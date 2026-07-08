import "server-only";
import { createClient } from "@/lib/supabase/server";
import { renderPost } from "@/services/render/renderService";
import { facebookPublishingService } from "@/services/meta/facebookPublishingService";
import { instagramPublishingService } from "@/services/meta/instagramPublishingService";
import type { Platform, PostType } from "@/types/enums";

export interface CreatePostSlideInput {
  imageUrl: string;
  textContent: Record<string, unknown>;
}

export interface CreatePostInput {
  agencyId: string;
  propertyId: string;
  /** Null for "eigen foto's" posts created without an admin-authored template. */
  agencyTemplateId: string | null;
  postType: PostType;
  caption: string;
  createdBy: string;
  slides: CreatePostSlideInput[];
}

/** Step 10 of the post flow: "App maakt post aan" (status starts as draft). */
export async function createPost(input: CreatePostInput): Promise<{ postId: string }> {
  const supabase = await createClient();

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      agency_id: input.agencyId,
      property_id: input.propertyId,
      agency_template_id: input.agencyTemplateId,
      post_type: input.postType,
      caption: input.caption,
      status: "draft",
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (error || !post) throw new Error(error?.message ?? "Kon post niet aanmaken.");

  if (input.slides.length > 0) {
    const { error: slidesError } = await supabase.from("post_slides").insert(
      input.slides.map((slide, index) => ({
        post_id: post.id,
        sort_order: index,
        image_url: slide.imageUrl,
        text_content: slide.textContent,
      })),
    );
    if (slidesError) throw new Error(slidesError.message);
  }

  return { postId: post.id };
}

export interface SchedulePostInput {
  postId: string;
  agencyId: string;
  platforms: Platform[];
  scheduledAt: string;
  caption: string;
  imageUrls: string[];
}

export interface SchedulePostResult {
  ok: boolean;
  failedPlatforms: Platform[];
}

const PLATFORM_SERVICE = {
  facebook: facebookPublishingService,
  instagram: instagramPublishingService,
} as const;

/**
 * Steps 10-12 of the post flow: render the post, create one post_jobs row per
 * chosen platform, and hand each off to its publishing service (mock today,
 * real Meta Graph API later — see facebookPublishingService /
 * instagramPublishingService). Status flow: draft -> rendering -> ready ->
 * scheduled (or failed if every platform failed to schedule).
 */
export async function schedulePost(input: SchedulePostInput): Promise<SchedulePostResult> {
  const supabase = await createClient();

  await renderPost(input.postId);

  await supabase
    .from("posts")
    .update({ status: "scheduled", scheduled_at: input.scheduledAt })
    .eq("id", input.postId);

  const failedPlatforms: Platform[] = [];

  for (const platform of input.platforms) {
    const service = PLATFORM_SERVICE[platform];
    const result = await service.schedule({
      agencyId: input.agencyId,
      platform,
      caption: input.caption,
      imageUrls: input.imageUrls,
      scheduledAt: input.scheduledAt,
    });

    const { error: jobError } = await supabase.from("post_jobs").insert({
      post_id: input.postId,
      platform,
      status: result.ok ? "scheduled" : "failed",
      scheduled_at: input.scheduledAt,
      meta_object_id: result.metaObjectId ?? null,
      error_message: result.errorMessage ?? null,
    });
    if (jobError) throw new Error(jobError.message);

    if (!result.ok) failedPlatforms.push(platform);
  }

  if (input.platforms.length > 0 && failedPlatforms.length === input.platforms.length) {
    await supabase.from("posts").update({ status: "failed" }).eq("id", input.postId);
  }

  return { ok: failedPlatforms.length === 0, failedPlatforms };
}

export async function cancelPost(postId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("posts").update({ status: "cancelled" }).eq("id", postId);
  await supabase.from("post_jobs").delete().eq("post_id", postId);
}
