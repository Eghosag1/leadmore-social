import { NextResponse, type NextRequest } from "next/server";
import { metaAuthService } from "@/services/meta/metaAuthService";
import { verifyState } from "@/lib/meta/state";
import { encryptToken } from "@/lib/token-encryption";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Meta redirects here after the admin (or whoever completes the Facebook
 * consent screen) approves or denies access. This runs outside our own
 * session — the person clicking through Facebook's dialog isn't necessarily
 * logged into Leadmore Social — so trust comes from the signed `state`
 * param (see src/lib/meta/state.ts), not requireRole(). Writes use the
 * service-role client for the same reason mockMetaSchedulingService does:
 * this models a trusted backend step, not a user-scoped app action.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const agencyId = state ? verifyState(state) : null;

  if (!agencyId) {
    return NextResponse.redirect(new URL("/admin/agencies", request.url));
  }

  const settingsUrl = new URL(`/admin/agencies/${agencyId}/settings`, request.url);

  if (error || !code) {
    settingsUrl.searchParams.set("meta", "error");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const result = await metaAuthService.handleOAuthCallback(code);
    const admin = createAdminClient();
    const { error: dbError } = await admin.from("social_connections").upsert(
      {
        agency_id: agencyId,
        provider: "meta",
        facebook_page_id: result.facebookPageId,
        instagram_account_id: result.instagramAccountId,
        access_token_encrypted: encryptToken(result.accessToken),
        token_expires_at: result.expiresAt,
        status: "connected",
      },
      { onConflict: "agency_id,provider" },
    );
    if (dbError) throw new Error(dbError.message);

    settingsUrl.searchParams.set("meta", "connected");
  } catch {
    settingsUrl.searchParams.set("meta", "error");
  }

  return NextResponse.redirect(settingsUrl);
}
