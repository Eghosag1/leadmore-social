"use client";

import { useEffect, useRef, useState } from "react";
import { DynamicTemplateRenderer } from "./DynamicTemplateRenderer";
import type { TemplateComponentProps } from "./types";

const NATIVE_WIDTH = 1080;
const NATIVE_HEIGHT = 1350; // 4:5 — matches the internal render-slide/render-template canvas

/**
 * Templates are authored against, and finally rendered at, a fixed native
 * 1080x1350 canvas (see the internal render-slide/render-template pages,
 * which Puppeteer captures at exactly that size). Every *preview* surface
 * (admin editor, phone mockup, template gallery) shows the template at some
 * much smaller physical width, but Tailwind classNames like `text-xl` are
 * fixed-pixel — not relative to their container — so without this, text
 * looks proportionally huge in a small preview and proportionally tiny in
 * the final image. This renders the template at its true native size in an
 * off-screen 1080x1350 box, then visually scales that whole box down (a CSS
 * transform, so borders/shadows/spacing/text all shrink together) to fill
 * whatever width its container actually has — measured via ResizeObserver so
 * it works in fixed-width contexts (the phone mockup) and fully responsive
 * ones (the template gallery grid) alike, with no per-caller magic numbers.
 */
export function ScaledTemplateCanvas({ source, data, slideIndex, className }: { source: string } & TemplateComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setScale(width / NATIVE_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative aspect-[4/5] w-full overflow-hidden">
      <div style={{ width: NATIVE_WIDTH, height: NATIVE_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <DynamicTemplateRenderer source={source} data={data} slideIndex={slideIndex} className={className} />
      </div>
    </div>
  );
}
