import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { facebookPublishingService } from "@/services/meta/facebookPublishingService";
import { instagramPublishingService } from "@/services/meta/instagramPublishingService";
import type { Platform } from "@/types/enums";

const PLATFORM_SERVICE = {
  facebook: facebookPublishingService,
  instagram: instagramPublishingService,
} as const;

/**
 * No webhook exists to tell us Meta actually published a scheduled post, so
 * posts.status stays 'scheduled' forever otherwise — reconcile lazily
 * instead, the moment anyone looks at these posts (mirrors the stale
 * 'rendering' reconciliation in postDetailService.ts).
 *
 * Uses the service-role client because flipping post_jobs.status is
 * service-role-only by RLS (mirrors a real Meta webhook, not a user
 * action — see post_jobs_update in 0001_init.sql).
 */
export async function reconcilePublishedPosts(postIds: string[]): Promise<void> {
  if (postIds.length === 0) return;
  const supabase = createAdminClient();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, agency_id, scheduled_at")
    .in("id", postIds)
    .eq("status", "scheduled")
    .not("scheduled_at", "is", null)
    .lt("scheduled_at", new Date().toISOString());
  if (!posts || posts.length === 0) return;

  const { data: jobs } = await supabase
    .from("post_jobs")
    .select("id, post_id, platform, meta_object_id, scheduled_at")
    .in(
      "post_id",
      posts.map((p) => p.id),
    )
    .eq("status", "scheduled");

  const jobsByPost = new Map<string, NonNullable<typeof jobs>>();
  for (const job of jobs ?? []) {
    jobsByPost.set(job.post_id, [...(jobsByPost.get(job.post_id) ?? []), job]);
  }

  for (const post of posts) {
    const postJobs = jobsByPost.get(post.id) ?? [];
    const checkableJobs = postJobs.filter((job) => job.meta_object_id);
    // Jobs that never got a meta_object_id (schedule() failed for that
    // platform) can't be confirmed and shouldn't block the ones that can —
    // but they also mean this post can never be fully 'published' via this
    // path; that's an existing publish_failed-style gap, not this fix's job.
    if (checkableJobs.length === 0) continue;

    let allChecked = true;
    for (const job of checkableJobs) {
      const service = PLATFORM_SERVICE[job.platform as Platform];
      const result = await service.checkPublishStatus(
        {
          agencyId: post.agency_id,
          platform: job.platform as Platform,
          metaObjectId: job.meta_object_id!,
          scheduledAt: job.scheduled_at ?? post.scheduled_at!,
        },
        supabase,
      );

      if (!result.ok || !result.published) {
        allChecked = false;
        continue;
      }
      await supabase.from("post_jobs").update({ status: "published" }).eq("id", job.id);
    }

    if (allChecked && checkableJobs.length === postJobs.length) {
      await supabase.from("posts").update({ status: "published" }).eq("id", post.id);
    }
  }
}
