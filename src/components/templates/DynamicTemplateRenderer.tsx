"use client";

import { Component as ReactComponent, useMemo, type ReactNode } from "react";
import { compileTemplateSource } from "@/lib/dynamic-template";
import type { TemplateComponentProps } from "./types";

function TemplateErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-red-300 bg-red-50 p-4 text-center">
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
 * preview — the same compiled output either way.
 */
export function DynamicTemplateRenderer({ source, ...props }: TemplateComponentProps & { source: string }) {
  const result = useMemo(() => {
    try {
      return { component: compileTemplateSource(source), error: null as string | null };
    } catch (error) {
      return { component: null, error: (error as Error).message };
    }
  }, [source]);

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
