"use client";

import { Component as ReactComponent, useMemo, type ReactNode } from "react";
import { compileTemplateSource } from "@/lib/dynamic-template";
import { RenderImage } from "@/components/render/RenderImage";
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
 * Compiles `source` (admin-authored TSX, see src/lib/dynamic-template.ts)
 * into a live component and renders it. Used both for the admin's own live
 * preview while authoring a template, and for the agency's post-creation
 * preview — the same compiled output either way. `useRawImage` is only set
 * by the internal render-slide page (plain `<img>` instead of next/image —
 * see RenderImage.tsx); everywhere else uses the default (next/image).
 *
 * `RenderImage` is resolved here, inside this already-client component,
 * rather than accepted as a component-reference prop — a Server Component
 * page (the render-slide page) can't pass a function value as a prop across
 * the server/client boundary (React rejects it at runtime), so the caller
 * only ever passes the serializable `useRawImage` boolean.
 */
export function DynamicTemplateRenderer({
  source,
  useRawImage,
  ...props
}: TemplateComponentProps & { source: string; useRawImage?: boolean }) {
  const result = useMemo(() => {
    try {
      return { component: compileTemplateSource(source, useRawImage ? RenderImage : undefined), error: null as string | null };
    } catch (error) {
      return { component: null, error: (error as Error).message };
    }
  }, [source, useRawImage]);

  if (!result.component) {
    return <TemplateErrorDisplay message={result.error ?? "Onbekende fout."} />;
  }

  const Template = result.component;
  return (
    <TemplateErrorBoundary key={source}>
      <Template {...props} />
    </TemplateErrorBoundary>
  );
}
