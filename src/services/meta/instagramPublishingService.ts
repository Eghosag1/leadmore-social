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
 * Instagram fetches+processes image_url asynchronously after container
 * creation — publishing immediately after creating the container routinely
 * fails with "(#9004) Media ID is not available" because the container
 * isn't done processing yet (confirmed via a real test). Poll status_code
 * until it's FINISHED (or a terminal error) before calling media_publish.
 * Bounded to ~12s total so one slow container doesn't eat the sweep's
 * shared 60s Hobby-plan budget when there are other due jobs in the batch.
 */
async function waitForContainerReady(containerId: string, pageToken: string): Promise<{ ok: true } | { ok: false; errorMessage: string }> {
  const maxAttempts = 8;
  const delayMs = 1500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${encodeURIComponent(pageToken)}`);
    const result = await response.json();
    if (!response.ok) {
      return { ok: false, errorMessage: result?.error?.message ?? `Instagram API-fout (${response.status})` };
    }

    if (result.status_code === "FINISHED") return { ok: true };
    if (result.status_code === "ERROR" || result.status_code === "EXPIRED") {
      return { ok: false, errorMessage: `Instagram kon de afbeelding niet verwerken (status: ${result.status_code}).` };
    }
    // IN_PROGRESS (or PUBLISHED, unexpected here) — wait and check again.
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return { ok: false, errorMessage: "Instagram was de afbeelding nog aan het verwerken en werd niet op tijd klaar." };
}

/** Creates a single-image (non-carousel) media container. */
async function createImageContainer(params: {
  instagramAccountId: string;
  pageToken: string;
  imageUrl: string;
  caption?: string;
  isCarouselItem?: boolean;
}): Promise<{ id: string } | { error: string }> {
  const body = new URLSearchParams({
    image_url: params.imageUrl,
    access_token: params.pageToken,
  });
  if (params.caption) body.set("caption", params.caption);
  if (params.isCarouselItem) body.set("is_carousel_item", "true");

  const response = await fetch(`${GRAPH_BASE}/${params.instagramAccountId}/media`, { method: "POST", body });
  const result = await response.json();
  if (!response.ok) return { error: result?.error?.message ?? `Instagram API-fout (${response.status})` };
  return { id: result.id };
}

// Graph API error code for "(#9004) Media ID is not available" — thrown when
// media_publish is called before Meta's backend has actually finished
// registering the container, even though a prior status_code poll already
// reported FINISHED. Confirmed via a real carousel test (2026-07-14): the
// CAROUSEL parent container has no image of its own to process, so it
// reports FINISHED on the very first poll — status_code isn't a reliable
// publish-readiness signal for it. Same underlying race the single-image
// path already documented, just not fully closed by the pre-publish poll —
// retrying the publish call itself on this specific code is the robust fix.
const MEDIA_ID_NOT_AVAILABLE_CODE = 9004;
const PUBLISH_RETRY_ATTEMPTS = 4;
const PUBLISH_RETRY_DELAY_MS = 2000;

async function publishContainer(params: { instagramAccountId: string; pageToken: string; creationId: string }): Promise<MetaSchedulingResult> {
  for (let attempt = 1; attempt <= PUBLISH_RETRY_ATTEMPTS; attempt++) {
    const publishResponse = await fetch(`${GRAPH_BASE}/${params.instagramAccountId}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({
        creation_id: params.creationId,
        access_token: params.pageToken,
      }),
    });
    const published = await publishResponse.json();
    if (publishResponse.ok) return { ok: true, metaObjectId: published.id };

    const isRetryable = published?.error?.code === MEDIA_ID_NOT_AVAILABLE_CODE && attempt < PUBLISH_RETRY_ATTEMPTS;
    if (!isRetryable) {
      return { ok: false, errorMessage: published?.error?.message ?? `Instagram API-fout (${publishResponse.status})` };
    }
    await new Promise((resolve) => setTimeout(resolve, PUBLISH_RETRY_DELAY_MS));
  }
  // Unreachable — the loop always returns on its last attempt.
  return { ok: false, errorMessage: "Instagram media_publish is onverwacht mislukt." };
}

/**
 * Real Instagram publish: create a media container, then publish it. Used
 * both for an immediate (scheduledAt already due) post and by
 * instagramSchedulerSweepService.ts once a scheduled post's time comes.
 *
 * A single image reuses the plain container->publish path. Multiple images
 * become a carousel: each image becomes its own is_carousel_item container
 * (created and polled in parallel — important for the sweep's shared 60s
 * Hobby-plan budget, sequential polling could blow that with 4+ photos),
 * then one parent CAROUSEL container referencing all of them via `children`,
 * itself polled too, and only then published.
 */
export async function publishPhotoNow(params: {
  instagramAccountId: string;
  pageToken: string;
  imageUrls: string[];
  caption: string;
}): Promise<MetaSchedulingResult> {
  try {
    if (params.imageUrls.length <= 1) {
      const container = await createImageContainer({
        instagramAccountId: params.instagramAccountId,
        pageToken: params.pageToken,
        imageUrl: params.imageUrls[0],
        caption: params.caption,
      });
      if ("error" in container) return { ok: false, errorMessage: container.error };

      const ready = await waitForContainerReady(container.id, params.pageToken);
      if (!ready.ok) return { ok: false, errorMessage: ready.errorMessage };

      return publishContainer({ instagramAccountId: params.instagramAccountId, pageToken: params.pageToken, creationId: container.id });
    }

    const itemContainers = await Promise.all(
      params.imageUrls.map((imageUrl) =>
        createImageContainer({ instagramAccountId: params.instagramAccountId, pageToken: params.pageToken, imageUrl, isCarouselItem: true }),
      ),
    );
    const failedItem = itemContainers.find((item) => "error" in item) as { error: string } | undefined;
    if (failedItem) return { ok: false, errorMessage: failedItem.error };
    const itemIds = itemContainers.map((item) => (item as { id: string }).id);

    const itemReadyResults = await Promise.all(itemIds.map((id) => waitForContainerReady(id, params.pageToken)));
    const failedReady = itemReadyResults.find((result) => !result.ok) as { ok: false; errorMessage: string } | undefined;
    if (failedReady) return { ok: false, errorMessage: failedReady.errorMessage };

    const carouselBody = new URLSearchParams({
      media_type: "CAROUSEL",
      children: itemIds.join(","),
      caption: params.caption,
      access_token: params.pageToken,
    });
    const carouselResponse = await fetch(`${GRAPH_BASE}/${params.instagramAccountId}/media`, { method: "POST", body: carouselBody });
    const carousel = await carouselResponse.json();
    if (!carouselResponse.ok) {
      return { ok: false, errorMessage: carousel?.error?.message ?? `Instagram API-fout (${carouselResponse.status})` };
    }

    const carouselReady = await waitForContainerReady(carousel.id, params.pageToken);
    if (!carouselReady.ok) return { ok: false, errorMessage: carouselReady.errorMessage };

    return publishContainer({ instagramAccountId: params.instagramAccountId, pageToken: params.pageToken, creationId: carousel.id });
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
 */
export const instagramPublishingService: MetaPublishingService = {
  async schedule(request: MetaSchedulingRequest, client?: SupabaseClient<Database>): Promise<MetaSchedulingResult> {
    const connection = await getInstagramToken(request.agencyId, client);
    if ("error" in connection) return { ok: false, errorMessage: connection.error };

    if (request.imageUrls.length === 0) return { ok: false, errorMessage: "Geen foto om te posten." };

    // In practice always a future timestamp (parseScheduledAt rejects past
    // dates at post-creation time) — handled anyway for interface honesty.
    if (!request.scheduledAt || new Date(request.scheduledAt).getTime() <= Date.now()) {
      return publishPhotoNow({
        instagramAccountId: connection.instagramAccountId,
        pageToken: connection.pageToken,
        imageUrls: request.imageUrls,
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
