import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getInstagramToken, publishPhotoNow } from "@/services/meta/instagramPublishingService";

/**
 * The actual "make it happen" half of Instagram scheduling — called by
 * /api/internal/instagram-sweep, itself woken up by a QStash wake-up call
 * scheduled in instagramPublishingService.schedule()/reschedule(). Doesn't
 * care who invoked it or why: it just publishes whatever is currently due.
 * That's deliberate — it's what makes swapping the trigger (QStash today,
 * maybe a Vercel Pro cron later) a no-op for this function.
 *
 * Uses the admin client throughout — no user session exists when this runs.
 */
export async function publishDueInstagramPosts(): Promise<void> {
  const admin = createAdminClient();

  const { data: dueJobs } = await admin
    .from("post_jobs")
    .select("id, post_id")
    .eq("platform", "instagram")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString());

  for (const job of dueJobs ?? []) {
    try {
      await publishOneDueJob(admin, job);
    } catch (error) {
      // One job's unexpected failure (a bug, a transient network error, a
      // corrupted row) must not abort the rest of the batch — other
      // agencies' due posts still need to go out. Best-effort mark this one
      // failed and move on; if even that write fails, just log and continue.
      const message = error instanceof Error ? error.message : "Onbekende fout tijdens Instagram-sweep.";
      await admin.from("post_jobs").update({ status: "failed", error_message: message }).eq("id", job.id).select("id");
      console.error(`[instagram-sweep] job ${job.id} failed:`, error);
    }
  }
}

async function publishOneDueJob(
  admin: ReturnType<typeof createAdminClient>,
  job: { id: string; post_id: string },
): Promise<void> {
  // Conditional claim — if another sweep invocation (e.g. a retried QStash
  // delivery) already grabbed this job, this UPDATE matches zero rows and we
  // skip it, exactly like postQueueService.processPendingPost's guard.
  const { data: claimed } = await admin
    .from("post_jobs")
    .update({ status: "publishing" })
    .eq("id", job.id)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const { data: post } = await admin.from("posts").select("id, agency_id, caption").eq("id", job.post_id).maybeSingle();
  if (!post) {
    await admin.from("post_jobs").update({ status: "failed", error_message: "Post niet gevonden." }).eq("id", job.id);
    return;
  }

  const { data: slides } = await admin
    .from("post_slides")
    .select("image_url, rendered_image_url")
    .eq("post_id", post.id)
    .order("sort_order");
  const imageUrl = slides?.[0] ? (slides[0].rendered_image_url ?? slides[0].image_url) : undefined;
  if (!imageUrl) {
    await admin.from("post_jobs").update({ status: "failed", error_message: "Geen foto om te posten." }).eq("id", job.id);
    return;
  }

  const connection = await getInstagramToken(post.agency_id, admin);
  if ("error" in connection) {
    await admin.from("post_jobs").update({ status: "failed", error_message: connection.error }).eq("id", job.id);
    return;
  }

  const result = await publishPhotoNow({
    instagramAccountId: connection.instagramAccountId,
    pageToken: connection.pageToken,
    imageUrl,
    caption: post.caption,
  });

  await admin
    .from("post_jobs")
    .update({
      status: result.ok ? "published" : "failed",
      meta_object_id: result.metaObjectId ?? null,
      error_message: result.errorMessage ?? null,
    })
    .eq("id", job.id);

  await updatePostAggregateStatus(post.id);
}

/** Mirrors the aggregate rollup already used in publishPost()/retryPublish() — flips posts.status once every platform job has resolved. */
async function updatePostAggregateStatus(postId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: jobs } = await admin.from("post_jobs").select("status").eq("post_id", postId);
  if (!jobs || jobs.length === 0) return;

  if (jobs.every((j) => j.status === "published")) {
    await admin.from("posts").update({ status: "published" }).eq("id", postId);
  } else if (jobs.every((j) => j.status === "failed")) {
    await admin.from("posts").update({ status: "publish_failed" }).eq("id", postId);
  }
}
