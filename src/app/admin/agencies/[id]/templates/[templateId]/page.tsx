import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { TemplateForm } from "@/components/admin/TemplateForm";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAgencyTemplate } from "@/services/templates/templateService";
import type { TemplateConfig } from "@/types/domain";
import { updateAgencyTemplateAction } from "../actions";

export default async function AgencyTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string; templateId: string }>;
}) {
  const { id, templateId } = await params;
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const [{ data: agency }, template] = await Promise.all([
    supabase.from("agencies").select("id, name").eq("id", id).maybeSingle(),
    getAgencyTemplate(templateId),
  ]);

  if (!agency || !template || template.agency_id !== id) notFound();

  const config = template.config as unknown as TemplateConfig;
  const boundAction = updateAgencyTemplateAction.bind(null, id, templateId);

  return (
    <div>
      <PageHeader
        title={template.name}
        description={agency.name}
        backHref={`/admin/agencies/${id}`}
        backLabel={agency.name}
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href={`/admin/agencies/${id}/templates/${templateId}/preview`} />}>
            <Eye className="h-4 w-4" />
            Preview met echt pand
          </Button>
        }
      />

      <TemplateForm
        action={boundAction}
        agencyName={agency.name}
        mode="edit"
        initial={{
          name: template.name,
          description: template.description ?? "",
          componentSource: template.component_source,
          slideCount: template.slide_count,
          brandColor: config.brand?.brandColor ?? "#111827",
          secondaryColor: config.brand?.secondaryColor ?? "#6b7280",
          ctaText: config.brand?.ctaText ?? "",
          badgeText: config.defaultTexts?.badgeText ?? "",
          billableType: template.billable_type,
        }}
      />
    </div>
  );
}
