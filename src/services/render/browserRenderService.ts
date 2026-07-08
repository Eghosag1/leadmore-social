import "server-only";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Page } from "puppeteer-core";
import { createAdminClient } from "@/lib/supabase/admin";
import { signRenderToken } from "@/lib/render/token";
import { getSlideRenderData } from "@/services/render/renderDataService";
import type { RenderService, RenderSlideInput, RenderSlideResult } from "./renderService";

// Kept tight on purpose: this runs inside a Vercel serverless function with a
// finite maxDuration (see the "use server" file that calls into renderPost()
// — 60s there, the Hobby-plan ceiling).
const MAX_ATTEMPTS = 2;
const NAV_TIMEOUT_MS = 15_000;
const CANVAS_SELECTOR = '[data-render-canvas="true"]';

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

/**
 * Concrete, deterministic readiness check run inside the page — no blind
 * delays. True once every <img> under the canvas has finished loading, and
 * every non-empty leaf text node has a real painted box (not display:none,
 * not zero-size, not hidden/transparent). If the template has no text at
 * all this is trivially true as soon as images are loaded.
 */
function isCanvasReady(): boolean {
  const canvas = document.querySelector('[data-render-canvas="true"]');
  if (!canvas) return false;

  const images = Array.from(canvas.querySelectorAll("img"));
  if (!images.every((img) => (img as HTMLImageElement).complete)) return false;

  const textElements = Array.from(canvas.querySelectorAll("*")).filter(
    (el) => el.children.length === 0 && (el.textContent ?? "").trim().length > 0,
  );
  if (textElements.length === 0) return true;

  return textElements.every((el) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.opacity !== "0";
  });
}

interface RenderDebugInfo {
  canvasFound: boolean;
  bodyTextSnippet: string;
  styleTagCount: number;
  textElementDebug: { text: string; rect: { width: number; height: number }; visibility: string; opacity: string }[];
}

function collectDebugInfo(): RenderDebugInfo {
  const canvas = document.querySelector('[data-render-canvas="true"]');
  const textElements = canvas
    ? Array.from(canvas.querySelectorAll("*")).filter((el) => el.children.length === 0 && (el.textContent ?? "").trim().length > 0)
    : [];

  return {
    canvasFound: !!canvas,
    bodyTextSnippet: (document.body.textContent ?? "").trim().slice(0, 300),
    styleTagCount: document.querySelectorAll("style").length,
    textElementDebug: textElements.slice(0, 10).map((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        text: (el.textContent ?? "").trim().slice(0, 60),
        rect: { width: rect.width, height: rect.height },
        visibility: style.visibility,
        opacity: style.opacity,
      };
    }),
  };
}

function attachDebugListeners(page: Page, context: string) {
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(`[browserRenderService][${context}] console.error:`, msg.text());
  });
  page.on("requestfailed", (req) => {
    console.error(`[browserRenderService][${context}] request failed:`, req.url(), req.failure()?.errorText);
  });
  page.on("pageerror", (err) => {
    console.error(`[browserRenderService][${context}] page error:`, err instanceof Error ? err.message : err);
  });
}

async function screenshotOnce(url: string, context: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1080, height: 1080 },
    executablePath: await executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    attachDebugListeners(page, context);

    await page.goto(url, { waitUntil: "networkidle0", timeout: NAV_TIMEOUT_MS });
    await page.evaluate(() => document.fonts.ready);

    try {
      await page.waitForFunction(isCanvasReady, { timeout: NAV_TIMEOUT_MS });
    } catch (waitError) {
      const debugInfo = await page.evaluate(collectDebugInfo);
      console.error(`[browserRenderService][${context}] readiness check timed out:`, JSON.stringify(debugInfo, null, 2));
      throw waitError;
    }

    // Let the final paint settle after the readiness check passes.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const canvas = await page.$(CANVAS_SELECTOR);
    if (!canvas) throw new Error("Render canvas element not found on the page.");

    const buffer = await canvas.screenshot({ type: "png" });
    return buffer as Buffer;
  } finally {
    await browser.close();
  }
}

async function screenshotWithRetries(url: string, context: string): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await screenshotOnce(url, `${context} attempt ${attempt}`);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(500 * attempt);
    }
  }
  throw lastError;
}

/**
 * Real render backend: screenshots the internal render-slide page's canvas
 * element (which shows the exact same DynamicTemplateRenderer output as the
 * live preview, with server-compiled Tailwind CSS for the template's actual
 * classNames — see compile-tailwind.ts) with a headless Chromium instance,
 * and uploads the result to the `rendered-posts` Storage bucket.
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
      const buffer = await screenshotWithRetries(url, context);
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
