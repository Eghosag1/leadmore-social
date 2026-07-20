-- Lifts the per-agency custom font from exactly one (agencies.custom_font_url/
-- custom_font_family) to an unlimited list — needed so the upcoming scene
-- editor can offer a font picker per text element (title font, body font, ...)
-- instead of one font for the whole template. See PLAN_TEMPLATE_EDITOR.md
-- Phase A. agencies.custom_font_url/custom_font_family are NOT dropped here —
-- that happens in a later, separate migration once the new code path is
-- verified against real data (see 0016_drop_agency_custom_font_columns.sql).

create table public.agency_fonts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  label text not null,
  font_url text not null,
  font_family text not null,
  created_at timestamptz not null default now()
);

alter table public.agency_fonts enable row level security;

create policy agency_fonts_select on public.agency_fonts for select
  using (public.is_super_admin() or agency_id = public.current_profile_agency_id());
create policy agency_fonts_write on public.agency_fonts for insert
  with check (public.is_super_admin());
create policy agency_fonts_update on public.agency_fonts for update
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy agency_fonts_delete on public.agency_fonts for delete
  using (public.is_super_admin());

-- Backfill: every agency that already had a single custom font gets it as
-- the first row in its new font list, so nothing regresses for existing data.
insert into public.agency_fonts (agency_id, label, font_url, font_family)
select id, 'Huisstijlfont', custom_font_url, custom_font_family
from public.agencies
where custom_font_url is not null and custom_font_family is not null;

-- Real server-side upload limit (5MB) — FontUploader.tsx today only checks
-- the file extension client-side, never the actual bytes/size.
update storage.buckets set file_size_limit = 5242880 where id = 'agency-fonts';
