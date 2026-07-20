"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createPost } from "@/services/posts/postSchedulerService";
import { parseScheduledAt } from "@/lib/scheduled-time";
import { signQueueToken } from "@/lib/queue/token";
import { siteUrl } from "@/lib/site-url";
import { clampCanvasHeight } from "@/lib/canvas-format";
import { CANVAS_FORMATS, type CanvasFormat, type Platform, type PostCanvasMode, type PostType } from "@/types/enums";

export interface CreatePostState {
  error: string | null;
}

// Mirrors CreatePostForm.tsx's maxCarouselPhotos — re-checked server-side,
// never trust the client-computed selection alone (same principle as
// clampCanvasHeight below). Instagram's real hard carousel limit is 10; a
// template with a fixed "end scene" (Phase C) reserves one of those slots
// for itself, so the effective cap depends on the chosen template.
const INSTAGRAM_CAROUSEL_LIMIT = 10;

export async function createAndSchedulePostAction(
  propertyId: string,
  _prevState: CreatePostState,
  formData: FormData,
): Promise<CreatePostState> {
  const current = await requireRole(["agency_admin", "agency_user"]);
  const agencyId = current.profile.agency_id!;
  const supabase = await createClient();

  const mode = String(formData.get("mode") ?? "template");
  const templateId = String(formData.get("templateId") ?? "");
  const postTypeField = String(formData.get("postType") ?? "single") as PostType;
  const title = String(formData.get("title") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim();
  const coverImageUrl = String(formData.get("coverImageUrl") ?? "");
  const ownPhotoUrls = formData.getAll("ownPhotoUrls").map(String);
  const platforms = formData.getAll("platforms").map(String) as Platform[];
  const postNow = formData.get("postNow") === "on";
  const scheduledDate = String(formData.get("scheduledDate") ?? "");
  const scheduledTime = String(formData.get("scheduledTime") ?? "");
  const canvasModeField = String(formData.get("canvasMode") ?? "fixed") as PostCanvasMode;

  if (platforms.length === 0) {
    return { error: "Kies minstens één platform (Facebook of Instagram)." };
  }

  // Re-clamp server-side rather than trusting the client-computed value —
  // this is a range check, not a re-measurement (no image-decode dependency
  // exists in this codebase to verify the number actually matches the
  // photo), but it does guarantee the persisted height can never break
  // Puppeteer's viewport or Meta's publish call. "Eigen foto's" mode never
  // gets a non-fixed canvas — see canvas-format.ts / CLAUDE.md.
  let canvasMode: PostCanvasMode = "fixed";
  let canvasHeight: number | null = null;
  if (mode === "template" && canvasModeField === "original") {
    const rawHeight = Number(formData.get("canvasHeight"));
    if (!Number.isFinite(rawHeight) || rawHeight <= 0) {
      return { error: "Ongeldig canvasformaat." };
    }
    canvasMode = "original";
    canvasHeight = clampCanvasHeight(rawHeight);
  }

  // "Nu posten" deliberately skips scheduling entirely — scheduledAt stays
  // `null` all the way down to facebookPublishingService/
  // instagramPublishingService, which both treat `null` as "publish
  // immediately" (see postSchedulerService.publishPost). A near-future
  // timestamp wouldn't work for this: Facebook rejects scheduled_publish_time
  // under 10 minutes out, so "now" has to be a real `null`, not just "close
  // to now".
  let scheduledAt: Date | null = null;
  if (!postNow) {
    if (!scheduledDate || !scheduledTime) {
      return { error: "Kies een datum en uur om de post in te plannen." };
    }
    scheduledAt = parseScheduledAt(scheduledDate, scheduledTime);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
      return { error: "Kies een datum en uur in de toekomst." };
    }
  }

  const description = String(formData.get("description") ?? "").trim() || null;
  // Which property field (or "manual") fed the title/description — kept for
  // traceability, see the field-binding controls in CreatePostForm.
  const titleSource = String(formData.get("titleSource") ?? "title");
  const descriptionSource = String(formData.get("descriptionSource") ?? "description");

  const { data: propertyImages } = await supabase.from("property_images").select("image_url").eq("property_id", propertyId);
  const validUrls = new Set((propertyImages ?? []).map((i) => i.image_url));
  const urls = postTypeField === "carousel" ? ownPhotoUrls : coverImageUrl ? [coverImageUrl] : [];

  if (urls.length === 0) {
    return { error: "Kies minstens één foto voor deze post." };
  }
  if (urls.some((url) => !validUrls.has(url))) {
    return { error: "Ongeldige foto geselecteerd." };
  }

  let agencyTemplateId: string | null = null;
  let postType: PostType = postTypeField;
  let canvasFormat: CanvasFormat | null = null;

  if (mode === "template") {
    if (!templateId) {
      return { error: "Kies een template voor u verdergaat." };
    }

    const { data: template } = await supabase
      .from("agency_templates")
      .select("id, slide_count, type, agency_id, scenes_by_format")
      .eq("id", templateId)
      .eq("agency_id", agencyId)
      .maybeSingle();

    if (!template) {
      return { error: "Deze template is niet (meer) beschikbaar." };
    }

    agencyTemplateId = template.id;
    postType = template.type as PostType;

    const scenesByFormat = template.scenes_by_format ?? {};
    const designedFormats = CANVAS_FORMATS.filter((format) => {
      const scenes = scenesByFormat[format];
      return scenes && (scenes.cover || scenes.content || scenes.end);
    });
    const hasEndScene = designedFormats.some((format) => scenesByFormat[format]?.end);

    if (designedFormats.length > 0) {
      // Scene template — never trust the client-submitted format, it must be
      // one this template actually has a scene designed for.
      const submittedFormat = String(formData.get("canvasFormat") ?? "");
      if (!designedFormats.includes(submittedFormat as CanvasFormat)) {
        return { error: "Ongeldig formaat geselecteerd." };
      }
      canvasFormat = submittedFormat as CanvasFormat;
    }

    const maxPhotos = hasEndScene ? INSTAGRAM_CAROUSEL_LIMIT - 1 : INSTAGRAM_CAROUSEL_LIMIT;
    if (urls.length > maxPhotos) {
      return { error: `Maximaal ${maxPhotos} foto's per carousel.` };
    }
  } else if (urls.length > INSTAGRAM_CAROUSEL_LIMIT) {
    return { error: `Maximaal ${INSTAGRAM_CAROUSEL_LIMIT} foto's per carousel.` };
  }

  // Every slide gets its own chosen photo — was `Array.from({length:
  // template.slide_count}, () => coverImageUrl)` for templated carousels
  // (always the same repeated photo); now identical to how "eigen foto's"
  // already worked, see PLAN_TEMPLATE_EDITOR.md Phase B.
  const slides = urls.map((url, index) => ({
    imageUrl: url,
    textContent: index === 0 ? { title, titleSource, description, descriptionSource } : { slideIndex: index },
  }));

  if (!title) {
    return { error: "Vul een titel in voor u verdergaat." };
  }

  const { postId } = await createPost({
    agencyId,
    propertyId,
    agencyTemplateId,
    postType,
    caption: caption || title,
    createdBy: current.profile.id,
    slides,
    platforms,
    canvasMode,
    canvasHeight,
    canvasFormat,
  });

  // The post now exists for real (chosen photo/template/platforms all
  // persisted) — from here on, failures are the post-detail page's concern
  // to resolve (retry / use original photo / check per-platform errors),
  // not something that should send the user back to a blank form.
  //
  // Rendering + publishing used to happen synchronously right here, which
  // meant this request had to wait out the full headless-Chromium render
  // time before it could redirect. Instead: mark the post pending_render and
  // trigger a separate route (its own function invocation, its own full
  // time budget — see src/app/api/internal/process-post-queue/route.ts)
  // via after() so it's guaranteed to actually fire even though redirect()
  // below unwinds this request immediately — a bare un-awaited fetch() would
  // race against the serverless function being frozen/torn down right after
  // the response is sent. If it still never lands, postDetailService.ts's
  // lazy safety-net picks the post up the next time anyone views it.
  await supabase.from("posts").update({ status: "pending_render", scheduled_at: scheduledAt?.toISOString() ?? null }).eq("id", postId);

  const token = signQueueToken(postId);
  const queueUrl = siteUrl();
  after(() =>
    fetch(`${queueUrl}/api/internal/process-post-queue`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId, token }),
    }).catch(() => {}),
  );

  redirect("/dashboard/scheduled?created=1");
}
