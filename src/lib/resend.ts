import "server-only";
import { resendApiKey, resendFromEmail } from "@/lib/resend-env";

/**
 * Sends a single email via Resend's REST API — plain fetch(), not the
 * `resend` SDK, same "bare fetch for the external API, no SDK" style as
 * src/lib/qstash.ts and the Meta Graph API calls elsewhere in this codebase.
 * Throws on failure — callers (postFailureNotificationService.ts) decide
 * whether that should ever surface further; today it's always swallowed,
 * since a notification failure must never block the render/publish flow
 * that triggered it.
 */
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail(),
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend gaf een fout (${response.status}): ${text}`);
  }
}
