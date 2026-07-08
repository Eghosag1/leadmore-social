import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface RenderSlideInput {
  postId: string;
  slideId: string;
  sourceImageUrl: string;
}

export interface RenderSlideResult {
  renderedImageUrl: string;
}

export interface RenderService {
  renderSlide(input: RenderSlideInput): Promise<RenderSlideResult>;
}

/**
 * Mock render backend. A real implementation would compose the template's
 * TemplateRenderProps into an actual branded image — e.g. server-side
 * `satori`/`@vercel/og`, or a headless-browser screenshot of the same React
 * template component used for the on-screen preview — and upload the result
 * to the `rendered-posts` Supabase Storage bucket, returning its public URL.
 *
 * For the MVP we skip real compositing and just echo the source photo back
 * as the "rendered" output, so the rest of the post pipeline (status flow,
 * storage, UI) can be built and tested against the final interface.
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
    .select("id, image_url")
    .eq("post_id", postId)
    .order("sort_order");

  if (error) throw new Error(error.message);

  for (const slide of slides ?? []) {
    const { renderedImageUrl } = await mockRenderService.renderSlide({
      postId,
      slideId: slide.id,
      sourceImageUrl: slide.image_url,
    });
    await supabase.from("post_slides").update({ rendered_image_url: renderedImageUrl }).eq("id", slide.id);
  }

  await supabase.from("posts").update({ status: "ready" }).eq("id", postId);
}
