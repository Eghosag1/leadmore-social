import "server-only";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { createAdminClient } from "@/lib/supabase/admin";
import { signRenderToken } from "@/lib/render/token";
import { getSlideRenderData } from "@/services/render/renderDataService";
import type { RenderService, RenderSlideInput, RenderSlideResult } from "./renderService";

const MAX_ATTEMPTS = 3;
const NAV_TIMEOUT_MS = 20_000;

function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function executablePath(): Promise<string> {
  if (process.env.VERCEL) return chromium.executablePath();
  return process.env.CHROME_EXECUTABLE_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function screenshotOnce(url: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1080, height: 1080 },
    executablePath: await executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    // networkidle0 (no more than 0 in-flight requests for 500ms) covers
    // waiting for the template's images to finish loading without needing
    // any custom signal from admin-authored template code we don't control.
    await page.goto(url, { waitUntil: "networkidle0", timeout: NAV_TIMEOUT_MS });
    const buffer = await page.screenshot({ type: "png" });
    return buffer as Buffer;
  } finally {
    await browser.close();
  }
}

async function screenshotWithRetries(url: string): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await screenshotOnce(url);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(500 * attempt);
    }
  }
  throw lastError;
}

/**
 * Real render backend: screenshots the internal render-slide page (which
 * shows the exact same DynamicTemplateRenderer output as the live preview)
 * with a headless Chromium instance, and uploads the result to the
 * `rendered-posts` Storage bucket.
 *
 * Reliability: up to 3 attempts with backoff (see screenshotWithRetries),
 * and if every attempt still fails, falls back to the untouched source photo
 * instead of throwing — a broken render must never block scheduling a post.
 * Callers can tell a fallback happened because renderedImageUrl will equal
 * sourceImageUrl for a slide that does have a template (see the warning
 * banner on the post detail page).
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

    try {
      const buffer = await screenshotWithRetries(url);
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
      console.error(`[browserRenderService] Render failed for post ${input.postId} slide ${input.slideIndex}, falling back to source photo:`, error);
      return { renderedImageUrl: input.sourceImageUrl };
    }
  },
};
