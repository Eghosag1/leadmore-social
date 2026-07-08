-- Restructure: templates belong directly to one agency, no shared blueprint
-- layer. New templates are created by choosing a layout_key from the
-- code-level registry (src/components/templates/registry.tsx) instead of
-- duplicating a row from a shared template_blueprints table.

alter table public.agency_templates drop constraint if exists agency_templates_blueprint_id_fkey;
alter table public.agency_templates drop column if exists blueprint_id;

drop policy if exists template_blueprints_select on public.template_blueprints;
drop policy if exists template_blueprints_write on public.template_blueprints;
drop policy if exists template_blueprints_update on public.template_blueprints;
drop policy if exists template_blueprints_delete on public.template_blueprints;
drop table if exists public.template_blueprints;

-- Property listing date from the source CRM, distinct from our own sync
-- timestamp (created_at) — shown in the agency's properties table.
alter table public.properties add column if not exists listed_at timestamptz;

-- Meta (Facebook/Instagram) connection is now configured by the
-- platformbeheerder only — agencies no longer manage this themselves, so
-- agency_admin loses write access here.
drop policy if exists social_connections_insert on public.social_connections;
drop policy if exists social_connections_update on public.social_connections;
drop policy if exists social_connections_delete on public.social_connections;

create policy social_connections_insert on public.social_connections for insert
  with check (public.is_super_admin());
create policy social_connections_update on public.social_connections for update
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy social_connections_delete on public.social_connections for delete
  using (public.is_super_admin());
