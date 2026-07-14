-- Tabla principal de garantías
create table public.warranties (
  id uuid primary key default gen_random_uuid(),
  tracking_code text unique not null,
  -- Datos del cliente (formulario público)
  full_name text not null,
  phone text not null,
  phone_alt text,
  email text not null,
  brand text not null check (brand in ('Favero','Sigeyi','XOSS','4iiii')),
  model text not null,
  purchase_date date,
  defect_notes text,
  customer_photo_url text,
  -- Gestión interna (panel admin)
  status text not null default 'en_revision'
    check (status in ('en_revision','aprobada','enviada','recibida','lista_para_entrega','rechazada')),
  admin_notes text,
  charge_amount numeric(10,2),
  charge_notes text,
  code_1 text,  -- datos biela 1
  code_2 text,  -- datos biela 2
  photo_angle_1 text,
  photo_angle_2 text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Historial de cambios de estado
create table public.warranty_status_history (
  id bigint generated always as identity primary key,
  warranty_id uuid not null references public.warranties(id) on delete cascade,
  old_status text,
  new_status text not null,
  note text,
  email_sent boolean not null default false,
  created_at timestamptz not null default now()
);

-- Código de seguimiento legible: GC-XXXXXX
create or replace function public.generate_tracking_code()
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
    code := 'GC-';
    for i in 1..6 loop
      code := code || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.warranties w where w.tracking_code = code);
  end loop;
  new.tracking_code := code;
  return new;
end;
$$;

create trigger set_tracking_code
  before insert on public.warranties
  for each row execute function public.generate_tracking_code();

-- updated_at automático + historial de estados
create or replace function public.warranties_on_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    insert into public.warranty_status_history (warranty_id, old_status, new_status)
    values (new.id, old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger on_warranty_update
  before update on public.warranties
  for each row execute function public.warranties_on_update();

-- RLS
alter table public.warranties enable row level security;
alter table public.warranty_status_history enable row level security;

create policy "anon puede registrar garantia"
  on public.warranties for insert to anon with check (true);
create policy "equipo lee garantias"
  on public.warranties for select to authenticated using (true);
create policy "equipo actualiza garantias"
  on public.warranties for update to authenticated using (true);
create policy "equipo elimina garantias"
  on public.warranties for delete to authenticated using (true);
create policy "equipo lee historial"
  on public.warranty_status_history for select to authenticated using (true);

-- Consulta pública de estado SOLO por código (no expone datos personales)
create or replace function public.get_warranty_status(p_code text)
returns table (
  tracking_code text,
  brand text,
  model text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select w.tracking_code, w.brand, w.model, w.status, w.created_at, w.updated_at
  from public.warranties w
  where upper(trim(p_code)) = w.tracking_code;
$$;

grant execute on function public.get_warranty_status(text) to anon, authenticated;
