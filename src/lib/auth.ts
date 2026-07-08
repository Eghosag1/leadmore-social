import { redirect } from "next/navigation";
import type { ProfileRole } from "@/types/enums";
import type { ProfileRow } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  authUserId: string;
  email: string | null;
  profile: ProfileRow;
}

/** Returns the signed-in user's profile, or null if not authenticated / no profile yet. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();

  if (!profile) return null;

  return { authUserId: user.id, email: user.email ?? null, profile };
}

/** Redirects to /login when signed out, and to the correct home when the role doesn't match. */
export async function requireRole(allowed: ProfileRole[]): Promise<CurrentUser> {
  const current = await getCurrentUser();

  if (!current) {
    redirect("/login");
  }

  if (!allowed.includes(current.profile.role)) {
    redirect(current.profile.role === "super_admin" ? "/admin" : "/dashboard");
  }

  return current;
}

export function isAgencyRole(role: ProfileRole): boolean {
  return role === "agency_admin" || role === "agency_user";
}
