"use client";

import { Component as ReactComponent, useMemo, type ReactNode } from "react";
import { compileTemplateSource } from "@/lib/dynamic-template";
import { RenderImage } from "@/components/render/RenderImage";
import { PlainPhotoSlide } from "@/components/templates/PlainPhotoSlide";
import SceneRenderer from "@/templates/scene/SceneRenderer";
import type { TemplateComponentProps } from "./types";
import type { Scene } from "@/types/scene";

/**
 * `data-template-error` marks this as a failure state for screenshotCanvas.ts
 * (both template validation and real post-rendering) — without it, the
 * readiness check only looks for "some visible text with a real bounding
 * box", which this friendly error box satisfies just as well as a correctly
 * rendered template. A screenshot of this box would otherwise pass validation
 * silently, or get uploaded as a real (broken-looking) post image.
 */
function TemplateErrorDisplay({ message }: { message: string }) {
  return (
    <div
      data-template-error="true"
      data-template-error-message={message}
      className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-red-300 bg-red-50 p-4 text-center"
    >
      <p className="text-sm font-medium text-red-700">Fout in de template</p>
      <p className="text-xs text-red-600">{message}</p>
    </div>
  );
}

function fontFormatFromUrl(url: string): string {
  const extension = url.split("?")[0].split(".").pop()?.toLowerCase();
  switch (extension) {
    case "woff2":
      return "woff2";
    case "woff":
      return "woff";
    case "otf":
      return "opentype";
    default:
      return "truetype";
  }
}

/**
 * Declares every font this agency has uploaded (any number, see
 * agency_fonts / FontsCard.tsx) as its own `@font-face`, each exposed via a
 * `--font-{id}` CSS variable so a template — or, going forward, a scene text
 * element — can pick a specific one (title font vs. body font, ...) instead
 * of "the one agency font" every template used to share. One centralized
 * injection point (here, not per-template), since this is agency-level
 * branding data, not something an individual template configures.
 *
 * `--font-brand` is kept as a deprecated alias for the *first* uploaded font
 * — this was the only CSS variable that existed before agencies could have
 * more than one font, and wuustwezel-single.tsx's own docstring already
 * anticipated swapping onto it "if an agency ever uploads one," so nothing
 * that already opts into `.font-brand` breaks silently.
 */
function CustomFontStyles({ fonts }: { fonts: TemplateComponentProps["data"]["fonts"] }) {
  if (fonts.length === 0) return null;
  const faces = fonts
    .map(
      (font) =>
        `@font-face{font-family:'${font.font_family}';src:url('${font.font_url}') format('${fontFormatFromUrl(font.font_url)}');font-display:swap;}`,
    )
    .join("");
  const variables = fonts.map((font) => `--font-${font.id}:'${font.font_family}',ui-sans-serif,system-ui,sans-serif;`).join("");
  const css = `${faces}:root{${variables}--font-brand:var(--font-${fonts[0].id});}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

/** Class component required: React error boundaries can't be hooks. `key`-ed by source so it resets on edit. */
class TemplateErrorBoundary extends ReactComponent<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) return <TemplateErrorDisplay message={this.state.error.message} />;
    return this.props.children;
  }
}

/**
 * Resolves a template reference to a live component and renders it. Two
 * sources, mutually exclusive:
 *   - `source`: admin-authored TSX string, compiled at runtime (see
 *     src/lib/dynamic-template.ts) — the legacy path, kept only because
 *     `createSceneAgencyTemplate` still stamps a (`""`, unused) placeholder
 *     on every new row; every template is scene-authored now.
 *   - `scene`: an already-resolved `Scene | null` for this exact slide (see
 *     resolveSceneForSlide() — the caller picks cover/content/end *before*
 *     this component ever runs, since only the caller knows the total slide
 *     count). `null` means this slide's role has no scene defined, so it
 *     falls back to the plain, unbranded photo (PlainPhotoSlide) — the same
 *     rendering "eigen foto's" posts already use. A non-null Scene is
 *     painted by the one shared SceneRenderer.
 *
 * Used both for the admin's own live preview while authoring a DB-string
 * template, and for the agency's post-creation preview — the same resolved
 * component either way. `useRawImage` only affects the `source` path (plain
 * `<img>` instead of next/image, see RenderImage.tsx below) — a scene
 * imports next/image directly, so there's no runtime hook to swap it; it
 * relies on `priority` + the same img.complete readiness check
 * (screenshotCanvas.ts) instead.
 *
 * `RenderImage` is resolved here, inside this already-client component,
 * rather than accepted as a component-reference prop — a Server Component
 * page (the render-slide page) can't pass a function value as a prop across
 * the server/client boundary (React rejects it at runtime), so the caller
 * only ever passes the serializable `useRawImage` boolean.
 */
type TemplateReference = { source: string; scene?: undefined } | { scene: Scene | null; source?: undefined };

export function DynamicTemplateRenderer({
  source,
  scene,
  useRawImage,
  ...rendererProps
}: TemplateComponentProps & TemplateReference & { useRawImage?: boolean }) {
  // Hooks must run unconditionally regardless of which reference kind was
  // passed, so the scene branch is resolved and rendered *after* this memo
  // rather than via an early return above it — the memo itself is simply a
  // no-op (never read) whenever `scene` is in play.
  const result = useMemo(() => {
    if (scene !== undefined) return { component: null, error: null as string | null };
    try {
      return { component: compileTemplateSource(source!, useRawImage ? RenderImage : undefined), error: null as string | null };
    } catch (error) {
      return { component: null, error: (error as Error).message };
    }
  }, [source, scene, useRawImage]);

  const { data, slideIndex, className } = rendererProps;

  if (scene !== undefined) {
    if (scene === null) {
      return <PlainPhotoSlide imageUrl={data.images[slideIndex ?? 0] ?? data.images[0]} className={className} />;
    }
    return (
      <TemplateErrorBoundary key={JSON.stringify(scene)}>
        <CustomFontStyles fonts={data.fonts} />
        <SceneRenderer data={data} slideIndex={slideIndex} className={className} scene={scene} />
      </TemplateErrorBoundary>
    );
  }

  if (!result.component) {
    return <TemplateErrorDisplay message={result.error ?? "Onbekende fout."} />;
  }

  const Template = result.component;
  return (
    <TemplateErrorBoundary key={source}>
      <CustomFontStyles fonts={data.fonts} />
      <Template {...rendererProps} />
    </TemplateErrorBoundary>
  );
}
