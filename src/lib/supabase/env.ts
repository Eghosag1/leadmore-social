// Centralised env access so a missing .env.local fails loudly in one place
// instead of as a cryptic "Invalid URL" deep inside a Supabase client call.
//
// The two NEXT_PUBLIC_ vars are deliberately read via a literal
// `process.env.NEXT_PUBLIC_X` expression each, not a shared `readEnv(name)`
// helper with a dynamic `process.env[name]` lookup — Next.js's client-bundle
// env inlining only replaces statically-analyzable literal references at
// build time; a dynamic key is invisible to that step, so in the browser
// `process.env[name]` silently evaluates to `undefined` and every call
// (e.g. every client-side Storage upload via src/lib/supabase/client.ts)
// falls through to the placeholder fallback instead of the real project.
// Found 2026-07-14 via FontUploader/LogoUploader both failing with
// `ERR_CONNECTION_REFUSED` against http://localhost:54321 in the browser,
// despite server-rendered pages using the real Supabase project correctly.

function readEnv(name: string, value: string | undefined, fallback?: string): string {
  const resolved = value ?? fallback;
  if (!resolved) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.local.example to .env.local and fill in your Supabase project credentials.`,
    );
  }
  return resolved;
}

export const supabaseUrl = () => readEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL, "http://localhost:54321");
export const supabaseAnonKey = () =>
  readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "public-anon-key-placeholder");
export const supabaseServiceRoleKey = () => readEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
