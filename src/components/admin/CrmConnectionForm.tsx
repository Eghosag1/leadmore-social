"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CRM_PROVIDERS } from "@/types/enums";
import type { CrmConnectionFormState } from "@/app/admin/agencies/actions";
import type { CrmConnectionRow } from "@/types/database";

export function CrmConnectionForm({
  action,
  connection,
}: {
  action: (prev: CrmConnectionFormState, formData: FormData) => Promise<CrmConnectionFormState>;
  connection: CrmConnectionRow | null;
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="provider">Provider</Label>
        <select
          id="provider"
          name="provider"
          defaultValue={connection?.provider ?? "mock"}
          className="h-9 w-fit rounded-md border border-input bg-background px-3 text-sm"
        >
          {CRM_PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="config">Config (JSON, optioneel)</Label>
        <Textarea
          id="config"
          name="config"
          rows={3}
          defaultValue={connection?.config && Object.keys(connection.config).length > 0 ? JSON.stringify(connection.config, null, 2) : ""}
          placeholder={'{ "apiKey": "..." }'}
          className="font-mono text-xs"
        />
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isPending} size="sm" className="w-fit">
        {isPending ? "Bezig..." : "CRM-koppeling opslaan"}
      </Button>
    </form>
  );
}
