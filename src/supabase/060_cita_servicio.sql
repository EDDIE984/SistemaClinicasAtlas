-- ============================================
-- 060: Tabla cita_servicio
-- Citas agendadas para servicios (independiente de la tabla cita de médicos)
-- ============================================

CREATE TABLE IF NOT EXISTS public.cita_servicio (
  id_cita_servicio    SERIAL PRIMARY KEY,
  id_horario_servicio INTEGER NOT NULL REFERENCES public.horario_servicio(id_horario_servicio) ON DELETE RESTRICT,
  id_servicio         INTEGER NOT NULL REFERENCES public.servicio(id_servicio) ON DELETE RESTRICT,
  id_paciente         INTEGER NOT NULL REFERENCES public.paciente(id_paciente) ON DELETE RESTRICT,
  id_sucursal         INTEGER NOT NULL REFERENCES public.sucursal(id_sucursal) ON DELETE RESTRICT,
  fecha_cita          DATE NOT NULL,
  hora_inicio         TIME NOT NULL,
  hora_fin            TIME NOT NULL,
  motivo              TEXT,
  estado_cita         VARCHAR(20) NOT NULL DEFAULT 'agendada'
                        CHECK (estado_cita IN ('agendada','confirmada','en_atencion','atendida','cancelada','no_asistio')),
  precio_cita         DECIMAL(10,2),
  forma_pago          VARCHAR(20) CHECK (forma_pago IN ('efectivo','tarjeta','transferencia','seguro')),
  estado_pago         VARCHAR(20) DEFAULT 'pendiente'
                        CHECK (estado_pago IN ('pendiente','pagado','parcial')),
  notas_cita          TEXT,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT chk_cita_servicio_hora_fin CHECK (hora_fin > hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_cita_servicio_servicio ON public.cita_servicio(id_servicio);
CREATE INDEX IF NOT EXISTS idx_cita_servicio_fecha    ON public.cita_servicio(fecha_cita);
CREATE INDEX IF NOT EXISTS idx_cita_servicio_horario  ON public.cita_servicio(id_horario_servicio);
CREATE INDEX IF NOT EXISTS idx_cita_servicio_paciente ON public.cita_servicio(id_paciente);
CREATE INDEX IF NOT EXISTS idx_cita_servicio_estado   ON public.cita_servicio(estado_cita);

CREATE TRIGGER update_cita_servicio_updated_at
  BEFORE UPDATE ON public.cita_servicio
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.cita_servicio DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.cita_servicio IS 'Citas agendadas para servicios (Tomografía, Rayos X, etc.) — completamente independiente de la tabla cita de médicos';
