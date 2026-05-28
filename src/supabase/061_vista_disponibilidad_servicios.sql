-- ============================================
-- 061: Vista de disponibilidad de servicios
-- Muestra los slots disponibles (cupos > 0) para los próximos 14 días.
-- Pensada para consultas de chatbot y reportes de disponibilidad.
-- No tiene RLS — acceso mediante supabaseAdmin igual que el resto del proyecto.
-- ============================================

CREATE OR REPLACE VIEW public.vista_disponibilidad_servicios AS
WITH

-- ── 1. Próximos 14 días con día de semana normalizado (1=Lun, 7=Dom) ──────
fechas AS (
  SELECT
    (CURRENT_DATE + i)::DATE AS fecha,
    CASE EXTRACT(DOW FROM CURRENT_DATE + i)
      WHEN 0 THEN 7
      ELSE EXTRACT(DOW FROM CURRENT_DATE + i)
    END::INTEGER AS dia_semana_num
  FROM generate_series(0, 13) AS i
),

-- ── 2. Slots generados dinámicamente para cada horario activo ─────────────
--    Divide cada bloque horario en franjas de `duracion_consulta` minutos.
slots AS (
  SELECT
    f.fecha,
    f.dia_semana_num,
    h.id_horario_servicio,
    h.id_servicio,
    h.capacidad,
    h.duracion_consulta,
    (h.hora_inicio + (n * (h.duracion_consulta * INTERVAL '1 minute')))        AS slot_inicio,
    (h.hora_inicio + ((n + 1) * (h.duracion_consulta * INTERVAL '1 minute'))) AS slot_fin
  FROM fechas f
  JOIN public.horario_servicio h
    ON  h.dia_semana = f.dia_semana_num
    AND h.estado     = 'activo'
  CROSS JOIN LATERAL generate_series(
    0,
    FLOOR(
      EXTRACT(EPOCH FROM (h.hora_fin - h.hora_inicio)) / (h.duracion_consulta * 60)
    )::INT - 1
  ) AS n
  -- Guardia: el slot no debe sobrepasar hora_fin
  WHERE (h.hora_inicio + ((n + 1) * (h.duracion_consulta * INTERVAL '1 minute'))) <= h.hora_fin
)

-- ── 3. Vista final: cupos calculados por slot ─────────────────────────────
SELECT
  -- Identificadores
  s.id_horario_servicio,
  s.id_servicio,
  su.id_sucursal,

  -- Fecha y día
  s.fecha,
  TO_CHAR(s.fecha, 'DD/MM/YYYY')                       AS fecha_formato,
  CASE s.dia_semana_num
    WHEN 1 THEN 'Lunes'
    WHEN 2 THEN 'Martes'
    WHEN 3 THEN 'Miércoles'
    WHEN 4 THEN 'Jueves'
    WHEN 5 THEN 'Viernes'
    WHEN 6 THEN 'Sábado'
    WHEN 7 THEN 'Domingo'
  END                                                  AS dia_semana,

  -- Lugar y servicio
  su.nombre                                            AS sucursal,
  sv.descripcion                                       AS servicio,
  sv.area                                              AS area_servicio,

  -- Horario del slot
  s.slot_inicio::TIME                                  AS hora_inicio,
  s.slot_fin::TIME                                     AS hora_fin,
  TO_CHAR(s.slot_inicio::TIME, 'HH24:MI')
    || ' – '
    || TO_CHAR(s.slot_fin::TIME,   'HH24:MI')          AS horario,
  s.duracion_consulta                                  AS duracion_minutos,

  -- Capacidad y ocupación
  s.capacidad,
  COUNT(cs.id_cita_servicio) FILTER (
    WHERE cs.hora_inicio < s.slot_fin::TIME
      AND cs.hora_fin    > s.slot_inicio::TIME
  )::INTEGER                                           AS citas_ocupadas,
  (s.capacidad - COUNT(cs.id_cita_servicio) FILTER (
    WHERE cs.hora_inicio < s.slot_fin::TIME
      AND cs.hora_fin    > s.slot_inicio::TIME
  ))::INTEGER                                          AS cupos_disponibles

FROM slots s

JOIN public.servicio sv
  ON  sv.id_servicio  = s.id_servicio
  AND sv.estado       = 'activo'
  AND UPPER(sv.descripcion) <> 'CONSULTA EXTERNA'

JOIN public.sucursal su
  ON  su.id_sucursal  = sv.id_sucursal

LEFT JOIN public.cita_servicio cs
  ON  cs.id_servicio  = s.id_servicio
  AND cs.fecha_cita   = s.fecha
  AND cs.estado_cita NOT IN ('cancelada', 'no_asistio')

GROUP BY
  s.fecha,
  s.dia_semana_num,
  s.id_horario_servicio,
  s.id_servicio,
  su.id_sucursal,
  su.nombre,
  sv.descripcion,
  sv.area,
  s.slot_inicio,
  s.slot_fin,
  s.duracion_consulta,
  s.capacidad

-- Solo mostrar slots con al menos 1 cupo disponible
HAVING
  (s.capacidad - COUNT(cs.id_cita_servicio) FILTER (
    WHERE cs.hora_inicio < s.slot_fin::TIME
      AND cs.hora_fin    > s.slot_inicio::TIME
  )) > 0

ORDER BY s.fecha, sv.descripcion, s.slot_inicio;

-- ── Comentarios ───────────────────────────────────────────────────────────
COMMENT ON VIEW public.vista_disponibilidad_servicios IS
  'Slots disponibles (cupos > 0) para los próximos 14 días. '
  'Excluye canceladas, no_asistio y CONSULTA EXTERNA. '
  'Uso principal: chatbot de disponibilidad de servicios.';


-- ── Consultas de ejemplo para el chatbot ─────────────────────────────────
--
-- Todos los slots disponibles hoy:
--   SELECT * FROM vista_disponibilidad_servicios WHERE fecha = CURRENT_DATE;
--
-- Disponibilidad de Tomografía esta semana:
--   SELECT fecha, dia_semana, sucursal, horario, cupos_disponibles
--   FROM vista_disponibilidad_servicios
--   WHERE UPPER(servicio) LIKE '%TOMOGRAF%'
--     AND fecha BETWEEN CURRENT_DATE AND CURRENT_DATE + 6;
--
-- Próximos slots disponibles por servicio (resumen):
--   SELECT servicio, sucursal, fecha, dia_semana, horario, cupos_disponibles
--   FROM vista_disponibilidad_servicios
--   ORDER BY servicio, fecha, hora_inicio;
--
-- Cupos disponibles agrupados por servicio y fecha:
--   SELECT servicio, sucursal, fecha, dia_semana,
--          SUM(cupos_disponibles) AS total_cupos_dia
--   FROM vista_disponibilidad_servicios
--   GROUP BY servicio, sucursal, fecha, dia_semana
--   ORDER BY fecha, servicio;
