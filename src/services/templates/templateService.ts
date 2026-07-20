import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AgencyTemplateRow } from "@/types/database";
import type { TemplateConfig } from "@/types/domain";
import type { ScenesByFormat } from "@/types/scene";

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
  /** Non-null (with at least one format key) = a scene-based template (Phase C + formats follow-up) — see getFormatScenes()/resolveSceneForSlide(). */
  scenes_by_format: ScenesByFormat | null;
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
    .select(
      "id, name, description, component_source, scenes_by_format, slide_count, type, post_format, config, preview_image_url, sort_order",
    )
    .eq("agency_id", agencyId)
    .eq("status", "published")
    .order("sort_order");
  if (error) throw new Error(error.message);
  // config is stored as jsonb (Record<string, unknown> at the DB layer); we
  // trust it to match TemplateConfig because only createSceneAgencyTemplate
  // ever writes to this column (the old componentSource-editing path that
  // used to let an admin edit `config.brand`/`defaultTexts` freely has been
  // removed — see PLAN_TEMPLATE_EDITOR.md Phase E follow-up).
  return (data ?? []) as unknown as AgencyTemplateForCustomer[];
}

export async function getAgencyTemplate(id: string): Promise<AgencyTemplateRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("agency_templates").select("*").eq("id", id).maybeSingle();
  return data;
}

export interface CreateSceneAgencyTemplateInput {
  agencyId: string;
  name: string;
  description: string | null;
  type: AgencyTemplateRow["type"];
  includedInPlan: boolean;
  sortOrder: number;
}

/**
 * Creates a blank scene-based template (Phase C/E) — the only way to create
 * a template now (the old componentSource "paste TSX" authoring path was
 * removed entirely, see PLAN_TEMPLATE_EDITOR.md's Phase E follow-up).
 * `component_source` stays '' (its DB default, never used for a scene row)
 * and `scenes_by_format` starts null (nothing designed for any format yet);
 * the admin fills it in on the editor page this redirects to right after
 * creation. `slide_count` is
 * meaningless for a scene template (real
 * slide count is always however many photos the agency picks per post, see
 * resolveSceneForSlide/Phase B) so it's left at its default of 1 — only
 * `type` (set explicitly here, not derived from slide_count) drives whether
 * agencies see it under "Single post" or "Carousel".
 */
export async function createSceneAgencyTemplate(input: CreateSceneAgencyTemplateInput): Promise<AgencyTemplateRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agency_templates")
    .insert({
      agency_id: input.agencyId,
      name: input.name,
      description: input.description,
      component_source: "",
      type: input.type,
      post_format: "feed",
      config: { brand: { brandColor: "#111827", secondaryColor: "#6b7280" }, fields: {} } as unknown as Record<string, unknown>,
      status: "draft",
      included_in_plan: input.includedInPlan,
      billable_type: input.includedInPlan ? "included" : "regie",
      sort_order: input.sortOrder,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Kon template niet aanmaken.");
  return data;
}

/**
 * Saves the editor's in-progress scene JSON — resets validation back to
 * `draft` and clears the persisted compiled CSS, since a scene edit is
 * exactly as capable of breaking the render as an old componentSource edit
 * used to be. The whole scenes_by_format object is replaced wholesale each
 * save (the editor always holds the complete, current in-memory state for
 * every format/role, see SceneEditor.tsx) — a format or role explicitly
 * toggled off in the editor is simply absent/null in what gets sent here.
 */
export async function updateAgencyTemplateScenes(templateId: string, scenesByFormat: ScenesByFormat): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("agency_templates")
    .update({
      scenes_by_format: scenesByFormat,
      status: "draft",
      compiled_css: null,
      compiled_css_hash: null,
      validated_at: null,
      validation_error: null,
    })
    .eq("id", templateId);

  if (error) throw new Error(error.message);
}

/** Hides a published template from agencies without discarding its validated state — unarchiveAgencyTemplate restores it to `published` directly, no revalidation needed since the source hasn't changed. */
export async function archiveAgencyTemplate(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("agency_templates").update({ status: "archived" }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function unarchiveAgencyTemplate(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("agency_templates").update({ status: "published" }).eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Permanently removes a template. `posts.agency_template_id` is declared
 * `on delete restrict` (0001_init.sql) — Postgres itself refuses this
 * delete while any real post (draft or published, ever) still references
 * the template, surfacing as error code 23503. That's intentional: a
 * template used by a real post must stay resolvable for that post's own
 * detail/re-render/re-schedule flows, so deletion is only actually possible
 * for a template no agency ever used yet. `agency_template_versions` rows
 * cascade-delete automatically (0013_template_versions.sql).
 */
export async function deleteAgencyTemplate(id: string): Promise<{ ok: true } | { ok: false; reason: "in_use" | "unknown"; message: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("agency_templates").delete().eq("id", id);
  if (!error) return { ok: true };
  if (error.code === "23503") {
    return { ok: false, reason: "in_use", message: "Deze template is al gebruikt in minstens één post en kan daarom niet verwijderd worden. Archiveer de template in plaats daarvan." };
  }
  return { ok: false, reason: "unknown", message: error.message };
}

/**
 * Maps a property + agency template config into the flat prop shape every
 * template React component accepts. Re-exported from the client-safe
 * src/lib/template-render.ts so the create-post live preview (a client
 * component) can build the exact same props without pulling in "server-only".
 */
export { buildTemplateRenderProps } from "@/lib/template-render";
