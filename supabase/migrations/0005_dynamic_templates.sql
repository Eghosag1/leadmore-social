-- Templates are no longer picked from a fixed set of statically-bundled React
-- layouts. The platformbeheerder now writes/pastes the actual React source
-- per template, per agency, compiled at runtime (see
-- src/lib/dynamic-template.ts). There is no catalog to choose from — a new
-- agency starts with zero templates.

alter table public.agency_templates drop column if exists layout_key;
alter table public.agency_templates add column if not exists component_source text not null default '';
alter table public.agency_templates add column if not exists slide_count integer not null default 1;

drop domain if exists public.layout_key;
