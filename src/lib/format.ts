import type { PropertyListingType, PropertyStatus, PropertyType } from "@/types/enums";

const priceFormatter = new Intl.NumberFormat("nl-BE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatPrice(price: number | null): string {
  if (price === null) return "Prijs op aanvraag";
  return priceFormatter.format(price);
}

export function formatSurface(surface: number | null): string {
  if (surface === null) return "-";
  return `${surface} m²`;
}

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  house: "Woning",
  apartment: "Appartement",
  villa: "Villa",
  studio: "Studio",
  commercial: "Handelspand",
  land: "Bouwgrond",
};

export function propertyTypeLabel(type: PropertyType): string {
  return PROPERTY_TYPE_LABELS[type];
}

const PROPERTY_LISTING_TYPE_LABELS: Record<PropertyListingType, string> = {
  sale: "Te koop",
  rent: "Te huur",
};

export function propertyListingTypeLabel(listingType: PropertyListingType): string {
  return PROPERTY_LISTING_TYPE_LABELS[listingType];
}

const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  available: "Beschikbaar",
  under_offer: "Onder optie",
  sold: "Verkocht",
  rented: "Verhuurd",
  withdrawn: "Ingetrokken",
};

export function propertyStatusLabel(status: PropertyStatus): string {
  return PROPERTY_STATUS_LABELS[status];
}

// Explicit timeZone matters here: these render inside Server Components,
// which run on Vercel in UTC — without it, times would display in UTC
// instead of Belgian local time (see src/lib/scheduled-time.ts for the
// matching fix on the write side).
const DATE_FORMATTER = new Intl.DateTimeFormat("nl-BE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Brussels",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("nl-BE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Brussels",
});

export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  return `${DATE_FORMATTER.format(date)} om ${TIME_FORMATTER.format(date)}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return DATE_FORMATTER.format(new Date(iso));
}
