import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AgencyTemplateRow } from "@/types/database";
import type { TemplateConfig } from "@/types/domain";

/** Admin view: every template for one agency, active or not, including billing metadata. */
export async function listAgencyTemplatesForAdmin(agencyId: string): Promise<AgencyTemplateRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agency_templates")
    .select("*")
    .eq("agency_id", agencyId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Customer-facing view: only active templates, and only the columns an
 * agency user is allowed to see (billable_type / included_in_plan stay out —
 * that's internal pricing/ops info, not something agencies see in-product).
 */
export interface AgencyTemplateForCustomer {
  id: string;
  name: string;
  description: string | null;
  component_source: string;
  slide_count: number;
  type: AgencyTemplateRow["type"];
  post_format: AgencyTemplateRow["post_format"];
  config: TemplateConfig;
  preview_image_url: string | null;
  sort_order: number;
}

export async function listActiveAgencyTemplatesForCustomer(agencyId: string): Promise<AgencyTemplateForCustomer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agency_templates")
    .select("id, name, description, component_source, slide_count, type, post_format, config, preview_image_url, sort_order")
    .eq("agency_id", agencyId)
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  // config is stored as jsonb (Record<string, unknown> at the DB layer); we
  // trust it to match TemplateConfig because only createAgencyTemplate and
  // updateAgencyTemplate ever write to this column.
  return (data ?? []) as unknown as AgencyTemplateForCustomer[];
}

export async function getAgencyTemplate(id: string): Promise<AgencyTemplateRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("agency_templates").select("*").eq("id", id).maybeSingle();
  return data;
}

export interface CreateAgencyTemplateInput {
  agencyId: string;
  name: string;
  description: string | null;
  componentSource: string;
  slideCount: number;
  postFormat: AgencyTemplateRow["post_format"];
  config: TemplateConfig;
  includedInPlan: boolean;
  sortOrder: number;
}

/**
 * Core admin action: create a template directly for one agency from
 * admin-authored TSX source (compiled at runtime, see
 * src/lib/dynamic-template.ts). There is no shared catalog to pick from —
 * every template belongs to exactly one agency from the moment it's created,
 * and a new agency starts with zero templates.
 */
export async function createAgencyTemplate(input: CreateAgencyTemplateInput): Promise<AgencyTemplateRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agency_templates")
    .insert({
      agency_id: input.agencyId,
      name: input.name,
      description: input.description,
      component_source: input.componentSource,
      slide_count: input.slideCount,
      type: input.slideCount > 1 ? "carousel" : "single",
      post_format: input.postFormat,
      config: input.config as unknown as Record<string, unknown>,
      is_active: true,
      included_in_plan: input.includedInPlan,
      billable_type: input.includedInPlan ? "included" : "regie",
      sort_order: input.sortOrder,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Kon template niet aanmaken.");
  return data;
}

export interface UpdateAgencyTemplateInput {
  id: string;
  name?: string;
  description?: string | null;
  componentSource?: string;
  slideCount?: number;
  config?: TemplateConfig;
  isActive?: boolean;
  includedInPlan?: boolean;
  billableType?: AgencyTemplateRow["billable_type"];
  sortOrder?: number;
  previewImageUrl?: string | null;
}

export async function updateAgencyTemplate(input: UpdateAgencyTemplateInput): Promise<AgencyTemplateRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agency_templates")
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.componentSource !== undefined && { component_source: input.componentSource }),
      ...(input.slideCount !== undefined && {
        slide_count: input.slideCount,
        type: input.slideCount > 1 ? "carousel" : "single",
      }),
      ...(input.config !== undefined && { config: input.config as unknown as Record<string, unknown> }),
      ...(input.isActive !== undefined && { is_active: input.isActive }),
      ...(input.includedInPlan !== undefined && { included_in_plan: input.includedInPlan }),
      ...(input.billableType !== undefined && { billable_type: input.billableType }),
      ...(input.sortOrder !== undefined && { sort_order: input.sortOrder }),
      ...(input.previewImageUrl !== undefined && { preview_image_url: input.previewImageUrl }),
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Kon template niet bijwerken.");
  return data;
}

export async function setAgencyTemplateActive(id: string, isActive: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("agency_templates").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Maps a property + agency template config into the flat prop shape every
 * template React component accepts. Re-exported from the client-safe
 * src/lib/template-render.ts so the create-post live preview (a client
 * component) can build the exact same props without pulling in "server-only".
 */
export { buildTemplateRenderProps } from "@/lib/template-render";
