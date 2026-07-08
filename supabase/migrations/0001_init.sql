-- Leadmore Social Media Post — initial schema
-- Roles: super_admin (platform), agency_admin / agency_user (real estate agency staff)
-- See CLAUDE.md for the product/business rules this schema encodes.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.profile_role as enum ('super_admin', 'agency_admin', 'agency_user');
create type public.template_type as enum ('single', 'carousel');
create type public.post_format as enum ('feed', 'story');
create type public.billable_type as enum ('included', 'regie');
create type public.post_status as enum ('draft', 'rendering', 'ready', 'scheduled', 'published', 'failed', 'cancelled');
create type public.platform as enum ('facebook', 'instagram');
create type public.property_status as enum ('available', 'under_offer', 'sold', 'rented', 'withdrawn');
create type public.property_type as enum ('house', 'apartment', 'villa', 'studio', 'commercial', 'land');
create type public.connection_status as enum ('not_connected', 'connected', 'error', 'expired');
create type public.crm_provider as enum ('mock', 'whise', 'immoweb', 'custom');

-- layout_key stays plain text (not an enum) because it maps 1:1 to a React
-- component that ships in application code (see src/components/templates).
-- Adding a new layout is already a code deploy; this constraint just keeps
-- the two in sync. Extend it in a follow-up migration when a new layout
-- component is added.
create domain public.layout_key as text
  check (value in ('property_single_v1', 'property_carousel_v1', 'sold_single_v1'));

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text not null default '#111827',
  secondary_color text not null default '#6b7280',
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  agency_id uuid references public.agencies (id) on delete set null,
  full_name text not null,
  role public.profile_role not null default 'agency_user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_agency_required_for_agency_roles check (
    role = 'super_admin' or agency_id is not null
  )
);
create index profiles_agency_id_idx on public.profiles (agency_id);

create table public.crm_connections (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  provider public.crm_provider not null default 'mock',
  status public.connection_status not null default 'not_connected',
  config jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, provider)
);

create table public.social_connections (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  provider text not null default 'meta',
  facebook_page_id text,
  instagram_account_id text,
  access_token_encrypted text,
  token_expires_at timestamptz,
  status public.connection_status not null default 'not_connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, provider)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  crm_property_id text,
  title text not null,
  description text,
  price numeric(12, 2) not null default 0,
  location text not null,
  property_type public.property_type not null default 'house',
  bedrooms integer,
  bathrooms integer,
  surface numeric(8, 2),
  status public.property_status not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, crm_property_id)
);
create index properties_agency_id_idx on public.properties (agency_id);

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index property_images_property_id_idx on public.property_images (property_id);

create table public.template_blueprints (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  layout_key public.layout_key not null,
  type public.template_type not null,
  post_format public.post_format not null default 'feed',
  default_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agency_templates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  blueprint_id uuid references public.template_blueprints (id) on delete set null,
  name text not null,
  description text,
  layout_key public.layout_key not null,
  type public.template_type not null,
  post_format public.post_format not null default 'feed',
  config jsonb not null default '{}'::jsonb,
  preview_image_url text,
  is_active boolean not null default true,
  included_in_plan boolean not null default true,
  billable_type public.billable_type not null default 'included',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agency_templates_agency_id_idx on public.agency_templates (agency_id);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete restrict,
  agency_template_id uuid not null references public.agency_templates (id) on delete restrict,
  post_type public.template_type not null,
  caption text not null default '',
  status public.post_status not null default 'draft',
  scheduled_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index posts_agency_id_idx on public.posts (agency_id);
create index posts_property_id_idx on public.posts (property_id);
create index posts_status_idx on public.posts (status);

create table public.post_slides (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  sort_order integer not null default 0,
  image_url text not null,
  text_content jsonb not null default '{}'::jsonb,
  rendered_image_url text,
  created_at timestamptz not null default now()
);
create index post_slides_post_id_idx on public.post_slides (post_id);

create table public.post_jobs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  platform public.platform not null,
  status public.post_status not null default 'draft',
  scheduled_at timestamptz,
  meta_object_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, platform)
);
create index post_jobs_post_id_idx on public.post_jobs (post_id);
create index post_jobs_status_idx on public.post_jobs (status);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.agencies for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.crm_connections for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.social_connections for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.properties for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.template_blueprints for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.agency_templates for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.posts for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.post_jobs for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auth helper functions (SECURITY DEFINER to avoid RLS recursion on profiles)
-- ---------------------------------------------------------------------------

create or replace function public.current_profile_role()
returns public.profile_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where user_id = auth.uid() limit 1;
$$;

create or replace function public.current_profile_agency_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select agency_id from public.profiles where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_profile_role() = 'super_admin', false);
$$;

create or replace function public.is_agency_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_profile_role() = 'agency_admin', false);
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.agencies enable row level security;
alter table public.profiles enable row level security;
alter table public.crm_connections enable row level security;
alter table public.social_connections enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.template_blueprints enable row level security;
alter table public.agency_templates enable row level security;
alter table public.posts enable row level security;
alter table public.post_slides enable row level security;
alter table public.post_jobs enable row level security;

-- agencies: super_admin manages everything, agency staff can read their own agency only.
create policy agencies_select on public.agencies for select
  using (public.is_super_admin() or id = public.current_profile_agency_id());
create policy agencies_write on public.agencies for insert
  with check (public.is_super_admin());
create policy agencies_update on public.agencies for update
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy agencies_delete on public.agencies for delete
  using (public.is_super_admin());

-- profiles: everyone can read their own row; super_admin reads/writes all;
-- agency members can see teammates in the same agency.
create policy profiles_select on public.profiles for select
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or agency_id = public.current_profile_agency_id()
  );
create policy profiles_insert on public.profiles for insert
  with check (public.is_super_admin());
create policy profiles_update on public.profiles for update
  using (public.is_super_admin() or user_id = auth.uid())
  with check (public.is_super_admin() or user_id = auth.uid());
create policy profiles_delete on public.profiles for delete
  using (public.is_super_admin());

-- crm_connections: agency staff read-only, super_admin manages.
create policy crm_connections_select on public.crm_connections for select
  using (public.is_super_admin() or agency_id = public.current_profile_agency_id());
create policy crm_connections_write on public.crm_connections for insert
  with check (public.is_super_admin());
create policy crm_connections_update on public.crm_connections for update
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy crm_connections_delete on public.crm_connections for delete
  using (public.is_super_admin());

-- social_connections: agency_admin manages their own agency's Meta connection.
create policy social_connections_select on public.social_connections for select
  using (public.is_super_admin() or agency_id = public.current_profile_agency_id());
create policy social_connections_insert on public.social_connections for insert
  with check (
    public.is_super_admin()
    or (public.is_agency_admin() and agency_id = public.current_profile_agency_id())
  );
create policy social_connections_update on public.social_connections for update
  using (
    public.is_super_admin()
    or (public.is_agency_admin() and agency_id = public.current_profile_agency_id())
  )
  with check (
    public.is_super_admin()
    or (public.is_agency_admin() and agency_id = public.current_profile_agency_id())
  );
create policy social_connections_delete on public.social_connections for delete
  using (public.is_super_admin() or (public.is_agency_admin() and agency_id = public.current_profile_agency_id()));

-- properties: come from CRM sync (service-role only writes). Agency staff read their own.
create policy properties_select on public.properties for select
  using (public.is_super_admin() or agency_id = public.current_profile_agency_id());
create policy properties_write on public.properties for insert
  with check (public.is_super_admin());
create policy properties_update on public.properties for update
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy properties_delete on public.properties for delete
  using (public.is_super_admin());

-- property_images: scoped through the parent property's agency.
create policy property_images_select on public.property_images for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_images.property_id
        and (public.is_super_admin() or p.agency_id = public.current_profile_agency_id())
    )
  );
create policy property_images_write on public.property_images for insert
  with check (public.is_super_admin());
create policy property_images_update on public.property_images for update
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy property_images_delete on public.property_images for delete
  using (public.is_super_admin());

-- template_blueprints: internal to the platform admin only.
create policy template_blueprints_select on public.template_blueprints for select
  using (public.is_super_admin());
create policy template_blueprints_write on public.template_blueprints for insert
  with check (public.is_super_admin());
create policy template_blueprints_update on public.template_blueprints for update
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy template_blueprints_delete on public.template_blueprints for delete
  using (public.is_super_admin());

-- agency_templates: agency staff can read their own *active* templates only;
-- only super_admin can create/edit/deactivate (this is the core template
-- business rule — agencies never author or edit templates themselves).
create policy agency_templates_select on public.agency_templates for select
  using (
    public.is_super_admin()
    or (agency_id = public.current_profile_agency_id() and is_active = true)
  );
create policy agency_templates_write on public.agency_templates for insert
  with check (public.is_super_admin());
create policy agency_templates_update on public.agency_templates for update
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy agency_templates_delete on public.agency_templates for delete
  using (public.is_super_admin());

-- posts: agency staff manage their own agency's posts.
create policy posts_select on public.posts for select
  using (public.is_super_admin() or agency_id = public.current_profile_agency_id());
create policy posts_insert on public.posts for insert
  with check (public.is_super_admin() or agency_id = public.current_profile_agency_id());
create policy posts_update on public.posts for update
  using (public.is_super_admin() or agency_id = public.current_profile_agency_id())
  with check (public.is_super_admin() or agency_id = public.current_profile_agency_id());
create policy posts_delete on public.posts for delete
  using (public.is_super_admin() or agency_id = public.current_profile_agency_id());

-- post_slides: scoped through the parent post's agency.
create policy post_slides_select on public.post_slides for select
  using (
    exists (
      select 1 from public.posts pt
      where pt.id = post_slides.post_id
        and (public.is_super_admin() or pt.agency_id = public.current_profile_agency_id())
    )
  );
create policy post_slides_insert on public.post_slides for insert
  with check (
    exists (
      select 1 from public.posts pt
      where pt.id = post_slides.post_id
        and (public.is_super_admin() or pt.agency_id = public.current_profile_agency_id())
    )
  );
create policy post_slides_update on public.post_slides for update
  using (
    exists (
      select 1 from public.posts pt
      where pt.id = post_slides.post_id
        and (public.is_super_admin() or pt.agency_id = public.current_profile_agency_id())
    )
  );
create policy post_slides_delete on public.post_slides for delete
  using (
    exists (
      select 1 from public.posts pt
      where pt.id = post_slides.post_id
        and (public.is_super_admin() or pt.agency_id = public.current_profile_agency_id())
    )
  );

-- post_jobs: agency staff can read + create (when scheduling); status
-- transitions after creation are applied by the scheduling service using the
-- service-role key (mirrors a real Meta webhook updating delivery status),
-- so there is no authenticated UPDATE policy here.
create policy post_jobs_select on public.post_jobs for select
  using (
    exists (
      select 1 from public.posts pt
      where pt.id = post_jobs.post_id
        and (public.is_super_admin() or pt.agency_id = public.current_profile_agency_id())
    )
  );
create policy post_jobs_insert on public.post_jobs for insert
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.posts pt
      where pt.id = post_jobs.post_id
        and pt.agency_id = public.current_profile_agency_id()
    )
  );
create policy post_jobs_update on public.post_jobs for update
  using (public.is_super_admin()) with check (public.is_super_admin());
-- Deleting a job (e.g. cancelling a scheduled post) is a direct user action,
-- unlike status transitions which mirror an async Meta webhook.
create policy post_jobs_delete on public.post_jobs for delete
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.posts pt
      where pt.id = post_jobs.post_id
        and pt.agency_id = public.current_profile_agency_id()
    )
  );
