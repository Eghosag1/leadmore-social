import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { signRenderToken } from "@/lib/render/token";
import { screenshotCanvas } from "@/lib/render/screenshotCanvas";
import { getSlideRenderData } from "@/services/render/renderDataService";
import type { RenderService, RenderSlideInput, RenderSlideResult } from "./renderService";

function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Real render backend: screenshots the internal render-slide page's canvas
 * element (which shows the exact same DynamicTemplateRenderer output as the
 * live preview, with server-compiled Tailwind CSS for the template's actual
 * classNames — see compile-tailwind.ts) with a headless Chromium instance
 * (screenshotCanvas, shared with templateValidationService), and uploads the
 * result to the `rendered-posts` Storage bucket.
 *
 * Reliability: up to 2 attempts with backoff, and if every attempt still
 * fails, falls back to the untouched source photo instead of throwing — a
 * broken render must never block scheduling a post. Callers can tell a
 * fallback happened because renderedImageUrl will equal sourceImageUrl for a
 * slide that does have a template (see the warning banner on the post
 * detail page).
 */
export const browserRenderService: RenderService = {
  async renderSlide(input: RenderSlideInput): Promise<RenderSlideResult> {
    const data = await getSlideRenderData(input.postId);
    if (!data || !data.componentSource) {
      // No template (or post not found) — nothing to overlay, the source photo is already the final visual.
      return { renderedImageUrl: input.sourceImageUrl };
    }

    const token = signRenderToken(input.postId);
    const url = `${siteUrl()}/internal/render-slide/${input.postId}/${input.slideIndex}?token=${token}`;
    const context = `post ${input.postId} slide ${input.slideIndex}`;

    try {
      const buffer = await screenshotCanvas(url, context);
      const admin = createAdminClient();
      const path = `${input.postId}/${input.slideId}.png`;
      const { error: uploadError } = await admin.storage.from("rendered-posts").upload(path, buffer, {
        contentType: "image/png",
        upsert: true,
      });
      if (uploadError) throw new Error(uploadError.message);

      const { data: publicUrl } = admin.storage.from("rendered-posts").getPublicUrl(path);
      return { renderedImageUrl: publicUrl.publicUrl };
    } catch (error) {
      console.error(`[browserRenderService] Render failed for ${context}, falling back to source photo:`, error);
      return { renderedImageUrl: input.sourceImageUrl };
    }
  },
};
