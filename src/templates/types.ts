import type { ComponentType } from "react";
import type { TemplateComponentProps } from "@/components/templates/types";
import type { TemplateFieldVisibility } from "@/types/domain";

/**
 * A git-managed template: a real, statically-imported .tsx file satisfying
 * the exact same TemplateComponentProps contract admin-authored DB-string
 * templates already satisfy (src/lib/dynamic-template.ts). No new data
 * model — the only thing this adds is a stable, registerable identity for a
 * real component, so agency_templates.template_key can point at it instead
 * of at a component_source string. See CLAUDE.md's "Template businessmodel"
 * section for why templates are otherwise still per-agency and admin-only.
 */
export interface TemplateDefinition {
  /** Stable key, referenced by agency_templates.template_key. Convention: "<agency-slug>/<template-name>". */
  id: string;
  agencySlug: string;
  name: string;
  version: number;
  width: 1080;
  height: 1350;
  category: "single" | "carousel";
  slideCount: number;
  supportedFields: (keyof TemplateFieldVisibility)[];
  Component: ComponentType<TemplateComponentProps>;
}
