import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderPostForScheduling } from "@/services/render/renderService";
import { publishPost } from "@/services/posts/postSchedulerService";
import type { Database } from "@/types/database";

/**
 * Processes one `pending_render` post through render -> publish. Called by
 * both the fire-and-forget queue route
 * (src/app/api/internal/process-post-queue/route.ts, admin client, no user
 * session) and the lazy safety-net check in postDetailService.ts (session
 * client, in case the fire-and-forget request never landed) — same
 * "reconcile on read" idea as the stale-rendering check and the Meta
 * publish-status sync already in this codebase.
 *
 * Claims the post with a conditional status flip
 * (pending_render -> rendering, `.eq("status", "pending_render")`) so two
 * callers racing on the same post don't both process it — whichever loses
 * the race gets no rows back and returns immediately.
 */
export async function processPendingPost(postId: string, client: SupabaseClient<Database>): Promise<void> {
  const { data: claimed } = await client
    .from("posts")
    .update({ status: "rendering" })
    .eq("id", postId)
    .eq("status", "pending_render")
    .select("id, agency_id, caption, scheduled_at")
    .maybeSingle();
  if (!claimed) return;

  const renderResult = await renderPostForScheduling(postId, client);
  if (!renderResult.ok) return;

  await publishPost(
    {
      postId,
      agencyId: claimed.agency_id,
      scheduledAt: claimed.scheduled_at ?? new Date().toISOString(),
      caption: claimed.caption,
    },
    client,
  );
}
