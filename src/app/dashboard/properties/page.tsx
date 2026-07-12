import Link from "next/link";
import Image from "next/image";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PostStatusBadge } from "@/components/shared/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatPrice, propertyStatusLabel } from "@/lib/format";
import type { PostStatus } from "@/types/enums";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  available: "default",
  under_offer: "secondary",
  sold: "outline",
  rented: "outline",
  withdrawn: "outline",
};

// Highest-priority status wins when a property has multiple posts.
const POST_STATUS_RANK: Record<PostStatus, number> = {
  published: 6,
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

  return (
    <div>
      <PageHeader title="Panden" description="Alle panden gesynchroniseerd vanuit uw CRM." />

      {!properties || properties.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 py-16 text-center text-sm text-muted-foreground">
          Nog geen panden gevonden.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14" />
              <TableHead>Adres</TableHead>
              <TableHead>Prijs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Gepubliceerd (CRM)</TableHead>
              <TableHead>Social post</TableHead>
              <TableHead className="text-right">Actie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((property) => {
              const postStatus = postStatusByProperty.get(property.id);
              const thumbnailUrl = thumbnailByProperty.get(property.id);
              return (
                <TableRow key={property.id}>
                  <TableCell>
                    <Link href={`/dashboard/properties/${property.id}`} className="relative block h-10 w-10 overflow-hidden rounded-md bg-neutral-100">
                      {thumbnailUrl && <Image src={thumbnailUrl} alt="" fill sizes="40px" className="object-cover" />}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/dashboard/properties/${property.id}`} className="hover:underline">
                      <p className="font-medium text-neutral-900">{property.location}</p>
                      <p className="text-xs text-muted-foreground">{property.title}</p>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-neutral-700">{formatPrice(property.price)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[property.status]}>{propertyStatusLabel(property.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(property.listed_at)}</TableCell>
                  <TableCell>
                    {postStatus ? (
                      <PostStatusBadge status={postStatus} />
                    ) : (
                      <span className="text-xs text-muted-foreground">Nog niet gepland</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      nativeButton={false}
                      render={
                        <Link
                          href={`/dashboard/create-post/${property.id}?returnTo=${encodeURIComponent("/dashboard/properties")}${safeDate ? `&date=${safeDate}` : ""}`}
                        />
                      }
                    >
                      Post maken
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
