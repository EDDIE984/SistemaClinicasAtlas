-- ============================================
-- SOLICITUD DE IMAGEN
-- Nueva tabla para solicitudes vinculadas a cita
-- ============================================

CREATE SEQUENCE IF NOT EXISTS solicitud_imagen_numero_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS solicitud_imagen (
  id_solicitud_imagen SERIAL PRIMARY KEY,
  numero_solicitud_imagen BIGINT NOT NULL UNIQUE DEFAULT nextval('solicitud_imagen_numero_seq'),
  id_cita INTEGER NOT NULL UNIQUE REFERENCES cita(id_cita) ON DELETE CASCADE,
  id_paciente INTEGER NOT NULL REFERENCES paciente(id_paciente) ON DELETE CASCADE,
  id_sucursal INTEGER NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
  id_usuario_solicitante INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
  fecha_solicitud DATE NOT NULL DEFAULT CURRENT_DATE,
  nombre_paciente VARCHAR(220) NOT NULL,
  edad_paciente INTEGER,
  procedimiento TEXT,
  antecedentes_clinico_quirurgico TEXT,
  cuadro_clinico TEXT,
  medicamentos TEXT,
  alergias TEXT,
  firma TEXT,
  sello TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'anulada')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitud_imagen_cita ON solicitud_imagen(id_cita);
CREATE INDEX IF NOT EXISTS idx_solicitud_imagen_paciente ON solicitud_imagen(id_paciente);
CREATE INDEX IF NOT EXISTS idx_solicitud_imagen_sucursal ON solicitud_imagen(id_sucursal);
CREATE INDEX IF NOT EXISTS idx_solicitud_imagen_fecha ON solicitud_imagen(fecha_solicitud);
CREATE INDEX IF NOT EXISTS idx_solicitud_imagen_numero ON solicitud_imagen(numero_solicitud_imagen);

CREATE OR REPLACE FUNCTION set_solicitud_imagen_numero_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_solicitud_imagen IS NULL OR NEW.numero_solicitud_imagen <= 0 THEN
    NEW.numero_solicitud_imagen := nextval('solicitud_imagen_numero_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_solicitud_imagen_numero_default ON solicitud_imagen;
CREATE TRIGGER trg_set_solicitud_imagen_numero_default
BEFORE INSERT ON solicitud_imagen
FOR EACH ROW
EXECUTE FUNCTION set_solicitud_imagen_numero_default();

DROP TRIGGER IF EXISTS update_solicitud_imagen_updated_at ON solicitud_imagen;
CREATE TRIGGER update_solicitud_imagen_updated_at
BEFORE UPDATE ON solicitud_imagen
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE solicitud_imagen IS 'Solicitudes de imagen diagnóstica generadas desde consulta médica';
COMMENT ON COLUMN solicitud_imagen.numero_solicitud_imagen IS 'Número secuencial interno de la solicitud de imagen';
COMMENT ON COLUMN solicitud_imagen.id_cita IS 'Relación única de la solicitud con la cita médica';
