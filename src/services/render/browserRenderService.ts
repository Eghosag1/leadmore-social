import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { signRenderToken } from "@/lib/render/token";
import { screenshotCanvas } from "@/lib/render/screenshotCanvas";
import { siteUrl } from "@/lib/site-url";
import { getSlideRenderData } from "@/services/render/renderDataService";
import { resolveRenderHeight } from "@/lib/canvas-format";
import type { RenderService, RenderSlideInput, RenderSlideResult } from "./renderService";

/**
 * Real render backend: screenshots the internal render-slide page's canvas
 * element (which shows the exact same DynamicTemplateRenderer output as the
 * live preview, with server-compiled Tailwind CSS for the template's actual
 * classNames — see compile-tailwind.ts) with a headless Chromium instance
 * (screenshotCanvas, shared with templateValidationService), and uploads the
 * result to the `rendered-posts` Storage bucket.
 *
 * Reliability: up to 2 attempts with backoff (inside screenshotCanvas) for
 * transient flakiness. Beyond that, this throws rather than silently
 * substituting the source photo — a broken render must block scheduling, not
 * publish an unbranded photo unnoticed. Callers (renderPostForScheduling)
 * decide what happens next: render_failed, with the user choosing to retry or
 * explicitly opt into the original photo.
 */
export const browserRenderService: RenderService = {
  async renderSlide(input: RenderSlideInput): Promise<RenderSlideResult> {
    const data = await getSlideRenderData(input.postId);
    if (!data || (!data.componentSource && !data.scenesByFormat)) {
      // No template (or post not found) — nothing to overlay, the source photo is already the final visual.
      return { renderedImageUrl: input.sourceImageUrl };
    }

    const token = signRenderToken(input.postId);
    const url = `${siteUrl()}/internal/render-slide/${input.postId}/${input.slideIndex}?token=${token}`;
    const context = `post ${input.postId} slide ${input.slideIndex}`;
    const viewportHeight = resolveRenderHeight({ canvasFormat: data.canvasFormat, canvasMode: data.canvasMode, canvasHeight: data.canvasHeight });

    const buffer = await screenshotCanvas(url, context, { viewportHeight });
    const admin = createAdminClient();
    const path = `${input.postId}/${input.slideId}.png`;
    const { error: uploadError } = await admin.storage.from("rendered-posts").upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrl } = admin.storage.from("rendered-posts").getPublicUrl(path);
    return { renderedImageUrl: publicUrl.publicUrl };
  },
};
