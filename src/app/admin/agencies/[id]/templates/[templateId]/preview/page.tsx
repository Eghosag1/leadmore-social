import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { TemplatePreviewClient, type PreviewPropertyOption } from "@/components/admin/TemplatePreviewClient";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAgencyTemplate } from "@/services/templates/templateService";
import { EXAMPLE_PROPERTY, EXAMPLE_PROPERTY_IMAGES } from "@/data/mock/example-property";
import type { TemplateConfig } from "@/types/domain";

export default async function AgencyTemplatePreviewPage({
  params,
}: {
  params: Promise<{ id: string; templateId: string }>;
}) {
  const { id, templateId } = await params;
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const [{ data: agency }, template, { data: properties }] = await Promise.all([
    supabase.from("agencies").select("id, name, custom_font_url, custom_font_family").eq("id", id).maybeSingle(),
    getAgencyTemplate(templateId),
    supabase.from("properties").select("*").eq("agency_id", id).order("created_at", { ascending: false }).limit(20),
  ]);

  if (!agency || !template || template.agency_id !== id) notFound();

  const propertyIds = (properties ?? []).map((p) => p.id);
  const { data: images } = propertyIds.length
    ? await supabase.from("property_images").select("*").in("property_id", propertyIds)
    : { data: [] };

  const imagesByProperty = new Map<string, typeof images>();
  for (const image of images ?? []) {
    imagesByProperty.set(image.property_id, [...(imagesByProperty.get(image.property_id) ?? []), image]);
  }

  const propertyOptions: PreviewPropertyOption[] =
    properties && properties.length > 0
      ? properties.map((property) => ({ property, images: imagesByProperty.get(property.id) ?? [] }))
      : [{ property: EXAMPLE_PROPERTY, images: EXAMPLE_PROPERTY_IMAGES }];

  return (
    <div>
      <PageHeader
        title={`Preview — ${template.name}`}
        description={agency.name}
        backHref={`/admin/agencies/${id}/templates/${templateId}`}
        backLabel={template.name}
      />
      <Card className="max-w-xl">
        <CardContent className="pt-6">
          <TemplatePreviewClient
            componentSource={template.component_source}
            templateKey={template.template_key}
            slideCount={template.slide_count}
            type={template.type}
            config={template.config as unknown as TemplateConfig}
            agencyName={agency.name}
            customFontFamily={agency.custom_font_family ?? undefined}
            customFontUrl={agency.custom_font_url ?? undefined}
            properties={propertyOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
