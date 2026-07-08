import type { CSSProperties } from "react";

/**
 * Drop-in replacement for next/image's `Image`, injected into
 * compileTemplateSource() only for the internal render-slide page (see
 * browserRenderService.ts). next/image is great for the live preview, but
 * for a server-side headless-browser screenshot we want deterministic pixels
 * — a plain `<img>` has no lazy-loading/optimization behavior to race
 * against. Covers exactly the props the starter templates (and any template
 * following the same contract) actually use.
 */
export function RenderImage({
  src,
  alt,
  fill,
  width,
  height,
  className,
}: {
  src: string;
  alt?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const style: CSSProperties | undefined = fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : undefined;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- intentional: this *is* the plain-img fallback for headless rendering.
    <img src={src} alt={alt ?? ""} className={className} style={style} width={fill ? undefined : width} height={fill ? undefined : height} />
  );
}
