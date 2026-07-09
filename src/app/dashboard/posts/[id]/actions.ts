"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelPost, publishPost, reschedulePost } from "@/services/posts/postSchedulerService";
import { renderPostForScheduling } from "@/services/render/renderService";
import { getPostDetailData, type PostDetailData } from "@/services/posts/postDetailService";
import { parseScheduledAt } from "@/lib/scheduled-time";

export interface UpdatePostState {
  error: string | null;
}

/** Statuses where the post exists but hasn't reached a terminal or actively-processing state — see PostDetailClient.tsx's canEdit for the UI-side mirror of this. */
const EDITABLE_STATUSES = ["draft", "ready", "rendered", "scheduled", "render_failed", "publish_failed"];

/** Lightweight edit: caption + reschedule. Re-picking template/photo isn't supported here — that's effectively a new post. */
export async function updatePostAction(postId: string, _prev: UpdatePostState, formData: FormData): Promise<UpdatePostState> {
  const current = await requireRole(["agency_admin", "agency_user"]);
  const agencyId = current.profile.agency_id!;

  const caption = String(formData.get("caption") ?? "").trim();
  const scheduledDate = String(formData.get("scheduledDate") ?? "");
  const scheduledTime = String(formData.get("scheduledTime") ?? "");

  if (!caption) return { error: "Het bijschrift mag niet leeg zijn." };
  if (!scheduledDate || !scheduledTime) return { error: "Kies een datum en uur." };

  const scheduledAt = parseScheduledAt(scheduledDate, scheduledTime);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
    return { error: "Kies een datum en uur in de toekomst." };
  }

  const supabase = await createClient();

  const { data: post } = await supabase.from("posts").select("id, status").eq("id", postId).eq("agency_id", agencyId).maybeSingle();
  if (!post) return { error: "Post niet gevonden." };
  if (!EDITABLE_STATUSES.includes(post.status)) {
    return { error: "Deze post kan niet meer bewerkt worden." };
  }

  // Push the new caption/time to Meta first — if a platform already has a
  // scheduled post there, our own DB shouldn't claim success unless that
  // actually got updated too.
  const rescheduleResult = await reschedulePost({
    postId,
    agencyId,
    caption,
    scheduledAt: scheduledAt.toISOString(),
  });
  if (!rescheduleResult.ok) {
    const details = rescheduleResult.errors.map((e) => `${e.platform}: ${e.message}`).join(" — ");
    return { error: `Bijwerken bij Meta mislukt. De post is niet gewijzigd. (${details})` };
  }

  const { error: postError } = await supabase
    .from("posts")
    .update({ caption, scheduled_at: scheduledAt.toISOString() })
    .eq("id", postId);
  if (postError) return { error: postError.message };

  await supabase.from("post_jobs").update({ scheduled_at: scheduledAt.toISOString() }).eq("post_id", postId);

  revalidatePath(`/dashboard/posts/${postId}`);
  revalidatePath("/dashboard/scheduled");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function cancelPostAction(postId: string): Promise<void> {
  const current = await requireRole(["agency_admin", "agency_user"]);
  const agencyId = current.profile.agency_id!;
  const supabase = await createClient();

  const { data: post } = await supabase.from("posts").select("id").eq("id", postId).eq("agency_id", agencyId).maybeSingle();
  if (!post) return;

  await cancelPost(postId);

  revalidatePath("/dashboard/scheduled");
  revalidatePath("/dashboard");
  redirect("/dashboard/scheduled");
}

/** Same as cancelPostAction but without the redirect — used by the calendar quick-view sheet, which stays on /dashboard. */
export async function cancelPostQuickAction(postId: string): Promise<void> {
  const current = await requireRole(["agency_admin", "agency_user"]);
  const agencyId = current.profile.agency_id!;
  const supabase = await createClient();

  const { data: post } = await supabase.from("posts").select("id").eq("id", postId).eq("agency_id", agencyId).maybeSingle();
  if (!post) return;

  await cancelPost(postId);

  revalidatePath(`/dashboard/posts/${postId}`);
  revalidatePath("/dashboard/scheduled");
  revalidatePath("/dashboard");
}

/** Fetches everything the calendar quick-view sheet needs for one post, without navigating away from /dashboard. */
export async function getPostQuickViewAction(postId: string): Promise<PostDetailData | null> {
  const current = await requireRole(["agency_admin", "agency_user"]);
  const agencyId = current.profile.agency_id!;
  return getPostDetailData(postId, agencyId);
}

export interface RenderRecoveryResult {
  ok: boolean;
  error?: string;
}

/**
 * Re-runs the render step for a render_failed post; if it now succeeds,
 * immediately continues to publishing — the original intent behind creating
 * the post was always "render and schedule", so a successful retry
 * shouldn't leave the user with a second button to press.
 */
export async function retryRenderAction(postId: string): Promise<RenderRecoveryResult> {
  const current = await requireRole(["agency_admin", "agency_user"]);
  const agencyId = current.profile.agency_id!;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("id, caption, scheduled_at")
    .eq("id", postId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!post) return { ok: false, error: "Post niet gevonden." };

  const renderResult = await renderPostForScheduling(postId);
  if (!renderResult.ok) {
    revalidatePath(`/dashboard/posts/${postId}`);
    return { ok: false, error: renderResult.error };
  }

  const publishResult = await publishPost({
    postId,
    agencyId,
    scheduledAt: post.scheduled_at ?? new Date().toISOString(),
    caption: post.caption,
  });

  revalidatePath(`/dashboard/posts/${postId}`);
  revalidatePath("/dashboard/scheduled");
  revalidatePath("/dashboard");
  return publishResult.ok ? { ok: true } : { ok: false, error: "Renderen lukte, maar inplannen bij Meta mislukte alsnog." };
}

/**
 * Explicit, user-chosen escape hatch for a render_failed post: publish the
 * unbranded source photo as-is rather than keep retrying. Marks every
 * templated slide as render_overridden so the UI can show this as a
 * deliberate choice afterwards, not an unresolved problem.
 */
export async function useOriginalPhotoAction(postId: string): Promise<RenderRecoveryResult> {
  const current = await requireRole(["agency_admin", "agency_user"]);
  const agencyId = current.profile.agency_id!;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts")
    .select("id, caption, scheduled_at")
    .eq("id", postId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!post) return { ok: false, error: "Post niet gevonden." };

  const { data: slides } = await supabase.from("post_slides").select("id, image_url").eq("post_id", postId);
  for (const slide of slides ?? []) {
    await supabase
      .from("post_slides")
      .update({ rendered_image_url: slide.image_url, render_overridden: true })
      .eq("id", slide.id);
  }

  await supabase.from("posts").update({ status: "rendered", render_error: null }).eq("id", postId);

  const publishResult = await publishPost({
    postId,
    agencyId,
    scheduledAt: post.scheduled_at ?? new Date().toISOString(),
    caption: post.caption,
  });

  revalidatePath(`/dashboard/posts/${postId}`);
  revalidatePath("/dashboard/scheduled");
  revalidatePath("/dashboard");
  return publishResult.ok ? { ok: true } : { ok: false, error: "Inplannen bij Meta mislukte." };
}
