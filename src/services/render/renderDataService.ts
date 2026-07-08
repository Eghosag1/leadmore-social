import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTemplateRenderProps } from "@/lib/template-render";
import type { TemplateConfig, TemplateRenderProps } from "@/types/domain";

export interface SlideRenderData {
  /** Null for "eigen foto's" posts — nothing to render, callers should skip the browser step entirely. */
  componentSource: string | null;
  previewData: TemplateRenderProps;
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

  return { componentSource: template.component_source, previewData };
}
