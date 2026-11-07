-- ============================================
-- 080 · Maternidad: la solicitud abierta se reutiliza solo con la misma cédula
-- Hasta 079, fn_maternidad_registrar reutilizaba la solicitud abierta de la misma cédula
-- O del mismo WhatsApp (remote_jid). Si desde un mismo número se cotiza para una mamá y
-- luego se agenda el tour de otra, la segunda sobrescribía a la primera (pasó en pruebas:
-- una proforma quedó con los datos y el tour de otra cédula).
-- 1) fn_maternidad_registrar (misma de 079) busca la solicitud abierta solo por cédula.
-- 2) (Retirado) La recuperación puntual de esa solicitud de prueba se ejecutó el 2026-11-07 y
--    los datos se eliminaron con la 082; se quitó del archivo para no guardar datos personales.
-- 3) El seguimiento del parto solo registra si dio a luz en la clínica: se quita 'otro_lugar'.
-- ============================================

-- ── 1. RPC de registro ──────────────────────────────────────────────────────
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
    -- 080: solo la misma cédula. Un mismo WhatsApp puede escribir por varias mamás (esposo, familiar):
    -- con otra cédula se crea una solicitud nueva en lugar de sobrescribir la de otra persona.
    WHERE cedula = v_cedula
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
  'Registra/actualiza una solicitud de maternidad (reutiliza la abierta de la misma cédula). Sin fecha = solo cotización; con fecha = agenda tour validando cupo. '
  'Errores con prefijo: DATOS_INCOMPLETOS, CORREO_INVALIDO, ASEGURADORA_INVALIDA, HORARIO_INVALIDO, FECHA_PASADA, SIN_CUPO, SOLICITUD_NO_EXISTE.';

GRANT EXECUTE ON FUNCTION public.fn_maternidad_registrar TO anon, authenticated, service_role;

-- ── 3. Parto: solo pendiente / clínica ─────────────────────────────────────
UPDATE public.maternidad_solicitud
SET resultado_parto = 'pendiente', actualizado_por = 'Sistema'
WHERE resultado_parto = 'otro_lugar';

ALTER TABLE public.maternidad_solicitud DROP CONSTRAINT IF EXISTS maternidad_solicitud_resultado_parto_check;
ALTER TABLE public.maternidad_solicitud ADD CONSTRAINT maternidad_solicitud_resultado_parto_check
  CHECK (resultado_parto IN ('pendiente', 'clinica'));

NOTIFY pgrst, 'reload schema';

-- Verificación:
--   SELECT id_solicitud_mat, nombre_madre, cedula, estado, fecha_tour, ultima_cotizacion, correos_enviados
--   FROM vista_maternidad_solicitudes ORDER BY id_solicitud_mat;
