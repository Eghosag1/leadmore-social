-- Custom font per vastgoedkantoor (not per template) — set on the agency's
-- own settings page, used by every template that agency has, via a fixed
-- `.font-brand` CSS class every template's className can opt into (see
-- DynamicTemplateRenderer.tsx). Nullable, no default — most agencies fall
-- back to the app's own default fonts.

alter table public.agencies add column if not exists custom_font_url text;
alter table public.agencies add column if not exists custom_font_family text;

insert into storage.buckets (id, name, public)
values ('agency-fonts', 'agency-fonts', true)
on conflict (id) do nothing;

create policy "Public read agency-fonts" on storage.objects for select
  using (bucket_id = 'agency-fonts');
create policy "Admin write agency-fonts" on storage.objects for insert
  with check (bucket_id = 'agency-fonts' and public.is_super_admin());
create policy "Admin update agency-fonts" on storage.objects for update
  using (bucket_id = 'agency-fonts' and public.is_super_admin());
create policy "Admin delete agency-fonts" on storage.objects for delete
  using (bucket_id = 'agency-fonts' and public.is_super_admin());
