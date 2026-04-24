-- ============================================
-- RECETA MEDICA: CAMPOS SEPARADOS
-- Agrega columnas separadas para RP e Indicaciones en consulta_medica
-- ============================================

BEGIN;

ALTER TABLE IF EXISTS public.consulta_medica DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.consulta_medica
  ADD COLUMN IF NOT EXISTS receta_rp TEXT,
  ADD COLUMN IF NOT EXISTS receta_indicaciones TEXT;

COMMENT ON COLUMN public.consulta_medica.receta_rp IS 'Contenido de la receta en formato RP';
COMMENT ON COLUMN public.consulta_medica.receta_indicaciones IS 'Indicaciones médicas para el paciente';

COMMIT;
