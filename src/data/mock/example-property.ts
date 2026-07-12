import type { PropertyImageRow, PropertyRow } from "@/types/database";

/**
 * Generic fallback used by template preview pages when an agency has no
 * synced properties yet (e.g. right after onboarding, before a CRM sync).
 */
export const EXAMPLE_PROPERTY: PropertyRow = {
  id: "00000000-0000-4000-8000-000000000000",
  agency_id: "00000000-0000-4000-8000-000000000000",
  crm_property_id: null,
  title: "Voorbeeldpand — Charmante gezinswoning",
  description:
    "Dit is een voorbeeldpand ter illustratie van deze template. Ruime woning met vier slaapkamers, een verzorgde tuin en een moderne keuken.",
  price: 425000,
  location: "Voorbeeldstraat 12, 2000 Antwerpen",
  property_type: "house",
  listing_type: "sale",
  bedrooms: 4,
  bathrooms: 2,
  surface: 210,
  status: "available",
  listed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const EXAMPLE_PROPERTY_IMAGES: PropertyImageRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    property_id: EXAMPLE_PROPERTY.id,
    image_url: "https://picsum.photos/seed/example-1/1200/900",
    sort_order: 0,
    is_primary: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    property_id: EXAMPLE_PROPERTY.id,
    image_url: "https://picsum.photos/seed/example-2/1200/900",
    sort_order: 1,
    is_primary: false,
    created_at: new Date().toISOString(),
  },
];
