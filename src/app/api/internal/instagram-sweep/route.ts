import { NextResponse, type NextRequest } from "next/server";
import { Receiver } from "@upstash/qstash";
import { qstashCurrentSigningKey, qstashNextSigningKey } from "@/lib/qstash-env";
import { siteUrl } from "@/lib/site-url";
import { publishDueInstagramPosts } from "@/services/meta/instagramSchedulerSweepService";

// Same Hobby-plan ceiling as the other internal routes.
export const maxDuration = 60;

/**
 * Woken up by a QStash wake-up call (see src/lib/qstash.ts) at — or shortly
 * after — an Instagram post's scheduled_at. Publishes whatever is currently
 * due, not just the one post that triggered this specific wake-up (several
 * posts due around the same time all get picked up together by whichever
 * wake-up call arrives first) — see instagramSchedulerSweepService.ts for
 * why that also makes swapping this trigger for a Vercel Pro cron later a
 * no-op for the actual publish logic.
 *
 * No user session exists here (QStash calls this server-to-server), so
 * trust comes from verifying QStash's signed JWT instead of requireRole() —
 * same idea as the render-queue's HMAC token, but QStash signs with a
 * rotating key pair or its own, so this uses their official Receiver rather
 * than hand-rolling JWT verification.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("upstash-signature");
  const body = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 401 });
  }

  const receiver = new Receiver({
    currentSigningKey: qstashCurrentSigningKey(),
    nextSigningKey: qstashNextSigningKey(),
  });

  try {
    const valid = await receiver.verify({ signature, body, url: `${siteUrl()}/api/internal/instagram-sweep` });
    if (!valid) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  await publishDueInstagramPosts();

  return NextResponse.json({ ok: true });
}
