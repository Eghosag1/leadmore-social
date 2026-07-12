import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bath, BedDouble, MapPin, Ruler } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BackButton } from "@/components/shared/BackButton";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPrice, formatSurface, propertyStatusLabel, propertyTypeLabel } from "@/lib/format";

export default async function PropertyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date } = await searchParams;
  const safeDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
  const current = await requireRole(["agency_admin", "agency_user"]);
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("agency_id", current.profile.agency_id!)
    .eq("id", id)
    .maybeSingle();

  if (!property) notFound();

  const { data: propertyImages } = await supabase
    .from("property_images")
    .select("id, image_url, is_primary, sort_order")
    .eq("property_id", id);

  const images = (propertyImages ?? []).sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <BackButton fallbackHref="/dashboard/properties" label="Panden" />
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {property.location}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{property.title}</h1>
        </div>
        <Button
          size="lg"
          nativeButton={false}
          render={
            <Link
              href={`/dashboard/create-post/${property.id}?returnTo=${encodeURIComponent(`/dashboard/properties/${property.id}`)}${safeDate ? `&date=${safeDate}` : ""}`}
            />
          }
        >
          Post maken voor dit pand
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="relative col-span-2 aspect-video overflow-hidden rounded-lg bg-neutral-100">
                <Image src={images[0].image_url} alt={property.title} fill sizes="800px" className="object-cover" priority />
              </div>
              {images.slice(1, 5).map((image) => (
                <div key={image.id} className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
                  <Image src={image.image_url} alt={property.title} fill sizes="400px" className="object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-neutral-200 text-sm text-muted-foreground">
              Geen foto&apos;s beschikbaar
            </div>
          )}

          {property.description && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-neutral-900">Beschrijving</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-600">{property.description}</p>
            </div>
          )}
        </div>

        <Card className="h-fit">
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="flex items-center justify-between">
              <Badge>{propertyStatusLabel(property.status)}</Badge>
              <span className="text-xs text-muted-foreground">{propertyTypeLabel(property.property_type)}</span>
            </div>
            <p className="text-2xl font-semibold text-neutral-900">{formatPrice(property.price)}</p>
            <div className="grid grid-cols-3 gap-3 border-t border-neutral-100 pt-4 text-sm">
              <div className="flex flex-col items-center gap-1 text-center">
                <BedDouble className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{property.bedrooms ?? "-"}</span>
                <span className="text-xs text-muted-foreground">Slaapkamers</span>
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <Bath className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{property.bathrooms ?? "-"}</span>
                <span className="text-xs text-muted-foreground">Badkamers</span>
              </div>
              <div className="flex flex-col items-center gap-1 text-center">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{formatSurface(property.surface)}</span>
                <span className="text-xs text-muted-foreground">Opp.</span>
              </div>
            </div>
            {property.crm_property_id && (
              <p className="border-t border-neutral-100 pt-3 text-xs text-muted-foreground">
                CRM-referentie: {property.crm_property_id}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
