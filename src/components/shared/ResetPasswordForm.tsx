"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/**
 * Landing point for the link Supabase emails from resetPasswordForEmail()
 * (see ForgotPasswordForm.tsx) — visiting that link gives the browser a
 * temporary recovery session automatically (handled by @supabase/ssr's
 * client), so this just needs to call updateUser({ password }) on it.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setStatus("error");
      return;
    }
    setStatus("pending");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      return;
    }
    router.push("/login");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Nieuw wachtwoord</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Minstens 8 tekens.</p>
      </div>
      {status === "error" && (
        <p className="text-sm font-medium text-destructive">
          Kon het wachtwoord niet instellen. De link is mogelijk verlopen — vraag een nieuwe aan.
        </p>
      )}
      <Button type="submit" disabled={status === "pending"} className="mt-2">
        {status === "pending" ? "Bezig..." : "Wachtwoord instellen"}
      </Button>
    </form>
  );
}
