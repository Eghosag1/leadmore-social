import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { tokenEncryptionKey } from "@/lib/meta/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function key(): Buffer {
  const hex = tokenEncryptionKey();
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters) — generate one with `openssl rand -hex 32`.");
  }
  return buf;
}

/** Encrypts a plaintext token for storage in `social_connections.access_token_encrypted`. */
export function encryptToken(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/** Reverses encryptToken(). Throws if the ciphertext is malformed or the key doesn't match (tampering/corruption). */
export function decryptToken(encoded: string): string {
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const encrypted = raw.subarray(IV_LENGTH + 16);

  const decipher = createDecipheriv(ALGORITHM, key(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
