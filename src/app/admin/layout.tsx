import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const current = await requireRole(["super_admin"]);

  return (
    <AppShell
      navVariant="admin"
      brandName="Leadmore Social"
      brandSubLabel="Platformbeheer"
      user={{ name: current.profile.full_name, roleLabel: "Platformbeheerder" }}
    >
      {children}
    </AppShell>
  );
}
