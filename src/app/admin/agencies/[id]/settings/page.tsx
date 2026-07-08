import { notFound } from "next/navigation";
import { CheckCircle2, Link2, RefreshCw, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/PageHeader";
import { AgencyForm } from "@/components/admin/AgencyForm";
import { MetaConnectionForm } from "@/components/admin/MetaConnectionForm";
import { BusinessManagerConnectForm } from "@/components/admin/BusinessManagerConnectForm";
import { CrmConnectionForm } from "@/components/admin/CrmConnectionForm";
import { DeleteAgencyButton } from "@/components/admin/DeleteAgencyButton";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  updateAgencyAction,
  syncAgencyCrmAction,
  updateAgencyMetaConnectionAction,
  updateAgencyCrmConnectionAction,
  startMetaConnectAction,
  connectAgencyViaBusinessManagerAction,
} from "../../actions";

export default async function AgencySettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ meta?: string; meta_error?: string }>;
}) {
  const { id } = await params;
  const { meta, meta_error: metaError } = await searchParams;
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const { data: agency } = await supabase.from("agencies").select("*").eq("id", id).maybeSingle();
  if (!agency) notFound();

  const [{ data: crmConnection }, { data: metaConnection }, { count: propertyCount }] = await Promise.all([
    supabase.from("crm_connections").select("*").eq("agency_id", id).maybeSingle(),
    supabase.from("social_connections").select("*").eq("agency_id", id).eq("provider", "meta").maybeSingle(),
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("agency_id", id),
  ]);

  const boundUpdate = updateAgencyAction.bind(null, agency.id);
  const boundSync = syncAgencyCrmAction.bind(null, agency.id);
  const boundMetaUpdate = updateAgencyMetaConnectionAction.bind(null, agency.id);
  const boundCrmUpdate = updateAgencyCrmConnectionAction.bind(null, agency.id);
  const boundMetaConnect = startMetaConnectAction.bind(null, agency.id);
  const boundBusinessManagerConnect = connectAgencyViaBusinessManagerAction.bind(null, agency.id);

  return (
    <div>
      <PageHeader
        title={`Instellingen — ${agency.name}`}
        description="Huisstijl en koppelingen voor dit kantoor."
        backHref={`/admin/agencies/${id}`}
        backLabel={agency.name}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Huisstijl</CardTitle>
          </CardHeader>
          <CardContent>
            <AgencyForm action={boundUpdate} agency={agency} pathPrefix={agency.id} submitLabel="Wijzigingen opslaan" />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {crmConnection?.status === "connected" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-neutral-400" />
                )}
                CRM-koppeling · {propertyCount ?? 0} panden
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <CrmConnectionForm action={boundCrmUpdate} connection={crmConnection ?? null} />
              <form action={boundSync}>
                <Button type="submit" size="sm" variant="outline">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Synchroniseren
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {metaConnection?.status === "connected" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-neutral-400" />
                )}
                Meta-koppeling (Facebook & Instagram)
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {meta === "connected" && (
                <Alert>
                  <AlertDescription>Facebook-koppeling gelukt.</AlertDescription>
                </Alert>
              )}
              {meta === "error" && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Facebook-koppeling mislukt. Probeer opnieuw, of vul de velden hieronder handmatig in.
                    {metaError && <span className="mt-1 block font-mono text-xs opacity-80">{metaError}</span>}
                  </AlertDescription>
                </Alert>
              )}
              <form action={boundMetaConnect}>
                <Button type="submit" size="sm" variant="outline">
                  <Link2 className="h-3.5 w-3.5" />
                  Verbind met Facebook
                </Button>
              </form>
              <BusinessManagerConnectForm action={boundBusinessManagerConnect} />
              <MetaConnectionForm action={boundMetaUpdate} connection={metaConnection ?? null} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <DeleteAgencyButton agencyId={agency.id} agencyName={agency.name} />
      </div>
    </div>
  );
}
