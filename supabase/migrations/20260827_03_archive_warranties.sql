-- Permite archivar (ocultar sin borrar) una garantía. null = activa.
alter table public.warranties add column archived_at timestamptz;
