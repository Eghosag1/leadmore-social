"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createSceneAgencyTemplate, updateAgencyTemplateScenes } from "@/services/templates/templateService";
import type { TemplateType } from "@/types/enums";
import type { ScenesByFormat } from "@/types/scene";

/**
 * Creates a blank scene-based template and sends the admin straight into the
 * editor for it — the visual-editor counterpart of createAgencyTemplateAction
 * (which creates a blank component_source template and lands on the code
 * editor instead). A plain form action (FormData), not startTransition, since
 * this is the one step that's still a simple name/type/billing form, not a
 * nested-JSON scene payload.
 */
export async function createSceneTemplateAction(agencyId: string, formData: FormData): Promise<void> {
  await requireRole(["super_admin"]);

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const type = String(formData.get("type") ?? "single") as TemplateType;
  const includedInPlan = formData.get("includedInPlan") === "on";

  if (!name) redirect(`/admin/agencies/${agencyId}/templates/new?error=${encodeURIComponent("Vul een naam in.")}`);

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("agency_templates")
    .select("sort_order")
    .eq("agency_id", agencyId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSortOrder = (existing?.[0]?.sort_order ?? 0) + 1;

  const template = await createSceneAgencyTemplate({ agencyId, name, description, type, includedInPlan, sortOrder: nextSortOrder });

  redirect(`/admin/agencies/${agencyId}/templates/${template.id}/editor`);
}

export interface SaveScenesResult {
  ok: boolean;
  error?: string;
}

/**
 * Plain async function (not useActionState + FormData) — called directly via
 * startTransition from SceneEditor.tsx, because a Scene's nested element
 * array doesn't serialize cleanly through <input> fields the way the flat
 * component_source form does. "Opslaan als concept" only — never publishes;
 * see validateAgencyTemplateAction (already generic over any templateId) for
 * "Valideren en publiceren", reused unchanged.
 */
export async function saveTemplateScenesAction(
  agencyId: string,
  templateId: string,
  scenesByFormat: ScenesByFormat,
): Promise<SaveScenesResult> {
  await requireRole(["super_admin"]);
  try {
    await updateAgencyTemplateScenes(templateId, scenesByFormat);
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
  revalidatePath(`/admin/agencies/${agencyId}/templates/${templateId}/editor`);
  revalidatePath(`/admin/agencies/${agencyId}`);
  return { ok: true };
}
