import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { browserRenderService } from "./browserRenderService";
import { notifyPostFailure } from "@/services/notifications/postFailureNotificationService";
import type { Database } from "@/types/database";

export interface RenderSlideInput {
  postId: string;
  slideId: string;
  sourceImageUrl: string;
  slideIndex: number;
}

export interface RenderSlideResult {
  renderedImageUrl: string;
}

export interface RenderService {
  renderSlide(input: RenderSlideInput): Promise<RenderSlideResult>;
}

/**
 * Mock render backend — kept around for local development on machines
 * without a working headless-Chromium setup, or as an easy way to bypass
 * rendering entirely. Not wired in by default; see browserRenderService.ts
 * for the real implementation renderPost() below actually uses.
 */
export const mockRenderService: RenderService = {
  async renderSlide({ sourceImageUrl }) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { renderedImageUrl: sourceImageUrl };
  },
};

export interface RenderPostResult {
  ok: boolean;
  error?: string;
}

/**
 * Drives a post through rendering -> rendered | render_failed.
 *
 * Fail-fast: if any slide's render throws, the whole post is render_failed —
 * a carousel with some branded and some unbranded slides would be worse than
 * a clear, complete failure the user can retry or explicitly override (see
 * useOriginalPhotoAction).
 *
 * `client` is optional — omit it for the normal session-scoped call sites
 * (retryRenderAction, useOriginalPhotoAction). The background queue route
 * (src/app/api/internal/process-post-queue/route.ts) has no user session, so
 * it passes an explicit admin client instead — see postQueueService.ts.
 */
export async function renderPostForScheduling(postId: string, client?: SupabaseClient<Database>): Promise<RenderPostResult> {
  const supabase = client ?? (await createClient());

  await supabase.from("posts").update({ status: "rendering" }).eq("id", postId);

  const { data: slides, error } = await supabase
    .from("post_slides")
    .select("id, image_url, sort_order")
    .eq("post_id", postId)
    .order("sort_order");

  if (error) throw new Error(error.message);

  try {
    // Rendered in parallel, not sequentially — each slide launches its own
    // headless Chromium instance (see browserRenderService), and this all runs
    // inside one serverless function with a finite maxDuration. Awaiting one
    // slide at a time would multiply the per-slide worst-case time by the
    // carousel's slide count; running them concurrently bounds the total time
    // to the single slowest slide instead.
    await Promise.all(
      (slides ?? []).map(async (slide) => {
        const { renderedImageUrl } = await browserRenderService.renderSlide({
          postId,
          slideId: slide.id,
          sourceImageUrl: slide.image_url,
          slideIndex: slide.sort_order,
        });
        await supabase.from("post_slides").update({ rendered_image_url: renderedImageUrl }).eq("id", slide.id);
      }),
    );
  } catch (renderError) {
    const message = (renderError as Error).message;
    await supabase.from("posts").update({ status: "render_failed", render_error: message }).eq("id", postId);
    await notifyPostFailure(postId, "render", message);
    return { ok: false, error: message };
  }

  await supabase.from("posts").update({ status: "rendered", render_error: null }).eq("id", postId);
  return { ok: true };
}
