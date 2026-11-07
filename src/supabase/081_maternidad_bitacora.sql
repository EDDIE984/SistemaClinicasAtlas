-- ============================================
-- 081 · Maternidad: bitácora de tours
-- La bitácora es el conjunto de solicitudes con tour realizado (estado 'asistio'): una sola
-- fuente para el histórico del Excel "BITACORA TOUR MATERNIDAD SEGUIMIENTO" y los tours nuevos
-- (WhatsApp o plataforma), que entran al marcarse "Asistió".
-- 1) maternidad_solicitud: origen 'BITACORA' (histórico del Excel), cédula/correo/teléfono opcionales
--    (el Excel no los tiene; la RPC los sigue exigiendo para registros nuevos), tour sin turno para
--    el histórico y columnas del tour realizado: asesor, hora_inicio_real, hora_fin_real,
--    firma_paciente, seguro_texto (seguro del Excel sin coincidencia en el catálogo) y numero_bitacora.
-- 2) numero_bitacora correlativo: se asigna al pasar a 'asistio' (continúa después del Excel, #474…).
-- 3) Historial: registro del histórico y datos del tour realizado.
-- 4) vista_maternidad_solicitudes con las columnas nuevas al final.
-- La carga del Excel la hace scripts/importar-bitacora-maternidad.mjs (después de esta migración).
-- Sin RLS. Ejecutar ANTES de desplegar la web.
-- ============================================

-- ── 1. Columnas y restricciones ─────────────────────────────────────────────
ALTER TABLE public.maternidad_solicitud
  ADD COLUMN IF NOT EXISTS numero_bitacora  INTEGER,
  ADD COLUMN IF NOT EXISTS asesor           VARCHAR(100),
  ADD COLUMN IF NOT EXISTS hora_inicio_real TIME,
  ADD COLUMN IF NOT EXISTS hora_fin_real    TIME,
  ADD COLUMN IF NOT EXISTS firma_paciente   BOOLEAN,
  ADD COLUMN IF NOT EXISTS seguro_texto     VARCHAR(100);

CREATE UNIQUE INDEX IF NOT EXISTS uq_maternidad_solicitud_numero_bitacora
  ON public.maternidad_solicitud (numero_bitacora) WHERE numero_bitacora IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_maternidad_solicitud_estado_fecha ON public.maternidad_solicitud (estado, fecha_tour);

ALTER TABLE public.maternidad_solicitud ALTER COLUMN cedula   DROP NOT NULL;
ALTER TABLE public.maternidad_solicitud ALTER COLUMN correo   DROP NOT NULL;
ALTER TABLE public.maternidad_solicitud ALTER COLUMN telefono DROP NOT NULL;

ALTER TABLE public.maternidad_solicitud DROP CONSTRAINT IF EXISTS maternidad_solicitud_origen_check;
ALTER TABLE public.maternidad_solicitud ADD CONSTRAINT maternidad_solicitud_origen_check
  CHECK (origen IN ('CHATBOT', 'SISTEMA', 'BITACORA'));

-- El histórico no tiene turno asignado: le basta la fecha del tour
ALTER TABLE public.maternidad_solicitud DROP CONSTRAINT IF EXISTS maternidad_solicitud_tour_check;
ALTER TABLE public.maternidad_solicitud ADD CONSTRAINT maternidad_solicitud_tour_check CHECK (
  estado IN ('solo_cotizacion', 'cancelada')
  OR (fecha_tour IS NOT NULL AND (origen = 'BITACORA' OR (id_horario_mat IS NOT NULL AND hora_inicio IS NOT NULL)))
);

-- ── 2. Número de bitácora ───────────────────────────────────────────────────
-- Último número del Excel: los tours nuevos continúan desde aquí aunque el histórico aún no se haya cargado
CREATE OR REPLACE FUNCTION public.fn_maternidad_numero_bitacora()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = 'asistio' AND NEW.numero_bitacora IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('maternidad_numero_bitacora'));
    SELECT GREATEST(COALESCE(MAX(numero_bitacora), 0), 473) + 1
      INTO NEW.numero_bitacora
    FROM public.maternidad_solicitud;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maternidad_numero_bitacora ON public.maternidad_solicitud;
CREATE TRIGGER trg_maternidad_numero_bitacora
BEFORE INSERT OR UPDATE ON public.maternidad_solicitud
FOR EACH ROW EXECUTE FUNCTION public.fn_maternidad_numero_bitacora();

-- ── 3. Historial ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_maternidad_etiqueta_tour_realizado(
  p_fecha DATE, p_asesor TEXT, p_inicio TIME, p_fin TIME, p_firma BOOLEAN
)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT 'Tour realizado'
    || COALESCE(' el ' || TO_CHAR(p_fecha, 'DD/MM/YYYY'), '')
    || COALESCE(' ' || TO_CHAR(p_inicio, 'HH24:MI') || COALESCE('–' || TO_CHAR(p_fin, 'HH24:MI'), ''), '')
    || COALESCE(' · asesor ' || NULLIF(TRIM(p_asesor), ''), '')
    || CASE WHEN p_firma IS TRUE THEN ' · firmó' WHEN p_firma IS FALSE THEN ' · no firmó' ELSE '' END
$$;

CREATE OR REPLACE FUNCTION public.fn_maternidad_historial_solicitud()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_usuario  TEXT;
  v_cambios  TEXT[] := ARRAY[]::TEXT[];
  v_texto    TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- 081: tours cargados desde la bitácora histórica (Excel)
    IF NEW.origen = 'BITACORA' THEN
      INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario, created_at)
      VALUES (NEW.id_solicitud_mat, 'registro',
              'Tour registrado en la bitácora histórica (Excel #' || COALESCE(NEW.numero_bitacora::TEXT, '—') || ')',
              NEW.creado_por, NEW.created_at);
      INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario, created_at)
      VALUES (NEW.id_solicitud_mat, 'tour',
              public.fn_maternidad_etiqueta_tour_realizado(NEW.fecha_tour, NEW.asesor, NEW.hora_inicio_real, NEW.hora_fin_real, NEW.firma_paciente),
              NEW.creado_por, NEW.created_at);
      RETURN NEW;
    END IF;

    INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario, created_at)
    VALUES (NEW.id_solicitud_mat, 'registro',
            'Solicitud registrada desde ' || CASE WHEN NEW.origen = 'CHATBOT' THEN 'WhatsApp' ELSE 'el sistema' END,
            NEW.creado_por, NEW.created_at);
    IF NEW.fecha_tour IS NOT NULL THEN
      INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario, created_at)
      VALUES (NEW.id_solicitud_mat, 'tour',
              'Tour agendado para el ' || public.fn_maternidad_etiqueta_tour(NEW.fecha_tour, NEW.hora_inicio),
              NEW.creado_por, NEW.created_at);
    END IF;
    RETURN NEW;
  END IF;

  v_usuario := NEW.actualizado_por;

  -- Tour agendado / reagendado
  IF NEW.fecha_tour IS NOT NULL
     AND (NEW.fecha_tour IS DISTINCT FROM OLD.fecha_tour OR NEW.hora_inicio IS DISTINCT FROM OLD.hora_inicio) THEN
    INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario)
    VALUES (NEW.id_solicitud_mat, 'tour',
            CASE WHEN OLD.fecha_tour IS NULL
              THEN 'Tour agendado para el ' || public.fn_maternidad_etiqueta_tour(NEW.fecha_tour, NEW.hora_inicio)
              ELSE 'Tour reagendado: ' || public.fn_maternidad_etiqueta_tour(OLD.fecha_tour, OLD.hora_inicio)
                   || ' → ' || public.fn_maternidad_etiqueta_tour(NEW.fecha_tour, NEW.hora_inicio)
            END,
            v_usuario);
  END IF;

  -- Estado (con motivo si se indicó)
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario)
    VALUES (NEW.id_solicitud_mat, 'estado',
            'Estado: ' || public.fn_maternidad_etiqueta_estado(OLD.estado) || ' → ' || public.fn_maternidad_etiqueta_estado(NEW.estado)
            || COALESCE('. Motivo: ' || NULLIF(TRIM(NEW.motivo_estado), ''), ''),
            v_usuario);
  END IF;

  -- 081: datos del tour realizado (asesor, horas reales, firma)
  IF NEW.asesor IS DISTINCT FROM OLD.asesor
     OR NEW.hora_inicio_real IS DISTINCT FROM OLD.hora_inicio_real
     OR NEW.hora_fin_real IS DISTINCT FROM OLD.hora_fin_real
     OR NEW.firma_paciente IS DISTINCT FROM OLD.firma_paciente THEN
    INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario)
    VALUES (NEW.id_solicitud_mat, 'tour',
            public.fn_maternidad_etiqueta_tour_realizado(NEW.fecha_tour, NEW.asesor, NEW.hora_inicio_real, NEW.hora_fin_real, NEW.firma_paciente)
            || COALESCE(' · bitácora #' || NEW.numero_bitacora, ''),
            v_usuario);
  END IF;

  -- Parto
  IF NEW.resultado_parto IS DISTINCT FROM OLD.resultado_parto
     OR NEW.fecha_parto IS DISTINCT FROM OLD.fecha_parto
     OR NEW.tipo_parto IS DISTINCT FROM OLD.tipo_parto
     OR NEW.observacion_parto IS DISTINCT FROM OLD.observacion_parto THEN
    INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario)
    VALUES (NEW.id_solicitud_mat, 'parto',
            'Parto: ' || public.fn_maternidad_etiqueta_parto(NEW.resultado_parto, NEW.tipo_parto, NEW.fecha_parto)
            || COALESCE('. Observación: ' || NULLIF(TRIM(NEW.observacion_parto), ''), ''),
            v_usuario);
  END IF;

  -- Datos de la mamá
  IF NEW.nombre_madre IS DISTINCT FROM OLD.nombre_madre THEN
    v_cambios := v_cambios || ('nombre: ' || OLD.nombre_madre || ' → ' || NEW.nombre_madre);
  END IF;
  IF NEW.cedula IS DISTINCT FROM OLD.cedula THEN
    v_cambios := v_cambios || ('cédula: ' || OLD.cedula || ' → ' || NEW.cedula);
  END IF;
  IF NEW.correo IS DISTINCT FROM OLD.correo THEN
    v_cambios := v_cambios || ('correo: ' || OLD.correo || ' → ' || NEW.correo);
  END IF;
  IF NEW.semanas_gestacion IS DISTINCT FROM OLD.semanas_gestacion THEN
    v_cambios := v_cambios || ('semanas: ' || COALESCE(OLD.semanas_gestacion::TEXT, '—') || ' → ' || COALESCE(NEW.semanas_gestacion::TEXT, '—'));
  END IF;
  IF NEW.medico_ginecologo IS DISTINCT FROM OLD.medico_ginecologo THEN
    v_cambios := v_cambios || ('médico: ' || COALESCE(OLD.medico_ginecologo, '—') || ' → ' || COALESCE(NEW.medico_ginecologo, '—'));
  END IF;
  IF NEW.id_aseguradora_mat IS DISTINCT FROM OLD.id_aseguradora_mat THEN
    SELECT 'aseguradora: '
           || COALESCE((SELECT nombre FROM public.maternidad_aseguradora WHERE id_aseguradora_mat = OLD.id_aseguradora_mat), '—')
           || ' → '
           || COALESCE((SELECT nombre FROM public.maternidad_aseguradora WHERE id_aseguradora_mat = NEW.id_aseguradora_mat), '—')
      INTO v_texto;
    v_cambios := v_cambios || v_texto;
  END IF;
  IF NEW.notas IS DISTINCT FROM OLD.notas THEN
    v_cambios := v_cambios || 'observaciones'::TEXT;
  END IF;

  IF array_length(v_cambios, 1) > 0 THEN
    INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario)
    VALUES (NEW.id_solicitud_mat, 'datos', 'Datos actualizados: ' || array_to_string(v_cambios, '; '), v_usuario);
  END IF;

  RETURN NEW;
END;
$$;

-- ── 4. Vista de solicitudes (079 + columnas de la bitácora al final) ───────
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
  s.seguro_texto
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

-- Tours del sistema que ya estaban en 'asistio' reciben su número de bitácora
UPDATE public.maternidad_solicitud SET estado = estado
WHERE estado = 'asistio' AND numero_bitacora IS NULL;

NOTIFY pgrst, 'reload schema';

-- Verificación (después de scripts/importar-bitacora-maternidad.mjs):
--   SELECT origen, COUNT(*), MIN(numero_bitacora), MAX(numero_bitacora)
--   FROM maternidad_solicitud WHERE estado = 'asistio' GROUP BY origen;
