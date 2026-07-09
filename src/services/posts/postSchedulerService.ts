import "server-only";
import { createClient } from "@/lib/supabase/server";
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
  /** Persisted immediately, before rendering ever runs — see publishPost, which reads this back instead of taking it as a parameter (so a retry after a render failure doesn't need to re-collect it). */
  platforms: Platform[];
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
      platforms: input.platforms,
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

export interface PublishPostInput {
  postId: string;
  agencyId: string;
  scheduledAt: string;
  caption: string;
}

export interface PublishPostResult {
  ok: boolean;
  failedPlatforms: Platform[];
}

const PLATFORM_SERVICE = {
  facebook: facebookPublishingService,
  instagram: instagramPublishingService,
} as const;

/**
 * The publish half of the post flow — create one post_jobs row per platform
 * the post was created with (posts.platforms, not a parameter here, so a
 * retry after a render failure doesn't need to re-collect it) and hand each
 * off to its publishing service (mock today, real Meta Graph API later — see
 * facebookPublishingService / instagramPublishingService).
 *
 * Precondition: the post must already be `rendered` — call
 * renderPostForScheduling() (or the explicit "use original photo" override)
 * first. This function doesn't render anything itself.
 */
export async function publishPost(input: PublishPostInput): Promise<PublishPostResult> {
  const supabase = await createClient();

  const { data: post } = await supabase.from("posts").select("platforms").eq("id", input.postId).single();
  const platforms = post?.platforms ?? [];

  const { data: slides } = await supabase
    .from("post_slides")
    .select("image_url, rendered_image_url")
    .eq("post_id", input.postId)
    .order("sort_order");
  const imageUrls = (slides ?? []).map((s) => s.rendered_image_url ?? s.image_url);

  await supabase
    .from("posts")
    .update({ status: "scheduled", scheduled_at: input.scheduledAt })
    .eq("id", input.postId);

  const failedPlatforms: Platform[] = [];

  for (const platform of platforms) {
    const service = PLATFORM_SERVICE[platform];
    const result = await service.schedule({
      agencyId: input.agencyId,
      platform,
      caption: input.caption,
      imageUrls,
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

  if (platforms.length > 0 && failedPlatforms.length === platforms.length) {
    await supabase.from("posts").update({ status: "publish_failed" }).eq("id", input.postId);
  }

  return { ok: failedPlatforms.length === 0, failedPlatforms };
}

export async function cancelPost(postId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("posts").update({ status: "cancelled" }).eq("id", postId);
  await supabase.from("post_jobs").delete().eq("post_id", postId);
}

export interface ReschedulePostInput {
  postId: string;
  agencyId: string;
  caption: string;
  scheduledAt: string;
}

export interface ReschedulePostResult {
  ok: boolean;
  failedPlatforms: Platform[];
  errors: { platform: Platform; message: string }[];
}

/**
 * Pushes a caption/time change out to every platform the post was already
 * scheduled on — editing scheduled_at in our own DB alone doesn't move the
 * publish time Meta itself is holding. Only touches jobs that actually have
 * a meta_object_id (i.e. schedulePost() already ran for that platform);
 * still-draft posts have nothing on Meta's side to update yet.
 *
 * facebookPublishingService.reschedule() deletes the old scheduled post and
 * creates a fresh one (in-place field updates aren't permitted for our app —
 * see the comment there), so this always needs the source image(s) again and
 * must persist the *new* meta_object_id, not just the error state.
 */
export async function reschedulePost(input: ReschedulePostInput): Promise<ReschedulePostResult> {
  const supabase = await createClient();

  const [{ data: jobs }, { data: slides }] = await Promise.all([
    supabase.from("post_jobs").select("id, platform, meta_object_id").eq("post_id", input.postId),
    supabase.from("post_slides").select("image_url, rendered_image_url").eq("post_id", input.postId).order("sort_order"),
  ]);
  const imageUrls = (slides ?? []).map((s) => s.rendered_image_url ?? s.image_url);

  const failedPlatforms: Platform[] = [];
  const errors: { platform: Platform; message: string }[] = [];

  for (const job of jobs ?? []) {
    if (!job.meta_object_id) continue;

    const service = PLATFORM_SERVICE[job.platform];
    const result = await service.reschedule({
      agencyId: input.agencyId,
      platform: job.platform,
      metaObjectId: job.meta_object_id,
      caption: input.caption,
      scheduledAt: input.scheduledAt,
      imageUrls,
    });

    if (!result.ok) {
      failedPlatforms.push(job.platform);
      errors.push({ platform: job.platform, message: result.errorMessage ?? "Onbekende fout." });
      await supabase.from("post_jobs").update({ error_message: result.errorMessage ?? null }).eq("id", job.id);
    } else {
      await supabase
        .from("post_jobs")
        .update({ meta_object_id: result.metaObjectId ?? job.meta_object_id, error_message: null })
        .eq("id", job.id);
    }
  }

  return { ok: failedPlatforms.length === 0, failedPlatforms, errors };
}
