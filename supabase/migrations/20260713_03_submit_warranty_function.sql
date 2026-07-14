-- Registro público: inserta y devuelve el código de seguimiento
create or replace function public.submit_warranty(
  p_full_name text,
  p_phone text,
  p_phone_alt text,
  p_email text,
  p_brand text,
  p_model text,
  p_purchase_date date,
  p_defect_notes text,
  p_customer_photo_url text
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
  insert into public.warranties
    (full_name, phone, phone_alt, email, brand, model, purchase_date, defect_notes, customer_photo_url)
  values
    (trim(p_full_name), trim(p_phone), nullif(trim(p_phone_alt),''), lower(trim(p_email)),
     p_brand, trim(p_model), p_purchase_date, p_defect_notes, p_customer_photo_url)
  returning tracking_code into v_code;
  return v_code;
end;
$$;

grant execute on function public.submit_warranty(text,text,text,text,text,text,date,text,text) to anon, authenticated;
