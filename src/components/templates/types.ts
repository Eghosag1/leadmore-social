import type { TemplateRenderProps } from "@/types/domain";

/** Every template layout component implements this same prop contract. */
export interface TemplateComponentProps {
  data: TemplateRenderProps;
  /** Only meaningful for carousel layouts — selects which of the N slides to render. */
  slideIndex?: number;
  className?: string;
}
