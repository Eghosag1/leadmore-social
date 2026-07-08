-- Storage buckets. Everything is public-read because rendered post images and
-- property photos ultimately need to be fetched by the Meta Graph API by URL.
-- Writes are restricted to super_admin / service-role (mock CRM sync and the
-- render service both run server-side with the service-role key).

insert into storage.buckets (id, name, public)
values
  ('agency-logos', 'agency-logos', true),
  ('property-images', 'property-images', true),
  ('template-previews', 'template-previews', true),
  ('rendered-posts', 'rendered-posts', true)
on conflict (id) do nothing;

create policy "Public read agency-logos" on storage.objects for select
  using (bucket_id = 'agency-logos');
create policy "Admin write agency-logos" on storage.objects for insert
  with check (bucket_id = 'agency-logos' and public.is_super_admin());
create policy "Admin update agency-logos" on storage.objects for update
  using (bucket_id = 'agency-logos' and public.is_super_admin());
create policy "Admin delete agency-logos" on storage.objects for delete
  using (bucket_id = 'agency-logos' and public.is_super_admin());

create policy "Public read property-images" on storage.objects for select
  using (bucket_id = 'property-images');
create policy "Admin write property-images" on storage.objects for insert
  with check (bucket_id = 'property-images' and public.is_super_admin());
create policy "Admin update property-images" on storage.objects for update
  using (bucket_id = 'property-images' and public.is_super_admin());
create policy "Admin delete property-images" on storage.objects for delete
  using (bucket_id = 'property-images' and public.is_super_admin());

create policy "Public read template-previews" on storage.objects for select
  using (bucket_id = 'template-previews');
create policy "Admin write template-previews" on storage.objects for insert
  with check (bucket_id = 'template-previews' and public.is_super_admin());
create policy "Admin update template-previews" on storage.objects for update
  using (bucket_id = 'template-previews' and public.is_super_admin());
create policy "Admin delete template-previews" on storage.objects for delete
  using (bucket_id = 'template-previews' and public.is_super_admin());

create policy "Public read rendered-posts" on storage.objects for select
  using (bucket_id = 'rendered-posts');
create policy "Admin write rendered-posts" on storage.objects for insert
  with check (bucket_id = 'rendered-posts' and public.is_super_admin());
create policy "Admin update rendered-posts" on storage.objects for update
  using (bucket_id = 'rendered-posts' and public.is_super_admin());
create policy "Admin delete rendered-posts" on storage.objects for delete
  using (bucket_id = 'rendered-posts' and public.is_super_admin());
