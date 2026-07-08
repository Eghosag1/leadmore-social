import "server-only";
import { createClient } from "@/lib/supabase/server";
import { browserRenderService } from "./browserRenderService";

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

/** Drives a post through draft -> rendering -> ready, rendering every slide. */
export async function renderPost(postId: string): Promise<void> {
  const supabase = await createClient();

  await supabase.from("posts").update({ status: "rendering" }).eq("id", postId);

  const { data: slides, error } = await supabase
    .from("post_slides")
    .select("id, image_url, sort_order")
    .eq("post_id", postId)
    .order("sort_order");

  if (error) throw new Error(error.message);

  for (const slide of slides ?? []) {
    const { renderedImageUrl } = await browserRenderService.renderSlide({
      postId,
      slideId: slide.id,
      sourceImageUrl: slide.image_url,
      slideIndex: slide.sort_order,
    });
    await supabase.from("post_slides").update({ rendered_image_url: renderedImageUrl }).eq("id", slide.id);
  }

  await supabase.from("posts").update({ status: "ready" }).eq("id", postId);
}
