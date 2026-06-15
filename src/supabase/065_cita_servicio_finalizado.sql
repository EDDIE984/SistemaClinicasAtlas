-- ============================================
-- 065: Estado 'finalizado' y almacenamiento de PDF en cita_servicio
-- Agrega el estado 'finalizado' para cuando el resultado del servicio
-- ha sido entregado en PDF, y las columnas para almacenar la referencia
-- al archivo en Supabase Storage.
-- ============================================

-- Ampliar CHECK constraint para incluir 'finalizado'
ALTER TABLE public.cita_servicio
  DROP CONSTRAINT IF EXISTS cita_servicio_estado_cita_check;

ALTER TABLE public.cita_servicio
  ADD CONSTRAINT cita_servicio_estado_cita_check
  CHECK (estado_cita IN ('agendada','confirmada','en_atencion','atendida','cancelada','no_asistio','finalizado'));

-- Columna para la ruta del PDF en Supabase Storage (bucket: resultados-servicios)
ALTER TABLE public.cita_servicio
  ADD COLUMN IF NOT EXISTS url_pdf_resultado TEXT;

-- Columna para registrar cuándo se finalizó la cita con el PDF
ALTER TABLE public.cita_servicio
  ADD COLUMN IF NOT EXISTS fecha_finalizada TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.cita_servicio.url_pdf_resultado
  IS 'Ruta del PDF de resultado en Supabase Storage (bucket: resultados-servicios). Formato: {id_compania}/{id_cita_servicio}/{timestamp}-resultado.pdf';

COMMENT ON COLUMN public.cita_servicio.fecha_finalizada
  IS 'Fecha y hora en que la cita pasó a estado finalizado al subir el PDF de resultado.';

-- ============================================
-- ACCIÓN MANUAL REQUERIDA EN SUPABASE DASHBOARD:
-- 1. Ir a Storage → Create bucket
-- 2. Nombre: resultados-servicios
-- 3. Tipo: Private (no marcar Public)
-- ============================================
