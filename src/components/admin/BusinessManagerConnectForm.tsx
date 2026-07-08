"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { BusinessManagerConnectState } from "@/app/admin/agencies/actions";

/**
 * Alternative to "Verbind met Facebook" for Pages inside a Business
 * Portfolio, where the personal OAuth Page-picker doesn't reliably surface
 * the Page (see CLAUDE.md). The agency must first share their Page with
 * Leadmore's Business Manager as a partner (Business Settings → Pages →
 * Assign Partner) — a manual step on their end, no API replaces it.
 */
export function BusinessManagerConnectForm({
  action,
}: {
  action: (prev: BusinessManagerConnectState, formData: FormData) => Promise<BusinessManagerConnectState>;
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-neutral-200 p-3">
      <div>
        <p className="text-sm font-medium text-neutral-900">Pagina binnen een Business Portfolio?</p>
        <p className="text-xs text-muted-foreground">
          Laat het kantoor hun Pagina eerst delen met Leadmore&apos;s Business Manager als partner (Business Settings
          → Pages → Assign Partner). Vul daarna hier het Facebook-pagina ID in.
        </p>
      </div>
      <form action={formAction} className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="businessManagerPageId">Facebook-pagina ID</Label>
          <Input id="businessManagerPageId" name="businessManagerPageId" placeholder="1234567890" />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          {isPending ? "Bezig..." : "Koppel via Business Manager"}
        </Button>
      </form>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
