import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { supabaseServiceRoleKey, supabaseUrl } from "./env";

/**
 * Service-role Supabase client. Bypasses RLS entirely — never import this
 * from client components and never forward its result to the browser.
 *
 * Used for operations that model a trusted backend process rather than an
 * authenticated user action: CRM sync writing properties, the render
 * service writing rendered images, and the mock Meta scheduler flipping
 * post_jobs status (mirrors a real Meta webhook).
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
