import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildTemplateRenderProps } from "@/lib/template-render";
import { EXAMPLE_PROPERTY, EXAMPLE_PROPERTY_IMAGES } from "@/data/mock/example-property";
import type { TemplateConfig, TemplateRenderProps } from "@/types/domain";
import type { CanvasFormat, PostCanvasMode } from "@/types/enums";
import type { ScenesByFormat } from "@/types/scene";

export interface SlideRenderData {
  /** Null for "eigen foto's" posts — nothing to render, callers should skip the browser step entirely. */
  componentSource: string | null;
  /** Non-null when this template uses the JSON scene model (Phase C). Resolve the actual per-slide Scene via getFormatScenes(scenesByFormat, canvasFormat) + resolveSceneForSlide(). */
  scenesByFormat: ScenesByFormat | null;
  /** Which of the template's designed formats this specific post uses — always set alongside a non-null scenesByFormat, see 0017_scene_canvas_formats.sql. */
  canvasFormat: CanvasFormat | null;
  /** How many slides this post actually has — needed alongside `scenesByFormat`/`canvasFormat` to resolve which of cover/content/end applies to one specific slideIndex, see resolveSceneForSlide(). */
  slideCount: number;
  previewData: TemplateRenderProps;
  /** Server-compiled CSS already persisted on the template row (see templateValidationService), if it was ever validated. Null for templates saved before validation existed. */
  compiledCss: string | null;
  /** 'fixed' = the constant 1080x1350 canvas; 'original' = derive the render wrapper's height from canvasHeight. Legacy componentSource/"eigen foto's" posts only — ignored whenever canvasFormat is set. */
  canvasMode: PostCanvasMode;
  canvasHeight: number | null;
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

  const [{ data: property }, { data: agency }, { data: slides }, { data: fonts }] = await Promise.all([
    admin.from("properties").select("*").eq("id", post.property_id).maybeSingle(),
    admin.from("agencies").select("name, logo_url").eq("id", post.agency_id).single(),
    admin.from("post_slides").select("*").eq("post_id", postId).order("sort_order"),
    admin.from("agency_fonts").select("*").eq("agency_id", post.agency_id),
  ]);
  if (!property) return null;

  const { data: template } = await admin.from("agency_templates").select("*").eq("id", post.agency_template_id).maybeSingle();
  if (!template) return null;

  const firstSlide = slides?.[0];
  const slideText = (firstSlide?.text_content ?? {}) as { title?: string; description?: string | null };

  const previewData = buildTemplateRenderProps({
    property,
    // This post's own chosen photos, in slide order — not every property
    // photo. A templated carousel now uses N distinct, user-picked photos
    // (one per slide, see actions.ts/CreatePostForm.tsx), so data.images[N]
    // must resolve to slide N's own photo, not some property-wide list.
    images: (slides ?? []).map((s) => ({ image_url: s.image_url, sort_order: s.sort_order })),
    config: template.config as unknown as TemplateConfig,
    agencyName: agency?.name ?? "",
    fonts: fonts ?? [],
    overrides: {
      title: slideText.title,
      description: slideText.description ?? undefined,
    },
  });

  return {
    componentSource: template.component_source,
    scenesByFormat: template.scenes_by_format,
    canvasFormat: post.canvas_format,
    slideCount: Math.max(slides?.length ?? 1, 1),
    previewData,
    compiledCss: template.compiled_css,
    canvasMode: post.canvas_mode,
    canvasHeight: post.canvas_height,
  };
}

export interface TemplateValidationRenderData {
  componentSource: string;
  /** Non-null when this template uses the JSON scene model (Phase C) — see /internal/render-template-scene, which picks one format+role out of this. */
  scenesByFormat: ScenesByFormat | null;
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

  const [{ data: agency }, { data: fonts }] = await Promise.all([
    admin.from("agencies").select("name").eq("id", template.agency_id).maybeSingle(),
    admin.from("agency_fonts").select("*").eq("agency_id", template.agency_id),
  ]);

  const previewData = buildTemplateRenderProps({
    property: EXAMPLE_PROPERTY,
    images: EXAMPLE_PROPERTY_IMAGES,
    config: template.config as unknown as TemplateConfig,
    agencyName: agency?.name ?? "",
    fonts: fonts ?? [],
  });

  return {
    componentSource: template.component_source,
    scenesByFormat: template.scenes_by_format,
    previewData,
  };
}
