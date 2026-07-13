-- Templates can now optionally be sourced from a git-managed TemplateDefinition
-- (src/templates/registry.ts) instead of the runtime-compiled component_source
-- string. A row with template_key set is registry-sourced; a row without it
-- keeps using component_source exactly as before. Nullable, no default — every
-- existing row stays a DB-string template until explicitly migrated.

alter table public.agency_templates add column if not exists template_key text;
