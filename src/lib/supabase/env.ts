// Centralised env access so a missing .env.local fails loudly in one place
// instead of as a cryptic "Invalid URL" deep inside a Supabase client call.

function readEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.local.example to .env.local and fill in your Supabase project credentials.`,
    );
  }
  return value;
}

export const supabaseUrl = () => readEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
export const supabaseAnonKey = () =>
  readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon-key-placeholder");
export const supabaseServiceRoleKey = () => readEnv("SUPABASE_SERVICE_ROLE_KEY");
