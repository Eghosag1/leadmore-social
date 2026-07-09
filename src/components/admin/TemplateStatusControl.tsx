"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TemplateStatusBadge } from "@/components/shared/StatusBadge";
import {
  archiveAgencyTemplateAction,
  unarchiveAgencyTemplateAction,
  validateAgencyTemplateAction,
} from "@/app/admin/agencies/[id]/templates/actions";
import type { TemplateStatus } from "@/types/enums";

/**
 * Replaces the old is_active toggle: shows the template's validation status
 * and, depending on it, either a "Valideer & publiceer" action (draft/failed
 * — compiles the TSX, generates its Tailwind CSS, and test-renders every
 * slide with dummy data, see validateAndPublishTemplate) or an archive
 * toggle (published/archived — archiving never touches the already-validated
 * compiled_css, so unarchiving needs no revalidation).
 */
export function TemplateStatusControl({
  agencyId,
  templateId,
  status,
  validationError,
}: {
  agencyId: string;
  templateId: string;
  status: TemplateStatus;
  validationError: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [lastError, setLastError] = useState(validationError);

  function handleValidate() {
    startTransition(async () => {
      const result = await validateAgencyTemplateAction(agencyId, templateId);
      setLastError(result.error ?? null);
      if (!result.ok) toast.error("Validatie mislukt — zie de foutmelding hieronder.");
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <TemplateStatusBadge status={status} />
        {(status === "draft" || status === "failed") && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={handleValidate}>
            {isPending ? "Bezig..." : "Valideer & publiceer"}
          </Button>
        )}
        {(status === "published" || status === "archived") && (
          <div className="flex items-center gap-2">
            <Switch
              checked={status === "published"}
              disabled={isPending}
              onCheckedChange={(checked) => {
                startTransition(() => {
                  const action = checked ? unarchiveAgencyTemplateAction : archiveAgencyTemplateAction;
                  action(agencyId, templateId);
                });
              }}
            />
            <span className="text-xs text-muted-foreground">{status === "published" ? "Actief" : "Gearchiveerd"}</span>
          </div>
        )}
      </div>
      {status === "failed" && lastError && <p className="max-w-xs text-xs text-destructive">{lastError}</p>}
    </div>
  );
}
