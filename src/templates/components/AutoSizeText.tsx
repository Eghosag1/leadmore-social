"use client";

import { useLayoutEffect, useRef, useState } from "react";

const SEARCH_ITERATIONS = 6;

/**
 * Shrinks its own font-size until the text fits its container, instead of
 * letting long titles/gemeentenamen overflow or wrap unpredictably (a real
 * gap in every current template — see the "Custom fonts en templatearchitectuur"
 * analysis, section 4). Bounded binary search inside a single useLayoutEffect
 * — that commits before the browser paints, which is also before Puppeteer's
 * screenshotCanvas.ts ever gets to poll the DOM (isCanvasReady runs via a
 * separate page.evaluate round-trip, strictly after this has already
 * settled) — so the real render pipeline needs no changes to wait for this.
 *
 * `multiline` toggles which dimension is checked: multi-line titles are
 * bounded by height (scrollHeight vs clientHeight, wrapping is fine), single-
 * line fields like a location/badge are bounded by width (no wrap allowed).
 */
export function AutoSizeText({
  children,
  className,
  minFontSizePx = 22,
  maxFontSizePx,
  multiline = true,
}: {
  children: string;
  className?: string;
  minFontSizePx?: number;
  maxFontSizePx: number;
  multiline?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(maxFontSizePx);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const fits = (size: number) => {
      el.style.fontSize = `${size}px`;
      return multiline ? el.scrollHeight <= el.clientHeight : el.scrollWidth <= el.clientWidth;
    };

    if (fits(maxFontSizePx)) {
      setFontSize(maxFontSizePx);
      return;
    }

    let lo = minFontSizePx;
    let hi = maxFontSizePx;
    let best = minFontSizePx;
    for (let i = 0; i < SEARCH_ITERATIONS; i++) {
      const mid = Math.round((lo + hi) / 2);
      if (fits(mid)) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
      if (lo > hi) break;
    }
    setFontSize(best);
  }, [children, minFontSizePx, maxFontSizePx, multiline]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ fontSize, overflow: "hidden", ...(multiline ? {} : { whiteSpace: "nowrap" }) }}
    >
      {children}
    </div>
  );
}
