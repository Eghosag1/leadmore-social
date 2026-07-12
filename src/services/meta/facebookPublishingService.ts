import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/token-encryption";
import type {
  MetaPublishingService,
  MetaRescheduleRequest,
  MetaSchedulingRequest,
  MetaSchedulingResult,
  MetaStatusCheckRequest,
  MetaStatusCheckResult,
} from "@/types/domain";
import type { Database } from "@/types/database";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function getPageToken(
  agencyId: string,
  client?: SupabaseClient<Database>,
): Promise<{ facebookPageId: string; pageToken: string } | { error: string }> {
  const supabase = client ?? (await createClient());
  const { data: connection } = await supabase
    .from("social_connections")
    .select("facebook_page_id, access_token_encrypted, status")
    .eq("agency_id", agencyId)
    .eq("provider", "meta")
    .maybeSingle();

  if (!connection || connection.status !== "connected" || !connection.facebook_page_id || !connection.access_token_encrypted) {
    return { error: "Geen actieve Facebook-koppeling voor dit kantoor." };
  }

  try {
    return { facebookPageId: connection.facebook_page_id, pageToken: decryptToken(connection.access_token_encrypted) };
  } catch {
    // A malformed/corrupted token must fail just this one lookup, not throw
    // uncaught — callers like postSchedulerService.publishPost() loop over
    // multiple platforms/posts, and one bad token shouldn't abort the rest.
    return { error: "Het opgeslagen Facebook-token kon niet gelezen worden. Koppel opnieuw." };
  }
}

async function createScheduledPhotoPost(params: {
  facebookPageId: string;
  pageToken: string;
  imageUrl: string;
  caption: string;
  scheduledAt: string | null;
}): Promise<MetaSchedulingResult> {
  try {
    const body = new URLSearchParams({
      url: params.imageUrl,
      caption: params.caption,
      access_token: params.pageToken,
    });

    if (params.scheduledAt) {
      const publishTime = Math.floor(new Date(params.scheduledAt).getTime() / 1000);
      body.set("published", "false");
      body.set("scheduled_publish_time", String(publishTime));
    }

    const response = await fetch(`${GRAPH_BASE}/${params.facebookPageId}/photos`, {
      method: "POST",
      body,
    });
    const result = await response.json();

    if (!response.ok) {
      return { ok: false, errorMessage: result?.error?.message ?? `Facebook API-fout (${response.status})` };
    }

    return { ok: true, metaObjectId: result.post_id ?? result.id };
  } catch (error) {
    return { ok: false, errorMessage: error instanceof Error ? error.message : "Onbekende fout bij Facebook-publicatie." };
  }
}

/**
 * Real Facebook Graph API integration for single-image posts.
 *
 * Not yet in scope: carousel/multi-photo Facebook posts (would need
 * uploading each photo unpublished to get photo ids, then POST /{page-id}/feed
 * with attached_media: [{media_fbid}, ...]) — every post today publishes
 * imageUrls[0] only, which covers single posts and reuses the cover photo
 * for carousel posts exactly like the rest of the app already does.
 */
export const facebookPublishingService: MetaPublishingService = {
  async schedule(request: MetaSchedulingRequest, client?: SupabaseClient<Database>): Promise<MetaSchedulingResult> {
    const connection = await getPageToken(request.agencyId, client);
    if ("error" in connection) return { ok: false, errorMessage: connection.error };

    const imageUrl = request.imageUrls[0];
    if (!imageUrl) return { ok: false, errorMessage: "Geen foto om te posten." };

    return createScheduledPhotoPost({
      facebookPageId: connection.facebookPageId,
      pageToken: connection.pageToken,
      imageUrl,
      caption: request.caption,
      scheduledAt: request.scheduledAt,
    });
  },

  /**
   * Confirmed via manual testing: updating scheduled_publish_time in place
   * via POST /{post-id} fails with Graph API error #10 ("Application does
   * not have the capability to make this API call") — our app's access
   * level doesn't support editing a scheduled post's fields after creation.
   * Instead: delete the old scheduled post and create a fresh one, reusing
   * the exact code path that's already confirmed working for schedule().
   */
  async reschedule(request: MetaRescheduleRequest, client?: SupabaseClient<Database>): Promise<MetaSchedulingResult> {
    const connection = await getPageToken(request.agencyId, client);
    if ("error" in connection) return { ok: false, errorMessage: connection.error };

    const imageUrl = request.imageUrls[0];
    if (!imageUrl) return { ok: false, errorMessage: "Geen foto om te posten." };

    try {
      const deleteResponse = await fetch(`${GRAPH_BASE}/${request.metaObjectId}?access_token=${encodeURIComponent(connection.pageToken)}`, {
        method: "DELETE",
      });
      if (!deleteResponse.ok) {
        const deleteResult = await deleteResponse.json();
        return { ok: false, errorMessage: deleteResult?.error?.message ?? `Kon oude geplande post niet verwijderen (${deleteResponse.status})` };
      }
    } catch (error) {
      return { ok: false, errorMessage: error instanceof Error ? error.message : "Onbekende fout bij verwijderen van de oude post." };
    }

    return createScheduledPhotoPost({
      facebookPageId: connection.facebookPageId,
      pageToken: connection.pageToken,
      imageUrl,
      caption: request.caption,
      scheduledAt: request.scheduledAt,
    });
  },

  /**
   * Confirmed via manual testing: our scheduled objects are Photo nodes
   * (createScheduledPhotoPost falls back to result.id, since /photos never
   * returns a post_id for a not-yet-published scheduled upload) — querying
   * fields like is_published/scheduled_publish_time directly on that id
   * fails with "(#100) Tried accessing nonexisting field", including after
   * the post has actually published. The reliable signal instead: Facebook
   * lists every still-pending scheduled post under
   * GET /{page-id}/scheduled_posts and removes it from that list the moment
   * its own scheduler publishes it — so "no longer present there" means
   * published. See publishReconciliationService.ts for the read-time caller.
   */
  async checkPublishStatus(request: MetaStatusCheckRequest, client?: SupabaseClient<Database>): Promise<MetaStatusCheckResult> {
    const connection = await getPageToken(request.agencyId, client);
    if ("error" in connection) return { ok: false, errorMessage: connection.error };

    try {
      const response = await fetch(
        `${GRAPH_BASE}/${connection.facebookPageId}/scheduled_posts?access_token=${encodeURIComponent(connection.pageToken)}`,
      );
      const result = await response.json();

      if (!response.ok) {
        return { ok: false, errorMessage: result?.error?.message ?? `Facebook API-fout (${response.status})` };
      }

      const stillScheduled = ((result.data ?? []) as { id: string }[]).some(
        (item) => item.id === request.metaObjectId || item.id.endsWith(`_${request.metaObjectId}`),
      );
      return { ok: true, published: !stillScheduled };
    } catch (error) {
      return {
        ok: false,
        errorMessage: error instanceof Error ? error.message : "Onbekende fout bij het opvragen van de publicatiestatus.",
      };
    }
  },
};
