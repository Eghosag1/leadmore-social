import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Server-side Supabase client scoped to the current request's auth session.
 * Respects RLS as the signed-in user. Use `createAdminClient` (admin.ts)
 * only for trusted server-only operations that must bypass RLS.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render — the proxy refreshes the
          // session cookie instead, so this can be safely ignored.
        }
      },
    },
  });
}
