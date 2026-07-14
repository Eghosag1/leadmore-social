// Client-safe (no "server-only") — used both by templateService (server) and
// by the live preview in the create-post form (client component), so the
// exact same mapping produces the on-screen preview and the persisted post.

import type { PropertyImageRow, PropertyRow } from "@/types/database";
import type { TemplateConfig, TemplateRenderProps } from "@/types/domain";

export function buildTemplateRenderProps(params: {
  property: PropertyRow;
  images: Pick<PropertyImageRow, "image_url" | "sort_order">[];
  config: TemplateConfig;
  agencyName: string;
  /** Agency-level custom font (agencies.custom_font_family/custom_font_url) — not part of TemplateConfig since it's set on the agency's own settings page, not per template. */
  customFontFamily?: string | null;
  customFontUrl?: string | null;
  overrides?: { title?: string; description?: string | null; coverImageUrl?: string };
}): TemplateRenderProps {
  const { property, images, config, agencyName, customFontFamily, customFontUrl, overrides } = params;
  const sortedImages = [...images].sort((a, b) => a.sort_order - b.sort_order).map((image) => image.image_url);
  const orderedImages = overrides?.coverImageUrl
    ? [overrides.coverImageUrl, ...sortedImages.filter((url) => url !== overrides.coverImageUrl)]
    : sortedImages;

  return {
    title: overrides?.title ?? property.title,
    badgeText: config.defaultTexts?.badgeText,
    price: property.price,
    location: property.location,
    propertyType: property.property_type,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    surface: property.surface,
    description: overrides?.description ?? property.description,
    images: orderedImages,
    agencyName,
    agencyLogo: config.brand.logoUrl,
    brandColor: config.brand.brandColor,
    secondaryColor: config.brand.secondaryColor,
    ctaText: config.brand.ctaText ?? config.defaultTexts?.ctaText,
    status: property.status,
    fields: config.fields,
    customFontFamily: customFontFamily ?? undefined,
    customFontUrl: customFontUrl ?? undefined,
  };
}

/**
 * "Eigen foto's" mode: no template, no branded overlay — the post is just
 * the agency's own photo(s) in the chosen order. Only `images` (and the
 * caption-adjacent fields) matter here; brand/field-visibility props are
 * unused since there's no compiled component to render them.
 */
export function buildRawPhotoRenderProps(params: {
  property: PropertyRow;
  images: string[];
  agencyName: string;
}): TemplateRenderProps {
  const { property, images, agencyName } = params;
  return {
    title: property.title,
    price: property.price,
    location: property.location,
    propertyType: property.property_type,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    surface: property.surface,
    description: property.description,
    images,
    agencyName,
    brandColor: "#111827",
    status: property.status,
    fields: {},
  };
}
