-- Splits post rendering from publishing into distinct, explicit statuses
-- instead of one overloaded 'failed' that could mean either "the render
-- pipeline broke" or "Meta rejected the post" — and removes the old silent
-- fallback-to-source-photo behavior (see browserRenderService.ts): a failed
-- render now blocks scheduling until the user explicitly retries or opts in
-- to the unbranded photo, rather than publishing it unbranded unnoticed.

-- Additive only — post_jobs.status keeps using draft/scheduled/published/failed
-- unchanged. Existing posts rows keep their old 'ready'/'failed' values as-is.
alter type public.post_status add value 'pending_render';
alter type public.post_status add value 'rendered';
alter type public.post_status add value 'render_failed';
alter type public.post_status add value 'publish_failed';

-- Platforms chosen at creation time, persisted immediately — today this is only
-- a transient argument passed into schedulePost(), lost if rendering fails
-- before a post_jobs row ever exists. Needed so a retry can re-publish without
-- re-asking the user which platforms they wanted.
alter table public.posts add column platforms public.platform[] not null default '{}'::public.platform[];

-- Specific render failure reason, shown on the post detail page — same pattern
-- as agency_templates.validation_error from the template validation flow.
alter table public.posts add column render_error text;

-- True only after the explicit "use original photo anyway" action — lets the UI
-- tell an unresolved render failure apart from a deliberate, informational choice.
alter table public.post_slides add column render_overridden boolean not null default false;
