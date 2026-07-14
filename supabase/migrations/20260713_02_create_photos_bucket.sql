-- Bucket para fotos de potenciómetros
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('warranty-photos', 'warranty-photos', true, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create policy "anon sube fotos de garantia"
  on storage.objects for insert to anon
  with check (bucket_id = 'warranty-photos');

create policy "equipo gestiona fotos"
  on storage.objects for all to authenticated
  using (bucket_id = 'warranty-photos')
  with check (bucket_id = 'warranty-photos');
