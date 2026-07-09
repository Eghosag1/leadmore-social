-- Templates now go through an explicit validation step before they're usable
-- by an agency: compile the TSX, generate its Tailwind CSS, and test-render
-- it with dummy property data. Replaces the simple is_active boolean with a
-- status that reflects that lifecycle, and persists the generated CSS so the
-- real render pipeline doesn't have to recompile it on every post.

create type public.template_status as enum ('draft', 'testing', 'published', 'failed', 'archived');

alter table public.agency_templates add column status public.template_status not null default 'draft';
alter table public.agency_templates add column compiled_css text;
alter table public.agency_templates add column compiled_css_hash text;
alter table public.agency_templates add column validated_at timestamptz;
alter table public.agency_templates add column validation_error text;

-- Existing templates were implicitly trusted (no validation step existed
-- yet) — carry that trust forward instead of hiding every seeded/live
-- template from agencies until someone manually revalidates each one.
update public.agency_templates set status = (case when is_active then 'published' else 'archived' end)::public.template_status;

-- agency_templates_select (0001_init.sql): agency staff could read their own
-- *active* templates only. Same rule, expressed against the new status.
-- Must happen before dropping is_active — the old policy body references it.
drop policy if exists agency_templates_select on public.agency_templates;
create policy agency_templates_select on public.agency_templates for select
  using (
    public.is_super_admin()
    or (agency_id = public.current_profile_agency_id() and status = 'published')
  );

alter table public.agency_templates drop column is_active;
