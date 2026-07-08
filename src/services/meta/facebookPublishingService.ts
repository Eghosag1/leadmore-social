import "server-only";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/token-encryption";
import type { MetaPublishingService, MetaSchedulingRequest, MetaSchedulingResult } from "@/types/domain";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

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
    const supabase = await createClient();
    const { data: connection } = await supabase
      .from("social_connections")
      .select("facebook_page_id, access_token_encrypted, status")
      .eq("agency_id", request.agencyId)
      .eq("provider", "meta")
      .maybeSingle();

    if (!connection || connection.status !== "connected" || !connection.facebook_page_id || !connection.access_token_encrypted) {
      return { ok: false, errorMessage: "Geen actieve Facebook-koppeling voor dit kantoor." };
    }

    const imageUrl = request.imageUrls[0];
    if (!imageUrl) {
      return { ok: false, errorMessage: "Geen foto om te posten." };
    }

    try {
      const pageToken = decryptToken(connection.access_token_encrypted);
      const body = new URLSearchParams({
        url: imageUrl,
        caption: request.caption,
        access_token: pageToken,
      });

      if (request.scheduledAt) {
        const publishTime = Math.floor(new Date(request.scheduledAt).getTime() / 1000);
        body.set("published", "false");
        body.set("scheduled_publish_time", String(publishTime));
      }

      const response = await fetch(`${GRAPH_BASE}/${connection.facebook_page_id}/photos`, {
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
};
