// Compiles admin-authored template source (TSX) into a live React component
// at runtime, via sucrase (JSX/TS -> JS, no build step needed) + `new
// Function`. Used everywhere a template needs to render: the admin's own
// live preview while authoring, and the agency's post-creation preview.
//
// Trust model: only super_admin can write this source (enforced by RLS on
// agency_templates + requireRole in the admin actions). There is no sandbox
// beyond that — compiled code runs with ambient access to the browser
// context it's rendered in, same as any other client component. Acceptable
// here because super_admin already has unrestricted platform access; not
// something to build on top of without revisiting this file.
import React from "react";
import Image from "next/image";
import { transform } from "sucrase";
import type { ComponentType } from "react";
import type { TemplateComponentProps } from "@/components/templates/types";

/**
 * `imageComponent` defaults to next/image but can be overridden — the
 * internal render-slide page passes RenderImage (a plain `<img>`) instead,
 * see src/components/render/RenderImage.tsx for why.
 */
export function compileTemplateSource(
  source: string,
  imageComponent: unknown = Image,
): ComponentType<TemplateComponentProps> {
  if (!source.trim()) {
    throw new Error("Deze template heeft nog geen broncode.");
  }

  let compiled: string;
  try {
    compiled = transform(source, { transforms: ["jsx", "typescript", "imports"], production: true }).code;
  } catch (error) {
    throw new Error(`Kon de template niet compileren: ${(error as Error).message}`);
  }

  const moduleExports: { default?: unknown } = {};
  try {
    // eslint-disable-next-line no-new-func -- intentional: this *is* the runtime template compiler.
    const run = new Function("exports", "React", "Image", compiled);
    run(moduleExports, React, imageComponent);
  } catch (error) {
    throw new Error(`Fout bij het uitvoeren van de template: ${(error as Error).message}`);
  }

  if (typeof moduleExports.default !== "function") {
    throw new Error("De template moet eindigen met \"export default JouwComponent;\".");
  }

  return moduleExports.default as ComponentType<TemplateComponentProps>;
}
