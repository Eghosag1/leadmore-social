import "server-only";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Page } from "puppeteer-core";

// Kept tight on purpose: callers run inside a Vercel serverless function with
// a finite maxDuration (60s on the Hobby-plan ceiling).
const MAX_ATTEMPTS = 2;
const NAV_TIMEOUT_MS = 15_000;
const CANVAS_SELECTOR = '[data-render-canvas="true"]';

async function executablePath(): Promise<string> {
  if (process.env.VERCEL) return chromium.executablePath();
  return process.env.CHROME_EXECUTABLE_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
}

/**
 * chromium.args (from @sparticuz/chromium) is tuned for AWS Lambda's
 * container — notably `--single-process` and `--no-zygote`, which Chromium
 * itself does not support on macOS and which hang indefinitely with a
 * regular desktop Chrome/Chromium binary. Only pair those flags with the
 * Lambda-only binary they were designed for; a plain local launch needs none
 * of them.
 */
function launchArgs(): string[] {
  return process.env.VERCEL ? chromium.args : [];
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

  // A caught render error (DynamicTemplateRenderer's error boundary) is a
  // stable, "nothing more will change" state too — resolve immediately
  // instead of waiting out the full timeout. screenshotOnce checks for this
  // marker right after and throws instead of screenshotting the error box.
  if (canvas.querySelector('[data-template-error="true"]')) return true;

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
    if (msg.type() === "error") console.error(`[screenshotCanvas][${context}] console.error:`, msg.text());
  });
  page.on("requestfailed", (req) => {
    console.error(`[screenshotCanvas][${context}] request failed:`, req.url(), req.failure()?.errorText);
  });
  page.on("pageerror", (err) => {
    console.error(`[screenshotCanvas][${context}] page error:`, err instanceof Error ? err.message : err);
  });
}

async function screenshotOnce(url: string, context: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: launchArgs(),
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
      console.error(`[screenshotCanvas][${context}] readiness check timed out:`, JSON.stringify(debugInfo, null, 2));
      throw waitError;
    }

    const templateError = await page.evaluate(() => {
      const el = document.querySelector('[data-render-canvas="true"] [data-template-error="true"]');
      return el ? el.getAttribute("data-template-error-message") : null;
    });
    if (templateError !== null) {
      throw new Error(`Template gooit een fout tijdens renderen: ${templateError}`);
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

/**
 * Screenshots the `data-render-canvas` element of an internal render page
 * (either a real post slide or a template validation test-render — both
 * pages share the same canvas/readiness contract). Retries with backoff;
 * throws after all attempts are exhausted so callers decide what "failed"
 * means for their context (post rendering falls back to the source photo,
 * template validation marks the template as failed).
 */
export async function screenshotCanvas(url: string, context: string): Promise<Buffer> {
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
