-- Migración 054: Agregar columna id_interconsulta a tabla cita para vincular citas originadas por interconsultas
ALTER TABLE public.cita
  ADD COLUMN IF NOT EXISTS id_interconsulta INT
  REFERENCES public.interconsulta(id_interconsulta) ON DELETE SET NULL;
