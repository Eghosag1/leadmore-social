import "server-only";
import { qstashToken } from "@/lib/qstash-env";
import { siteUrl } from "@/lib/site-url";

/**
 * Schedules a QStash wake-up call to /api/internal/instagram-sweep at (or
 * just after) `notBefore` — plain fetch() to QStash's publish-to-URL
 * endpoint, not the SDK, since scheduling is a single outbound POST (same
 * "bare fetch for the external API, no SDK" style as facebookPublishingService.ts).
 * No payload needed: the sweep route re-checks everything currently due
 * rather than acting on a specific job passed in here — see
 * instagramSchedulerSweepService.ts for why (also what makes swapping this
 * trigger for a Vercel Cron ping later a no-op for the actual publish logic).
 *
 * Deliberately fire-and-forget-tolerant: if QStash itself is unreachable,
 * this throws and the caller (instagramPublishingService) surfaces it as a
 * schedule() failure — better to fail loudly at schedule time than silently
 * never publish days later.
 */
export async function scheduleInstagramSweep(notBefore: Date): Promise<void> {
  const target = `${siteUrl()}/api/internal/instagram-sweep`;
  const response = await fetch(`https://qstash.upstash.io/v2/publish/${encodeURIComponent(target)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${qstashToken()}`,
      "Upstash-Not-Before": String(Math.floor(notBefore.getTime() / 1000)),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kon QStash-wake-up niet inplannen (${response.status}): ${text}`);
  }
}
