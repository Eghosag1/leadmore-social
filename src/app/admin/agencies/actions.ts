"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/token-encryption";
import { metaAuthService } from "@/services/meta/metaAuthService";
import type { SocialConnectionRow } from "@/types/database";

export interface AgencyFormState {
  error: string | null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function readAgencyFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    logoUrl: String(formData.get("logoUrl") ?? "").trim() || null,
    websiteUrl: String(formData.get("websiteUrl") ?? "").trim() || null,
  };
}

export async function createAgencyAction(_prev: AgencyFormState, formData: FormData): Promise<AgencyFormState> {
  await requireRole(["super_admin"]);
  const fields = readAgencyFields(formData);
  if (!fields.name) return { error: "Vul een naam in voor het kantoor." };

  const supabase = await createClient();
  const { data: agency, error } = await supabase
    .from("agencies")
    .insert({
      name: fields.name,
      slug: slugify(fields.name),
      logo_url: fields.logoUrl,
      website_url: fields.websiteUrl,
    })
    .select("id")
    .single();

  if (error || !agency) return { error: error?.message ?? "Kon kantoor niet aanmaken." };

  // Mock CRM connection placeholder — a real integration would be set up
  // and synced from here instead. Not "connected" yet: no sync has run.
  const admin = createAdminClient();
  await admin.from("crm_connections").insert({ agency_id: agency.id, provider: "mock", status: "not_connected" });
  await admin.from("social_connections").insert({ agency_id: agency.id, provider: "meta", status: "not_connected" });

  redirect(`/admin/agencies/${agency.id}`);
}

export async function updateAgencyAction(agencyId: string, _prev: AgencyFormState, formData: FormData): Promise<AgencyFormState> {
  await requireRole(["super_admin"]);
  const fields = readAgencyFields(formData);
  if (!fields.name) return { error: "Vul een naam in voor het kantoor." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agencies")
    .update({
      name: fields.name,
      logo_url: fields.logoUrl,
      website_url: fields.websiteUrl,
    })
    .eq("id", agencyId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/agencies/${agencyId}`);
  revalidatePath(`/admin/agencies/${agencyId}/settings`);
  return { error: null };
}

export async function syncAgencyCrmAction(agencyId: string): Promise<void> {
  await requireRole(["super_admin"]);
  const { syncAgencyPropertiesFromCrm } = await import("@/services/crm/crmMockService");
  await syncAgencyPropertiesFromCrm(agencyId);
  revalidatePath(`/admin/agencies/${agencyId}`);
  revalidatePath(`/admin/agencies/${agencyId}/settings`);
}

/**
 * Deletes an agency and everything that belongs to it. Properties, templates,
 * posts and connections cascade via their FKs (see 0001_init.sql). Staff
 * profiles are handled explicitly first: profiles.agency_id is ON DELETE SET
 * NULL, which would violate the "agency_admin/agency_user must have an
 * agency_id" CHECK constraint — deleting their auth.users accounts (via the
 * admin API, which cascades to profiles) avoids that and also revokes their
 * login, which is the correct behavior when a customer account is removed.
 */
export async function deleteAgencyAction(agencyId: string): Promise<void> {
  await requireRole(["super_admin"]);
  const admin = createAdminClient();

  const { data: staff } = await admin.from("profiles").select("user_id").eq("agency_id", agencyId);
  for (const profile of staff ?? []) {
    await admin.auth.admin.deleteUser(profile.user_id);
  }

  const { error } = await admin.from("agencies").delete().eq("id", agencyId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/agencies");
  redirect("/admin/agencies");
}

export interface MetaConnectionFormState {
  error: string | null;
}

export async function updateAgencyMetaConnectionAction(
  agencyId: string,
  _prev: MetaConnectionFormState,
  formData: FormData,
): Promise<MetaConnectionFormState> {
  await requireRole(["super_admin"]);

  const facebookPageId = String(formData.get("facebookPageId") ?? "").trim() || null;
  const instagramAccountId = String(formData.get("instagramAccountId") ?? "").trim() || null;
  const rawAccessToken = String(formData.get("accessToken") ?? "").trim();
  const status = facebookPageId || instagramAccountId ? "connected" : "not_connected";

  // The token field is always left blank in the form (a secret is never echoed
  // back) — only overwrite the stored token when the admin actually typed a
  // new one, so re-saving the Page/IG ids alone doesn't wipe an OAuth-obtained
  // token.
  const updatePayload: Partial<SocialConnectionRow> = {
    facebook_page_id: facebookPageId,
    instagram_account_id: instagramAccountId,
    status,
  };
  if (rawAccessToken) updatePayload.access_token_encrypted = encryptToken(rawAccessToken);

  const supabase = await createClient();
  const { error } = await supabase.from("social_connections").update(updatePayload).eq("agency_id", agencyId).eq("provider", "meta");

  if (error) return { error: error.message };

  revalidatePath(`/admin/agencies/${agencyId}`);
  revalidatePath(`/admin/agencies/${agencyId}/settings`);
  return { error: null };
}

/** Redirects the admin to Facebook's OAuth consent dialog for this agency's Page/Instagram connection. */
export async function startMetaConnectAction(agencyId: string): Promise<void> {
  await requireRole(["super_admin"]);
  redirect(metaAuthService.buildAuthorizationUrl({ agencyId }));
}

/**
 * Same authorization URL as startMetaConnectAction, but returned instead of
 * redirected to — for forwarding to whoever at the agency actually manages
 * their Facebook Page, instead of the admin completing the consent screen
 * themselves. The signed state param has no expiry (see src/lib/meta/state.ts),
 * so the copied link stays valid until it's actually used.
 */
export async function getMetaAuthorizationUrlAction(agencyId: string): Promise<string> {
  await requireRole(["super_admin"]);
  return metaAuthService.buildAuthorizationUrl({ agencyId });
}

export interface BusinessManagerConnectState {
  error: string | null;
}

/**
 * Alternative to startMetaConnectAction for Pages managed inside a Business
 * Portfolio — no OAuth redirect, just a direct Graph API lookup using
 * Leadmore's own System User token. Requires the agency to have already
 * shared their Page with Leadmore's Business Manager (manual, agency-side
 * step — see metaAuthService.connectViaBusinessManager).
 */
export async function connectAgencyViaBusinessManagerAction(
  agencyId: string,
  _prev: BusinessManagerConnectState,
  formData: FormData,
): Promise<BusinessManagerConnectState> {
  await requireRole(["super_admin"]);

  const facebookPageId = String(formData.get("businessManagerPageId") ?? "").trim();
  if (!facebookPageId) return { error: "Vul een Facebook-pagina ID in." };

  try {
    const result = await metaAuthService.connectViaBusinessManager(facebookPageId);
    const supabase = await createClient();
    const { error } = await supabase
      .from("social_connections")
      .update({
        facebook_page_id: result.facebookPageId,
        instagram_account_id: result.instagramAccountId,
        access_token_encrypted: encryptToken(result.accessToken),
        token_expires_at: result.expiresAt,
        status: "connected",
      })
      .eq("agency_id", agencyId)
      .eq("provider", "meta");

    if (error) return { error: error.message };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Onbekende fout bij het koppelen via Business Manager." };
  }

  revalidatePath(`/admin/agencies/${agencyId}`);
  revalidatePath(`/admin/agencies/${agencyId}/settings`);
  return { error: null };
}

export interface CrmConnectionFormState {
  error: string | null;
}

export async function updateAgencyCrmConnectionAction(
  agencyId: string,
  _prev: CrmConnectionFormState,
  formData: FormData,
): Promise<CrmConnectionFormState> {
  await requireRole(["super_admin"]);

  const provider = String(formData.get("provider") ?? "mock");
  const configText = String(formData.get("config") ?? "").trim();

  let config: Record<string, unknown> = {};
  if (configText) {
    try {
      config = JSON.parse(configText);
    } catch {
      return { error: "Config moet geldige JSON zijn (of laat leeg)." };
    }
  }

  const supabase = await createClient();
  // Filter by agency_id only: an agency has exactly one crm_connections row,
  // and this update itself may be changing the provider value.
  const { error } = await supabase
    .from("crm_connections")
    .update({ provider: provider as "mock" | "whise" | "immoweb" | "custom", config, status: "connected" })
    .eq("agency_id", agencyId);

  if (error) return { error: error.message };

  revalidatePath(`/admin/agencies/${agencyId}`);
  revalidatePath(`/admin/agencies/${agencyId}/settings`);
  return { error: null };
}
