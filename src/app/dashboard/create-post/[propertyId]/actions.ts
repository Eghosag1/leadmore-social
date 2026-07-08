"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createPost, schedulePost } from "@/services/posts/postSchedulerService";
import { parseScheduledAt } from "@/lib/scheduled-time";
import type { Platform, PostType } from "@/types/enums";

export interface CreatePostState {
  error: string | null;
}

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
  const scheduledDate = String(formData.get("scheduledDate") ?? "");
  const scheduledTime = String(formData.get("scheduledTime") ?? "");

  if (platforms.length === 0) {
    return { error: "Kies minstens één platform (Facebook of Instagram)." };
  }
  if (!scheduledDate || !scheduledTime) {
    return { error: "Kies een datum en uur om de post in te plannen." };
  }

  const scheduledAt = parseScheduledAt(scheduledDate, scheduledTime);
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
    return { error: "Kies een datum en uur in de toekomst." };
  }

  const description = String(formData.get("description") ?? "").trim() || null;
  // Which property field (or "manual") fed the title/description — kept for
  // traceability, see the field-binding controls in CreatePostForm.
  const titleSource = String(formData.get("titleSource") ?? "title");
  const descriptionSource = String(formData.get("descriptionSource") ?? "description");

  let agencyTemplateId: string | null = null;
  let postType: PostType = postTypeField;
  let slides: { imageUrl: string; textContent: Record<string, unknown> }[];
  let imageUrls: string[];

  if (mode === "own") {
    const { data: propertyImages } = await supabase
      .from("property_images")
      .select("image_url")
      .eq("property_id", propertyId);
    const validUrls = new Set((propertyImages ?? []).map((i) => i.image_url));

    const urls = postTypeField === "carousel" ? ownPhotoUrls : coverImageUrl ? [coverImageUrl] : [];
    if (urls.length === 0) {
      return { error: "Kies minstens één foto voor deze post." };
    }
    if (urls.some((url) => !validUrls.has(url))) {
      return { error: "Ongeldige foto geselecteerd." };
    }

    slides = urls.map((url, index) => ({
      imageUrl: url,
      textContent: index === 0 ? { title, titleSource, description, descriptionSource } : { slideIndex: index },
    }));
    imageUrls = urls;
  } else {
    if (!templateId || !coverImageUrl) {
      return { error: "Kies een template en foto voor u verdergaat." };
    }

    const { data: template } = await supabase
      .from("agency_templates")
      .select("id, slide_count, type, agency_id")
      .eq("id", templateId)
      .eq("agency_id", agencyId)
      .maybeSingle();

    if (!template) {
      return { error: "Deze template is niet (meer) beschikbaar." };
    }

    agencyTemplateId = template.id;
    postType = template.type as PostType;
    slides = Array.from({ length: template.slide_count }, (_, index) => ({
      imageUrl: coverImageUrl,
      textContent: index === 0 ? { title, titleSource, description, descriptionSource } : { slideIndex: index },
    }));
    imageUrls = [coverImageUrl];
  }

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
  });

  const result = await schedulePost({
    postId,
    agencyId,
    platforms,
    scheduledAt: scheduledAt.toISOString(),
    caption: caption || title,
    imageUrls,
  });

  if (!result.ok) {
    return {
      error: `Post aangemaakt maar inplannen mislukte voor: ${result.failedPlatforms.join(", ")}. Controleer uw Meta-koppeling.`,
    };
  }

  redirect("/dashboard/scheduled?created=1");
}
