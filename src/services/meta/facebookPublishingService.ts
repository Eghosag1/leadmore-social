import "server-only";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/token-encryption";
import type { MetaPublishingService, MetaRescheduleRequest, MetaSchedulingRequest, MetaSchedulingResult } from "@/types/domain";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function getPageToken(agencyId: string): Promise<{ facebookPageId: string; pageToken: string } | { error: string }> {
  const supabase = await createClient();
  const { data: connection } = await supabase
    .from("social_connections")
    .select("facebook_page_id, access_token_encrypted, status")
    .eq("agency_id", agencyId)
    .eq("provider", "meta")
    .maybeSingle();

  if (!connection || connection.status !== "connected" || !connection.facebook_page_id || !connection.access_token_encrypted) {
    return { error: "Geen actieve Facebook-koppeling voor dit kantoor." };
  }

  return { facebookPageId: connection.facebook_page_id, pageToken: decryptToken(connection.access_token_encrypted) };
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
  async schedule(request: MetaSchedulingRequest): Promise<MetaSchedulingResult> {
    const connection = await getPageToken(request.agencyId);
    if ("error" in connection) return { ok: false, errorMessage: connection.error };

    const imageUrl = request.imageUrls[0];
    if (!imageUrl) {
      return { ok: false, errorMessage: "Geen foto om te posten." };
    }

    try {
      const body = new URLSearchParams({
        url: imageUrl,
        caption: request.caption,
        access_token: connection.pageToken,
      });

      if (request.scheduledAt) {
        const publishTime = Math.floor(new Date(request.scheduledAt).getTime() / 1000);
        body.set("published", "false");
        body.set("scheduled_publish_time", String(publishTime));
      }

      const response = await fetch(`${GRAPH_BASE}/${connection.facebookPageId}/photos`, {
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
  },

  /**
   * Updates an already-scheduled (not yet published) Page post's caption and
   * scheduled_publish_time in place — Facebook supports this via a plain
   * POST to the post's own node ID, no need to delete/recreate it.
   */
  async reschedule(request: MetaRescheduleRequest): Promise<MetaSchedulingResult> {
    const connection = await getPageToken(request.agencyId);
    if ("error" in connection) return { ok: false, errorMessage: connection.error };

    try {
      const publishTime = Math.floor(new Date(request.scheduledAt).getTime() / 1000);
      const body = new URLSearchParams({
        message: request.caption,
        scheduled_publish_time: String(publishTime),
        access_token: connection.pageToken,
      });

      const response = await fetch(`${GRAPH_BASE}/${request.metaObjectId}`, {
        method: "POST",
        body,
      });
      const result = await response.json();

      if (!response.ok) {
        return { ok: false, errorMessage: result?.error?.message ?? `Facebook API-fout (${response.status})` };
      }

      return { ok: true, metaObjectId: request.metaObjectId };
    } catch (error) {
      return { ok: false, errorMessage: error instanceof Error ? error.message : "Onbekende fout bij herplannen op Facebook." };
    }
  },
};
