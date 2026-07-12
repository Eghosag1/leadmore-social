import { PageHeader } from "@/components/shared/PageHeader";
import { PropertyListTabs, type PropertyListRow } from "@/components/dashboard/PropertyListTabs";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PostStatus } from "@/types/enums";

// Highest-priority status wins when a property has multiple posts.
const POST_STATUS_RANK: Record<PostStatus, number> = {
  published: 6,
  publishing: 5,
  scheduled: 5,
  ready: 4,
  rendered: 4,
  pending_render: 3,
  rendering: 3,
  draft: 2,
  failed: 1,
  render_failed: 1,
  publish_failed: 1,
  cancelled: 0,
};

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const safeDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  const current = await requireRole(["agency_admin", "agency_user"]);
  const agencyId = current.profile.agency_id!;
  const supabase = await createClient();

  const [{ data: properties }, { data: posts }] = await Promise.all([
    supabase.from("properties").select("*").eq("agency_id", agencyId).order("listed_at", { ascending: false }),
    supabase.from("posts").select("id, property_id, status").eq("agency_id", agencyId),
  ]);

  const propertyIds = (properties ?? []).map((p) => p.id);
  const { data: images } = propertyIds.length
    ? await supabase
        .from("property_images")
        .select("property_id, image_url, sort_order, is_primary")
        .in("property_id", propertyIds)
        .order("sort_order")
    : { data: [] as { property_id: string; image_url: string; sort_order: number; is_primary: boolean }[] };

  const thumbnailByProperty = new Map<string, string>();
  for (const image of images ?? []) {
    const existing = thumbnailByProperty.get(image.property_id);
    if (!existing || image.is_primary) thumbnailByProperty.set(image.property_id, image.image_url);
  }

  const postStatusByProperty = new Map<string, PostStatus>();
  for (const post of posts ?? []) {
    const existing = postStatusByProperty.get(post.property_id);
    if (!existing || POST_STATUS_RANK[post.status] > POST_STATUS_RANK[existing]) {
      postStatusByProperty.set(post.property_id, post.status);
    }
  }

  const rows: PropertyListRow[] = (properties ?? []).map((property) => ({
    id: property.id,
    location: property.location,
    title: property.title,
    price: property.price,
    status: property.status,
    listingType: property.listing_type,
    listedAt: property.listed_at,
    thumbnailUrl: thumbnailByProperty.get(property.id),
    postStatus: postStatusByProperty.get(property.id),
  }));

  return (
    <div>
      <PageHeader title="Panden" description="Alle panden gesynchroniseerd vanuit uw CRM." />

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 py-16 text-center text-sm text-muted-foreground">
          Nog geen panden gevonden.
        </p>
      ) : (
        <PropertyListTabs properties={rows} safeDate={safeDate} />
      )}
    </div>
  );
}
