import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const ROLE_LABELS = { agency_admin: "Beheerder", agency_user: "Medewerker" } as const;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const current = await requireRole(["agency_admin", "agency_user"]);
  const supabase = await createClient();

  const { data: agency } = await supabase
    .from("agencies")
    .select("name, logo_url")
    .eq("id", current.profile.agency_id!)
    .single();

  return (
    <AppShell
      navVariant="agency"
      brandName={agency?.name ?? "Uw kantoor"}
      brandSubLabel="Social media dashboard"
      logoUrl={agency?.logo_url}
      user={{
        name: current.profile.full_name,
        roleLabel: ROLE_LABELS[current.profile.role as "agency_admin" | "agency_user"] ?? current.profile.role,
      }}
    >
      {children}
    </AppShell>
  );
}
