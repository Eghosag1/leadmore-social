import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  MetaPublishingService,
  MetaRescheduleRequest,
  MetaSchedulingRequest,
  MetaSchedulingResult,
  MetaStatusCheckRequest,
  MetaStatusCheckResult,
} from "@/types/domain";

/**
 * Stands in for the real Meta Graph API. facebookPublishingService and
 * instagramPublishingService both currently delegate here; once real Meta
 * app credentials exist, each of those files calls the real endpoint instead
 * and this file can be deleted — nothing else in the app needs to change
 * because everything is written against the MetaPublishingService interface.
 */
export const mockMetaSchedulingService: MetaPublishingService = {
  async schedule(request: MetaSchedulingRequest): Promise<MetaSchedulingResult> {
    const supabase = await createClient();
    const { data: connection } = await supabase
      .from("social_connections")
      .select("status, facebook_page_id, instagram_account_id")
      .eq("agency_id", request.agencyId)
      .eq("provider", "meta")
      .maybeSingle();

    if (!connection || connection.status !== "connected") {
      return {
        ok: false,
        errorMessage: "Geen actieve Meta-koppeling voor dit kantoor. Vraag de platformbeheerder om deze in te stellen.",
      };
    }

    if (request.platform === "instagram" && !connection.instagram_account_id) {
      return { ok: false, errorMessage: "Geen Instagram-account gekoppeld aan deze Facebook-pagina." };
    }

    if (request.platform === "facebook" && !connection.facebook_page_id) {
      return { ok: false, errorMessage: "Geen Facebook-pagina gekoppeld aan dit kantoor." };
    }

    // Simulate Meta API latency + it assigning a scheduled post id.
    await new Promise((resolve) => setTimeout(resolve, 150));
    const prefix = request.platform === "facebook" ? "mock_fb" : "mock_ig";
    return { ok: true, metaObjectId: `${prefix}_${crypto.randomUUID().slice(0, 8)}` };
  },

  async reschedule(request: MetaRescheduleRequest): Promise<MetaSchedulingResult> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { ok: true, metaObjectId: request.metaObjectId };
  },

  // No real object to query (Instagram scheduling is still mocked — see
  // instagramPublishingService.ts) — simulate it having published the
  // moment its scheduled time passes, same as a real platform would.
  async checkPublishStatus(request: MetaStatusCheckRequest): Promise<MetaStatusCheckResult> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return { ok: true, published: Date.now() >= new Date(request.scheduledAt).getTime() };
  },
};
