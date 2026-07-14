import "server-only";
import { headers } from "next/headers";

/**
 * In-memory sliding-window rate limiter, keyed per bucket+IP. Deliberately
 * not Upstash-Redis-backed for v1 — that would need a new external account
 * right now, and this is a reasonable first line of defense: per-instance
 * (resets on cold start, not shared across concurrent Vercel instances), but
 * enough to stop a naive brute-force/email-bombing script. A Redis-backed
 * version (@upstash/ratelimit, same account as the existing QStash setup) is
 * a documented later upgrade, see BACKLOG.md.
 */
const attemptsByKey = new Map<string, number[]>();

export async function isRateLimited(bucket: string, maxAttempts: number, windowMs: number): Promise<boolean> {
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? "unknown";
  const key = `${bucket}:${ip}`;

  const now = Date.now();
  const attempts = (attemptsByKey.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);

  if (attempts.length >= maxAttempts) {
    attemptsByKey.set(key, attempts);
    return true;
  }

  attempts.push(now);
  attemptsByKey.set(key, attempts);
  return false;
}
