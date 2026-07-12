import "server-only";

// Same fail-loudly pattern as src/lib/meta/env.ts — a missing var throws a
// clear message instead of a cryptic error deep inside a fetch call.
function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.local.example to .env.local and fill in your Upstash QStash credentials.`);
  }
  return value;
}

/** Bearer token used to publish (schedule) messages to QStash — from the Upstash console. */
export const qstashToken = () => readEnv("QSTASH_TOKEN");
/** Used together to verify the Upstash-Signature header on incoming sweep-route calls — QStash rotates these, both must be checked. */
export const qstashCurrentSigningKey = () => readEnv("QSTASH_CURRENT_SIGNING_KEY");
export const qstashNextSigningKey = () => readEnv("QSTASH_NEXT_SIGNING_KEY");
