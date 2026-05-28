-- ============================================
-- 063: Fechas por cambio de estado en cita_servicio
-- Permite conocer cuándo una cita de servicio pasó por cada estado operativo.
-- ============================================

ALTER TABLE public.cita_servicio
  ADD COLUMN IF NOT EXISTS fecha_confirmada TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS fecha_inicio_atencion TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS fecha_atendida TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS fecha_cancelada TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS fecha_no_asistio TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.cita_servicio.fecha_confirmada
  IS 'Fecha y hora en que la cita de servicio pasó a estado confirmada.';

COMMENT ON COLUMN public.cita_servicio.fecha_inicio_atencion
  IS 'Fecha y hora en que la cita de servicio pasó a estado en_atencion.';

COMMENT ON COLUMN public.cita_servicio.fecha_atendida
  IS 'Fecha y hora en que la cita de servicio pasó a estado atendida.';

COMMENT ON COLUMN public.cita_servicio.fecha_cancelada
  IS 'Fecha y hora en que la cita de servicio pasó a estado cancelada.';

COMMENT ON COLUMN public.cita_servicio.fecha_no_asistio
  IS 'Fecha y hora en que la cita de servicio pasó a estado no_asistio.';
