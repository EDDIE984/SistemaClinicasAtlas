-- ============================================
-- 082 · Maternidad: alertas de seguimiento por semanas de gestación y limpieza de pruebas
-- 1) fecha_semanas: fecha a la que corresponden las semanas registradas. Cuando cambian las
--    semanas (operario, edición o n8n) pasa a hoy, y las semanas actuales se calculan desde ahí.
-- 2) resultado_parto acepta 'perdida' (seguimiento cerrado: superó 40 semanas, no se pudo
--    contactar o no dará a luz en la clínica).
-- 3) vista_maternidad_solicitudes: semanas_actuales, fecha_probable_parto, en_seguimiento
--    (tour realizado o proforma enviada sin tour) y estado_seguimiento:
--      parto_clinica | perdida | sin_semanas | vencida (> 40) | llamar (37–40) | seguimiento (20–36) | temprana (< 20)
--    Las alertas rojas del perfil maternidad son 'llamar' y 'seguimiento'.
-- 4) fn_maternidad_cerrar_seguimientos_vencidos(): cierra como 'perdida' lo que supera 40 semanas.
--    Corre a diario con pg_cron (si está disponible) y también desde la app al cargar las alertas.
-- 5) Borra las solicitudes de prueba #1 a #6 (con sus cotizaciones, correos e historial) y
--    reinicia la numeración de cotizaciones (COT-MAT-AAAA-000001).
-- Sin RLS. Ejecutar ANTES de desplegar la web.
-- ============================================

-- ── 1. Fecha de las semanas registradas ─────────────────────────────────────
ALTER TABLE public.maternidad_solicitud ADD COLUMN IF NOT EXISTS fecha_semanas DATE;

UPDATE public.maternidad_solicitud
SET fecha_semanas = (created_at AT TIME ZONE 'America/Guayaquil')::DATE
WHERE fecha_semanas IS NULL;

CREATE OR REPLACE FUNCTION public.fn_maternidad_fecha_semanas()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_hoy DATE := (NOW() AT TIME ZONE 'America/Guayaquil')::DATE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.fecha_semanas IS NULL THEN
      NEW.fecha_semanas := COALESCE((NEW.created_at AT TIME ZONE 'America/Guayaquil')::DATE, v_hoy);
    END IF;
  ELSIF NEW.semanas_gestacion IS DISTINCT FROM OLD.semanas_gestacion
        AND NEW.fecha_semanas IS NOT DISTINCT FROM OLD.fecha_semanas THEN
    NEW.fecha_semanas := v_hoy;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maternidad_fecha_semanas ON public.maternidad_solicitud;
CREATE TRIGGER trg_maternidad_fecha_semanas
BEFORE INSERT OR UPDATE ON public.maternidad_solicitud
FOR EACH ROW EXECUTE FUNCTION public.fn_maternidad_fecha_semanas();

-- ── 2. Parto: pendiente / clínica / perdida ─────────────────────────────────
ALTER TABLE public.maternidad_solicitud DROP CONSTRAINT IF EXISTS maternidad_solicitud_resultado_parto_check;
ALTER TABLE public.maternidad_solicitud ADD CONSTRAINT maternidad_solicitud_resultado_parto_check
  CHECK (resultado_parto IN ('pendiente', 'clinica', 'perdida'));

CREATE OR REPLACE FUNCTION public.fn_maternidad_etiqueta_parto(p_resultado TEXT, p_tipo TEXT, p_fecha DATE)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_resultado
    WHEN 'pendiente'  THEN 'Pendiente'
    WHEN 'perdida'    THEN 'Seguimiento cerrado (perdida)'
    WHEN 'clinica'    THEN 'Dio a luz en la clínica' || COALESCE(' (' || NULLIF(CONCAT_WS(', ',
                             CASE p_tipo WHEN 'normal' THEN 'parto normal' WHEN 'cesarea' THEN 'cesárea' END,
                             TO_CHAR(p_fecha, 'DD/MM/YYYY')), '') || ')', '')
    ELSE p_resultado
  END
$$;

-- ── 3. Semanas actuales y estado de seguimiento ─────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_maternidad_semanas_actuales(p_semanas INTEGER, p_fecha DATE)
RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_semanas IS NOT NULL AND p_fecha IS NOT NULL
    THEN ROUND(p_semanas + ((NOW() AT TIME ZONE 'America/Guayaquil')::DATE - p_fecha) / 7.0, 1)
  END
$$;

-- Umbrales: alerta desde la semana 20, llamar desde la 37, cierre después de la 40
CREATE OR REPLACE FUNCTION public.fn_maternidad_estado_seguimiento(p_resultado TEXT, p_semanas INTEGER, p_fecha DATE)
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN p_resultado = 'clinica' THEN 'parto_clinica'
    WHEN p_resultado = 'perdida' THEN 'perdida'
    WHEN p_semanas IS NULL OR p_fecha IS NULL THEN 'sin_semanas'
    WHEN public.fn_maternidad_semanas_actuales(p_semanas, p_fecha) > 40 THEN 'vencida'
    WHEN public.fn_maternidad_semanas_actuales(p_semanas, p_fecha) >= 37 THEN 'llamar'
    WHEN public.fn_maternidad_semanas_actuales(p_semanas, p_fecha) >= 20 THEN 'seguimiento'
    ELSE 'temprana'
  END
$$;

CREATE OR REPLACE VIEW public.vista_maternidad_solicitudes AS
SELECT
  s.id_solicitud_mat,
  s.nombre_madre,
  s.cedula,
  s.semanas_gestacion,
  s.correo,
  s.telefono,
  s.medico_ginecologo,
  s.id_aseguradora_mat,
  a.nombre                                                         AS aseguradora,
  s.id_horario_mat,
  s.fecha_tour,
  TO_CHAR(s.fecha_tour, 'DD/MM/YYYY')                              AS fecha_tour_formato,
  CASE EXTRACT(ISODOW FROM s.fecha_tour)::INTEGER
    WHEN 1 THEN 'Lunes'
    WHEN 2 THEN 'Martes'
    WHEN 3 THEN 'Miércoles'
    WHEN 4 THEN 'Jueves'
    WHEN 5 THEN 'Viernes'
    WHEN 6 THEN 'Sábado'
    WHEN 7 THEN 'Domingo'
  END                                                              AS dia_nombre,
  s.hora_inicio,
  s.hora_fin,
  CASE WHEN s.hora_inicio IS NOT NULL
    THEN TO_CHAR(s.hora_inicio, 'HH24:MI') || ' - ' || TO_CHAR(s.hora_fin, 'HH24:MI')
  END                                                              AS horario,
  s.fecha_agendamiento_tour,
  s.estado,
  s.origen,
  s.remote_jid,
  s.notas,
  s.creado_por,
  s.created_at,
  s.updated_at,
  uc.estado                                                        AS ultimo_correo_estado,
  uc.created_at                                                    AS ultimo_correo_fecha,
  COALESCE(tc.total, 0)::INTEGER                                   AS correos_enviados,
  COALESCE(tc.errores, 0)::INTEGER                                 AS correos_error,
  ct.numero_cotizacion                                             AS ultima_cotizacion,
  ct.fecha_emision                                                 AS ultima_cotizacion_fecha,
  COALESCE(ct.total_cotizaciones, 0)::INTEGER                      AS cotizaciones_emitidas,
  -- 079: seguimiento del parto y último cambio
  s.resultado_parto,
  s.fecha_parto,
  s.tipo_parto,
  s.observacion_parto,
  s.motivo_estado,
  s.actualizado_por,
  -- 081: bitácora de tours
  s.numero_bitacora,
  s.asesor,
  s.hora_inicio_real,
  s.hora_fin_real,
  s.firma_paciente,
  s.seguro_texto,
  -- 082: seguimiento por semanas de gestación (se recalcula en cada consulta)
  s.fecha_semanas,
  public.fn_maternidad_semanas_actuales(s.semanas_gestacion, s.fecha_semanas)       AS semanas_actuales,
  CASE WHEN s.semanas_gestacion IS NOT NULL AND s.fecha_semanas IS NOT NULL
    THEN s.fecha_semanas + (40 - s.semanas_gestacion) * 7
  END                                                                               AS fecha_probable_parto,
  (s.estado = 'asistio' OR (s.estado = 'solo_cotizacion' AND COALESCE(tc.total, 0) > 0)) AS en_seguimiento,
  public.fn_maternidad_estado_seguimiento(s.resultado_parto, s.semanas_gestacion, s.fecha_semanas) AS estado_seguimiento
FROM public.maternidad_solicitud s
LEFT JOIN public.maternidad_aseguradora a ON a.id_aseguradora_mat = s.id_aseguradora_mat
LEFT JOIN LATERAL (
  SELECT e.estado, e.created_at
  FROM public.maternidad_envio_correo e
  WHERE e.id_solicitud_mat = s.id_solicitud_mat
  ORDER BY e.created_at DESC
  LIMIT 1
) uc ON TRUE
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE e.estado = 'enviado') AS total,
    COUNT(*) FILTER (WHERE e.estado = 'error')   AS errores
  FROM public.maternidad_envio_correo e
  WHERE e.id_solicitud_mat = s.id_solicitud_mat
) tc ON TRUE
LEFT JOIN LATERAL (
  SELECT c.numero_cotizacion, c.fecha_emision, COUNT(*) OVER () AS total_cotizaciones
  FROM public.maternidad_cotizacion c
  WHERE c.id_solicitud_mat = s.id_solicitud_mat
  ORDER BY c.fecha_emision DESC
  LIMIT 1
) ct ON TRUE;

-- ── 4. Cierre automático de seguimientos vencidos ───────────────────────────
CREATE OR REPLACE FUNCTION public.fn_maternidad_cerrar_seguimientos_vencidos()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_cerradas INTEGER;
BEGIN
  UPDATE public.maternidad_solicitud s SET
    resultado_parto   = 'perdida',
    observacion_parto = 'Cierre automático: superó 40 semanas sin parto registrado',
    actualizado_por   = 'Sistema (seguimiento automático)',
    updated_at        = NOW()
  WHERE s.resultado_parto = 'pendiente'
    AND public.fn_maternidad_semanas_actuales(s.semanas_gestacion, s.fecha_semanas) > 40
    AND (
      s.estado = 'asistio'
      OR (s.estado = 'solo_cotizacion' AND EXISTS (
        SELECT 1 FROM public.maternidad_envio_correo e
        WHERE e.id_solicitud_mat = s.id_solicitud_mat AND e.estado = 'enviado'
      ))
    );
  GET DIAGNOSTICS v_cerradas = ROW_COUNT;
  RETURN v_cerradas;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_maternidad_cerrar_seguimientos_vencidos TO anon, authenticated, service_role;

-- Diario a las 01:00 de Ecuador (06:00 UTC). Si pg_cron no está disponible, lo hace la app.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'maternidad-cerrar-seguimientos';
  PERFORM cron.schedule('maternidad-cerrar-seguimientos', '0 6 * * *',
                        'SELECT public.fn_maternidad_cerrar_seguimientos_vencidos()');
  RAISE NOTICE 'pg_cron: cierre diario de seguimientos programado';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron no disponible (%): el cierre lo hace la app al cargar las alertas', SQLERRM;
END;
$$;

-- ── 5. Limpieza de las solicitudes de prueba ────────────────────────────────
-- Ids explícitos: no toca registros reales que hayan entrado después ni la bitácora
DELETE FROM public.maternidad_solicitud
WHERE id_solicitud_mat IN (1, 2, 3, 4, 5, 6) AND origen <> 'BITACORA';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.maternidad_cotizacion) THEN
    EXECUTE format('ALTER SEQUENCE %s RESTART WITH 1',
                   pg_get_serial_sequence('public.maternidad_cotizacion', 'id_cotizacion_mat'));
    RAISE NOTICE 'Numeración de cotizaciones reiniciada: la próxima es COT-MAT-%-000001',
                 TO_CHAR(NOW() AT TIME ZONE 'America/Guayaquil', 'YYYY');
  ELSE
    RAISE NOTICE 'Quedan cotizaciones registradas: la numeración NO se reinició';
  END IF;
END;
$$;

-- ── 6. Primer cierre de vencidos ────────────────────────────────────────────
SELECT public.fn_maternidad_cerrar_seguimientos_vencidos() AS seguimientos_cerrados;

NOTIFY pgrst, 'reload schema';

-- Verificación:
--   SELECT estado_seguimiento, COUNT(*) FROM vista_maternidad_solicitudes
--   WHERE en_seguimiento GROUP BY 1 ORDER BY 1;
