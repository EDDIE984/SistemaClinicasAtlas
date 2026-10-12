-- =====================================================
-- RECORDATORIOS DE CITA POR WHATSAPP
-- Historial de recordatorios enviados (o fallidos) a pacientes y médicos
-- desde el módulo "Recordatorio Pacientes" del perfil GESTOR.
-- El resumen diario al médico guarda una fila por cada cita incluida.
-- Sin RLS (ver CLAUDE.md: el proyecto no usa Supabase Auth).
-- =====================================================

CREATE TABLE IF NOT EXISTS public.recordatorio_whatsapp (
  id_recordatorio     SERIAL PRIMARY KEY,
  tipo_destinatario   VARCHAR(10) NOT NULL CHECK (tipo_destinatario IN ('PACIENTE', 'MEDICO')),
  tipo_cita           VARCHAR(20) NOT NULL CHECK (tipo_cita IN ('CONSULTA_EXTERNA', 'SERVICIO')),
  id_cita             INTEGER REFERENCES public.cita(id_cita) ON DELETE SET NULL,
  id_cita_servicio    INTEGER REFERENCES public.cita_servicio(id_cita_servicio) ON DELETE SET NULL,
  id_usuario_sucursal INTEGER REFERENCES public.usuario_sucursal(id_usuario_sucursal) ON DELETE SET NULL,
  fecha_cita          DATE NOT NULL,
  telefono            VARCHAR(20) NOT NULL,
  mensaje             TEXT NOT NULL,
  estado              VARCHAR(10) NOT NULL CHECK (estado IN ('ENVIADO', 'FALLIDO')),
  detalle_error       TEXT,
  intentos            SMALLINT NOT NULL DEFAULT 1,
  id_usuario_envio    INTEGER REFERENCES public.usuario(id_usuario),
  fecha_envio         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recordatorio_whatsapp_cita ON public.recordatorio_whatsapp(id_cita);
CREATE INDEX IF NOT EXISTS idx_recordatorio_whatsapp_cita_servicio ON public.recordatorio_whatsapp(id_cita_servicio);
CREATE INDEX IF NOT EXISTS idx_recordatorio_whatsapp_fecha_envio ON public.recordatorio_whatsapp(fecha_envio DESC);

ALTER TABLE public.recordatorio_whatsapp DISABLE ROW LEVEL SECURITY;

-- Recargar el caché de esquema de PostgREST para que la API vea la tabla nueva
NOTIFY pgrst, 'reload schema';
