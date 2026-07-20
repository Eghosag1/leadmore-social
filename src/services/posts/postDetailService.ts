import "server-only";
import { createClient } from "@/lib/supabase/server";
import { reconcilePublishedPosts } from "@/services/posts/publishReconciliationService";
import { processPendingPost } from "@/services/posts/postQueueService";
import { notifyPostFailure } from "@/services/notifications/postFailureNotificationService";
import { buildRawPhotoRenderProps, buildTemplateRenderProps } from "@/lib/template-render";
import type { PropertyRow } from "@/types/database";
import type { TemplateConfig, TemplateRenderProps } from "@/types/domain";
import type { CanvasFormat, Platform, PostCanvasMode, PostStatus } from "@/types/enums";
import type { ScenesByFormat } from "@/types/scene";

export interface PostDetailData {
  postId: string;
  property: PropertyRow;
  propertyTitle: string;
  initialCaption: string;
  scheduledAt: string | null;
  status: PostStatus;
  jobs: { platform: Platform; status: PostStatus; error_message: string | null }[];
  componentSource: string | null;
  /** Non-null when this post's template uses the JSON scene model (Phase C) instead of source. */
  scenesByFormat: ScenesByFormat | null;
  /** Which of the template's designed formats this post uses — set alongside a non-null scenesByFormat. */
  canvasFormat: CanvasFormat | null;
  canvasMode: PostCanvasMode;
  canvasHeight: number | null;
  slideCount: number;
  previewData: TemplateRenderProps;
  agencyName: string;
  agencyLogo?: string;
  /** Specific reason the render failed, set only when status is render_failed — see RenderFailedActions. */
  renderError: string | null;
  /** True when at least one slide deliberately uses the unbranded source photo via the explicit "use original photo" override — informational only, not an unresolved problem (contrast with status === 'render_failed'). */
  renderOverridden: boolean;
  /** Ordered by sort_order (same order as slideIndex in PhonePreview). Null entries mean that slide hasn't been rendered yet (still draft). */
  renderedImageUrls: (string | null)[];
}

// How long a post can plausibly sit on 'rendering' before it's more likely
// stuck (an aborted request, a crash outside browserRenderService's own
// try/catch) than genuinely still in progress — well above the render
// pipeline's own internal retry budget (2 attempts x 15s timeout, see
// screenshotCanvas.ts).
const STALE_RENDERING_THRESHOLD_MS = 3 * 60 * 1000;

// How long a post can plausibly sit on 'pending_render' before the
// fire-and-forget queue trigger (createAndSchedulePostAction, via after())
// probably didn't land — normally resolves within single-digit seconds, so
// this is a generous safety margin, not a normal wait.
const STALE_PENDING_RENDER_THRESHOLD_MS = 20 * 1000;

// "Nu posten" (postSchedulerService.publishPost()) puts a post on
// 'publishing' while it makes a handful of synchronous Graph API calls —
// normally seconds. Same rationale/threshold as STALE_RENDERING_THRESHOLD_MS:
// well above what a healthy run needs, so this only catches an aborted
// request or a crash outside publishPost()'s own try/catch.
const STALE_PUBLISHING_THRESHOLD_MS = 3 * 60 * 1000;

/**
 * Assembles everything a post detail view needs (full page or quick-view
 * sheet) — same shape either way so both surfaces stay in sync. Returns null
 * when the post doesn't exist or doesn't belong to this agency.
 */
export async function getPostDetailData(postId: string, agencyId: string): Promise<PostDetailData | null> {
  const supabase = await createClient();

  const { data: post } = await supabase.from("posts").select("*").eq("id", postId).eq("agency_id", agencyId).maybeSingle();
  if (!post) return null;

  // No background queue exists to notice a request that died mid-render
  // (exactly what happened during local testing: an aborted connection left
  // a post on 'rendering' forever). Reconcile lazily instead, the moment
  // anyone actually looks at this post.
  if (post.status === "rendering" && Date.now() - new Date(post.updated_at).getTime() > STALE_RENDERING_THRESHOLD_MS) {
    const staleError = "Renderen duurde te lang of werd onderbroken.";
    await supabase.from("posts").update({ status: "render_failed", render_error: staleError }).eq("id", postId);
    post.status = "render_failed";
    post.render_error = staleError;
    await notifyPostFailure(postId, "render", staleError);
  }

  if (post.status === "publishing" && Date.now() - new Date(post.updated_at).getTime() > STALE_PUBLISHING_THRESHOLD_MS) {
    const staleError = "Publiceren duurde te lang of werd onderbroken.";
    await supabase.from("posts").update({ status: "publish_failed" }).eq("id", postId);
    post.status = "publish_failed";
    await notifyPostFailure(postId, "publish", staleError);
  }

  // Safety net for the fire-and-forget queue trigger in
  // createAndSchedulePostAction — if that request never landed, this is what
  // actually gets the post render+published, using the ordinary session
  // client (RLS already allows an agency member to update their own posts
  // and insert post_jobs, exactly like the old synchronous flow did). Not
  // added to the list/calendar pages on purpose — those shouldn't trigger
  // heavy render work just from being viewed, see BACKLOG.md reasoning.
  if (post.status === "pending_render" && Date.now() - new Date(post.updated_at).getTime() > STALE_PENDING_RENDER_THRESHOLD_MS) {
    await processPendingPost(postId, supabase);
    const { data: refreshed } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
    if (refreshed) Object.assign(post, refreshed);
  }

  // Same idea as the stale-render check above: no webhook tells us Meta
  // actually published a scheduled post, so reconcile lazily on read — see
  // publishReconciliationService.ts.
  if (post.status === "scheduled" && post.scheduled_at && new Date(post.scheduled_at).getTime() < Date.now()) {
    await reconcilePublishedPosts([postId]);
    const { data: refreshed } = await supabase.from("posts").select("status").eq("id", postId).maybeSingle();
    if (refreshed) post.status = refreshed.status;
  }

  const [{ data: property }, { data: agency }, { data: slides }, { data: jobs }, { data: fonts }] = await Promise.all([
    supabase.from("properties").select("*").eq("id", post.property_id).maybeSingle(),
    supabase.from("agencies").select("name, logo_url").eq("id", agencyId).single(),
    supabase.from("post_slides").select("*").eq("post_id", postId).order("sort_order"),
    supabase.from("post_jobs").select("platform, status, error_message").eq("post_id", postId),
    supabase.from("agency_fonts").select("*").eq("agency_id", agencyId),
  ]);

  if (!property) return null;

  const firstSlide = slides?.[0];

  let componentSource: string | null = null;
  let scenesByFormat: ScenesByFormat | null = null;
  // Real slide count for a templated post is however many post_slides rows
  // it actually has (photo-count-driven, see actions.ts), not the template's
  // own agency_templates.slide_count — see PLAN_TEMPLATE_EDITOR.md Phase B.
  const slideCount = Math.max(slides?.length ?? 1, 1);
  let previewData: TemplateRenderProps;

  if (post.agency_template_id) {
    const { data: template } = await supabase.from("agency_templates").select("*").eq("id", post.agency_template_id).maybeSingle();
    if (!template) return null;

    const slideText = (firstSlide?.text_content ?? {}) as { title?: string; description?: string | null };
    componentSource = template.component_source;
    scenesByFormat = template.scenes_by_format;
    previewData = buildTemplateRenderProps({
      property,
      // This post's own chosen photos, in slide order — not every property
      // photo, see renderDataService.ts's getSlideRenderData for the same fix.
      images: (slides ?? []).map((slide) => ({ image_url: slide.image_url, sort_order: slide.sort_order })),
      config: template.config as unknown as TemplateConfig,
      agencyName: agency?.name ?? "",
      fonts: fonts ?? [],
      overrides: {
        title: slideText.title,
        description: slideText.description ?? undefined,
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

  const renderOverridden = (slides ?? []).some((slide) => slide.render_overridden);

  return {
    postId,
    property,
    propertyTitle: property.title,
    initialCaption: post.caption,
    scheduledAt: post.scheduled_at,
    status: post.status,
    jobs: jobs ?? [],
    componentSource,
    scenesByFormat,
    canvasFormat: post.canvas_format,
    canvasMode: post.canvas_mode,
    canvasHeight: post.canvas_height,
    slideCount,
    previewData,
    agencyName: agency?.name ?? "",
    agencyLogo: agency?.logo_url ?? undefined,
    renderError: post.render_error,
    renderOverridden,
    renderedImageUrls: (slides ?? []).map((slide) => slide.rendered_image_url),
  };
}
