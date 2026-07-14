"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site-url";

export interface SignInState {
  error: string | null;
}

const SIGN_IN_MAX_ATTEMPTS = 5;
const SIGN_IN_WINDOW_MS = 5 * 60 * 1000;

export async function signInAction(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Vul een e-mailadres en wachtwoord in." };
  }

  if (await isRateLimited("sign-in", SIGN_IN_MAX_ATTEMPTS, SIGN_IN_WINDOW_MS)) {
    return { error: "Te veel inlogpogingen. Probeer het over enkele minuten opnieuw." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Ongeldige inloggegevens. Probeer het opnieuw." };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", data.user.id).single();

  redirect(profile?.role === "super_admin" ? "/admin" : "/dashboard");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export interface RequestPasswordResetState {
  status: "idle" | "sent" | "rate_limited";
}

const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_WINDOW_MS = 5 * 60 * 1000;

/**
 * Server action so the rate limit (IP-keyed, via next/headers) can actually
 * be enforced — a client-side-only resetPasswordForEmail() call has no
 * server-side gate an attacker's script couldn't just skip. Always resolves
 * to "sent" on a real send, same anti-enumeration reasoning as before: never
 * reveal whether the address has an account. Only "rate_limited" differs in
 * message, which is fine — confirming "you're sending too many requests"
 * doesn't leak account existence.
 */
export async function requestPasswordResetAction(
  _prevState: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { status: "idle" };

  if (await isRateLimited("password-reset", PASSWORD_RESET_MAX_ATTEMPTS, PASSWORD_RESET_WINDOW_MS)) {
    return { status: "rate_limited" };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${siteUrl()}/reset-password` });
  return { status: "sent" };
}
