-- ============================================================
-- 052_interconsultas_estado_numero.sql
-- Tabla de interconsultas con numero secuencial y estados nuevos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS interconsulta_numero_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS public.interconsulta (
  id_interconsulta        SERIAL PRIMARY KEY,
  numero_interconsulta    BIGINT NOT NULL UNIQUE DEFAULT nextval('interconsulta_numero_seq'),
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
  estado                  VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_AGENDAR'
                            CHECK (estado IN ('ATENDIDO', 'PENDIENTE_AGENDAR', 'AGENDADA', 'RECHAZADA')),
  id_cita_generada        INT REFERENCES public.cita(id_cita),
  created_at              TIMESTAMP DEFAULT NOW(),
  updated_at              TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.interconsulta
  ADD COLUMN IF NOT EXISTS numero_interconsulta BIGINT,
  ADD COLUMN IF NOT EXISTS id_consulta_medica INT REFERENCES public.consulta_medica(id_consulta_medica) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS id_paciente INT REFERENCES public.paciente(id_paciente) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS id_usuario_solicitante INT REFERENCES public.usuario(id_usuario),
  ADD COLUMN IF NOT EXISTS tipo_destino VARCHAR(10),
  ADD COLUMN IF NOT EXISTS id_usuario_destino INT REFERENCES public.usuario(id_usuario),
  ADD COLUMN IF NOT EXISTS id_especialidad_destino INT REFERENCES public.especialidad(id_especialidad),
  ADD COLUMN IF NOT EXISTS especialidad_destino_texto VARCHAR(255),
  ADD COLUMN IF NOT EXISTS medico_destino_externo VARCHAR(255),
  ADD COLUMN IF NOT EXISTS motivo TEXT,
  ADD COLUMN IF NOT EXISTS resumen_clinico TEXT,
  ADD COLUMN IF NOT EXISTS urgencia VARCHAR(10),
  ADD COLUMN IF NOT EXISTS fecha_limite DATE,
  ADD COLUMN IF NOT EXISTS estado VARCHAR(30),
  ADD COLUMN IF NOT EXISTS id_cita_generada INT REFERENCES public.cita(id_cita),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE public.interconsulta
  DROP CONSTRAINT IF EXISTS interconsulta_estado_check;

UPDATE public.interconsulta
SET estado = CASE
  WHEN estado = 'pendiente' THEN 'PENDIENTE_AGENDAR'
  WHEN estado = 'en_proceso' THEN 'AGENDADA'
  WHEN estado = 'atendida' THEN 'ATENDIDO'
  WHEN estado = 'cancelada' THEN 'RECHAZADA'
  WHEN estado IS NULL THEN 'PENDIENTE_AGENDAR'
  ELSE estado
END;

UPDATE public.interconsulta
SET numero_interconsulta = nextval('interconsulta_numero_seq')
WHERE numero_interconsulta IS NULL OR numero_interconsulta <= 0;

ALTER TABLE public.interconsulta
  ALTER COLUMN numero_interconsulta SET NOT NULL,
  ALTER COLUMN numero_interconsulta SET DEFAULT nextval('interconsulta_numero_seq'),
  ALTER COLUMN tipo_destino SET NOT NULL,
  ALTER COLUMN motivo SET NOT NULL,
  ALTER COLUMN urgencia SET DEFAULT 'normal',
  ALTER COLUMN urgencia SET NOT NULL,
  ALTER COLUMN estado SET DEFAULT 'PENDIENTE_AGENDAR',
  ALTER COLUMN estado SET NOT NULL;

ALTER TABLE public.interconsulta
  ADD CONSTRAINT interconsulta_estado_check
    CHECK (estado IN ('ATENDIDO', 'PENDIENTE_AGENDAR', 'AGENDADA', 'RECHAZADA'));

ALTER TABLE public.interconsulta
  DROP CONSTRAINT IF EXISTS interconsulta_tipo_destino_check,
  ADD CONSTRAINT interconsulta_tipo_destino_check
    CHECK (tipo_destino IN ('interno', 'externo'));

ALTER TABLE public.interconsulta
  DROP CONSTRAINT IF EXISTS interconsulta_urgencia_check,
  ADD CONSTRAINT interconsulta_urgencia_check
    CHECK (urgencia IN ('normal', 'urgente'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_interconsulta_numero_unique ON public.interconsulta(numero_interconsulta);
CREATE UNIQUE INDEX IF NOT EXISTS idx_interconsulta_consulta_unique
  ON public.interconsulta(id_consulta_medica)
  WHERE id_consulta_medica IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interconsulta_consulta ON public.interconsulta(id_consulta_medica);
CREATE INDEX IF NOT EXISTS idx_interconsulta_paciente ON public.interconsulta(id_paciente);
CREATE INDEX IF NOT EXISTS idx_interconsulta_solicitante ON public.interconsulta(id_usuario_solicitante);
CREATE INDEX IF NOT EXISTS idx_interconsulta_destino ON public.interconsulta(id_usuario_destino);
CREATE INDEX IF NOT EXISTS idx_interconsulta_estado ON public.interconsulta(estado);

CREATE OR REPLACE FUNCTION set_interconsulta_numero_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_interconsulta IS NULL OR NEW.numero_interconsulta <= 0 THEN
    NEW.numero_interconsulta := nextval('interconsulta_numero_seq');
  END IF;

  IF NEW.estado IS NULL OR NEW.estado = '' THEN
    NEW.estado := 'PENDIENTE_AGENDAR';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_interconsulta_numero_default ON public.interconsulta;
CREATE TRIGGER trg_set_interconsulta_numero_default
BEFORE INSERT ON public.interconsulta
FOR EACH ROW
EXECUTE FUNCTION set_interconsulta_numero_default();

DROP TRIGGER IF EXISTS update_interconsulta_updated_at ON public.interconsulta;
CREATE TRIGGER update_interconsulta_updated_at
BEFORE UPDATE ON public.interconsulta
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.interconsulta DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.interconsulta IS 'Interconsultas generadas desde consulta medica';
COMMENT ON COLUMN public.interconsulta.numero_interconsulta IS 'Numero secuencial visible para impresion de interconsulta';
COMMENT ON COLUMN public.interconsulta.estado IS 'Estados: ATENDIDO, PENDIENTE_AGENDAR, AGENDADA, RECHAZADA';

NOTIFY pgrst, 'reload schema';
