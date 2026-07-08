"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    tailwind?: unknown;
  }
}

const TAILWIND_POLL_MS = 30;
const TAILWIND_MAX_WAIT_MS = 5_000;

/** Resolves once window.tailwind (the Play CDN global) exists, or after a capped wait if it never shows up. */
function waitForTailwindCdn(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.tailwind) {
      resolve();
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.tailwind || Date.now() - start > TAILWIND_MAX_WAIT_MS) {
        clearInterval(interval);
        resolve();
      }
    }, TAILWIND_POLL_MS);
  });
}

/**
 * Only used by the internal render-slide page (src/app/internal/render-slide)
 * — Puppeteer waits for `[data-render-ready="true"]` before screenshotting.
 * Two things have to be true before a screenshot is safe to take, neither of
 * which `networkidle0` alone covers:
 *   1. DynamicTemplateRenderer has compiled and painted the template
 *      client-side (after hydration) — approximated here by waiting for
 *      every <img> under it to finish loading (or error, so a broken image
 *      can't hang it forever).
 *   2. The Tailwind Play CDN script that page loads has run and injected
 *      CSS for whatever classNames the (database-stored, so never seen by
 *      our build-time Tailwind) admin template actually uses — otherwise
 *      the text is in the DOM but unstyled and effectively invisible.
 */
export function RenderReadyWrapper({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function waitForImages(): Promise<void> {
      return new Promise((resolve) => {
        const images = Array.from(el!.querySelectorAll("img"));
        if (images.length === 0) {
          resolve();
          return;
        }
        let remaining = images.length;
        function onOneSettled() {
          remaining -= 1;
          if (remaining <= 0) resolve();
        }
        for (const img of images) {
          if (img.complete) onOneSettled();
          else {
            img.addEventListener("load", onOneSettled, { once: true });
            img.addEventListener("error", onOneSettled, { once: true });
          }
        }
      });
    }

    Promise.all([waitForTailwindCdn(), waitForImages()]).then(() => {
      requestAnimationFrame(() => setReady(true));
    });
  }, []);

  return (
    <div ref={ref} data-render-ready={ready ? "true" : "false"}>
      {children}
    </div>
  );
}
