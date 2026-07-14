"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction, type RequestPasswordResetState } from "@/lib/auth-actions";

const initialState: RequestPasswordResetState = { status: "idle" };

/**
 * Server action (auth-actions.ts) instead of a direct client-side Supabase
 * call — the IP-based rate limit only works server-side (next/headers), a
 * client-only call would have no gate an attacker's script couldn't skip.
 */
export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, initialState);
  const [email, setEmail] = useState("");

  if (state.status === "sent") {
    return (
      <p className="text-sm text-muted-foreground">
        Als er een account bestaat voor <strong>{email}</strong>, is er net een e-mail verstuurd met een link om een
        nieuw wachtwoord in te stellen.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mailadres</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="naam@kantoor.be"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {state.status === "rate_limited" && (
        <p className="text-sm font-medium text-destructive">Te veel aanvragen. Probeer het over enkele minuten opnieuw.</p>
      )}
      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? "Bezig..." : "Verstuur resetlink"}
      </Button>
    </form>
  );
}
