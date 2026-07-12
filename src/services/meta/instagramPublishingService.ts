import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/token-encryption";
import { scheduleInstagramSweep } from "@/lib/qstash";
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

export async function getInstagramToken(
  agencyId: string,
  client?: SupabaseClient<Database>,
): Promise<{ instagramAccountId: string; pageToken: string } | { error: string }> {
  const supabase = client ?? (await createClient());
  const { data: connection } = await supabase
    .from("social_connections")
    .select("instagram_account_id, access_token_encrypted, status")
    .eq("agency_id", agencyId)
    .eq("provider", "meta")
    .maybeSingle();

  if (!connection || connection.status !== "connected" || !connection.instagram_account_id || !connection.access_token_encrypted) {
    return { error: "Geen actief Instagram-account gekoppeld aan dit kantoor." };
  }

  try {
    return { instagramAccountId: connection.instagram_account_id, pageToken: decryptToken(connection.access_token_encrypted) };
  } catch {
    // A malformed/corrupted token must fail just this one lookup, not throw
    // uncaught — instagramSchedulerSweepService.ts processes many agencies'
    // due jobs in one sweep, and one bad token shouldn't abort the batch.
    return { error: "Het opgeslagen Instagram-token kon niet gelezen worden. Koppel opnieuw." };
  }
}

/**
 * Real two-step Instagram publish: create a media container, then publish
 * it. Used both for an immediate (scheduledAt already due) post and by
 * instagramSchedulerSweepService.ts once a scheduled post's time comes.
 */
export async function publishPhotoNow(params: {
  instagramAccountId: string;
  pageToken: string;
  imageUrl: string;
  caption: string;
}): Promise<MetaSchedulingResult> {
  try {
    const containerResponse = await fetch(`${GRAPH_BASE}/${params.instagramAccountId}/media`, {
      method: "POST",
      body: new URLSearchParams({
        image_url: params.imageUrl,
        caption: params.caption,
        access_token: params.pageToken,
      }),
    });
    const container = await containerResponse.json();
    if (!containerResponse.ok) {
      return { ok: false, errorMessage: container?.error?.message ?? `Instagram API-fout (${containerResponse.status})` };
    }

    const publishResponse = await fetch(`${GRAPH_BASE}/${params.instagramAccountId}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({
        creation_id: container.id,
        access_token: params.pageToken,
      }),
    });
    const published = await publishResponse.json();
    if (!publishResponse.ok) {
      return { ok: false, errorMessage: published?.error?.message ?? `Instagram API-fout (${publishResponse.status})` };
    }

    return { ok: true, metaObjectId: published.id };
  } catch (error) {
    return { ok: false, errorMessage: error instanceof Error ? error.message : "Onbekende fout bij Instagram-publicatie." };
  }
}

/**
 * Real Instagram Graph API integration for single-image posts.
 *
 * Unlike Facebook, Instagram's Content Publishing API has no scheduled-
 * publish equivalent — media_publish always publishes immediately. So
 * schedule() below does NOT call the Graph API at all when scheduledAt is in
 * the future: it just validates the connection and schedules a QStash
 * wake-up call (src/lib/qstash.ts) for that time. The actual container
 * creation + publish happens later, when /api/internal/instagram-sweep fires
 * — see instagramSchedulerSweepService.ts. post_jobs.meta_object_id stays
 * null until that real publish happens, which is also what
 * publishReconciliationService.ts's checkableJobs filter relies on (a null
 * meta_object_id means "not actually published yet, nothing to check").
 *
 * Not yet in scope: carousel/multi-photo posts — mirrors the same limitation
 * facebookPublishingService.ts already has (imageUrls[0] only).
 */
export const instagramPublishingService: MetaPublishingService = {
  async schedule(request: MetaSchedulingRequest, client?: SupabaseClient<Database>): Promise<MetaSchedulingResult> {
    const connection = await getInstagramToken(request.agencyId, client);
    if ("error" in connection) return { ok: false, errorMessage: connection.error };

    const imageUrl = request.imageUrls[0];
    if (!imageUrl) return { ok: false, errorMessage: "Geen foto om te posten." };

    // In practice always a future timestamp (parseScheduledAt rejects past
    // dates at post-creation time) — handled anyway for interface honesty.
    if (!request.scheduledAt || new Date(request.scheduledAt).getTime() <= Date.now()) {
      return publishPhotoNow({
        instagramAccountId: connection.instagramAccountId,
        pageToken: connection.pageToken,
        imageUrl,
        caption: request.caption,
      });
    }

    try {
      await scheduleInstagramSweep(new Date(request.scheduledAt));
    } catch (error) {
      return { ok: false, errorMessage: error instanceof Error ? error.message : "Kon de Instagram-post niet inplannen." };
    }

    return { ok: true };
  },

  /**
   * A not-yet-published job (meta_object_id still null) has nothing on
   * Meta's side to move yet — just reschedules the QStash wake-up for the
   * new time. postSchedulerService.reschedulePost() knows to call this for
   * such jobs too, not only ones with a meta_object_id like Facebook needs —
   * see the comment there for why that distinction matters for Instagram.
   */
  async reschedule(request: MetaRescheduleRequest, client?: SupabaseClient<Database>): Promise<MetaSchedulingResult> {
    void client;
    if (!request.metaObjectId) {
      try {
        await scheduleInstagramSweep(new Date(request.scheduledAt));
        return { ok: true };
      } catch (error) {
        return { ok: false, errorMessage: error instanceof Error ? error.message : "Kon de Instagram-post niet herplannen." };
      }
    }

    // Already published (real meta_object_id present) — Instagram has no
    // post-hoc edit for publish time, and nothing should call reschedule()
    // on an already-published job in practice (posts.status wouldn't be
    // editable anymore by then). Echo back unchanged rather than erroring.
    return { ok: true, metaObjectId: request.metaObjectId };
  },

  /**
   * No Meta-side check needed — instagramSchedulerSweepService.ts is itself
   * the source of truth (it's what actually publishes), so post_jobs.status
   * is already authoritative by the time meta_object_id is set. This just
   * reflects that back, for interface consistency with
   * facebookPublishingService's checkPublishStatus (which genuinely does
   * need to ask Meta, since Facebook's own scheduler publishes async).
   */
  async checkPublishStatus(request: MetaStatusCheckRequest, client?: SupabaseClient<Database>): Promise<MetaStatusCheckResult> {
    const supabase = client ?? (await createClient());
    const { data: job } = await supabase
      .from("post_jobs")
      .select("status")
      .eq("meta_object_id", request.metaObjectId)
      .eq("platform", "instagram")
      .maybeSingle();
    return { ok: true, published: job?.status === "published" };
  },
};
