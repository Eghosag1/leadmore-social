import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeleteAgencyButton } from "@/components/admin/DeleteAgencyButton";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AgenciesPage() {
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const { data: agencies } = await supabase.from("agencies").select("*").order("created_at", { ascending: false });
  const { data: templates } = await supabase.from("agency_templates").select("agency_id, is_active");
  const { data: properties } = await supabase.from("properties").select("agency_id");

  const templateCountByAgency = new Map<string, number>();
  for (const t of templates ?? []) {
    if (t.is_active) templateCountByAgency.set(t.agency_id, (templateCountByAgency.get(t.agency_id) ?? 0) + 1);
  }
  const propertyCountByAgency = new Map<string, number>();
  for (const p of properties ?? []) {
    propertyCountByAgency.set(p.agency_id, (propertyCountByAgency.get(p.agency_id) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        title="Vastgoedkantoren"
        description="Beheer alle aangesloten vastgoedkantoren."
        actions={
          <Button nativeButton={false} render={<Link href="/admin/agencies/new" />}>
            <Plus className="h-4 w-4" />
            Nieuw kantoor
          </Button>
        }
      />

      {!agencies || agencies.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 py-16 text-center text-sm text-muted-foreground">
          Nog geen vastgoedkantoren aangemaakt.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agencies.map((agency) => (
            <Card key={agency.id} className="h-full transition-colors hover:border-neutral-300">
              <CardContent className="flex flex-col gap-4 pt-6">
                <Link href={`/admin/agencies/${agency.id}`} className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100">
                      {agency.logo_url ? (
                        <Image src={agency.logo_url} alt={agency.name} width={44} height={44} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs font-semibold text-neutral-500">{agency.name.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">{agency.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{agency.website_url ?? agency.slug}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{propertyCountByAgency.get(agency.id) ?? 0} panden</Badge>
                    <Badge variant="secondary">{templateCountByAgency.get(agency.id) ?? 0} actieve templates</Badge>
                  </div>
                </Link>
                <div className="flex justify-end border-t border-neutral-100 pt-3">
                  <DeleteAgencyButton agencyId={agency.id} agencyName={agency.name} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
