-- ============================================
-- 062: Datos de confirmación en cita_servicio
-- Agrega los campos necesarios para el flujo de confirmación:
-- médico solicitante, número de registro y fotografía del pedido.
-- La foto se guarda como base64 en columna TEXT separada
-- y NO se incluye en el SELECT general (se obtiene on-demand).
-- ============================================

ALTER TABLE public.cita_servicio
  ADD COLUMN IF NOT EXISTS medico_solicitante      VARCHAR(200),
  ADD COLUMN IF NOT EXISTS numero_registro_medico  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS foto_pedido_base64       TEXT;

ALTER TABLE public.cita_servicio DISABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN public.cita_servicio.medico_solicitante     IS 'Nombre del médico que solicita el servicio de imagen';
COMMENT ON COLUMN public.cita_servicio.numero_registro_medico IS 'Número de registro / colegio médico del solicitante';
COMMENT ON COLUMN public.cita_servicio.foto_pedido_base64     IS 'Fotografía del pedido médico en base64 (data:image/...). Se obtiene on-demand, no en el SELECT general.';
