-- Las funciones de trigger no deben ser invocables vía API
revoke execute on function public.generate_tracking_code() from anon, authenticated, public;
revoke execute on function public.warranties_on_update() from anon, authenticated, public;
