import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listActiveAgencyTemplatesForCustomer } from "@/services/templates/templateService";
import { CreatePostForm } from "@/components/dashboard/CreatePostForm";

// Route segment config also governs the max duration of Server Actions
// invoked from this page (createAndSchedulePostAction, which triggers the
// headless-browser render step) — the default 10s (Hobby) is too short for
// that. 60s is the Hobby-plan ceiling; see the tightened retry/timeout
// budget in browserRenderService.ts (worst case ~30s for the slowest slide).
export const maxDuration = 60;

export default async function CreatePostPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ returnTo?: string; date?: string }>;
}) {
  const { propertyId } = await params;
  const { returnTo, date } = await searchParams;
  // Only ever forward a same-app path — never let an arbitrary query value become a redirect target.
  const safeReturnTo = returnTo?.startsWith("/dashboard") ? returnTo : undefined;
  // Only ever forward a well-formed yyyy-MM-dd value into a date input's defaultValue.
  const safeDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  const current = await requireRole(["agency_admin", "agency_user"]);
  const agencyId = current.profile.agency_id!;
  const supabase = await createClient();

  const [{ data: property }, { data: images }, templates, { data: agency }, { data: connection }] = await Promise.all([
    supabase.from("properties").select("*").eq("agency_id", agencyId).eq("id", propertyId).maybeSingle(),
    supabase.from("property_images").select("*").eq("property_id", propertyId).order("sort_order"),
    listActiveAgencyTemplatesForCustomer(agencyId),
    supabase.from("agencies").select("name, logo_url").eq("id", agencyId).single(),
    supabase.from("social_connections").select("status").eq("agency_id", agencyId).eq("provider", "meta").maybeSingle(),
  ]);

  if (!property) notFound();

  return (
    <CreatePostForm
      property={property}
      images={images ?? []}
      templates={templates}
      agencyName={agency?.name ?? ""}
      agencyLogo={agency?.logo_url ?? undefined}
      metaConnected={connection?.status === "connected"}
      returnTo={safeReturnTo}
      initialDate={safeDate}
    />
  );
}
