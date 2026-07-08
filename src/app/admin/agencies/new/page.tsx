import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { AgencyForm } from "@/components/admin/AgencyForm";
import { requireRole } from "@/lib/auth";
import { createAgencyAction } from "../actions";

export default async function NewAgencyPage() {
  await requireRole(["super_admin"]);
  const uploadPrefix = crypto.randomUUID();

  return (
    <div>
      <PageHeader
        title="Nieuw vastgoedkantoor"
        description="Stap 1 — kantoor aanmaken en huisstijl instellen."
        backHref="/admin/agencies"
        backLabel="Vastgoedkantoren"
      />
      <Card className="max-w-xl">
        <CardContent className="pt-6">
          <AgencyForm action={createAgencyAction} pathPrefix={uploadPrefix} submitLabel="Kantoor aanmaken" />
        </CardContent>
      </Card>
    </div>
  );
}
