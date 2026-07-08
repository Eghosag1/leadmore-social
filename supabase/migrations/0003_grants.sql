-- Explicit privilege grants for the public schema.
--
-- RLS policies (0001_init.sql) control *row* access. These GRANTs control
-- whether the anon/authenticated/service_role Postgres roles can touch the
-- tables at all — a separate, coarser layer that Postgres checks first. New
-- Supabase projects don't always pre-configure this for tables created via
-- raw SQL (as opposed to the dashboard Table Editor), which shows up as
-- "permission denied for table X" even when using the service_role key.
--
-- Safe to run: anon/authenticated remain fully governed by RLS; service_role
-- already bypasses RLS by design, this just makes that explicit.

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
