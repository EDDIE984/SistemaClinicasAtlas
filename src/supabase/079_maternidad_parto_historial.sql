-- ============================================
-- 079 · Maternidad: resultado del parto, motivo de estado e historial de la paciente
-- 1) maternidad_solicitud: resultado_parto (pendiente / clinica / otro_lugar), fecha_parto,
--    tipo_parto (normal / cesarea), observacion_parto, motivo_estado y actualizado_por.
--    El parto es independiente del estado del tour (una mamá puede haber asistido al tour y
--    dar a luz en la clínica, o solo haber recibido la proforma).
-- 2) maternidad_historial: línea de tiempo de cada solicitud. La llenan triggers sobre
--    maternidad_solicitud, maternidad_cotizacion y maternidad_envio_correo, así también queda
--    lo que llega por WhatsApp (n8n). El usuario sale de actualizado_por / creado_por /
--    generado_por / enviado_por: toda escritura a maternidad_solicitud debe llenar actualizado_por.
-- 3) fn_maternidad_registrar (misma de 077) guarda actualizado_por.
-- 4) vista_maternidad_solicitudes con las columnas nuevas al final.
-- 5) Carga inicial del historial de las solicitudes existentes.
-- Sin RLS (autenticación propia). Ejecutar ANTES de desplegar la web.
-- ============================================

-- ── 1. Columnas nuevas ──────────────────────────────────────────────────────
ALTER TABLE public.maternidad_solicitud
  ADD COLUMN IF NOT EXISTS resultado_parto   VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS fecha_parto       DATE,
  ADD COLUMN IF NOT EXISTS tipo_parto        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS observacion_parto TEXT,
  ADD COLUMN IF NOT EXISTS motivo_estado     TEXT,
  ADD COLUMN IF NOT EXISTS actualizado_por   VARCHAR(200);

ALTER TABLE public.maternidad_solicitud DROP CONSTRAINT IF EXISTS maternidad_solicitud_resultado_parto_check;
ALTER TABLE public.maternidad_solicitud ADD CONSTRAINT maternidad_solicitud_resultado_parto_check
  CHECK (resultado_parto IN ('pendiente', 'clinica', 'otro_lugar'));
ALTER TABLE public.maternidad_solicitud DROP CONSTRAINT IF EXISTS maternidad_solicitud_tipo_parto_check;
ALTER TABLE public.maternidad_solicitud ADD CONSTRAINT maternidad_solicitud_tipo_parto_check
  CHECK (tipo_parto IS NULL OR tipo_parto IN ('normal', 'cesarea'));

CREATE INDEX IF NOT EXISTS idx_maternidad_solicitud_parto ON public.maternidad_solicitud (resultado_parto);

-- ── 2. Historial ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maternidad_historial (
  id_historial_mat BIGSERIAL PRIMARY KEY,
  id_solicitud_mat INTEGER NOT NULL REFERENCES public.maternidad_solicitud(id_solicitud_mat) ON DELETE CASCADE,
  tipo             VARCHAR(20) NOT NULL
    CHECK (tipo IN ('registro', 'estado', 'tour', 'parto', 'datos', 'cotizacion', 'correo')),
  descripcion      TEXT NOT NULL,
  usuario          VARCHAR(200),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maternidad_historial_solicitud ON public.maternidad_historial (id_solicitud_mat, created_at);

ALTER TABLE public.maternidad_historial DISABLE ROW LEVEL SECURITY;

-- Etiquetas legibles (mismas que la web)
CREATE OR REPLACE FUNCTION public.fn_maternidad_etiqueta_estado(p_estado TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_estado
    WHEN 'solo_cotizacion' THEN 'Solo cotización'
    WHEN 'agendada'        THEN 'Tour agendado'
    WHEN 'confirmada'      THEN 'Confirmada'
    WHEN 'asistio'         THEN 'Asistió'
    WHEN 'no_asistio'      THEN 'No asistió'
    WHEN 'cancelada'       THEN 'Cancelada'
    ELSE p_estado
  END
$$;

CREATE OR REPLACE FUNCTION public.fn_maternidad_etiqueta_tour(p_fecha DATE, p_hora TIME)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT TO_CHAR(p_fecha, 'DD/MM/YYYY') || COALESCE(' ' || TO_CHAR(p_hora, 'HH24:MI'), '')
$$;

CREATE OR REPLACE FUNCTION public.fn_maternidad_etiqueta_parto(p_resultado TEXT, p_tipo TEXT, p_fecha DATE)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_resultado
    WHEN 'pendiente'  THEN 'Pendiente'
    WHEN 'otro_lugar' THEN 'Dio a luz en otro lugar'
    WHEN 'clinica'    THEN 'Dio a luz en la clínica' || COALESCE(' (' || NULLIF(CONCAT_WS(', ',
                             CASE p_tipo WHEN 'normal' THEN 'parto normal' WHEN 'cesarea' THEN 'cesárea' END,
                             TO_CHAR(p_fecha, 'DD/MM/YYYY')), '') || ')', '')
    ELSE p_resultado
  END
$$;

-- Solicitud: registro, estado, tour, parto y datos de la mamá
CREATE OR REPLACE FUNCTION public.fn_maternidad_historial_solicitud()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_usuario  TEXT;
  v_cambios  TEXT[] := ARRAY[]::TEXT[];
  v_texto    TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
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

DROP TRIGGER IF EXISTS trg_maternidad_historial_solicitud ON public.maternidad_solicitud;
CREATE TRIGGER trg_maternidad_historial_solicitud
AFTER INSERT OR UPDATE ON public.maternidad_solicitud
FOR EACH ROW EXECUTE FUNCTION public.fn_maternidad_historial_solicitud();

-- Cotización emitida
CREATE OR REPLACE FUNCTION public.fn_maternidad_historial_cotizacion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario, created_at)
  VALUES (NEW.id_solicitud_mat, 'cotizacion',
          'Cotización ' || COALESCE(NEW.numero_cotizacion, '') || ' emitida'
          || CASE WHEN NEW.tipo = 'confirmacion_tour' THEN ' (confirmación de tour)' ELSE '' END
          || COALESCE(' — ' || NEW.aseguradora, ''),
          NEW.generado_por, NEW.fecha_emision);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maternidad_historial_cotizacion ON public.maternidad_cotizacion;
CREATE TRIGGER trg_maternidad_historial_cotizacion
AFTER INSERT ON public.maternidad_cotizacion
FOR EACH ROW EXECUTE FUNCTION public.fn_maternidad_historial_cotizacion();

-- Correo (proforma) enviado o con error
CREATE OR REPLACE FUNCTION public.fn_maternidad_historial_correo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_numero TEXT;
BEGIN
  SELECT numero_cotizacion INTO v_numero FROM public.maternidad_cotizacion WHERE id_cotizacion_mat = NEW.id_cotizacion_mat;
  INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario, created_at)
  VALUES (NEW.id_solicitud_mat, 'correo',
          CASE WHEN NEW.estado = 'enviado'
            THEN 'Proforma enviada a ' || NEW.destinatario
            ELSE 'Error al enviar la proforma a ' || NEW.destinatario
          END
          || COALESCE(' (' || v_numero || ')', '')
          || CASE WHEN NEW.estado = 'error' THEN COALESCE(': ' || LEFT(NEW.error_mensaje, 200), '') ELSE '' END,
          NEW.enviado_por, NEW.created_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maternidad_historial_correo ON public.maternidad_envio_correo;
CREATE TRIGGER trg_maternidad_historial_correo
AFTER INSERT ON public.maternidad_envio_correo
FOR EACH ROW EXECUTE FUNCTION public.fn_maternidad_historial_correo();

-- ── 3. RPC de registro (igual a 077 + actualizado_por) ──────────────────────
CREATE OR REPLACE FUNCTION public.fn_maternidad_registrar(
  p_nombre_madre       TEXT,
  p_cedula             TEXT,
  p_correo             TEXT,
  p_telefono           TEXT,
  p_semanas_gestacion  INTEGER DEFAULT NULL,
  p_medico_ginecologo  TEXT    DEFAULT NULL,
  p_id_aseguradora_mat INTEGER DEFAULT NULL,
  p_aseguradora        TEXT    DEFAULT NULL,
  p_fecha_tour         DATE    DEFAULT NULL,
  p_hora_inicio        TIME    DEFAULT NULL,
  p_id_horario_mat     INTEGER DEFAULT NULL,
  p_remote_jid         TEXT    DEFAULT NULL,
  p_origen             TEXT    DEFAULT 'CHATBOT',
  p_notas              TEXT    DEFAULT NULL,
  p_creado_por         TEXT    DEFAULT NULL,
  p_id_solicitud_mat   INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_ahora        TIMESTAMP := NOW() AT TIME ZONE 'America/Guayaquil';
  v_aseguradora  public.maternidad_aseguradora%ROWTYPE;
  v_horario      public.maternidad_horario%ROWTYPE;
  v_existente    public.maternidad_solicitud%ROWTYPE;
  v_resultado    public.maternidad_solicitud%ROWTYPE;
  v_reservados   INTEGER;
  v_tenia_tour   BOOLEAN := FALSE;
  v_accion       TEXT;
  v_cedula       TEXT := REGEXP_REPLACE(COALESCE(p_cedula, ''), '\s', '', 'g');
BEGIN
  -- Datos obligatorios
  IF COALESCE(TRIM(p_nombre_madre), '') = '' OR v_cedula = ''
     OR COALESCE(TRIM(p_correo), '') = '' OR COALESCE(TRIM(p_telefono), '') = '' THEN
    RAISE EXCEPTION 'DATOS_INCOMPLETOS: nombre, cédula, correo y teléfono son obligatorios';
  END IF;

  IF TRIM(p_correo) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'CORREO_INVALIDO: %', p_correo;
  END IF;

  -- Aseguradora: por id o por nombre, solo activas
  IF p_id_aseguradora_mat IS NOT NULL THEN
    SELECT * INTO v_aseguradora FROM public.maternidad_aseguradora
    WHERE id_aseguradora_mat = p_id_aseguradora_mat AND estado = 'activo';
  ELSIF COALESCE(TRIM(p_aseguradora), '') <> '' THEN
    SELECT * INTO v_aseguradora FROM public.maternidad_aseguradora
    WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(p_aseguradora)) AND estado = 'activo';
  END IF;

  IF v_aseguradora.id_aseguradora_mat IS NULL THEN
    RAISE EXCEPTION 'ASEGURADORA_INVALIDA: debe ser una aseguradora activa de maternidad_aseguradora';
  END IF;

  -- Solicitud existente a actualizar
  IF p_id_solicitud_mat IS NOT NULL THEN
    SELECT * INTO v_existente FROM public.maternidad_solicitud
    WHERE id_solicitud_mat = p_id_solicitud_mat
    FOR UPDATE;
    IF v_existente.id_solicitud_mat IS NULL THEN
      RAISE EXCEPTION 'SOLICITUD_NO_EXISTE: %', p_id_solicitud_mat;
    END IF;
  ELSE
    SELECT * INTO v_existente FROM public.maternidad_solicitud
    WHERE (cedula = v_cedula OR (p_remote_jid IS NOT NULL AND remote_jid = p_remote_jid))
      AND (
        estado = 'solo_cotizacion'
        OR (estado IN ('agendada', 'confirmada') AND fecha_tour >= v_ahora::DATE)
      )
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  v_tenia_tour := v_existente.id_solicitud_mat IS NOT NULL AND v_existente.fecha_tour IS NOT NULL
                  AND v_existente.estado IN ('agendada', 'confirmada');

  -- Tour: validar horario y cupo
  IF p_fecha_tour IS NOT NULL THEN
    IF p_id_horario_mat IS NOT NULL THEN
      SELECT * INTO v_horario FROM public.maternidad_horario
      WHERE id_horario_mat = p_id_horario_mat AND estado = 'activo'
      FOR UPDATE;
    ELSIF p_hora_inicio IS NOT NULL THEN
      SELECT * INTO v_horario FROM public.maternidad_horario
      WHERE dia_semana = EXTRACT(ISODOW FROM p_fecha_tour)::INTEGER
        AND hora_inicio = p_hora_inicio
        AND estado = 'activo'
      FOR UPDATE;
    END IF;

    IF v_horario.id_horario_mat IS NULL THEN
      RAISE EXCEPTION 'HORARIO_INVALIDO: no existe un turno activo para % %', p_fecha_tour, p_hora_inicio;
    END IF;

    IF v_horario.dia_semana <> EXTRACT(ISODOW FROM p_fecha_tour)::INTEGER THEN
      RAISE EXCEPTION 'HORARIO_INVALIDO: el turno no corresponde al día %', p_fecha_tour;
    END IF;

    IF (p_fecha_tour + v_horario.hora_inicio) <= v_ahora THEN
      RAISE EXCEPTION 'FECHA_PASADA: el turno % % ya pasó', p_fecha_tour, v_horario.hora_inicio;
    END IF;

    SELECT COUNT(*) INTO v_reservados
    FROM public.maternidad_solicitud
    WHERE id_horario_mat = v_horario.id_horario_mat
      AND fecha_tour = p_fecha_tour
      AND estado IN ('agendada', 'confirmada', 'asistio')
      AND id_solicitud_mat IS DISTINCT FROM v_existente.id_solicitud_mat;

    IF v_reservados >= v_horario.cupo THEN
      RAISE EXCEPTION 'SIN_CUPO: el turno % % no tiene cupos disponibles', p_fecha_tour, v_horario.hora_inicio;
    END IF;
  END IF;

  IF v_existente.id_solicitud_mat IS NOT NULL THEN
    UPDATE public.maternidad_solicitud SET
      nombre_madre            = TRIM(p_nombre_madre),
      cedula                  = v_cedula,
      semanas_gestacion       = COALESCE(p_semanas_gestacion, semanas_gestacion),
      correo                  = LOWER(TRIM(p_correo)),
      telefono                = TRIM(p_telefono),
      medico_ginecologo       = COALESCE(NULLIF(TRIM(p_medico_ginecologo), ''), medico_ginecologo),
      id_aseguradora_mat      = v_aseguradora.id_aseguradora_mat,
      id_horario_mat          = CASE WHEN p_fecha_tour IS NOT NULL THEN v_horario.id_horario_mat ELSE id_horario_mat END,
      fecha_tour              = COALESCE(p_fecha_tour, fecha_tour),
      hora_inicio             = CASE WHEN p_fecha_tour IS NOT NULL THEN v_horario.hora_inicio ELSE hora_inicio END,
      hora_fin                = CASE WHEN p_fecha_tour IS NOT NULL THEN v_horario.hora_fin ELSE hora_fin END,
      fecha_agendamiento_tour = CASE WHEN p_fecha_tour IS NOT NULL THEN NOW() ELSE fecha_agendamiento_tour END,
      estado                  = CASE WHEN p_fecha_tour IS NOT NULL THEN 'agendada' ELSE estado END,
      remote_jid              = COALESCE(p_remote_jid, remote_jid),
      notas                   = COALESCE(NULLIF(TRIM(p_notas), ''), notas),
      -- 079: quién hizo el cambio (historial) y el motivo de estado se limpia al agendar/reagendar
      actualizado_por         = p_creado_por,
      motivo_estado           = CASE WHEN p_fecha_tour IS NOT NULL THEN NULL ELSE motivo_estado END,
      updated_at              = NOW()
    WHERE id_solicitud_mat = v_existente.id_solicitud_mat
    RETURNING * INTO v_resultado;
    v_accion := 'actualizada';
  ELSE
    INSERT INTO public.maternidad_solicitud (
      nombre_madre, cedula, semanas_gestacion, correo, telefono, medico_ginecologo,
      id_aseguradora_mat, id_horario_mat, fecha_tour, hora_inicio, hora_fin,
      fecha_agendamiento_tour, estado, origen, remote_jid, notas, creado_por
    ) VALUES (
      TRIM(p_nombre_madre), v_cedula, p_semanas_gestacion, LOWER(TRIM(p_correo)), TRIM(p_telefono),
      NULLIF(TRIM(p_medico_ginecologo), ''), v_aseguradora.id_aseguradora_mat,
      v_horario.id_horario_mat, p_fecha_tour, v_horario.hora_inicio, v_horario.hora_fin,
      CASE WHEN p_fecha_tour IS NOT NULL THEN NOW() END,
      CASE WHEN p_fecha_tour IS NOT NULL THEN 'agendada' ELSE 'solo_cotizacion' END,
      CASE WHEN UPPER(p_origen) = 'SISTEMA' THEN 'SISTEMA' ELSE 'CHATBOT' END,
      p_remote_jid, NULLIF(TRIM(p_notas), ''), p_creado_por
    )
    RETURNING * INTO v_resultado;
    v_accion := 'creada';
  END IF;

  RETURN to_jsonb(v_resultado) || jsonb_build_object(
    'accion',       v_accion,
    'aseguradora',  v_aseguradora.nombre,
    'tour_agendado', v_resultado.fecha_tour IS NOT NULL AND v_resultado.estado IN ('agendada', 'confirmada'),
    -- true cuando en esta llamada se agendó (o reagendó) el tour → el correo va como confirmacion_tour
    'tour_nuevo',   p_fecha_tour IS NOT NULL,
    'tenia_tour',   v_tenia_tour
  );
END;
$$;

COMMENT ON FUNCTION public.fn_maternidad_registrar IS
  'Registra/actualiza una solicitud de maternidad. Sin fecha = solo cotización; con fecha = agenda tour validando cupo. '
  'Errores con prefijo: DATOS_INCOMPLETOS, CORREO_INVALIDO, ASEGURADORA_INVALIDA, HORARIO_INVALIDO, FECHA_PASADA, SIN_CUPO, SOLICITUD_NO_EXISTE.';

GRANT EXECUTE ON FUNCTION public.fn_maternidad_registrar TO anon, authenticated, service_role;

-- ── 4. Vista de solicitudes (igual a 076 + columnas nuevas al final) ────────
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
  s.actualizado_por
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

-- ── 5. Carga inicial del historial (solo solicitudes que aún no tienen) ────
DROP TABLE IF EXISTS tmp_maternidad_sin_historial;
CREATE TEMP TABLE tmp_maternidad_sin_historial AS
SELECT s.id_solicitud_mat
FROM public.maternidad_solicitud s
WHERE NOT EXISTS (SELECT 1 FROM public.maternidad_historial h WHERE h.id_solicitud_mat = s.id_solicitud_mat);

INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario, created_at)
SELECT s.id_solicitud_mat, 'registro',
       'Solicitud registrada desde ' || CASE WHEN s.origen = 'CHATBOT' THEN 'WhatsApp' ELSE 'el sistema' END,
       s.creado_por, s.created_at
FROM public.maternidad_solicitud s
JOIN tmp_maternidad_sin_historial t USING (id_solicitud_mat);

INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario, created_at)
SELECT s.id_solicitud_mat, 'tour',
       'Tour agendado para el ' || public.fn_maternidad_etiqueta_tour(s.fecha_tour, s.hora_inicio),
       s.creado_por, COALESCE(s.fecha_agendamiento_tour, s.created_at)
FROM public.maternidad_solicitud s
JOIN tmp_maternidad_sin_historial t USING (id_solicitud_mat)
WHERE s.fecha_tour IS NOT NULL;

INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario, created_at)
SELECT s.id_solicitud_mat, 'estado',
       'Estado actual: ' || public.fn_maternidad_etiqueta_estado(s.estado),
       NULL, s.updated_at
FROM public.maternidad_solicitud s
JOIN tmp_maternidad_sin_historial t USING (id_solicitud_mat)
WHERE s.estado NOT IN ('solo_cotizacion', 'agendada');

INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario, created_at)
SELECT c.id_solicitud_mat, 'cotizacion',
       'Cotización ' || COALESCE(c.numero_cotizacion, '') || ' emitida'
       || CASE WHEN c.tipo = 'confirmacion_tour' THEN ' (confirmación de tour)' ELSE '' END
       || COALESCE(' — ' || c.aseguradora, ''),
       c.generado_por, c.fecha_emision
FROM public.maternidad_cotizacion c
JOIN tmp_maternidad_sin_historial t USING (id_solicitud_mat);

INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario, created_at)
SELECT e.id_solicitud_mat, 'correo',
       CASE WHEN e.estado = 'enviado'
         THEN 'Proforma enviada a ' || e.destinatario
         ELSE 'Error al enviar la proforma a ' || e.destinatario
       END
       || COALESCE(' (' || c.numero_cotizacion || ')', '')
       || CASE WHEN e.estado = 'error' THEN COALESCE(': ' || LEFT(e.error_mensaje, 200), '') ELSE '' END,
       e.enviado_por, e.created_at
FROM public.maternidad_envio_correo e
JOIN tmp_maternidad_sin_historial t USING (id_solicitud_mat)
LEFT JOIN public.maternidad_cotizacion c ON c.id_cotizacion_mat = e.id_cotizacion_mat;

DROP TABLE IF EXISTS tmp_maternidad_sin_historial;

NOTIFY pgrst, 'reload schema';

-- Consultas de ejemplo:
--   SELECT created_at, tipo, descripcion, usuario FROM maternidad_historial
--   WHERE id_solicitud_mat = 5 ORDER BY created_at;
--   SELECT resultado_parto, COUNT(*) FROM maternidad_solicitud GROUP BY 1;
