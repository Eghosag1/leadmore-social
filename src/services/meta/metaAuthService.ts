import "server-only";
import { metaAppId, metaAppSecret, metaRedirectUri, metaSystemUserToken } from "@/lib/meta/env";
import { signState } from "@/lib/meta/state";

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Facebook Page scopes only, for now. Instagram permission names have shifted
// under Meta's newer "Instagram API with Instagram Login" use case
// (instagram_business_basic / instagram_business_content_publish, alongside
// the older instagram_basic / instagram_content_publish) — since Instagram
// publishing isn't built yet (see instagramPublishingService.ts), we don't
// request any Instagram scope here and avoid depending on naming that may
// still change before that integration is written. Re-check Meta's current
// docs for the right scope names when that work starts.
const SCOPES = ["pages_show_list", "pages_manage_posts", "pages_read_engagement"].join(",");

export interface MetaAuthUrlParams {
  agencyId: string;
}

export interface MetaTokenExchangeResult {
  accessToken: string;
  expiresAt: string;
  facebookPageId: string;
  instagramAccountId: string | null;
}

async function graphFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url.toString());
  const body = await response.json();
  if (!response.ok) {
    const message = body?.error?.message ?? `Graph API request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export const metaAuthService = {
  /** Builds the Facebook OAuth dialog URL the admin is redirected to when clicking "Verbind met Facebook". */
  buildAuthorizationUrl({ agencyId }: MetaAuthUrlParams): string {
    const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    url.searchParams.set("client_id", metaAppId());
    url.searchParams.set("redirect_uri", metaRedirectUri());
    url.searchParams.set("state", signState(agencyId));
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("response_type", "code");
    // Forces Facebook to show the full consent + Page-picker dialog again
    // every time, instead of silently reusing a previous (possibly
    // page-less) grant for this app — important while debugging why a
    // freshly-selected Page still doesn't show up via /me/accounts.
    url.searchParams.set("auth_type", "rerequest");
    return url.toString();
  },

  /**
   * Exchanges the OAuth `code` for a long-lived Page access token and looks
   * up the Page (+ linked Instagram account, if any) it grants access to.
   *
   * MVP simplification: if the authorizing account manages multiple Pages,
   * this takes the first one returned by /me/accounts — there's no Page
   * picker yet. Fine for a single-Page test account; revisit before
   * onboarding agencies whose Facebook user manages several Pages.
   */
  async handleOAuthCallback(code: string): Promise<MetaTokenExchangeResult> {
    const appId = metaAppId();
    const appSecret = metaAppSecret();

    const shortLived = await graphFetch<{ access_token: string }>("/oauth/access_token", {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: metaRedirectUri(),
      code,
    });

    const longLived = await graphFetch<{ access_token: string; expires_in?: number }>("/oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLived.access_token,
    });

    const pages = await graphFetch<{ data: { id: string; access_token: string }[] }>("/me/accounts", {
      access_token: longLived.access_token,
    });
    const page = pages.data[0];
    if (!page) {
      // Confirmed via manual testing: Pages owned by a Business Portfolio
      // sometimes don't surface here even with pages_show_list granted and
      // the Page connected as a business asset to the app — a standalone
      // Page (created outside Business Manager) works fine. Root cause not
      // fully pinned down; if this recurs, log /me/permissions + this
      // response again before assuming it's the same issue.
      throw new Error("Dit Facebook-account beheert geen enkele Pagina (of enkel Pagina's binnen een Business Portfolio — probeer een standalone Pagina).");
    }

    const pageDetails = await graphFetch<{ instagram_business_account?: { id: string } }>(`/${page.id}`, {
      fields: "instagram_business_account",
      access_token: page.access_token,
    });

    // Page tokens minted from a long-lived user token don't expire under normal
    // circumstances; Meta doesn't return an explicit expiry for them the way it
    // does for user tokens, so this is a conservative bookkeeping estimate.
    const expiresAt = new Date(Date.now() + (longLived.expires_in ?? 60 * 24 * 60 * 60) * 1000).toISOString();

    return {
      accessToken: page.access_token,
      expiresAt,
      facebookPageId: page.id,
      instagramAccountId: pageDetails.instagram_business_account?.id ?? null,
    };
  },

  /**
   * Alternative to the personal OAuth flow above, for Pages managed inside a
   * Business Portfolio (see the CLAUDE.md note on why /me/accounts doesn't
   * reliably surface those). Requires the agency to have already shared
   * their Page with Leadmore's Business Manager as a partner (a manual,
   * agency-side step in Meta Business Settings — there's no API call that
   * creates that trust relationship, Meta requires human approval on their
   * side). Once shared, Leadmore's own System User token can fetch a
   * Page-scoped access token directly, no per-agency consent screen needed.
   */
  async connectViaBusinessManager(facebookPageId: string): Promise<MetaTokenExchangeResult> {
    const pageDetails = await graphFetch<{ access_token?: string; instagram_business_account?: { id: string } }>(
      `/${facebookPageId}`,
      {
        fields: "access_token,instagram_business_account",
        access_token: metaSystemUserToken(),
      },
    );

    if (!pageDetails.access_token) {
      throw new Error(
        "Geen toegang tot deze Pagina. Is ze al gedeeld met Leadmore's Business Manager (Business Settings → Pages → Assign Partner)?",
      );
    }

    // System User Page tokens don't expire under normal circumstances (same
    // bookkeeping caveat as the OAuth path above — Meta doesn't return an
    // explicit expiry here either).
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    return {
      accessToken: pageDetails.access_token,
      expiresAt,
      facebookPageId,
      instagramAccountId: pageDetails.instagram_business_account?.id ?? null,
    };
  },
};
