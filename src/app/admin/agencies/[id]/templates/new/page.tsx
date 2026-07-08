import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { TemplateForm } from "@/components/admin/TemplateForm";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAgencyTemplateAction } from "../actions";

export default async function NewAgencyTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const { data: agency } = await supabase.from("agencies").select("id, name").eq("id", id).maybeSingle();
  if (!agency) notFound();

  const boundAction = createAgencyTemplateAction.bind(null, id);

  return (
    <div>
      <PageHeader
        title={`Nieuwe template — ${agency.name}`}
        description="Schrijf de template-broncode voor dit kantoor. Er is geen gedeelde basistemplate — kies eventueel een voorbeeld als startpunt."
        backHref={`/admin/agencies/${id}`}
        backLabel={agency.name}
      />
      <TemplateForm action={boundAction} agencyName={agency.name} mode="create" />
    </div>
  );
}
