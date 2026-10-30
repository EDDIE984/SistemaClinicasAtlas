-- ============================================
-- 073: Maternidad — un solo tour por turno
-- Cada turno (día + hora) admite una sola reserva. fn_maternidad_registrar ya valida
-- el cupo con bloqueo (FOR UPDATE), así que con cupo = 1 un segundo agendamiento
-- en el mismo turno devuelve SIN_CUPO y el turno deja de aparecer en
-- vista_maternidad_horarios_disponibles (disponibles = 0).
-- El cupo sigue siendo editable por turno desde la pantalla Horarios Maternidad.
-- ============================================

ALTER TABLE public.maternidad_horario
  ALTER COLUMN cupo SET DEFAULT 1;

UPDATE public.maternidad_horario
SET cupo = 1,
    updated_at = NOW()
WHERE cupo <> 1;

NOTIFY pgrst, 'reload schema';
