-- ============================================
-- 076: Maternidad — cotizaciones numeradas
-- Cada vez que se genera una cotización (presupuesto + checklist + boletín) se crea
-- una fila con número correlativo COT-MAT-AAAA-NNNNNN, la fecha de emisión, la fecha de
-- envío, la aseguradora y los valores usados en ese momento (para reimprimir igual
-- aunque luego cambien los valores de la aseguradora). Los PDF quedan en el bucket
-- maternidad-cotizaciones y se pueden volver a abrir o reenviar con el mismo número.
-- Sin RLS (autenticación propia).
-- ============================================

CREATE TABLE IF NOT EXISTS public.maternidad_cotizacion (
  id_cotizacion_mat  SERIAL PRIMARY KEY,
  numero_cotizacion  VARCHAR(30) UNIQUE,
  id_solicitud_mat   INTEGER NOT NULL REFERENCES public.maternidad_solicitud(id_solicitud_mat) ON DELETE CASCADE,
  id_aseguradora_mat INTEGER REFERENCES public.maternidad_aseguradora(id_aseguradora_mat),
  aseguradora        VARCHAR(120),
  tipo               VARCHAR(20) NOT NULL DEFAULT 'cotizacion' CHECK (tipo IN ('cotizacion', 'confirmacion_tour')),
  -- Copia de config_cotizacion.presupuesto usada (null = presupuesto genérico)
  valores            JSONB,
  -- [{ "procedimiento": "CESÁREA", "total": 1390 }, ...]
  resumen            JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "tipo": "presupuesto", "nombre": "...pdf", "path": "<ruta en bucket>" }]
  archivos           JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado             VARCHAR(10) NOT NULL DEFAULT 'generada' CHECK (estado IN ('generada', 'enviada', 'error')),
  fecha_emision      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_envio        TIMESTAMPTZ,
  veces_enviada      INTEGER NOT NULL DEFAULT 0,
  generado_por       VARCHAR(200),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maternidad_cotizacion_solicitud ON public.maternidad_cotizacion (id_solicitud_mat, fecha_emision DESC);

ALTER TABLE public.maternidad_cotizacion DISABLE ROW LEVEL SECURITY;

-- Número correlativo: COT-MAT-2026-000001 (año de emisión en hora de Ecuador)
CREATE OR REPLACE FUNCTION public.fn_maternidad_numero_cotizacion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.numero_cotizacion IS NULL THEN
    NEW.numero_cotizacion := 'COT-MAT-'
      || TO_CHAR(NOW() AT TIME ZONE 'America/Guayaquil', 'YYYY') || '-'
      || LPAD(NEW.id_cotizacion_mat::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maternidad_numero_cotizacion ON public.maternidad_cotizacion;
CREATE TRIGGER trg_maternidad_numero_cotizacion
BEFORE INSERT ON public.maternidad_cotizacion
FOR EACH ROW EXECUTE FUNCTION public.fn_maternidad_numero_cotizacion();

-- Cada envío de correo (auditoría) indica qué cotización se envió
ALTER TABLE public.maternidad_envio_correo
  ADD COLUMN IF NOT EXISTS id_cotizacion_mat INTEGER REFERENCES public.maternidad_cotizacion(id_cotizacion_mat) ON DELETE SET NULL;

-- Vista de solicitudes: se agrega la última cotización (columnas al final para CREATE OR REPLACE)
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
  COALESCE(ct.total_cotizaciones, 0)::INTEGER                      AS cotizaciones_emitidas
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

NOTIFY pgrst, 'reload schema';

-- Consultas de ejemplo:
--   SELECT numero_cotizacion, aseguradora, estado, fecha_emision, fecha_envio, resumen
--   FROM maternidad_cotizacion ORDER BY id_cotizacion_mat DESC;
