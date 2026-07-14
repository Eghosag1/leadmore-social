-- Per-post canvas format: 'fixed' keeps today's 1080x1350 (4:5) canvas,
-- 'original' derives the render canvas height from the source photo's own
-- aspect ratio instead of a fixed crop. Additive only — every existing row
-- defaults to 'fixed', identical behavior to before this migration.
-- canvas_height is only meaningful when canvas_mode = 'original'; the check
-- constraint mirrors Instagram's supported aspect-ratio range (4:5 to
-- 1.91:1, i.e. 565-1350px at a fixed 1080px width) as defense-in-depth
-- alongside the app-level clamp in src/lib/canvas-format.ts.
create type public.post_canvas_mode as enum ('fixed', 'original');

alter table public.posts
  add column canvas_mode public.post_canvas_mode not null default 'fixed';

alter table public.posts
  add column canvas_height integer
  constraint posts_canvas_height_range check (canvas_height is null or (canvas_height between 565 and 1350));
