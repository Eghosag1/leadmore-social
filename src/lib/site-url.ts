import "server-only";

/**
 * Absolute URL of this app itself — needed anywhere server code has to issue
 * a request back to one of our own routes (Puppeteer navigating to an
 * internal render page, the fire-and-forget queue trigger). On Vercel this
 * is derived automatically from VERCEL_URL if NEXT_PUBLIC_SITE_URL isn't
 * set; for local dev it falls back to localhost.
 */
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
