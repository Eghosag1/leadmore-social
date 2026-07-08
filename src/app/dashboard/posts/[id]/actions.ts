"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelPost, reschedulePost } from "@/services/posts/postSchedulerService";
import { getPostDetailData, type PostDetailData } from "@/services/posts/postDetailService";
import { parseScheduledAt } from "@/lib/scheduled-time";

export interface UpdatePostState {
  error: string | null;
}

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
  if (!["draft", "ready", "scheduled"].includes(post.status)) {
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
