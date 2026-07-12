import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyQueueToken } from "@/lib/queue/token";
import { processPendingPost } from "@/services/posts/postQueueService";

// Same Hobby-plan ceiling as create-post/[propertyId]/page.tsx — this route
// now does the render+publish work that page used to do inline, in its own
// function invocation with its own full time budget.
export const maxDuration = 60;

/**
 * Fire-and-forget target for createAndSchedulePostAction — called
 * server-to-server (no user session, hence the signed token instead of
 * requireRole(), same pattern as the internal render-slide page) right
 * after a post is created, so the request that redirects the user to
 * /dashboard/scheduled doesn't have to wait out the full render+publish
 * duration. See postQueueService.ts for the actual work, and
 * postDetailService.ts for the lazy safety-net if this request never lands.
 */
export async function POST(request: NextRequest) {
  const { postId, token } = await request.json();
  if (!postId || !token || !verifyQueueToken(postId, token)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  await processPendingPost(postId, admin);

  return NextResponse.json({ ok: true });
}
