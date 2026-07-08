// Domain-level types used across services and UI. These sit one level above
// the raw database rows (src/types/database.ts) and are what components and
// server actions actually pass around.

import type { Platform, PostStatus, PropertyStatus, PropertyType } from "./enums";

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
}

export interface MetaPublishingService {
  schedule(request: MetaSchedulingRequest): Promise<MetaSchedulingResult>;
  reschedule(request: MetaRescheduleRequest): Promise<MetaSchedulingResult>;
}

export interface PostStatusBadgeMeta {
  label: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
}

export const POST_STATUS_META: Record<PostStatus, PostStatusBadgeMeta> = {
  draft: { label: "Concept", tone: "neutral" },
  rendering: { label: "Wordt gerenderd", tone: "info" },
  ready: { label: "Klaar", tone: "info" },
  scheduled: { label: "Ingepland", tone: "success" },
  published: { label: "Gepubliceerd", tone: "success" },
  failed: { label: "Mislukt", tone: "danger" },
  cancelled: { label: "Geannuleerd", tone: "warning" },
};
