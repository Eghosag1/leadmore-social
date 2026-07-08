// Lets the agency user choose, per post, which property field feeds a given
// template text-slot (title/description) instead of always taking the
// property's own field 1:1 — or type a manual value instead. Client-safe
// (no "server-only"), used by both the create-post form and the server
// action that persists the resolved value.

import type { PropertyRow } from "@/types/database";
import { formatPrice, formatSurface, propertyStatusLabel, propertyTypeLabel } from "./format";

export const BINDABLE_PROPERTY_FIELDS = [
  "title",
  "location",
  "description",
  "price",
  "propertyType",
  "bedrooms",
  "bathrooms",
  "surface",
  "status",
] as const;

export type BindablePropertyField = (typeof BINDABLE_PROPERTY_FIELDS)[number];

export const BINDABLE_FIELD_LABELS: Record<BindablePropertyField, string> = {
  title: "Titel",
  location: "Locatie",
  description: "Beschrijving",
  price: "Prijs",
  propertyType: "Type pand",
  bedrooms: "Slaapkamers",
  bathrooms: "Badkamers",
  surface: "Oppervlakte",
  status: "Status",
};

export function resolvePropertyField(property: PropertyRow, field: BindablePropertyField): string {
  switch (field) {
    case "title":
      return property.title;
    case "location":
      return property.location;
    case "description":
      return property.description ?? "";
    case "price":
      return formatPrice(property.price);
    case "propertyType":
      return propertyTypeLabel(property.property_type);
    case "bedrooms":
      return property.bedrooms !== null ? String(property.bedrooms) : "";
    case "bathrooms":
      return property.bathrooms !== null ? String(property.bathrooms) : "";
    case "surface":
      return formatSurface(property.surface);
    case "status":
      return propertyStatusLabel(property.status);
  }
}

export const MANUAL_SOURCE = "manual" as const;
/** Value used in a <select> to represent a field source: a BindablePropertyField or "manual". */
export type FieldSourceValue = BindablePropertyField | typeof MANUAL_SOURCE;
