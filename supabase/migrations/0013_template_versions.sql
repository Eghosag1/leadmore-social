-- Version history for component_source (DB-string) templates — every
-- successful validateAndPublishTemplate() snapshots the just-published
-- state, so an admin can load a previous version back into the editor.
-- Git-managed (template_key) templates get version history for free via
-- git, so this only ever applies to component_source templates.

create table public.agency_template_versions (
  id uuid primary key default gen_random_uuid(),
  agency_template_id uuid not null references public.agency_templates(id) on delete cascade,
  version integer not null,
  component_source text not null,
  slide_count integer not null,
  config jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  unique (agency_template_id, version)
);
create index agency_template_versions_template_id_idx on public.agency_template_versions (agency_template_id);

-- Same access model as agency_templates itself: authoring is a super_admin-only concern.
alter table public.agency_template_versions enable row level security;
create policy agency_template_versions_all on public.agency_template_versions
  for all using (public.is_super_admin()) with check (public.is_super_admin());
