"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { toggleAgencyTemplateActiveAction } from "@/app/admin/agencies/[id]/templates/actions";

export function ToggleTemplateActiveButton({
  agencyId,
  templateId,
  isActive,
}: {
  agencyId: string;
  templateId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={isActive}
        disabled={isPending}
        onCheckedChange={(checked) => {
          startTransition(() => {
            toggleAgencyTemplateActiveAction(agencyId, templateId, checked);
          });
        }}
      />
      <span className="text-xs text-muted-foreground">{isActive ? "Actief" : "Inactief"}</span>
    </div>
  );
}
