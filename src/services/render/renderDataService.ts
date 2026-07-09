import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTemplateRenderProps } from "@/lib/template-render";
import { EXAMPLE_PROPERTY, EXAMPLE_PROPERTY_IMAGES } from "@/data/mock/example-property";
import type { TemplateConfig, TemplateRenderProps } from "@/types/domain";

export interface SlideRenderData {
  /** Null for "eigen foto's" posts — nothing to render, callers should skip the browser step entirely. */
  componentSource: string | null;
  previewData: TemplateRenderProps;
  /** Server-compiled CSS already persisted on the template row (see templateValidationService), if it was ever validated. Null for templates saved before validation existed. */
  compiledCss: string | null;
}

/**
 * Same data shape as buildTemplateRenderProps produces for the live preview
 * (src/services/posts/postDetailService.ts's getPostDetailData), but fetched
 * with the service-role client — the internal render page has no logged-in
 * user session to scope an RLS-respecting query by (Puppeteer hits it
 * server-to-server, authorized by a signed token instead, see
 * src/lib/render/token.ts).
 */
export async function getSlideRenderData(postId: string): Promise<SlideRenderData | null> {
  const admin = createAdminClient();

  const { data: post } = await admin.from("posts").select("*").eq("id", postId).maybeSingle();
  if (!post || !post.agency_template_id) return null;

  const [{ data: property }, { data: agency }, { data: slides }] = await Promise.all([
    admin.from("properties").select("*").eq("id", post.property_id).maybeSingle(),
    admin.from("agencies").select("name, logo_url").eq("id", post.agency_id).single(),
    admin.from("post_slides").select("*").eq("post_id", postId).order("sort_order"),
  ]);
  if (!property) return null;

  const { data: template } = await admin.from("agency_templates").select("*").eq("id", post.agency_template_id).maybeSingle();
  if (!template) return null;

  const { data: images } = await admin.from("property_images").select("*").eq("property_id", property.id);
  const firstSlide = slides?.[0];
  const slideText = (firstSlide?.text_content ?? {}) as { title?: string; description?: string | null };

  const previewData = buildTemplateRenderProps({
    property,
    images: images ?? [],
    config: template.config as unknown as TemplateConfig,
    agencyName: agency?.name ?? "",
    overrides: {
      title: slideText.title,
      description: slideText.description ?? undefined,
      coverImageUrl: firstSlide?.image_url,
    },
  });

  return { componentSource: template.component_source, previewData, compiledCss: template.compiled_css };
}

export interface TemplateValidationRenderData {
  componentSource: string;
  previewData: TemplateRenderProps;
}

/**
 * Data for the template-validation test-render (src/app/internal/render-template) —
 * no real post/property involved, just the template itself rendered against
 * the same dummy property the admin's live preview already uses
 * (EXAMPLE_PROPERTY, see TemplateForm.tsx) so validation works even for a
 * brand-new agency with zero synced properties yet.
 */
export async function getTemplateValidationRenderData(templateId: string): Promise<TemplateValidationRenderData | null> {
  const admin = createAdminClient();

  const { data: template } = await admin.from("agency_templates").select("*").eq("id", templateId).maybeSingle();
  if (!template) return null;

  const { data: agency } = await admin.from("agencies").select("name").eq("id", template.agency_id).maybeSingle();

  const previewData = buildTemplateRenderProps({
    property: EXAMPLE_PROPERTY,
    images: EXAMPLE_PROPERTY_IMAGES,
    config: template.config as unknown as TemplateConfig,
    agencyName: agency?.name ?? "",
  });

  return { componentSource: template.component_source, previewData };
}
