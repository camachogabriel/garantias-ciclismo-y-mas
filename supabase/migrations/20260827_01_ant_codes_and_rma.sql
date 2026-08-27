-- 1. Códigos ANT+ por biela
alter table public.warranties
  add column code_1_ant text,
  add column code_2_ant text;

-- 2. Tabla de RMAs (envíos consolidados de garantías)
create table public.rma_requests (
  id uuid primary key default gen_random_uuid(),
  rma_code text unique not null,
  tracking_out text,      -- número de tracking de envío
  date_out date,          -- fecha de envío
  tracking_in text,       -- número de tracking de retorno
  date_in date,           -- fecha de retorno
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.warranties
  add column rma_id uuid references public.rma_requests(id) on delete set null;

-- Código legible: RMA-XXXXXX
create or replace function public.generate_rma_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := 'RMA-';
    for i in 1..6 loop
      code := code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.rma_requests r where r.rma_code = code);
  end loop;
  new.rma_code := code;
  return new;
end;
$$;

create trigger set_rma_code
  before insert on public.rma_requests
  for each row execute function public.generate_rma_code();

create or replace function public.rma_requests_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger on_rma_update
  before update on public.rma_requests
  for each row execute function public.rma_requests_touch();

revoke execute on function public.generate_rma_code() from anon, authenticated, public;
revoke execute on function public.rma_requests_touch() from anon, authenticated, public;

-- RLS: solo el admin fijo de garantías
alter table public.rma_requests enable row level security;

create policy "admin garantias lee rma"
  on public.rma_requests for select to authenticated
  using ((auth.jwt() ->> 'email') = 'garantias@athletetrainlab.com');
create policy "admin garantias inserta rma"
  on public.rma_requests for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'garantias@athletetrainlab.com');
create policy "admin garantias actualiza rma"
  on public.rma_requests for update to authenticated
  using ((auth.jwt() ->> 'email') = 'garantias@athletetrainlab.com');
create policy "admin garantias elimina rma"
  on public.rma_requests for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'garantias@athletetrainlab.com');

-- 3. Función atómica: crea el RMA, liga las garantías seleccionadas y las pasa a "enviada"
create or replace function public.generate_rma(p_warranty_ids uuid[])
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rma_id uuid;
  v_rma_code text;
  v_count int;
begin
  if (auth.jwt() ->> 'email') is distinct from 'garantias@athletetrainlab.com' then
    raise exception 'No autorizado';
  end if;
  if p_warranty_ids is null or array_length(p_warranty_ids, 1) is null then
    raise exception 'Selecciona al menos una garantía';
  end if;

  insert into public.rma_requests (date_out) values (current_date)
  returning id, rma_code into v_rma_id, v_rma_code;

  update public.warranties
    set status = 'enviada', rma_id = v_rma_id
    where id = any(p_warranty_ids);
  get diagnostics v_count = row_count;

  if v_count = 0 then
    delete from public.rma_requests where id = v_rma_id;
    raise exception 'No se encontraron garantías válidas para el RMA';
  end if;

  return v_rma_code;
end;
$$;

grant execute on function public.generate_rma(uuid[]) to authenticated;
revoke execute on function public.generate_rma(uuid[]) from anon, public;
