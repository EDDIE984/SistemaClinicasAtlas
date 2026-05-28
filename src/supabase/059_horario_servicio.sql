-- ============================================
-- 059: Tabla horario_servicio
-- Define disponibilidad semanal por servicio
-- ============================================

CREATE TABLE IF NOT EXISTS public.horario_servicio (
  id_horario_servicio SERIAL PRIMARY KEY,
  id_servicio         INTEGER NOT NULL REFERENCES public.servicio(id_servicio) ON DELETE CASCADE,
  dia_semana          INTEGER NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  hora_inicio         TIME NOT NULL,
  hora_fin            TIME NOT NULL,
  duracion_consulta   INTEGER NOT NULL DEFAULT 30 CHECK (duracion_consulta > 0 AND duracion_consulta <= 480),
  capacidad           INTEGER NOT NULL DEFAULT 1 CHECK (capacidad > 0),
  estado              VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_hora_fin_mayor_inicio CHECK (hora_fin > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_horario_servicio_servicio ON public.horario_servicio(id_servicio);
CREATE INDEX IF NOT EXISTS idx_horario_servicio_dia      ON public.horario_servicio(dia_semana);
CREATE INDEX IF NOT EXISTS idx_horario_servicio_estado   ON public.horario_servicio(estado);

CREATE TRIGGER update_horario_servicio_updated_at
  BEFORE UPDATE ON public.horario_servicio
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.horario_servicio DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.horario_servicio IS 'Horarios semanales de disponibilidad por servicio (independiente de horarios de médicos)';
COMMENT ON COLUMN public.horario_servicio.dia_semana IS '1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado, 7=Domingo';
COMMENT ON COLUMN public.horario_servicio.capacidad IS 'Número máximo de citas simultáneas permitidas en cada slot';
