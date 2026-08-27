-- El código de RMA real y la guía de envío los asigna el fabricante después,
-- así que arrancamos con un placeholder editable en vez de un código aleatorio único.

drop trigger if exists set_rma_code on public.rma_requests;
drop function if exists public.generate_rma_code();
alter table public.rma_requests drop constraint rma_requests_rma_code_key;
alter table public.rma_requests alter column rma_code set default 'RMA-TEMP';

-- El generador ahora crea el RMA con código 'RMA-TEMP' y devuelve su id
-- (el código deja de ser único, así que el id es la referencia confiable)
drop function if exists public.generate_rma(uuid[]);

create function public.generate_rma(p_warranty_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rma_id uuid;
  v_count int;
begin
  if (auth.jwt() ->> 'email') is distinct from 'garantias@athletetrainlab.com' then
    raise exception 'No autorizado';
  end if;
  if p_warranty_ids is null or array_length(p_warranty_ids, 1) is null then
    raise exception 'Selecciona al menos una garantía';
  end if;

  insert into public.rma_requests (rma_code, date_out) values ('RMA-TEMP', current_date)
  returning id into v_rma_id;

  update public.warranties
    set status = 'enviada', rma_id = v_rma_id
    where id = any(p_warranty_ids);
  get diagnostics v_count = row_count;

  if v_count = 0 then
    delete from public.rma_requests where id = v_rma_id;
    raise exception 'No se encontraron garantías válidas para el RMA';
  end if;

  return v_rma_id;
end;
$$;

grant execute on function public.generate_rma(uuid[]) to authenticated;
revoke execute on function public.generate_rma(uuid[]) from anon, public;
