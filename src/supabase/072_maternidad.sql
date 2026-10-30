-- ============================================
-- 072: Módulo Maternidad — tours de maternidad y cotizaciones
-- Módulo independiente: tablas con prefijo maternidad_.
-- Solo reutiliza `usuario` (nuevo perfil 'maternidad').
-- Sin RLS — la app usa autenticación propia (ver CLAUDE.md).
-- Consumido por la web y por n8n (vistas + RPC fn_maternidad_registrar).
-- ============================================

-- ── 1. Perfil maternidad ───────────────────────────────────────────────────
ALTER TABLE public.usuario
  DROP CONSTRAINT IF EXISTS usuario_tipo_usuario_check;

ALTER TABLE public.usuario
  ADD CONSTRAINT usuario_tipo_usuario_check
  CHECK (
    tipo_usuario IN (
      'medico',
      'administrativo',
      'enfermera',
      'secretaria',
      'USUARIO_IMANGE',
      'USUARIO_IMAGEN',
      'GESTOR_IMAGEN',
      'GESTOR',
      'maternidad'
    )
  );

-- ── 2. Aseguradoras de maternidad ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maternidad_aseguradora (
  id_aseguradora_mat SERIAL PRIMARY KEY,
  nombre             VARCHAR(120) NOT NULL UNIQUE,
  orden              INTEGER NOT NULL DEFAULT 0,
  -- Configuración de la cotización (formatos de presupuesto/checklist/boletín por aseguradora)
  config_cotizacion  JSONB NOT NULL DEFAULT '{}'::jsonb,
  estado             VARCHAR(10) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.maternidad_aseguradora (nombre, orden) VALUES
  ('Allianz Care',      1),
  ('Alphaplus',         2),
  ('Asisken',           3),
  ('Confiamed',         4),
  ('Humana',            5),
  ('Pan American Life', 6),
  ('Plan Vital',        7),
  ('PLUS MEDICAL',      8),
  ('Privilegio',        9),
  ('Proassislife',     10),
  ('TECNISEGUROS',     11),
  ('Vida Buena',       12),
  ('Vumi Latina',      13),
  ('AIGMETROPOLITANA', 14)
ON CONFLICT (nombre) DO NOTHING;

-- ── 3. Horarios (turnos) de tours ──────────────────────────────────────────
-- dia_semana: 1=Lunes … 7=Domingo (ISO)
CREATE TABLE IF NOT EXISTS public.maternidad_horario (
  id_horario_mat SERIAL PRIMARY KEY,
  dia_semana     INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  hora_inicio    TIME NOT NULL,
  hora_fin       TIME NOT NULL,
  cupo           INTEGER NOT NULL DEFAULT 1 CHECK (cupo >= 1),
  estado         VARCHAR(10) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT maternidad_horario_rango_check CHECK (hora_fin > hora_inicio),
  CONSTRAINT maternidad_horario_unico UNIQUE (dia_semana, hora_inicio)
);

-- Lunes a viernes: 09h00 a 12h30 y 15h30 a 17h00 en turnos de 1 hora (un tour por turno, ver 073)
INSERT INTO public.maternidad_horario (dia_semana, hora_inicio, hora_fin)
SELECT d, t.hora_inicio, t.hora_fin
FROM generate_series(1, 5) AS d
CROSS JOIN (VALUES
  ('09:00'::TIME, '10:00'::TIME),
  ('10:00'::TIME, '11:00'::TIME),
  ('11:00'::TIME, '12:00'::TIME),
  ('12:00'::TIME, '12:30'::TIME),
  ('15:30'::TIME, '16:30'::TIME),
  ('16:30'::TIME, '17:00'::TIME)
) AS t(hora_inicio, hora_fin)
ON CONFLICT (dia_semana, hora_inicio) DO NOTHING;

-- Sábados: 09h00 | 10h00 | 11h00 | 12h00 | 13h00
INSERT INTO public.maternidad_horario (dia_semana, hora_inicio, hora_fin) VALUES
  (6, '09:00', '10:00'),
  (6, '10:00', '11:00'),
  (6, '11:00', '12:00'),
  (6, '12:00', '13:00'),
  (6, '13:00', '14:00')
ON CONFLICT (dia_semana, hora_inicio) DO NOTHING;

-- ── 4. Solicitudes (cotización y/o tour) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maternidad_solicitud (
  id_solicitud_mat        SERIAL PRIMARY KEY,
  -- Datos de la mamá
  nombre_madre            VARCHAR(200) NOT NULL,
  cedula                  VARCHAR(20)  NOT NULL,
  semanas_gestacion       INTEGER CHECK (semanas_gestacion BETWEEN 1 AND 45),
  correo                  VARCHAR(200) NOT NULL,
  telefono                VARCHAR(30)  NOT NULL,
  medico_ginecologo       VARCHAR(200),
  id_aseguradora_mat      INTEGER REFERENCES public.maternidad_aseguradora(id_aseguradora_mat),
  -- Tour (vacío cuando solo se pidió la cotización)
  id_horario_mat          INTEGER REFERENCES public.maternidad_horario(id_horario_mat),
  fecha_tour              DATE,
  hora_inicio             TIME,
  hora_fin                TIME,
  fecha_agendamiento_tour TIMESTAMPTZ,
  -- Control
  estado                  VARCHAR(20) NOT NULL DEFAULT 'solo_cotizacion'
    CHECK (estado IN ('solo_cotizacion', 'agendada', 'confirmada', 'asistio', 'no_asistio', 'cancelada')),
  origen                  VARCHAR(10) NOT NULL DEFAULT 'CHATBOT' CHECK (origen IN ('CHATBOT', 'SISTEMA')),
  remote_jid              VARCHAR(100),
  notas                   TEXT,
  creado_por              VARCHAR(200),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT maternidad_solicitud_tour_check CHECK (
    estado IN ('solo_cotizacion', 'cancelada')
    OR (fecha_tour IS NOT NULL AND id_horario_mat IS NOT NULL AND hora_inicio IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_maternidad_solicitud_fecha_tour ON public.maternidad_solicitud (fecha_tour, id_horario_mat);
CREATE INDEX IF NOT EXISTS idx_maternidad_solicitud_cedula     ON public.maternidad_solicitud (cedula);
CREATE INDEX IF NOT EXISTS idx_maternidad_solicitud_remote_jid ON public.maternidad_solicitud (remote_jid);
CREATE INDEX IF NOT EXISTS idx_maternidad_solicitud_created    ON public.maternidad_solicitud (created_at);

-- ── 5. Conversación (un mensaje por fila, la escribe n8n) ──────────────────
CREATE TABLE IF NOT EXISTS public.maternidad_conversacion (
  id_mensaje_mat   BIGSERIAL PRIMARY KEY,
  remote_jid       VARCHAR(100) NOT NULL,
  telefono         VARCHAR(30),
  rol              VARCHAR(10) NOT NULL CHECK (rol IN ('usuario', 'asistente')),
  mensaje          TEXT NOT NULL,
  id_solicitud_mat INTEGER REFERENCES public.maternidad_solicitud(id_solicitud_mat) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maternidad_conversacion_jid       ON public.maternidad_conversacion (remote_jid, created_at);
CREATE INDEX IF NOT EXISTS idx_maternidad_conversacion_solicitud ON public.maternidad_conversacion (id_solicitud_mat);

-- ── 6. Auditoría de envío de correos ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.maternidad_envio_correo (
  id_envio_mat     BIGSERIAL PRIMARY KEY,
  id_solicitud_mat INTEGER NOT NULL REFERENCES public.maternidad_solicitud(id_solicitud_mat) ON DELETE CASCADE,
  tipo             VARCHAR(20) NOT NULL DEFAULT 'cotizacion' CHECK (tipo IN ('cotizacion', 'confirmacion_tour')),
  destinatario     VARCHAR(200) NOT NULL,
  asunto           VARCHAR(300),
  -- [{ "tipo": "presupuesto", "nombre": "...pdf", "path": "<ruta en bucket>" }]
  adjuntos         JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado           VARCHAR(10) NOT NULL CHECK (estado IN ('enviado', 'error')),
  message_id       VARCHAR(300),
  error_mensaje    TEXT,
  enviado_por      VARCHAR(200) NOT NULL DEFAULT 'n8n',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maternidad_envio_solicitud ON public.maternidad_envio_correo (id_solicitud_mat, created_at);

-- ── 7. Sin RLS (autenticación propia) ──────────────────────────────────────
ALTER TABLE public.maternidad_aseguradora  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.maternidad_horario      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.maternidad_solicitud    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.maternidad_conversacion DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.maternidad_envio_correo DISABLE ROW LEVEL SECURITY;

-- ── 8. Bucket privado para los PDF de cotización ───────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'maternidad-cotizaciones',
  'maternidad-cotizaciones',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "maternidad_cotizaciones_insert" ON storage.objects;
CREATE POLICY "maternidad_cotizaciones_insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'maternidad-cotizaciones');

DROP POLICY IF EXISTS "maternidad_cotizaciones_select" ON storage.objects;
CREATE POLICY "maternidad_cotizaciones_select"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'maternidad-cotizaciones');

DROP POLICY IF EXISTS "maternidad_cotizaciones_update" ON storage.objects;
CREATE POLICY "maternidad_cotizaciones_update"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'maternidad-cotizaciones')
WITH CHECK (bucket_id = 'maternidad-cotizaciones');

-- ── 9. Vista: horarios disponibles (próximos 30 días) — para n8n y la web ──
CREATE OR REPLACE VIEW public.vista_maternidad_horarios_disponibles AS
WITH
ahora AS (
  SELECT (NOW() AT TIME ZONE 'America/Guayaquil') AS ts
),
fechas AS (
  SELECT (a.ts::DATE + i)::DATE AS fecha
  FROM ahora a, generate_series(0, 29) AS i
)
SELECT
  h.id_horario_mat,
  f.fecha,
  TO_CHAR(f.fecha, 'DD/MM/YYYY')                                   AS fecha_formato,
  h.dia_semana,
  CASE h.dia_semana
    WHEN 1 THEN 'Lunes'
    WHEN 2 THEN 'Martes'
    WHEN 3 THEN 'Miércoles'
    WHEN 4 THEN 'Jueves'
    WHEN 5 THEN 'Viernes'
    WHEN 6 THEN 'Sábado'
    WHEN 7 THEN 'Domingo'
  END                                                              AS dia_nombre,
  h.hora_inicio,
  h.hora_fin,
  TO_CHAR(h.hora_inicio, 'HH24:MI') || ' - ' || TO_CHAR(h.hora_fin, 'HH24:MI') AS horario,
  h.cupo,
  COALESCE(r.reservados, 0)::INTEGER                               AS reservados,
  (h.cupo - COALESCE(r.reservados, 0))::INTEGER                    AS disponibles
FROM fechas f
JOIN public.maternidad_horario h
  ON  h.dia_semana = EXTRACT(ISODOW FROM f.fecha)::INTEGER
  AND h.estado     = 'activo'
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS reservados
  FROM public.maternidad_solicitud s
  WHERE s.id_horario_mat = h.id_horario_mat
    AND s.fecha_tour     = f.fecha
    AND s.estado IN ('agendada', 'confirmada', 'asistio')
) r ON TRUE
WHERE (f.fecha + h.hora_inicio) > (SELECT ts FROM ahora)
ORDER BY f.fecha, h.hora_inicio;

COMMENT ON VIEW public.vista_maternidad_horarios_disponibles IS
  'Turnos de tour de maternidad de los próximos 30 días con cupo, reservados y disponibles. '
  'Para n8n filtrar disponibles > 0 (PostgREST: ?disponibles=gt.0).';

-- ── 10. Vista: solicitudes con datos de agendamiento — para n8n, calendario y reportes
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
  COALESCE(tc.errores, 0)::INTEGER                                 AS correos_error
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
) tc ON TRUE;

COMMENT ON VIEW public.vista_maternidad_solicitudes IS
  'Solicitudes de maternidad (cotización y/o tour) con aseguradora, horario y estado del último correo.';

-- ── 11. RPC: registrar solicitud (cotización y/o tour) ─────────────────────
-- Única entrada de escritura para n8n y la web.
--  · Sin fecha  → la solicitud queda en 'solo_cotizacion'.
--  · Con fecha  → valida cupo (con bloqueo) y pasa a 'agendada'.
-- Si ya existe una solicitud abierta de la misma cédula / remote_jid, la actualiza
-- (así una cotización que luego se convierte en tour no se duplica).
-- La aseguradora puede enviarse por id o por nombre (debe estar activa).
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

  -- Asociar la conversación de WhatsApp a la solicitud
  IF v_resultado.remote_jid IS NOT NULL THEN
    UPDATE public.maternidad_conversacion
    SET id_solicitud_mat = v_resultado.id_solicitud_mat
    WHERE remote_jid = v_resultado.remote_jid
      AND id_solicitud_mat IS NULL;
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

NOTIFY pgrst, 'reload schema';

-- ── Consultas de ejemplo ───────────────────────────────────────────────────
--   SELECT * FROM vista_maternidad_horarios_disponibles WHERE disponibles > 0 LIMIT 20;
--   SELECT * FROM vista_maternidad_solicitudes ORDER BY created_at DESC;
--   SELECT fn_maternidad_registrar(
--     p_nombre_madre := 'María Pérez', p_cedula := '0912345678', p_correo := 'maria@correo.com',
--     p_telefono := '0991234567', p_semanas_gestacion := 28, p_medico_ginecologo := 'Dr. López',
--     p_aseguradora := 'Humana');                                   -- solo cotización
--   SELECT fn_maternidad_registrar(
--     p_nombre_madre := 'María Pérez', p_cedula := '0912345678', p_correo := 'maria@correo.com',
--     p_telefono := '0991234567', p_aseguradora := 'Humana',
--     p_fecha_tour := '2026-11-03', p_hora_inicio := '10:00');     -- agenda el tour sobre la misma solicitud
