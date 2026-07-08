import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { tokenEncryptionKey } from "@/lib/meta/env";

// Derived from TOKEN_ENCRYPTION_KEY with a distinct context string, so this
// doesn't share a key with the AES token encryption in token-encryption.ts
// even though both ultimately trace back to one env var.
function hmacKey(): Buffer {
  return createHmac("sha256", tokenEncryptionKey()).update("meta-oauth-state").digest();
}

/**
 * Signs `agencyId` into an opaque state token for the Meta OAuth `state`
 * param. The person completing the Facebook consent screen isn't
 * necessarily logged into Leadmore Social, so this signature — not a
 * session — is what lets the callback route trust which agency an
 * authorization is for.
 */
export function signState(agencyId: string): string {
  const nonce = randomBytes(8).toString("hex");
  const payload = `${agencyId}.${nonce}`;
  const signature = createHmac("sha256", hmacKey()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

/** Verifies a state token produced by signState(); returns the agencyId, or null if invalid/tampered. */
export function verifyState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [agencyId, nonce, signature] = decoded.split(".");
    if (!agencyId || !nonce || !signature) return null;

    const expected = createHmac("sha256", hmacKey()).update(`${agencyId}.${nonce}`).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) return null;

    return agencyId;
  } catch {
    return null;
  }
}
