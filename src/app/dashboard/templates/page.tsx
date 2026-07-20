import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScaledTemplateCanvas } from "@/components/templates/ScaledTemplateCanvas";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listActiveAgencyTemplatesForCustomer } from "@/services/templates/templateService";
import { buildTemplateRenderProps } from "@/lib/template-render";
import { EXAMPLE_PROPERTY, EXAMPLE_PROPERTY_IMAGES } from "@/data/mock/example-property";
import { CANVAS_FORMATS } from "@/types/enums";

export default async function TemplatesGalleryPage() {
  const current = await requireRole(["agency_admin", "agency_user"]);
  const agencyId = current.profile.agency_id!;
  const supabase = await createClient();

  const [templates, { data: agency }, { data: sampleProperty }, { data: fonts }] = await Promise.all([
    listActiveAgencyTemplatesForCustomer(agencyId),
    supabase.from("agencies").select("name, logo_url").eq("id", agencyId).single(),
    supabase.from("properties").select("*").eq("agency_id", agencyId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("agency_fonts").select("*").eq("agency_id", agencyId),
  ]);

  const property = sampleProperty ?? EXAMPLE_PROPERTY;
  let images = EXAMPLE_PROPERTY_IMAGES;
  if (sampleProperty) {
    const { data: propertyImages } = await supabase.from("property_images").select("*").eq("property_id", sampleProperty.id);
    images = propertyImages ?? [];
  }

  return (
    <div>
      <PageHeader title="Templates" description="De templates die voor uw kantoor beschikbaar zijn, in uw huisstijl." />

      {templates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 py-16 text-center text-sm text-muted-foreground">
          Er zijn nog geen templates voor uw kantoor. Neem contact op met uw accountbeheerder.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const previewData = buildTemplateRenderProps({
              property,
              images,
              config: template.config,
              agencyName: agency?.name ?? "",
              fonts: fonts ?? [],
            });
            // Thumbnail always shows the cover scene of the first designed
            // format — just a representative preview, not tied to any post's
            // actual chosen format.
            const firstDesignedFormat = CANVAS_FORMATS.find((format) => template.scenes_by_format?.[format]);
            return (
              <Card key={template.id} className="overflow-hidden py-0">
                <ScaledTemplateCanvas
                  {...(firstDesignedFormat
                    ? { scene: template.scenes_by_format![firstDesignedFormat]!.cover }
                    : { source: template.component_source })}
                  data={previewData}
                  className="rounded-none shadow-none"
                />
                <CardContent className="flex flex-col gap-1.5 pb-5 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-neutral-900">{template.name}</p>
                    <Badge variant="secondary">{template.type === "carousel" ? "Carousel" : "Single post"}</Badge>
                  </div>
                  {template.description && <p className="text-xs text-muted-foreground">{template.description}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
