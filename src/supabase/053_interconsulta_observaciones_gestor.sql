-- Migración 053: Agregar campo observaciones_gestor a la tabla interconsulta
ALTER TABLE public.interconsulta
  ADD COLUMN IF NOT EXISTS observaciones_gestor TEXT;
