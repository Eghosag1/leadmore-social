import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { tokenEncryptionKey } from "@/lib/meta/env";

// Same HMAC-derived-key approach as src/lib/render/token.ts, with its own
// context string so it doesn't share a key with that one even though both
// trace back to the same TOKEN_ENCRYPTION_KEY.
function hmacKey(): Buffer {
  return createHmac("sha256", tokenEncryptionKey()).update("internal-queue-token").digest();
}

/**
 * Authorizes the fire-and-forget server-to-server request from
 * createAndSchedulePostAction to /api/internal/process-post-queue — that
 * route has no user session to check against (it's a separate function
 * invocation), so this signature is what stops it from being hit by an
 * outsider who guesses a postId. See src/services/posts/postQueueService.ts.
 */
export function signQueueToken(postId: string): string {
  return createHmac("sha256", hmacKey()).update(postId).digest("hex");
}

export function verifyQueueToken(postId: string, token: string): boolean {
  const expected = signQueueToken(postId);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(token, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
