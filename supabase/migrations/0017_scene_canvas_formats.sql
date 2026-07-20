-- Scenes can now be authored separately per fixed social-media aspect ratio
-- ("portrait" 4:5, "square" 1:1, "landscape" 1.91:1) instead of a single
-- implicit 4:5 canvas — see src/types/scene.ts (CANVAS_FORMATS) and the
-- SceneEditor's format tabs. Replaces the flat cover_scene/content_scene/
-- end_scene columns (0016_template_scenes.sql) with one scenes_by_format
-- jsonb column keyed by format:
--   { portrait: {cover,content,end}, square: {...}, landscape: {...} }
-- Each format key is independently optional/absent (same
-- nullable-column-as-signal precedent template_key/the old scene columns
-- already established) — a template can have just "portrait" designed, or
-- all three.
alter table public.agency_templates add column if not exists scenes_by_format jsonb;

-- Backfill: existing scene data (authored before formats existed) was always
-- implicitly the 4:5/"portrait" canvas — wrap it under that key so nothing
-- already-designed is lost.
update public.agency_templates
set scenes_by_format = jsonb_build_object(
  'portrait', jsonb_build_object('cover', cover_scene, 'content', content_scene, 'end', end_scene)
)
where cover_scene is not null or content_scene is not null or end_scene is not null;

alter table public.agency_templates drop column if exists cover_scene;
alter table public.agency_templates drop column if exists content_scene;
alter table public.agency_templates drop column if exists end_scene;

-- Which of a scene template's designed formats one specific post uses.
-- Null for "eigen foto's" and legacy component_source posts — those keep
-- using canvas_mode/canvas_height (0014_post_canvas_mode.sql) exactly as
-- before, untouched by this migration. Set for every scene-template post;
-- the render pipeline prefers canvas_format over canvas_mode/canvas_height
-- whenever it's present (src/lib/render/canvas-dimensions.ts).
create type public.post_canvas_format as enum ('portrait', 'square', 'landscape');
alter table public.posts add column canvas_format public.post_canvas_format;
