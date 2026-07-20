import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { SceneEditor } from "@/components/admin/scene-editor/SceneEditor";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildTemplateRenderProps } from "@/lib/template-render";
import { EXAMPLE_PROPERTY, EXAMPLE_PROPERTY_IMAGES } from "@/data/mock/example-property";
import type { TemplateConfig } from "@/types/domain";

/**
 * The visual scene editor (Phase E) — the only way to author a template now
 * (the old TemplateForm code-editing path was removed entirely). Renders
 * against the same EXAMPLE_PROPERTY dummy data every other admin preview
 * surface already uses, so the editor works even before the agency has any
 * real synced properties.
 */
export default async function TemplateEditorPage({ params }: { params: Promise<{ id: string; templateId: string }> }) {
  const { id, templateId } = await params;
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const [{ data: agency }, { data: template }] = await Promise.all([
    supabase.from("agencies").select("id, name").eq("id", id).maybeSingle(),
    supabase.from("agency_templates").select("*").eq("id", templateId).eq("agency_id", id).maybeSingle(),
  ]);
  if (!agency || !template) notFound();

  const { data: fonts } = await supabase.from("agency_fonts").select("*").eq("agency_id", id);

  const previewData = buildTemplateRenderProps({
    property: EXAMPLE_PROPERTY,
    images: EXAMPLE_PROPERTY_IMAGES,
    config: template.config as unknown as TemplateConfig,
    agencyName: agency.name,
    fonts: fonts ?? [],
  });

  return (
    <div>
      <PageHeader
        title={`Scène-editor — ${template.name}`}
        description="Sleep tekst, vormen, de pandfoto en het logo naar hun plek voor cover, inhoud en/of eindslide."
        backHref={`/admin/agencies/${id}`}
        backLabel={agency.name}
      />
      <SceneEditor
        agencyId={id}
        templateId={template.id}
        templateStatus={template.status}
        validationError={template.validation_error}
        initialScenesByFormat={template.scenes_by_format ?? {}}
        previewData={previewData}
        fonts={fonts ?? []}
      />
    </div>
  );
}
