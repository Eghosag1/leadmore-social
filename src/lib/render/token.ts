import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { tokenEncryptionKey } from "@/lib/meta/env";

// Same HMAC-derived-key approach as src/lib/meta/state.ts, with its own
// context string so it doesn't share a key with the OAuth state signing even
// though both trace back to the same TOKEN_ENCRYPTION_KEY.
function hmacKey(): Buffer {
  return createHmac("sha256", tokenEncryptionKey()).update("internal-render-token").digest();
}

/**
 * Authorizes Puppeteer's server-to-server request to the internal render
 * page for one post — that page has no user session to check against, so
 * this signature is what stops it from being scraped by an outsider who
 * guesses a postId.
 */
export function signRenderToken(postId: string): string {
  return createHmac("sha256", hmacKey()).update(postId).digest("hex");
}

export function verifyRenderToken(postId: string, token: string): boolean {
  const expected = signRenderToken(postId);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(token, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
