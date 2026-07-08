"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Only used by the internal render-slide page (src/app/internal/render-slide)
 * — Puppeteer waits for `[data-render-ready="true"]` before screenshotting.
 * `networkidle0` alone isn't enough: DynamicTemplateRenderer compiles and
 * renders the template client-side (after hydration), so a screenshot taken
 * the moment network requests settle can land before React has actually
 * painted the text. This waits for every <img> under it to finish loading
 * (or error, so a broken image can't hang it forever), then flips ready on
 * the next paint.
 */
export function RenderReadyWrapper({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const images = Array.from(el.querySelectorAll("img"));
    if (images.length === 0) {
      requestAnimationFrame(() => setReady(true));
      return;
    }

    let remaining = images.length;
    function onOneSettled() {
      remaining -= 1;
      if (remaining <= 0) requestAnimationFrame(() => setReady(true));
    }
    for (const img of images) {
      if (img.complete) {
        onOneSettled();
      } else {
        img.addEventListener("load", onOneSettled, { once: true });
        img.addEventListener("error", onOneSettled, { once: true });
      }
    }
  }, []);

  return (
    <div ref={ref} data-render-ready={ready ? "true" : "false"}>
      {children}
    </div>
  );
}
