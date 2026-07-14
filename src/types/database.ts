// Hand-written row types mirroring supabase/migrations/0001_init.sql.
// If you have the Supabase CLI available, prefer regenerating this file with
// `supabase gen types typescript` and re-adding the domain helpers below.

import type {
  BillableType,
  ConnectionStatus,
  CrmProvider,
  Platform,
  PostCanvasMode,
  PostFormat,
  PostStatus,
  PostType,
  ProfileRole,
  PropertyListingType,
  PropertyStatus,
  PropertyType,
  TemplateStatus,
  TemplateType,
} from "./enums";

export type AgencyRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  website_url: string | null;
  /** Public URL of an uploaded font file (agency-fonts bucket) — used by every template of this agency via the fixed `.font-brand` CSS class. */
  custom_font_url: string | null;
  /** CSS font-family name to declare in the @font-face rule — freely chosen, not derived from the file. */
  custom_font_family: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  user_id: string;
  agency_id: string | null;
  full_name: string;
  role: ProfileRole;
  created_at: string;
  updated_at: string;
};

export type CrmConnectionRow = {
  id: string;
  agency_id: string;
  provider: CrmProvider;
  status: ConnectionStatus;
  config: Record<string, unknown>;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SocialConnectionRow = {
  id: string;
  agency_id: string;
  provider: "meta";
  facebook_page_id: string | null;
  instagram_account_id: string | null;
  access_token_encrypted: string | null;
  token_expires_at: string | null;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
};

export type PropertyRow = {
  id: string;
  agency_id: string;
  crm_property_id: string | null;
  title: string;
  description: string | null;
  price: number;
  location: string;
  property_type: PropertyType;
  listing_type: PropertyListingType;
  bedrooms: number | null;
  bathrooms: number | null;
  surface: number | null;
  status: PropertyStatus;
  /** When the property was published in the source CRM (not our sync time). */
  listed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PropertyImageRow = {
  id: string;
  property_id: string;
  image_url: string;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
};

export type AgencyTemplateRow = {
  id: string;
  agency_id: string;
  name: string;
  description: string | null;
  /** Admin-authored TSX source, compiled at runtime — see src/lib/dynamic-template.ts. Ignored when template_key is set. */
  component_source: string;
  /** When set, this row is sourced from the git-managed src/templates/registry.ts instead of component_source — see src/templates/types.ts. */
  template_key: string | null;
  /** 1 = single post, >1 = carousel with that many slides. */
  slide_count: number;
  type: TemplateType;
  post_format: PostFormat;
  config: Record<string, unknown>;
  preview_image_url: string | null;
  status: TemplateStatus;
  /** Server-compiled Tailwind CSS for this template's actual classNames — see src/lib/render/compile-tailwind.ts. Populated once validation succeeds. */
  compiled_css: string | null;
  compiled_css_hash: string | null;
  validated_at: string | null;
  /** Human-readable reason the last validation attempt failed, if status is 'failed'. */
  validation_error: string | null;
  included_in_plan: boolean;
  billable_type: BillableType;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** Snapshot of a component_source template taken at every successful validateAndPublishTemplate() — see templateValidationService.ts. Never created for template_key (git-managed) templates. */
export type AgencyTemplateVersionRow = {
  id: string;
  agency_template_id: string;
  version: number;
  component_source: string;
  slide_count: number;
  config: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
};

export type PostRow = {
  id: string;
  agency_id: string;
  property_id: string;
  /** Null for "eigen foto's" posts created without an admin-authored template. */
  agency_template_id: string | null;
  post_type: PostType;
  caption: string;
  status: PostStatus;
  /** Chosen at creation time, before rendering ever runs — see publishPost in postSchedulerService.ts. */
  platforms: Platform[];
  /** Specific reason the last render attempt failed, set only when status is render_failed. */
  render_error: string | null;
  /** 'fixed' = the standard 1080x1350 canvas; 'original' = canvas_height drives the render wrapper's height instead. Templated posts only, see canvas-format.ts. */
  canvas_mode: PostCanvasMode;
  /** Only meaningful when canvas_mode = 'original' — clamped server-side to [565, 1350], see canvas-format.ts. */
  canvas_height: number | null;
  scheduled_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type PostSlideRow = {
  id: string;
  post_id: string;
  sort_order: number;
  image_url: string;
  text_content: Record<string, unknown>;
  rendered_image_url: string | null;
  /** True only after the explicit "use original photo anyway" action — see useOriginalPhotoAction. */
  render_overridden: boolean;
  created_at: string;
};

export type PostJobRow = {
  id: string;
  post_id: string;
  platform: Platform;
  status: PostStatus;
  scheduled_at: string | null;
  meta_object_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type TableName =
  | "agencies"
  | "profiles"
  | "crm_connections"
  | "social_connections"
  | "properties"
  | "property_images"
  | "agency_templates"
  | "agency_template_versions"
  | "posts"
  | "post_slides"
  | "post_jobs";

// @supabase/postgrest-js requires every table to carry a `Relationships`
// array (even if empty) to correctly infer Insert/Update payload types —
// without it, generic inference silently collapses to `never`.
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      agencies: Table<AgencyRow>;
      profiles: Table<ProfileRow>;
      crm_connections: Table<CrmConnectionRow>;
      social_connections: Table<SocialConnectionRow>;
      properties: Table<PropertyRow>;
      property_images: Table<PropertyImageRow>;
      agency_templates: Table<AgencyTemplateRow>;
      agency_template_versions: Table<AgencyTemplateVersionRow>;
      posts: Table<PostRow>;
      post_slides: Table<PostSlideRow>;
      post_jobs: Table<PostJobRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
