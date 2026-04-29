-- =====================================================
-- 051 - Campos adicionales de admisión del paciente
-- Formulario basado en ficha de registro/admisión
-- Ejecutar en Supabase SQL Editor
-- =====================================================

ALTER TABLE paciente
  ADD COLUMN IF NOT EXISTS id_sucursal INTEGER REFERENCES sucursal(id_sucursal) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nombre_admisionista VARCHAR(255),
  ADD COLUMN IF NOT EXISTS historia_clinica_establecimiento VARCHAR(2),
  ADD COLUMN IF NOT EXISTS tipo_documento_identificacion VARCHAR(20),
  ADD COLUMN IF NOT EXISTS estado_civil VARCHAR(20),
  ADD COLUMN IF NOT EXISTS telefono_fijo VARCHAR(50),
  ADD COLUMN IF NOT EXISTS lugar_nacimiento VARCHAR(255),
  ADD COLUMN IF NOT EXISTS nacionalidad VARCHAR(100),
  ADD COLUMN IF NOT EXISTS condicion_edad VARCHAR(10),
  ADD COLUMN IF NOT EXISTS grupo_prioritario VARCHAR(2),
  ADD COLUMN IF NOT EXISTS grupo_prioritario_especifique VARCHAR(255),
  ADD COLUMN IF NOT EXISTS autoidentificacion_etnica VARCHAR(100),
  ADD COLUMN IF NOT EXISTS nacionalidad_etnica VARCHAR(100),
  ADD COLUMN IF NOT EXISTS pueblo VARCHAR(100),
  ADD COLUMN IF NOT EXISTS nivel_educacion VARCHAR(100),
  ADD COLUMN IF NOT EXISTS estado_nivel_educacion VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tipo_empresa_trabajo VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ocupacion_profesion VARCHAR(150),
  ADD COLUMN IF NOT EXISTS seguro_salud_principal VARCHAR(50),
  ADD COLUMN IF NOT EXISTS provincia VARCHAR(100),
  ADD COLUMN IF NOT EXISTS canton VARCHAR(100),
  ADD COLUMN IF NOT EXISTS parroquia VARCHAR(100),
  ADD COLUMN IF NOT EXISTS barrio_sector VARCHAR(150),
  ADD COLUMN IF NOT EXISTS calle_principal VARCHAR(150),
  ADD COLUMN IF NOT EXISTS calle_secundaria VARCHAR(150),
  ADD COLUMN IF NOT EXISTS referencia_domicilio VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_parentesco VARCHAR(100),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_direccion VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono VARCHAR(50),
  ADD COLUMN IF NOT EXISTS forma_llegada VARCHAR(50),
  ADD COLUMN IF NOT EXISTS fuente_informacion VARCHAR(150),
  ADD COLUMN IF NOT EXISTS institucion_entrega_paciente VARCHAR(255),
  ADD COLUMN IF NOT EXISTS telefono_institucion_entrega VARCHAR(50);

COMMENT ON COLUMN paciente.nombre_admisionista IS 'Nombre y apellido del admisionista que registra al paciente';
COMMENT ON COLUMN paciente.historia_clinica_establecimiento IS 'Indica si el paciente tiene historia clinica en el establecimiento: SI/NO';
COMMENT ON COLUMN paciente.tipo_documento_identificacion IS 'Tipo de documento: CC/CI, PAS, CARNE, SD';
COMMENT ON COLUMN paciente.estado_civil IS 'Estado civil: SOL, CAS, DIV, VIU, U, UH, NA';
COMMENT ON COLUMN paciente.condicion_edad IS 'Marcador de condicion de edad: H, D, M, A';
COMMENT ON COLUMN paciente.grupo_prioritario IS 'Indica si pertenece a grupo prioritario: SI/NO';
COMMENT ON COLUMN paciente.seguro_salud_principal IS 'Seguro salud principal: IESS-G, IESS-C, ISSPOL, ISSFA, PRIV, NING';
COMMENT ON COLUMN paciente.forma_llegada IS 'Forma de llegada: AMBULATORIO, AMBULANCIA, OTRO_TRANSPORTE';

CREATE INDEX IF NOT EXISTS idx_paciente_estado_civil ON paciente(estado_civil);
CREATE INDEX IF NOT EXISTS idx_paciente_id_sucursal ON paciente(id_sucursal);
CREATE INDEX IF NOT EXISTS idx_paciente_seguro_salud_principal ON paciente(seguro_salud_principal);
CREATE INDEX IF NOT EXISTS idx_paciente_provincia_canton ON paciente(provincia, canton);

-- Fuerza a PostgREST/Supabase a refrescar la cache del esquema.
-- Es util cuando aparece: "Could not find the ... column of ... in the schema cache".
NOTIFY pgrst, 'reload schema';
