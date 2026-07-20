-- Adds the JSON-driven "scene" template path — three independently-optional
-- scenes per template (cover for slide 1, content reused for middle slides,
-- end as a fixed no-photo closing card, always the last slide if defined).
-- See PLAN_TEMPLATE_EDITOR.md Phase C for the full design.
--
-- Nullable, no default, no new discriminator column: whether a row is
-- "scene-based" is simply "cover_scene, content_scene, or end_scene is not
-- null" — the exact same nullable-column-as-discriminator pattern
-- template_key already established (0011_template_registry_key.sql)
-- alongside component_source.
alter table public.agency_templates add column if not exists cover_scene jsonb;
alter table public.agency_templates add column if not exists content_scene jsonb;
alter table public.agency_templates add column if not exists end_scene jsonb;
