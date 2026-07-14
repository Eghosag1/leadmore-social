"use client";

import { Component as ReactComponent, useMemo, type ReactNode } from "react";
import { compileTemplateSource } from "@/lib/dynamic-template";
import { RenderImage } from "@/components/render/RenderImage";
import { getTemplateDefinition } from "@/templates/registry";
import type { TemplateComponentProps } from "./types";

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
 * Declares the agency's custom font (if any) as `@font-face` and exposes it
 * via the fixed `--font-brand` CSS variable — see globals.css's `.font-brand`
 * utility, which every template's className can opt into. One centralized
 * injection point (here, not per-template) since this is agency-level
 * branding, not something an individual template configures — see
 * src/components/admin/FontUploader.tsx and the agency settings page.
 */
function CustomFontStyle({ family, url }: { family: string; url: string }) {
  const css = `@font-face{font-family:'${family}';src:url('${url}') format('${fontFormatFromUrl(url)}');font-display:swap;}:root{--font-brand:'${family}',ui-sans-serif,system-ui,sans-serif;}`;
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
 *     src/lib/dynamic-template.ts) — the original, still-supported path for
 *     every template that hasn't been migrated to a git file yet.
 *   - `templateKey`: a real, statically-imported component registered in
 *     src/templates/registry.ts — no compilation needed, TypeScript already
 *     checked it at build time. See the "Templatearchitectuur" migration
 *     plan for why both paths coexist during the migration.
 *
 * Used both for the admin's own live preview while authoring a DB-string
 * template, and for the agency's post-creation preview — the same resolved
 * component either way. `useRawImage` only affects the `source` path (plain
 * `<img>` instead of next/image, see RenderImage.tsx below) — registry
 * templates import next/image directly in their own file, so there's no
 * runtime hook to swap it; they rely on `priority` + the same img.complete
 * readiness check (screenshotCanvas.ts) instead.
 *
 * `RenderImage` is resolved here, inside this already-client component,
 * rather than accepted as a component-reference prop — a Server Component
 * page (the render-slide page) can't pass a function value as a prop across
 * the server/client boundary (React rejects it at runtime), so the caller
 * only ever passes the serializable `useRawImage` boolean.
 */
type TemplateReference = { source: string; templateKey?: undefined } | { templateKey: string; source?: undefined };

export function DynamicTemplateRenderer({
  source,
  templateKey,
  useRawImage,
  ...rendererProps
}: TemplateComponentProps & TemplateReference & { useRawImage?: boolean }) {
  const result = useMemo(() => {
    if (templateKey) {
      const definition = getTemplateDefinition(templateKey);
      if (!definition) return { component: null, error: `Onbekende template: "${templateKey}".` };
      return { component: definition.Component, error: null as string | null };
    }
    try {
      return { component: compileTemplateSource(source!, useRawImage ? RenderImage : undefined), error: null as string | null };
    } catch (error) {
      return { component: null, error: (error as Error).message };
    }
  }, [source, templateKey, useRawImage]);

  if (!result.component) {
    return <TemplateErrorDisplay message={result.error ?? "Onbekende fout."} />;
  }

  const Template = result.component;
  const { data } = rendererProps;
  return (
    <TemplateErrorBoundary key={source ?? templateKey}>
      {data.customFontFamily && data.customFontUrl && <CustomFontStyle family={data.customFontFamily} url={data.customFontUrl} />}
      <Template {...rendererProps} />
    </TemplateErrorBoundary>
  );
}
