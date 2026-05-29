-- ============================================
-- 064: Seguro medico en confirmacion de cita_servicio
-- Agrega un campo de texto para registrar si el paciente tiene seguro medico
-- durante la confirmacion de citas de servicios de imagen.
-- ============================================

ALTER TABLE public.cita_servicio
  ADD COLUMN IF NOT EXISTS tiene_seguro_medico TEXT;

COMMENT ON COLUMN public.cita_servicio.tiene_seguro_medico
  IS 'Texto ingresado por el usuario durante la confirmacion: indica si el paciente tiene seguro medico.';
