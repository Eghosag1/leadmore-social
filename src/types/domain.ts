// Domain-level types used across services and UI. These sit one level above
// the raw database rows (src/types/database.ts) and are what components and
// server actions actually pass around.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Platform, PostStatus, PropertyListingType, PropertyStatus, PropertyType, TemplateStatus } from "./enums";
import type { AgencyFontRow, Database } from "./database";

/** Branding config shared by every agency template. Extend rather than fork per layout. */
export interface TemplateBrandConfig {
  brandColor: string;
  secondaryColor?: string;
  logoUrl?: string;
  fontFamily?: string;
  ctaText?: string;
}

/** Controls which content fields the agency user is allowed to edit for a template instance. */
export interface TemplateFieldVisibility {
  showPrice?: boolean;
  showBedrooms?: boolean;
  showBathrooms?: boolean;
  showSurface?: boolean;
  showDescription?: boolean;
  showAgentName?: boolean;
}

/** Shape stored in agency_templates.config (jsonb). */
export interface TemplateConfig {
  brand: TemplateBrandConfig;
  fields: TemplateFieldVisibility;
  defaultTexts?: {
    /** Small kicker/badge shown above the title, e.g. "Nieuw op de markt", "Prijs aangepast", "Open kijkdag". */
    badgeText?: string;
    description?: string;
    ctaText?: string;
  };
}

/** Props every template React component receives. Superset — individual templates ignore what they don't need. */
export interface TemplateRenderProps {
  /** Always the property's real title (agency can edit it, see post creation flow), never a template label. */
  title: string;
  badgeText?: string;
  price: number | null;
  location: string;
  propertyType: PropertyType;
  bedrooms: number | null;
  bathrooms: number | null;
  surface: number | null;
  description: string | null;
  images: string[];
  agencyName: string;
  agencyLogo?: string;
  brandColor: string;
  secondaryColor?: string;
  ctaText?: string;
  status: PropertyStatus;
  fields: TemplateFieldVisibility;
  /** Agency-level fonts (set on the agency's own settings page, not per template) — any number, see agency_fonts / FontsCard.tsx and DynamicTemplateRenderer.tsx's per-font `@font-face`/`--font-{id}` injection. Same field names as AgencyFontRow so callers can pass query results through unchanged. */
  fonts: Pick<AgencyFontRow, "id" | "label" | "font_family" | "font_url">[];
}

// --- CRM mock boundary -----------------------------------------------------
// This is the shape a *real* CRM integration would eventually return. Keeping
// it stable means swapping crmMockService for a real provider later only
// touches src/services/crm/*.

export interface CrmProperty {
  crmPropertyId: string;
  title: string;
  description: string;
  price: number;
  location: string;
  propertyType: PropertyType;
  listingType: PropertyListingType;
  bedrooms: number | null;
  bathrooms: number | null;
  surface: number | null;
  status: PropertyStatus;
  /** When the property was published in the source CRM (ISO date). */
  listedAt: string;
  images: { url: string; isPrimary: boolean; sortOrder: number }[];
}

export interface CrmService {
  listProperties(agencyId: string): Promise<CrmProperty[]>;
  getProperty(agencyId: string, crmPropertyId: string): Promise<CrmProperty | null>;
}

// --- Meta scheduling boundary ----------------------------------------------
// Real facebook/instagram publishing services must implement this same
// interface so postSchedulerService never needs to change.

export interface MetaSchedulingRequest {
  agencyId: string;
  platform: Platform;
  caption: string;
  imageUrls: string[];
  scheduledAt: string | null;
}

export interface MetaSchedulingResult {
  ok: boolean;
  metaObjectId?: string;
  errorMessage?: string;
}

export interface MetaRescheduleRequest {
  agencyId: string;
  platform: Platform;
  /** post_jobs.meta_object_id from the original schedule() call — identifies which Meta-side post to update. */
  metaObjectId: string;
  caption: string;
  scheduledAt: string;
  /** Needed to recreate the post (delete + recreate — see facebookPublishingService.reschedule). */
  imageUrls: string[];
}

export interface MetaStatusCheckRequest {
  agencyId: string;
  platform: Platform;
  /** post_jobs.meta_object_id from the original schedule() call. */
  metaObjectId: string;
  scheduledAt: string;
}

export interface MetaStatusCheckResult {
  /** False means the check itself failed (network/API error) — caller should leave the job untouched and retry later, not treat this as "not published". */
  ok: boolean;
  published?: boolean;
  errorMessage?: string;
}

export interface MetaPublishingService {
  /**
   * `client` is optional on every method — omit it for normal session-scoped
   * callers. The background queue route has no user session (see
   * postQueueService.ts), so it passes an admin client all the way down to
   * here, since the social_connections lookup (getPageToken in
   * facebookPublishingService.ts) needs *some* authorized client to read
   * with, not just publishPost()'s own reads.
   */
  schedule(request: MetaSchedulingRequest, client?: SupabaseClient<Database>): Promise<MetaSchedulingResult>;
  reschedule(request: MetaRescheduleRequest, client?: SupabaseClient<Database>): Promise<MetaSchedulingResult>;
  /** Confirms whether Meta actually published a previously-scheduled post — see publishReconciliationService.ts. */
  checkPublishStatus(request: MetaStatusCheckRequest, client?: SupabaseClient<Database>): Promise<MetaStatusCheckResult>;
}

export interface PostStatusBadgeMeta {
  label: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
}

// pending_render/rendering/rendered/publishing are internal pipeline steps
// (see postQueueService.ts's processPendingPost and CLAUDE.md's
// "Achtergrond-queue voor renderen") — none of them are actionable for
// whoever's looking at the badge, and they're normally gone within seconds.
// Showing them as distinct statuses just adds noise; they display as
// "Ingepland" like `scheduled` and only surface as something different if
// the pipeline actually fails (render_failed/publish_failed) or finishes
// (published).
export const POST_STATUS_META: Record<PostStatus, PostStatusBadgeMeta> = {
  draft: { label: "Concept", tone: "neutral" },
  pending_render: { label: "Ingepland", tone: "success" },
  rendering: { label: "Ingepland", tone: "success" },
  // Legacy value — posts created before the render/publish split may still carry
  // this; 'rendered' is what new posts use for the same meaning.
  ready: { label: "Ingepland", tone: "success" },
  rendered: { label: "Ingepland", tone: "success" },
  scheduled: { label: "Ingepland", tone: "success" },
  publishing: { label: "Ingepland", tone: "success" },
  published: { label: "Gepubliceerd", tone: "success" },
  // Legacy value — new posts use render_failed/publish_failed for the same
  // meaning, split by which step actually failed.
  failed: { label: "Mislukt", tone: "danger" },
  render_failed: { label: "Renderen mislukt", tone: "danger" },
  publish_failed: { label: "Publiceren mislukt", tone: "danger" },
  cancelled: { label: "Geannuleerd", tone: "warning" },
};

export const TEMPLATE_STATUS_META: Record<TemplateStatus, PostStatusBadgeMeta> = {
  draft: { label: "Concept", tone: "neutral" },
  testing: { label: "Wordt getest", tone: "info" },
  published: { label: "Gepubliceerd", tone: "success" },
  failed: { label: "Mislukt", tone: "danger" },
  archived: { label: "Gearchiveerd", tone: "neutral" },
};
