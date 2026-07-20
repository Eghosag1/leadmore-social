-- The git-managed template path (src/templates/registry.ts, introduced in
-- 0011_template_registry_key.sql) is scrapped: the scene editor is now the
-- only way to create or edit a template, and template_key required writing
-- a real .tsx file and deploying code, which no admin-facing flow ever did.
-- No row in this app's own data ever had this column set.

alter table public.agency_templates drop column if exists template_key;
