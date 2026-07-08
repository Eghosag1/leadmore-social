import "server-only";

// Same fail-loudly pattern as src/lib/supabase/env.ts — a missing var throws
// a clear message instead of a cryptic error deep inside a fetch call.
function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.local.example to .env.local and fill in your Meta app credentials.`);
  }
  return value;
}

export const metaAppId = () => readEnv("META_APP_ID");
export const metaAppSecret = () => readEnv("META_APP_SECRET");
export const metaRedirectUri = () => readEnv("META_REDIRECT_URI");
export const tokenEncryptionKey = () => readEnv("TOKEN_ENCRYPTION_KEY");
