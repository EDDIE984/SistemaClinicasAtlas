-- ============================================
-- 083 · Maternidad: estado real de los correos (rebotes, correos mal escritos y reintentos)
-- 1) maternidad_envio_correo.estado acepta:
--      'rebotado' → el servidor destino devolvió el correo (buzón inexistente). Lo detecta
--                   /api/maternidad-correos leyendo los avisos de rebote de la casilla de la clínica.
--      'invalido' → no rebota pero la dirección está mal escrita o el dominio no existe
--                   (p. ej. "outloook.es", que acepta correo y nunca llega a la mamá).
--    Columnas nuevas: rebote_detalle (código del servidor o motivo), rebote_fecha, correo_sugerido
--    y reintentos_auto (reintentos automáticos de un envío con 'error').
-- 2) Historial: cuando un envío pasa a 'rebotado' o 'invalido' queda registrado en la solicitud.
-- 3) vista_maternidad_correos: cada envío con los datos de la solicitud y la cotización, y
--      pendiente       → error/rebotado/invalido sin un envío posterior exitoso de la misma cotización
--      correo_cambiado → el correo actual de la solicitud ya no es el destinatario de ese envío
-- Sin RLS. Ejecutar ANTES de desplegar la web.
-- ============================================

-- ── 1. Estados y columnas ───────────────────────────────────────────────────
ALTER TABLE public.maternidad_envio_correo DROP CONSTRAINT IF EXISTS maternidad_envio_correo_estado_check;
ALTER TABLE public.maternidad_envio_correo ADD CONSTRAINT maternidad_envio_correo_estado_check
  CHECK (estado IN ('enviado', 'error', 'rebotado', 'invalido'));

ALTER TABLE public.maternidad_envio_correo
  ADD COLUMN IF NOT EXISTS rebote_detalle  TEXT,
  ADD COLUMN IF NOT EXISTS rebote_fecha    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correo_sugerido VARCHAR(200),
  ADD COLUMN IF NOT EXISTS reintentos_auto INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_maternidad_envio_message_id ON public.maternidad_envio_correo (message_id);
CREATE INDEX IF NOT EXISTS idx_maternidad_envio_estado     ON public.maternidad_envio_correo (estado, created_at);

ALTER TABLE public.maternidad_envio_correo DISABLE ROW LEVEL SECURITY;

-- ── 2. Historial del rebote / correo inválido ───────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_maternidad_historial_correo_estado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_numero TEXT;
BEGIN
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado OR NEW.estado NOT IN ('rebotado', 'invalido') THEN
    RETURN NEW;
  END IF;
  SELECT numero_cotizacion INTO v_numero FROM public.maternidad_cotizacion WHERE id_cotizacion_mat = NEW.id_cotizacion_mat;
  INSERT INTO public.maternidad_historial (id_solicitud_mat, tipo, descripcion, usuario, created_at)
  VALUES (NEW.id_solicitud_mat, 'correo',
          CASE WHEN NEW.estado = 'rebotado'
            THEN 'Correo rebotado: ' || NEW.destinatario
            ELSE 'Correo inválido: ' || NEW.destinatario
          END
          || COALESCE(' (' || v_numero || ')', '')
          || COALESCE(' — ' || LEFT(NEW.rebote_detalle, 200), '')
          || COALESCE('. Sugerido: ' || NEW.correo_sugerido, ''),
          'Sistema', COALESCE(NEW.rebote_fecha, NOW()));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maternidad_historial_correo_estado ON public.maternidad_envio_correo;
CREATE TRIGGER trg_maternidad_historial_correo_estado
AFTER UPDATE OF estado ON public.maternidad_envio_correo
FOR EACH ROW EXECUTE FUNCTION public.fn_maternidad_historial_correo_estado();

-- ── 3. Vista para la pantalla Correos Maternidad ────────────────────────────
DROP VIEW IF EXISTS public.vista_maternidad_correos;
CREATE VIEW public.vista_maternidad_correos AS
SELECT
  e.id_envio_mat,
  e.id_solicitud_mat,
  e.id_cotizacion_mat,
  e.tipo,
  e.destinatario,
  e.asunto,
  e.adjuntos,
  e.estado,
  e.message_id,
  e.error_mensaje,
  e.enviado_por,
  e.created_at,
  e.rebote_detalle,
  e.rebote_fecha,
  e.correo_sugerido,
  e.reintentos_auto,
  s.nombre_madre,
  s.cedula,
  s.telefono,
  s.correo AS correo_actual,
  s.origen,
  c.numero_cotizacion,
  (
    e.estado IN ('error', 'rebotado', 'invalido')
    AND NOT EXISTS (
      SELECT 1
      FROM public.maternidad_envio_correo e2
      WHERE e2.id_solicitud_mat = e.id_solicitud_mat
        AND e2.id_cotizacion_mat IS NOT DISTINCT FROM e.id_cotizacion_mat
        AND e2.created_at > e.created_at
        AND e2.estado = 'enviado'
    )
  ) AS pendiente,
  (LOWER(COALESCE(s.correo, '')) <> LOWER(e.destinatario)) AS correo_cambiado
FROM public.maternidad_envio_correo e
JOIN public.maternidad_solicitud s ON s.id_solicitud_mat = e.id_solicitud_mat
LEFT JOIN public.maternidad_cotizacion c ON c.id_cotizacion_mat = e.id_cotizacion_mat;
