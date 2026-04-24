-- ============================================
-- MÓDULO INICIAL DE LABORATORIO
-- Catálogo de exámenes + pedido de laboratorio + detalle
-- ============================================

CREATE SEQUENCE IF NOT EXISTS pedido_laboratorio_numero_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS examen_laboratorio (
  id_examen_laboratorio SERIAL PRIMARY KEY,
  categoria VARCHAR(120) NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  descripcion TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_examen_laboratorio_categoria_nombre UNIQUE (categoria, nombre)
);

CREATE TABLE IF NOT EXISTS pedido_laboratorio (
  id_pedido_laboratorio SERIAL PRIMARY KEY,
  numero_pedido_laboratorio BIGINT NOT NULL UNIQUE DEFAULT nextval('pedido_laboratorio_numero_seq'),
  id_cita INTEGER NOT NULL REFERENCES cita(id_cita) ON DELETE CASCADE,
  id_paciente INTEGER NOT NULL REFERENCES paciente(id_paciente) ON DELETE CASCADE,
  id_sucursal INTEGER NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
  id_usuario_solicitante INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
  id_usuario_sucursal_medico INTEGER NOT NULL REFERENCES usuario_sucursal(id_usuario_sucursal) ON DELETE RESTRICT,
  fecha_pedido TIMESTAMP NOT NULL DEFAULT NOW(),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'procesado', 'cancelado')),
  observaciones TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedido_laboratorio_detalle (
  id_pedido_laboratorio_detalle SERIAL PRIMARY KEY,
  id_pedido_laboratorio INTEGER NOT NULL REFERENCES pedido_laboratorio(id_pedido_laboratorio) ON DELETE CASCADE,
  id_examen_laboratorio INTEGER NOT NULL REFERENCES examen_laboratorio(id_examen_laboratorio) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pedido_laboratorio_detalle UNIQUE (id_pedido_laboratorio, id_examen_laboratorio)
);

CREATE INDEX IF NOT EXISTS idx_examen_laboratorio_categoria ON examen_laboratorio(categoria);
CREATE INDEX IF NOT EXISTS idx_examen_laboratorio_estado ON examen_laboratorio(estado);
CREATE INDEX IF NOT EXISTS idx_pedido_laboratorio_cita ON pedido_laboratorio(id_cita);
CREATE INDEX IF NOT EXISTS idx_pedido_laboratorio_paciente ON pedido_laboratorio(id_paciente);
CREATE INDEX IF NOT EXISTS idx_pedido_laboratorio_sucursal ON pedido_laboratorio(id_sucursal);
CREATE INDEX IF NOT EXISTS idx_pedido_laboratorio_fecha ON pedido_laboratorio(fecha_pedido);
CREATE INDEX IF NOT EXISTS idx_pedido_laboratorio_numero ON pedido_laboratorio(numero_pedido_laboratorio);
CREATE INDEX IF NOT EXISTS idx_pedido_laboratorio_detalle_pedido ON pedido_laboratorio_detalle(id_pedido_laboratorio);

CREATE OR REPLACE FUNCTION set_pedido_laboratorio_numero_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_pedido_laboratorio IS NULL OR NEW.numero_pedido_laboratorio <= 0 THEN
    NEW.numero_pedido_laboratorio := nextval('pedido_laboratorio_numero_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_pedido_laboratorio_numero_default ON pedido_laboratorio;
CREATE TRIGGER trg_set_pedido_laboratorio_numero_default
BEFORE INSERT ON pedido_laboratorio
FOR EACH ROW
EXECUTE FUNCTION set_pedido_laboratorio_numero_default();

DROP TRIGGER IF EXISTS update_examen_laboratorio_updated_at ON examen_laboratorio;
CREATE TRIGGER update_examen_laboratorio_updated_at
BEFORE UPDATE ON examen_laboratorio
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pedido_laboratorio_updated_at ON pedido_laboratorio;
CREATE TRIGGER update_pedido_laboratorio_updated_at
BEFORE UPDATE ON pedido_laboratorio
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE examen_laboratorio IS 'Catálogo de mantenimiento de exámenes de laboratorio';
COMMENT ON TABLE pedido_laboratorio IS 'Cabecera de pedidos de laboratorio generados desde la consulta médica';
COMMENT ON TABLE pedido_laboratorio_detalle IS 'Detalle de exámenes solicitados en cada pedido de laboratorio';
COMMENT ON COLUMN pedido_laboratorio.numero_pedido_laboratorio IS 'Número secuencial visible del pedido de laboratorio';

INSERT INTO examen_laboratorio (categoria, nombre)
VALUES
  ('HEMATOLÓGICO', 'Biometría Hemática'),
  ('HEMATOLÓGICO', 'Coombs Directo'),
  ('HEMATOLÓGICO', 'Coombs Indirecto'),
  ('HEMATOLÓGICO', 'Grupo Sanguíneo y Rh'),
  ('HEMATOLÓGICO', 'Hemoglobina / Hematocrito'),
  ('HEMATOLÓGICO', 'Reticulocitos'),
  ('HEMATOLÓGICO', 'Sedimentación (VSG)'),
  ('HEMATOLÓGICO', 'Plaquetas Recuento'),
  ('COAGULACIÓN Y HEMOSTASIA', 'Dímero D'),
  ('COAGULACIÓN Y HEMOSTASIA', 'Fibrinógeno'),
  ('COAGULACIÓN Y HEMOSTASIA', 'T. Coagulación'),
  ('COAGULACIÓN Y HEMOSTASIA', 'T. Protrombina (TP)'),
  ('COAGULACIÓN Y HEMOSTASIA', 'T. Tromboplastina P. (TTP)'),
  ('COAGULACIÓN Y HEMOSTASIA', 'T. Sangría'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'ANA / Anti-DNA'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'Anti DNA (DC)'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'Asto'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'Dengue IgG - IgM'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'Látex - R.F'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'P.C.R Semicuantitativo'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'P.C.R Cuantitativo'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'R.F Bunnel (Monotest)'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'V.D.R.L'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'HIV'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'C3'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'C4'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'IgG'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'IgA'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'IgE'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'IgM'),
  ('INMUNOLOGÍA Y SEROLOGÍA', 'Electroforesis'),
  ('ELECTROLITOS', 'Na'),
  ('ELECTROLITOS', 'K'),
  ('ELECTROLITOS', 'Cl'),
  ('ELECTROLITOS', 'Ca'),
  ('ELECTROLITOS', 'P'),
  ('ELECTROLITOS', 'Mg'),
  ('ELECTROLITOS', 'Ca - Iónico'),
  ('QUÍMICA SANGUÍNEA', 'Ácido úrico'),
  ('QUÍMICA SANGUÍNEA', 'Albúmina / Globulina'),
  ('QUÍMICA SANGUÍNEA', 'Bilirrubina (T. / Dir. / Indirecta)'),
  ('QUÍMICA SANGUÍNEA', 'Colesterol Total'),
  ('QUÍMICA SANGUÍNEA', 'Colesterol HDL - LDL'),
  ('QUÍMICA SANGUÍNEA', 'Creatinina'),
  ('QUÍMICA SANGUÍNEA', 'G. Curva Tolerancia'),
  ('QUÍMICA SANGUÍNEA', 'Glucosa'),
  ('QUÍMICA SANGUÍNEA', 'Glucosa Postprandial'),
  ('QUÍMICA SANGUÍNEA', 'Hierro Sérico'),
  ('QUÍMICA SANGUÍNEA', 'Ferritina'),
  ('QUÍMICA SANGUÍNEA', 'Transferrina'),
  ('QUÍMICA SANGUÍNEA', 'Proteínas Totales'),
  ('QUÍMICA SANGUÍNEA', 'Triglicéridos'),
  ('QUÍMICA SANGUÍNEA', 'Urea'),
  ('QUÍMICA SANGUÍNEA', 'BUN'),
  ('QUÍMICA SANGUÍNEA', 'Vitamina B12'),
  ('QUÍMICA SANGUÍNEA', 'Hemoglobina Glicosilada (HbA1c)'),
  ('ENZIMAS', 'Amilasa'),
  ('ENZIMAS', 'AST (TGO)'),
  ('ENZIMAS', 'ALT (TGP)'),
  ('ENZIMAS', 'CKMB'),
  ('ENZIMAS', 'CPK'),
  ('ENZIMAS', 'F. Ácida'),
  ('ENZIMAS', 'F. Prostática'),
  ('ENZIMAS', 'Fosfatasa Alcalina'),
  ('ENZIMAS', 'Gama G - T'),
  ('ENZIMAS', 'L.D.H (desidrog. L.)'),
  ('ENZIMAS', 'Lipasa'),
  ('ENZIMAS', 'Procalcitonina'),
  ('ENZIMAS', 'Troponina'),
  ('GASOMETRÍA', 'Gasometría Arterial'),
  ('GASOMETRÍA', 'Gasometría Venosa'),
  ('ORINA', 'Elemental y Microscópico'),
  ('ORINA', 'Gota Fresca'),
  ('ORINA', 'Proteinuria'),
  ('ORINA', 'GRAM'),
  ('ORINA', 'Urocultivo'),
  ('ORINA', 'Microalbuminuria'),
  ('HORMONAS', 'Beta - HCG Cuantitativa'),
  ('HORMONAS', 'Beta - HCG Cualitativa'),
  ('HORMONAS', 'Cortisol AM'),
  ('HORMONAS', 'Cortisol Pm'),
  ('HORMONAS', 'Insulina Ayunas'),
  ('HORMONAS', 'Insulina Post Prandial'),
  ('HORMONAS', 'Prolactina'),
  ('HORMONAS', 'Testosterona Total'),
  ('HORMONAS', 'Testosterona Libre'),
  ('HORMONAS', 'FT3'),
  ('HORMONAS', 'FT4'),
  ('HORMONAS', 'TSH'),
  ('HORMONAS', 'T3'),
  ('HORMONAS', 'T4'),
  ('HORMONAS', 'LH'),
  ('HORMONAS', 'FSH'),
  ('HORMONAS', 'E2'),
  ('HORMONAS', 'PSA Total'),
  ('HORMONAS', 'PSA Libre'),
  ('HECES FECALES', 'Azúcares reductores'),
  ('HECES FECALES', 'Coprocultivo'),
  ('HECES FECALES', 'Coproparasitario Seriado'),
  ('HECES FECALES', 'Coproparasitario por Concentración'),
  ('HECES FECALES', 'PH'),
  ('HECES FECALES', 'Polimorfonucleares'),
  ('HECES FECALES', 'Rotavirus'),
  ('HECES FECALES', 'Sangre Oculta'),
  ('HECES FECALES', 'Sudan'),
  ('OTRAS PRUEBAS', 'Alfa Feto Proteina (AFP)'),
  ('OTRAS PRUEBAS', 'B2 Microglobulina'),
  ('OTRAS PRUEBAS', 'CA 125'),
  ('OTRAS PRUEBAS', 'CA 19-9'),
  ('OTRAS PRUEBAS', 'CA 15-3'),
  ('OTRAS PRUEBAS', 'CMV IgG'),
  ('OTRAS PRUEBAS', 'CMV IgM'),
  ('OTRAS PRUEBAS', 'Epstein Bair'),
  ('OTRAS PRUEBAS', 'HAV'),
  ('OTRAS PRUEBAS', 'HBsAg'),
  ('OTRAS PRUEBAS', 'Herpes Virus I'),
  ('OTRAS PRUEBAS', 'Herpes Virus II'),
  ('OTRAS PRUEBAS', 'STORCH'),
  ('OTRAS PRUEBAS', 'Toxoplasma'),
  ('OTRAS PRUEBAS', 'H. Pylori'),
  ('OTRAS PRUEBAS', 'Rubéola'),
  ('OTRAS PRUEBAS', 'Combo P. Rápida SARS-CoV-2, Sincitial respiratorio y influenza A y B'),
  ('OTRAS PRUEBAS', 'Panel de Drogas'),
  ('OTRAS PRUEBAS', 'Tamizaje Neonatal')
ON CONFLICT (categoria, nombre) DO NOTHING;

SELECT
  'Laboratorio inicial creado correctamente' AS status,
  (SELECT COUNT(*) FROM examen_laboratorio) AS total_examenes,
  (SELECT COUNT(*) FROM pedido_laboratorio) AS total_pedidos;