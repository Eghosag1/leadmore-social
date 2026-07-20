"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogoUploader } from "@/components/admin/LogoUploader";
import type { AgencyFormState } from "@/app/admin/agencies/actions";
import type { AgencyRow } from "@/types/database";

export function AgencyForm({
  action,
  agency,
  pathPrefix,
  submitLabel,
}: {
  action: (prev: AgencyFormState, formData: FormData) => Promise<AgencyFormState>;
  agency?: AgencyRow;
  pathPrefix: string;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Naam van het kantoor</Label>
        <Input id="name" name="name" defaultValue={agency?.name} placeholder="Vastgoed De Voorbeeld" required />
      </div>

      <LogoUploader fieldName="logoUrl" initialUrl={agency?.logo_url} pathPrefix={pathPrefix} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="websiteUrl">Website (optioneel)</Label>
        <Input id="websiteUrl" name="websiteUrl" type="url" defaultValue={agency?.website_url ?? ""} placeholder="https://" />
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Bezig..." : submitLabel}
      </Button>
    </form>
  );
}
