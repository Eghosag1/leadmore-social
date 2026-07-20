"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { archiveAgencyTemplate, deleteAgencyTemplate, unarchiveAgencyTemplate } from "@/services/templates/templateService";
import { validateAndPublishTemplate } from "@/services/templates/templateValidationService";

export async function archiveAgencyTemplateAction(agencyId: string, templateId: string): Promise<void> {
  await requireRole(["super_admin"]);
  await archiveAgencyTemplate(templateId);
  revalidatePath(`/admin/agencies/${agencyId}`);
}

export interface DeleteTemplateResult {
  ok: boolean;
  error?: string;
}

/** Only succeeds for a template no post has ever used — see deleteAgencyTemplate's on-delete-restrict note. */
export async function deleteAgencyTemplateAction(agencyId: string, templateId: string): Promise<DeleteTemplateResult> {
  await requireRole(["super_admin"]);
  const result = await deleteAgencyTemplate(templateId);
  revalidatePath(`/admin/agencies/${agencyId}`);
  return result.ok ? { ok: true } : { ok: false, error: result.message };
}

export async function unarchiveAgencyTemplateAction(agencyId: string, templateId: string): Promise<void> {
  await requireRole(["super_admin"]);
  await unarchiveAgencyTemplate(templateId);
  revalidatePath(`/admin/agencies/${agencyId}`);
}

export interface ValidateTemplateResult {
  ok: boolean;
  error?: string;
}

/** Compiles the template, generates its Tailwind CSS, and test-renders every slide with dummy property data — only on full success does the template become selectable by the agency (see validateAndPublishTemplate). Shared by componentSource templates (legacy, no longer editable — see the removed TemplateForm) and scene templates (SceneEditor.tsx). */
export async function validateAgencyTemplateAction(agencyId: string, templateId: string): Promise<ValidateTemplateResult> {
  const current = await requireRole(["super_admin"]);
  const result = await validateAndPublishTemplate(templateId, current.profile.id);
  revalidatePath(`/admin/agencies/${agencyId}`);
  revalidatePath(`/admin/agencies/${agencyId}/templates/${templateId}/editor`);
  return result;
}
