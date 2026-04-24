-- ============================================================
-- 042_interconsultas.sql
-- Tabla para registrar interconsultas (derivaciones entre médicos)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.interconsulta (
  id_interconsulta        SERIAL PRIMARY KEY,
  id_consulta_medica      INT REFERENCES public.consulta_medica(id_consulta_medica) ON DELETE CASCADE,
  id_paciente             INT REFERENCES public.paciente(id_paciente) ON DELETE CASCADE,
  id_usuario_solicitante  INT REFERENCES public.usuario(id_usuario),
  tipo_destino            VARCHAR(10) NOT NULL CHECK (tipo_destino IN ('interno', 'externo')),
  id_usuario_destino      INT REFERENCES public.usuario(id_usuario),
  id_especialidad_destino INT REFERENCES public.especialidad(id_especialidad),
  especialidad_destino_texto VARCHAR(255),
  medico_destino_externo  VARCHAR(255),
  motivo                  TEXT NOT NULL,
  resumen_clinico         TEXT,
  urgencia                VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (urgencia IN ('normal', 'urgente')),
  fecha_limite            DATE,
  estado                  VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente', 'en_proceso', 'atendida', 'cancelada')),
  id_cita_generada        INT REFERENCES public.cita(id_cita),
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.interconsulta DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_interconsulta_consulta ON public.interconsulta(id_consulta_medica);
CREATE INDEX IF NOT EXISTS idx_interconsulta_paciente ON public.interconsulta(id_paciente);
CREATE INDEX IF NOT EXISTS idx_interconsulta_solicitante ON public.interconsulta(id_usuario_solicitante);
CREATE INDEX IF NOT EXISTS idx_interconsulta_destino ON public.interconsulta(id_usuario_destino);
CREATE INDEX IF NOT EXISTS idx_interconsulta_estado ON public.interconsulta(estado);
