import "server-only";

// Same fail-loudly pattern as src/lib/qstash-env.ts — a missing var throws a
// clear message instead of a cryptic error deep inside a fetch call.
function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.local.example to .env.local and fill in your Resend credentials.`);
  }
  return value;
}

/** From the Resend dashboard's API Keys page. */
export const resendApiKey = () => readEnv("RESEND_API_KEY");
/** Must be an address on a domain verified in Resend — e.g. notificaties@leadmoresocial.be. */
export const resendFromEmail = () => readEnv("RESEND_FROM_EMAIL");
