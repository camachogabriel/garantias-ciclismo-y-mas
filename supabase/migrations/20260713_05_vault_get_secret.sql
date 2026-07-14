-- Lectura de secretos del Vault, solo para service_role (edge functions)
create or replace function public.get_secret(p_name text)
returns text
language sql
security definer
set search_path = vault, public
stable
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$$;

revoke execute on function public.get_secret(text) from public, anon, authenticated;
grant execute on function public.get_secret(text) to service_role;
