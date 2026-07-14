// Central enum definitions shared between database rows, services and UI.
// Keep these in sync with the CHECK constraints in supabase/migrations.

export const PROFILE_ROLES = ["super_admin", "agency_admin", "agency_user"] as const;
export type ProfileRole = (typeof PROFILE_ROLES)[number];

export const TEMPLATE_TYPES = ["single", "carousel"] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export const TEMPLATE_STATUSES = ["draft", "testing", "published", "failed", "archived"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const POST_FORMATS = ["feed", "story"] as const;
export type PostFormat = (typeof POST_FORMATS)[number];

export const BILLABLE_TYPES = ["included", "regie"] as const;
export type BillableType = (typeof BILLABLE_TYPES)[number];

export const POST_STATUSES = [
  "draft",
  "pending_render",
  "rendering",
  "ready",
  "rendered",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "render_failed",
  "publish_failed",
  "cancelled",
] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_TYPES = ["single", "carousel"] as const;
export type PostType = (typeof POST_TYPES)[number];

// 'fixed' = the constant 1080x1350 (4:5) render canvas; 'original' = canvas
// height derived from the source photo's own aspect ratio. Distinct from
// PostFormat ('feed'/'story', above) — unrelated concept, different table.
export const POST_CANVAS_MODES = ["fixed", "original"] as const;
export type PostCanvasMode = (typeof POST_CANVAS_MODES)[number];

export const PLATFORMS = ["facebook", "instagram"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PROPERTY_STATUSES = ["available", "under_offer", "sold", "rented", "withdrawn"] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const PROPERTY_LISTING_TYPES = ["sale", "rent"] as const;
export type PropertyListingType = (typeof PROPERTY_LISTING_TYPES)[number];

export const PROPERTY_TYPES = [
  "house",
  "apartment",
  "villa",
  "studio",
  "commercial",
  "land",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const CONNECTION_STATUSES = ["not_connected", "connected", "error", "expired"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const CRM_PROVIDERS = ["mock", "whise", "immoweb", "custom"] as const;
export type CrmProvider = (typeof CRM_PROVIDERS)[number];
