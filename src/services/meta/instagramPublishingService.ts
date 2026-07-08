import "server-only";
import type { MetaPublishingService } from "@/types/domain";
import { mockMetaSchedulingService } from "./mockMetaSchedulingService";

/**
 * Placeholder for the real Instagram Graph API integration.
 *
 * Real implementation (future), roughly:
 *   1. Look up the IG business account id + Page access token from
 *      social_connections (obtained via metaAuthService's OAuth flow).
 *   2. Create a media container:
 *      POST /{ig-user-id}/media  { image_url, caption }
 *      For a carousel: create one container per image with is_carousel_item:
 *      true, then a parent container with media_type: CAROUSEL and children.
 *   3. Publish (or schedule, once Meta exposes scheduling for this endpoint —
 *      today the Graph API publishes immediately, so a real integration would
 *      need its own delayed job to call this at scheduled_at):
 *      POST /{ig-user-id}/media_publish { creation_id }
 *   4. Store the returned media id as post_jobs.meta_object_id.
 *
 * Until then this simply delegates to the mock scheduler so postSchedulerService
 * and the UI can be built against the final MetaPublishingService contract.
 */
export const instagramPublishingService: MetaPublishingService = mockMetaSchedulingService;
