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
/** Long-lived token for Leadmore's own Business Manager System User — only needed for the Business Portfolio connect path. */
export const metaSystemUserToken = () => readEnv("META_SYSTEM_USER_TOKEN");
/** Optional — Leadmore's own Business Manager ID, shown in the Business Manager connect guide so an agency knows what to enter when sharing their Page as a partner. Purely informational, Meta's API never needs it from us. */
export const metaBusinessManagerId = (): string | undefined => process.env.META_BUSINESS_MANAGER_ID;
