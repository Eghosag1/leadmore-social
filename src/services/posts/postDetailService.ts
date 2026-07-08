import "server-only";
import { createClient } from "@/lib/supabase/server";
import { buildRawPhotoRenderProps, buildTemplateRenderProps } from "@/lib/template-render";
import type { PropertyRow } from "@/types/database";
import type { TemplateConfig, TemplateRenderProps } from "@/types/domain";
import type { Platform, PostStatus } from "@/types/enums";

export interface PostDetailData {
  postId: string;
  property: PropertyRow;
  propertyTitle: string;
  initialCaption: string;
  scheduledAt: string | null;
  status: PostStatus;
  jobs: { platform: Platform; status: PostStatus; error_message: string | null }[];
  componentSource: string | null;
  slideCount: number;
  previewData: TemplateRenderProps;
  agencyName: string;
  agencyLogo?: string;
}

/**
 * Assembles everything a post detail view needs (full page or quick-view
 * sheet) — same shape either way so both surfaces stay in sync. Returns null
 * when the post doesn't exist or doesn't belong to this agency.
 */
export async function getPostDetailData(postId: string, agencyId: string): Promise<PostDetailData | null> {
  const supabase = await createClient();

  const { data: post } = await supabase.from("posts").select("*").eq("id", postId).eq("agency_id", agencyId).maybeSingle();
  if (!post) return null;

  const [{ data: property }, { data: agency }, { data: slides }, { data: jobs }] = await Promise.all([
    supabase.from("properties").select("*").eq("id", post.property_id).maybeSingle(),
    supabase.from("agencies").select("name, logo_url").eq("id", agencyId).single(),
    supabase.from("post_slides").select("*").eq("post_id", postId).order("sort_order"),
    supabase.from("post_jobs").select("platform, status, error_message").eq("post_id", postId),
  ]);

  if (!property) return null;

  const { data: images } = await supabase.from("property_images").select("*").eq("property_id", property.id);
  const firstSlide = slides?.[0];

  let componentSource: string | null = null;
  let slideCount = Math.max(slides?.length ?? 1, 1);
  let previewData: TemplateRenderProps;

  if (post.agency_template_id) {
    const { data: template } = await supabase.from("agency_templates").select("*").eq("id", post.agency_template_id).maybeSingle();
    if (!template) return null;

    const slideText = (firstSlide?.text_content ?? {}) as { title?: string; description?: string | null };
    componentSource = template.component_source;
    slideCount = template.slide_count;
    previewData = buildTemplateRenderProps({
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
  } else {
    // "Eigen foto's" post — no template, just the chosen photos in slide order.
    previewData = buildRawPhotoRenderProps({
      property,
      images: (slides ?? []).map((slide) => slide.image_url),
      agencyName: agency?.name ?? "",
    });
  }

  return {
    postId,
    property,
    propertyTitle: property.title,
    initialCaption: post.caption,
    scheduledAt: post.scheduled_at,
    status: post.status,
    jobs: jobs ?? [],
    componentSource,
    slideCount,
    previewData,
    agencyName: agency?.name ?? "",
    agencyLogo: agency?.logo_url ?? undefined,
  };
}
