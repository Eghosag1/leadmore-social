import "server-only";
import { createClient } from "@/lib/supabase/server";
import { reconcilePublishedPosts } from "@/services/posts/publishReconciliationService";
import { processPendingPost } from "@/services/posts/postQueueService";
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
  templateKey: string | null;
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
  let templateKey: string | null = null;
  let slideCount = Math.max(slides?.length ?? 1, 1);
  let previewData: TemplateRenderProps;

  if (post.agency_template_id) {
    const { data: template } = await supabase.from("agency_templates").select("*").eq("id", post.agency_template_id).maybeSingle();
    if (!template) return null;

    const slideText = (firstSlide?.text_content ?? {}) as { title?: string; description?: string | null };
    componentSource = template.component_source;
    templateKey = template.template_key;
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
    templateKey,
    slideCount,
    previewData,
    agencyName: agency?.name ?? "",
    agencyLogo: agency?.logo_url ?? undefined,
    renderError: post.render_error,
    renderOverridden,
    renderedImageUrls: (slides ?? []).map((slide) => slide.rendered_image_url),
  };
}
