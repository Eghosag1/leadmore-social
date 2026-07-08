"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAgencyTemplate, setAgencyTemplateActive, updateAgencyTemplate } from "@/services/templates/templateService";
import type { TemplateConfig } from "@/types/domain";

export interface CreateTemplateState {
  error: string | null;
}

/** Admin action: create a template directly for this agency from pasted TSX source (see createAgencyTemplate). */
export async function createAgencyTemplateAction(
  agencyId: string,
  _prev: CreateTemplateState,
  formData: FormData,
): Promise<CreateTemplateState> {
  await requireRole(["super_admin"]);

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const componentSource = String(formData.get("componentSource") ?? "");
  const slideCount = Math.max(1, Number(formData.get("slideCount") ?? 1) || 1);
  const includedInPlan = formData.get("includedInPlan") === "on";
  const brandColor = String(formData.get("brandColor") ?? "#111827");
  const secondaryColor = String(formData.get("secondaryColor") ?? "#6b7280");
  const ctaText = String(formData.get("ctaText") ?? "").trim();
  const badgeText = String(formData.get("badgeText") ?? "").trim();

  if (!name || !componentSource.trim()) return { error: "Vul een naam in en schrijf de template-broncode." };

  const config: TemplateConfig = {
    brand: { brandColor, secondaryColor, ctaText: ctaText || undefined },
    fields: {
      showPrice: true,
      showBedrooms: true,
      showBathrooms: true,
      showSurface: true,
      showDescription: true,
      showAgentName: true,
    },
    defaultTexts: { badgeText: badgeText || undefined },
  };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("agency_templates")
    .select("sort_order")
    .eq("agency_id", agencyId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSortOrder = (existing?.[0]?.sort_order ?? 0) + 1;

  await createAgencyTemplate({
    agencyId,
    name,
    description,
    componentSource,
    slideCount,
    postFormat: "feed",
    config,
    includedInPlan,
    sortOrder: nextSortOrder,
  });

  redirect(`/admin/agencies/${agencyId}`);
}

export async function toggleAgencyTemplateActiveAction(agencyId: string, templateId: string, isActive: boolean): Promise<void> {
  await requireRole(["super_admin"]);
  await setAgencyTemplateActive(templateId, isActive);
  revalidatePath(`/admin/agencies/${agencyId}`);
}

export interface UpdateTemplateState {
  error: string | null;
}

export async function updateAgencyTemplateAction(
  agencyId: string,
  templateId: string,
  _prev: UpdateTemplateState,
  formData: FormData,
): Promise<UpdateTemplateState> {
  await requireRole(["super_admin"]);

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const componentSource = String(formData.get("componentSource") ?? "");
  const slideCount = Math.max(1, Number(formData.get("slideCount") ?? 1) || 1);
  const brandColor = String(formData.get("brandColor") ?? "#111827");
  const secondaryColor = String(formData.get("secondaryColor") ?? "#6b7280");
  const ctaText = String(formData.get("ctaText") ?? "").trim();
  const badgeText = String(formData.get("badgeText") ?? "").trim();
  const billableType = String(formData.get("billableType") ?? "included") as "included" | "regie";

  if (!name || !componentSource.trim()) return { error: "Vul een naam in en schrijf de template-broncode." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("agency_templates").select("config").eq("id", templateId).single();
  const currentConfig = (current?.config ?? { brand: {}, fields: {} }) as unknown as TemplateConfig;

  await updateAgencyTemplate({
    id: templateId,
    name,
    description,
    componentSource,
    slideCount,
    billableType,
    includedInPlan: billableType === "included",
    config: {
      ...currentConfig,
      brand: { ...currentConfig.brand, brandColor, secondaryColor, ctaText: ctaText || undefined },
      defaultTexts: { ...currentConfig.defaultTexts, badgeText: badgeText || undefined },
    },
  });

  revalidatePath(`/admin/agencies/${agencyId}/templates/${templateId}`);
  revalidatePath(`/admin/agencies/${agencyId}`);
  return { error: null };
}
