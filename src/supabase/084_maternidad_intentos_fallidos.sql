-- ============================================
-- 084 · Maternidad: pedidos de cotización que no se pudieron registrar
-- Cuando el flujo de WhatsApp (n8n) llama a /api/maternidad-cotizacion con `datos` y el registro falla
-- antes de crear la solicitud (teléfono o correo vacíos, correo inválido, sin cupo, turno inválido…),
-- antes no quedaba ningún rastro. Ahora el pedido se guarda aquí con los datos recibidos y el error, y
-- aparece en la pantalla Correos Maternidad para completarlo y enviarlo, o descartarlo.
--   estado: pendiente → resuelto (se registró y envió; id_solicitud_mat) | descartado
-- Sin RLS. Ejecutar ANTES de desplegar la web.
-- ============================================

CREATE TABLE IF NOT EXISTS public.maternidad_intento_fallido (
  id_intento_mat   BIGSERIAL PRIMARY KEY,
  cedula           TEXT,
  nombre_madre     TEXT,
  correo           TEXT,
  telefono         TEXT,
  -- Copia de lo recibido en `datos` (aseguradora, médico, semanas, tour, remote_jid…) para reintentar
  datos            JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_codigo     VARCHAR(40) NOT NULL,
  error_mensaje    TEXT,
  enviado_por      VARCHAR(200),
  intentos         INTEGER NOT NULL DEFAULT 1,
  estado           VARCHAR(12) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'resuelto', 'descartado')),
  id_solicitud_mat INTEGER REFERENCES public.maternidad_solicitud(id_solicitud_mat) ON DELETE SET NULL,
  atendido_por     VARCHAR(200),
  atendido_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maternidad_intento_estado ON public.maternidad_intento_fallido (estado, created_at);
CREATE INDEX IF NOT EXISTS idx_maternidad_intento_cedula ON public.maternidad_intento_fallido (cedula);

ALTER TABLE public.maternidad_intento_fallido DISABLE ROW LEVEL SECURITY;
