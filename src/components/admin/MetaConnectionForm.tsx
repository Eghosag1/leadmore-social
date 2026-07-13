"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { MetaConnectionFormState } from "@/app/admin/agencies/actions";
import type { SocialConnectionRow } from "@/types/database";

export function MetaConnectionForm({
  action,
  connection,
}: {
  action: (prev: MetaConnectionFormState, formData: FormData) => Promise<MetaConnectionFormState>;
  connection: SocialConnectionRow | null;
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="facebookPageId">Facebook-pagina ID</Label>
        <Input
          key={connection?.facebook_page_id}
          id="facebookPageId"
          name="facebookPageId"
          defaultValue={connection?.facebook_page_id ?? ""}
          placeholder="1234567890"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="instagramAccountId">Instagram-account ID</Label>
        <Input
          key={connection?.instagram_account_id}
          id="instagramAccountId"
          name="instagramAccountId"
          defaultValue={connection?.instagram_account_id ?? ""}
          placeholder="1234567890"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="accessToken">Access token{connection?.access_token_encrypted && " (ingesteld)"}</Label>
        {/* Never echo a stored secret back into the form — blank means "keep the current token", see updateAgencyMetaConnectionAction. */}
        <Input id="accessToken" name="accessToken" type="password" placeholder="Laat leeg om het huidige token te behouden" />
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isPending} size="sm" className="w-fit">
        {isPending ? "Bezig..." : "Meta-koppeling opslaan"}
      </Button>
    </form>
  );
}
