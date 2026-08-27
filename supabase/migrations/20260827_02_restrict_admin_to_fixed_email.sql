-- Este proyecto Supabase es compartido con otros sistemas (fichas_*, topstone_*).
-- Se restringe el acceso administrativo de garantías a un único correo fijo,
-- en vez de "cualquier usuario autenticado" del proyecto.

drop policy if exists "equipo lee garantias" on public.warranties;
drop policy if exists "equipo actualiza garantias" on public.warranties;
drop policy if exists "equipo elimina garantias" on public.warranties;
drop policy if exists "equipo lee historial" on public.warranty_status_history;
drop policy if exists "equipo gestiona fotos" on storage.objects;

create policy "admin garantias lee"
  on public.warranties for select to authenticated
  using ((auth.jwt() ->> 'email') = 'garantias@athletetrainlab.com');

create policy "admin garantias actualiza"
  on public.warranties for update to authenticated
  using ((auth.jwt() ->> 'email') = 'garantias@athletetrainlab.com');

create policy "admin garantias elimina"
  on public.warranties for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'garantias@athletetrainlab.com');

create policy "admin garantias lee historial"
  on public.warranty_status_history for select to authenticated
  using ((auth.jwt() ->> 'email') = 'garantias@athletetrainlab.com');

create policy "admin garantias gestiona fotos"
  on storage.objects for all to authenticated
  using (bucket_id = 'warranty-photos' and (auth.jwt() ->> 'email') = 'garantias@athletetrainlab.com')
  with check (bucket_id = 'warranty-photos' and (auth.jwt() ->> 'email') = 'garantias@athletetrainlab.com');
