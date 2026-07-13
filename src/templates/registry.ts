import WuustwezelSingle from "@/templates/vastgoed-de-meester/wuustwezel-single";
import type { TemplateDefinition } from "./types";

export const TEMPLATE_REGISTRY: TemplateDefinition[] = [
  {
    id: "vastgoed-de-meester/wuustwezel-single",
    agencySlug: "vastgoed-de-meester",
    name: "Wuustwezel — single (Figma-PoC)",
    version: 1,
    width: 1080,
    height: 1350,
    category: "single",
    slideCount: 1,
    supportedFields: ["showBedrooms", "showBathrooms", "showSurface"],
    Component: WuustwezelSingle,
  },
];

export function getTemplateDefinition(templateKey: string): TemplateDefinition | undefined {
  return TEMPLATE_REGISTRY.find((def) => def.id === templateKey);
}
