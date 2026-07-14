import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/resend";
import { siteUrl } from "@/lib/site-url";

const STAGE_LABEL = {
  render: "renderen",
  publish: "publiceren",
} as const;

/**
 * Notifies every user of the post's agency by email when a post enters
 * render_failed/publish_failed — the only way this was surfaced before was
 * someone happening to open the dashboard. Called from every place a post's
 * status actually flips to one of those two (see the 5 call sites listed in
 * the "Templatearchitectuur" migration plan's mail section).
 *
 * Deliberately no dedupe: a retry that fails again sends another email —
 * correct behavior, not a bug, since each failure is a new, real event the
 * agency should know about.
 *
 * Always swallows its own errors (missing RESEND_API_KEY, Resend being
 * down, ...) — a notification failing must never cascade into failing the
 * render/publish flow that triggered it. Uses its own admin client
 * regardless of what client the caller used for its own writes, since
 * `auth.admin.getUserById` (the only way to reach an email address —
 * profiles doesn't carry one, see auth.users) always requires the
 * service-role key.
 */
export async function notifyPostFailure(postId: string, stage: "render" | "publish", reason: string): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: post } = await admin.from("posts").select("agency_id, property_id, caption").eq("id", postId).maybeSingle();
    if (!post) return;

    const [{ data: property }, { data: agency }, { data: profiles }] = await Promise.all([
      admin.from("properties").select("title").eq("id", post.property_id).maybeSingle(),
      admin.from("agencies").select("name").eq("id", post.agency_id).maybeSingle(),
      admin.from("profiles").select("user_id").eq("agency_id", post.agency_id),
    ]);
    if (!profiles || profiles.length === 0) return;

    const emails = (
      await Promise.all(
        profiles.map(async (profile) => {
          const { data } = await admin.auth.admin.getUserById(profile.user_id);
          return data.user?.email ?? null;
        }),
      )
    ).filter((email): email is string => !!email);
    if (emails.length === 0) return;

    const postTitle = property?.title ?? (post.caption || "een post");
    const postUrl = `${siteUrl()}/dashboard/posts/${postId}`;
    const subject = `${STAGE_LABEL[stage]} mislukt — ${postTitle}`;
    const html = `
      <p>Het ${STAGE_LABEL[stage]} van een post voor <strong>${postTitle}</strong> is mislukt${agency?.name ? ` (${agency.name})` : ""}.</p>
      <p><strong>Reden:</strong> ${reason}</p>
      <p><a href="${postUrl}">Bekijk de post</a></p>
    `;

    // allSettled, not all — one recipient's send failing (e.g. Resend's
    // sandbox mode rejecting a non-verified address before a domain is
    // verified) must not swallow/obscure the others' successful delivery.
    // Confirmed for real: a batch with one valid and one sandbox-rejected
    // recipient genuinely delivers to the valid one regardless.
    const results = await Promise.allSettled(emails.map((to) => sendEmail({ to, subject, html })));
    results.forEach((result, i) => {
      if (result.status === "rejected") console.error(`notifyPostFailure(${postId}, ${stage}) mislukte voor ${emails[i]}:`, result.reason);
    });
  } catch (error) {
    console.error(`notifyPostFailure(${postId}, ${stage}) mislukte:`, error);
  }
}
