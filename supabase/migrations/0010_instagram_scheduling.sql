-- Real Instagram publishing needs its own delayed-fire mechanism (Instagram's
-- Content Publishing API has no scheduled_publish_time equivalent — it always
-- publishes immediately), driven by an external QStash wake-up call hitting
-- /api/internal/instagram-sweep at the right time. 'publishing' is a brief
-- in-progress claim state on post_jobs while that sweep is actively calling
-- the Graph API for a given job — guards against two overlapping sweep
-- invocations (e.g. a retried QStash delivery) double-publishing the same
-- post. Same additive-only pattern as 0008_post_lifecycle.sql.
alter type public.post_status add value 'publishing';
