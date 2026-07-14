-- Soporte para múltiples fotos (cliente y admin)
alter table public.warranties
  add column customer_photos jsonb not null default '[]'::jsonb,
  add column admin_photos jsonb not null default '[]'::jsonb;

update public.warranties set customer_photos = jsonb_build_array(customer_photo_url)
  where customer_photo_url is not null;
update public.warranties set admin_photos = (
    select jsonb_agg(x) from unnest(array[photo_angle_1, photo_angle_2]) as x where x is not null
  ) where photo_angle_1 is not null or photo_angle_2 is not null;

drop function public.submit_warranty(text,text,text,text,text,text,date,text,text);

create or replace function public.submit_warranty(
  p_full_name text,
  p_phone text,
  p_phone_alt text,
  p_email text,
  p_brand text,
  p_model text,
  p_purchase_date date,
  p_defect_notes text,
  p_photos jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if coalesce(trim(p_full_name),'') = '' or coalesce(trim(p_phone),'') = ''
     or coalesce(trim(p_email),'') = '' or coalesce(trim(p_model),'') = '' then
    raise exception 'Faltan campos obligatorios';
  end if;
  if jsonb_typeof(coalesce(p_photos,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_photos,'[]'::jsonb)) > 6 then
    raise exception 'Fotos inválidas (máximo 6)';
  end if;
  insert into public.warranties
    (full_name, phone, phone_alt, email, brand, model, purchase_date, defect_notes, customer_photos, customer_photo_url)
  values
    (trim(p_full_name), trim(p_phone), nullif(trim(p_phone_alt),''), lower(trim(p_email)),
     p_brand, trim(p_model), p_purchase_date, p_defect_notes, coalesce(p_photos,'[]'::jsonb), p_photos->>0)
  returning tracking_code into v_code;
  return v_code;
end;
$$;

grant execute on function public.submit_warranty(text,text,text,text,text,text,date,text,jsonb) to anon, authenticated;
