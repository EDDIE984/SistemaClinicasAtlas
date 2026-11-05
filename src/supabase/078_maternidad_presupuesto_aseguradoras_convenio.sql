-- ============================================
-- 078: Maternidad — presupuesto de cada aseguradora en convenio
-- Valores tomados de docs/formatos-cotizaciones/PARTO - CESAREA  - SEGUROS MEDICOS EN CONVENIO - CELESTE.xlsx
-- (una hoja por aseguradora; solo filas visibles).
--   Cesárea:      clínica $1.125 + anestesiólogo (según aseguradora); cirujano, ayudante y pediatra A CONVENIR
--   Parto normal: clínica $750; ginecólogo y pediatra A CONVENIR
--   Adicionales:  tamizajes $88 / $99 / $38 + Coombs directo y grupo y factor (según aseguradora)
--   Sin abono; nota de verificación de cobertura con la aseguradora; "Seguro Privado : …" en el PDF.
-- Sobrescribe config_cotizacion.presupuesto de estas aseguradoras (la 075 les había copiado el de
-- OTRA / PARTICULAR). No toca OTRA / PARTICULAR ni las demás claves de config_cotizacion.
-- Se empareja por nombre sin espacios ni signos (p. ej. "Plan Vital" = PLANVITAL).
-- Después cada aseguradora se ajusta en Aseguradoras Maternidad → Cotización.
-- ============================================

WITH valores (clave, seguro, anestesiologo, coombs) AS (
  VALUES
    ('HUMANA',           'HUMANA',            167.47, 17.00),
    ('PLUSMEDICAL',      'PLUS MEDICAL',      192.85, 24.04),
    ('CONFIAMED',        'CONFIAMED',         167.48, 13.60),
    ('ALLIANZCARE',      'ALLIANZ CARE',      218.23, 36.90),
    ('ALPHAPLUS',        'ALPHA PLUS',        203.00, 36.90),
    ('ASISKEN',          'ASISKEN',           218.23, 17.00),
    ('PANAMERICANLIFE',  'PALIG',             197.93, 17.00),
    ('PALIG',            'PALIG',             197.93, 17.00),
    ('PLANVITAL',        'PLAN VITAL',        197.93, 17.00),
    ('PRIVILEGIO',       'PRIVILEGIO',        203.00, 31.00),
    ('PROASSISLIFE',     'PROASSISLIFE',      218.23, 17.00),
    ('TECNISEGUROS',     'TECNISEGUROS',      218.23, 17.00),
    ('VIDABUENA',        'VIDA BUENA',        177.63, 25.00),
    ('VUMILATINA',       'VUMI LATINA',       218.23, 31.00),
    ('AIGMETROPOLITANA', 'AIG METROPOLITANA', 218.23, 31.00)
),
presupuestos AS (
  SELECT
    v.clave,
    jsonb_build_object(
      'especialidad', 'GINECÓLOGO',
      'seguro', v.seguro,
      'firma', jsonb_build_object('nombre', 'Valeria Quezada', 'cargo', 'Presupuestos', 'telefono', '0988400810'),
      'adicionales', jsonb_build_array(
        jsonb_build_object('concepto', 'Tamizaje neonatal metabólico', 'valor', 88),
        jsonb_build_object('concepto', 'Tamizaje neonatal metabólico + fibrosis', 'valor', 99),
        jsonb_build_object('concepto', 'Tamizaje auditivo:', 'valor', 38),
        jsonb_build_object('grupo', 'Laboratorios:', 'concepto', E'Coombs directo\nGrupo y factor', 'valor', v.coombs)
      ),
      'procedimientos', jsonb_build_array(
        jsonb_build_object(
          'procedimiento', 'CESÁREA',
          'internacion', '3 DÍAS - 2 NOCHES',
          'clinica', 1125,
          'incluye', jsonb_build_array(
            'HABITACIÓN:  3 DÍAS - 2 NOCHES',
            'ALIMENTACIÓN: (5 COMIDAS DIARIAS)',
            'ADMINISTRACIÓN DE MEDICAMENTOS',
            'SERVICIO DE HOSPITALIZACIÓN',
            'DERECHO  DE QUIRÓFANO (1 HORA USO DE QUIRÓFANO )',
            'MEDICINAS E INSUMOS',
            'SERVICIO DE NEONATOLOGÍA (CUIDADO DE RUTINA)',
            'ASESORIA EN LACTANCIA MATERNA'
          ),
          'honorarios', jsonb_build_array(
            jsonb_build_object('concepto', 'HONORARIOS MÉDICO CIRUJANO', 'valor', NULL),
            jsonb_build_object('concepto', 'HONORARIOS MÉDICO AYUDANTE', 'valor', NULL),
            jsonb_build_object('concepto', 'HONORARIOS  PEDIATRA', 'valor', NULL),
            jsonb_build_object('concepto', 'HONORARIOS  ANESTESIÓLOGO', 'valor', v.anestesiologo)
          ),
          'notas', jsonb_build_array(
            'Los valores son aproximados y pueden variar de acuerdo a la complejidad de cada procedimiento,  estado del paciente o decisión del Médico Tratante.',
            'No incluye: Honorarios médico ginecólogo, ayudante, pediatra, exámenes laboratorio, imagen, patología.',
            'Le recomendamos verificar con su compañía de seguros el monto de cobertura disponible para su beneficio de maternidad antes de su ingreso. La autorización de cobertura y los valores reconocidos serán determinados exclusivamente por la aseguradora, de acuerdo con las condiciones, límites y beneficios establecidos en su póliza vigente.'
          ),
          'abono', NULL
        ),
        jsonb_build_object(
          'procedimiento', 'PARTO NORMAL',
          'internacion', '2 DÍAS - 1 NOCHE',
          'clinica', 750,
          'incluye', jsonb_build_array(
            'HABITACIÓN:  2 DÍAS - 1 NOCHE',
            'ALIMENTACIÓN: (5 COMIDAS DIARIAS)',
            'ADMINISTRACIÓN DE MEDICAMENTOS',
            'SERVICIO DE CLÍNICA',
            'DERECHO SALA DE PARTO',
            'SERVICIO SALA DE PARTO',
            'MEDICINAS E INSUMOS',
            'SERVICIO DE NEONATOLOGÍA (CUIDADO DE RUTINA)',
            'ASESORIA EN LACTANCIA MATERNA'
          ),
          'honorarios', jsonb_build_array(
            jsonb_build_object('concepto', 'HONORARIO MÉDICO GINECÓLOGO', 'valor', NULL),
            jsonb_build_object('concepto', 'HONORARIOS  PEDIATRA', 'valor', NULL)
          ),
          'notas', jsonb_build_array(
            'Los valores son aproximados y pueden variar de acuerdo a la complejidad de cada procedimiento,  estado del paciente o decisión del Médico Tratante.',
            'No incluye: Honorarios médico ginecólogo, pediatra, exámenes laboratorio, imagen, patología.',
            'Le recomendamos verificar con su compañía de seguros el monto de cobertura disponible para su beneficio de maternidad antes de su ingreso. La autorización de cobertura y los valores reconocidos serán determinados exclusivamente por la aseguradora, de acuerdo con las condiciones, límites y beneficios establecidos en su póliza vigente.'
          ),
          'abono', NULL
        )
      )
    ) AS presupuesto
  FROM valores v
)
UPDATE public.maternidad_aseguradora a
SET config_cotizacion = COALESCE(a.config_cotizacion, '{}'::jsonb) || jsonb_build_object('presupuesto', p.presupuesto),
    updated_at = NOW()
FROM presupuestos p
WHERE UPPER(regexp_replace(a.nombre, '[^A-Za-z0-9]', '', 'g')) = p.clave;

-- Verificación 1: cada aseguradora en convenio con CESÁREA y PARTO NORMAL y su total
SELECT a.nombre,
       a.config_cotizacion -> 'presupuesto' ->> 'seguro' AS seguro,
       p ->> 'procedimiento'                            AS procedimiento,
       (p ->> 'clinica')::NUMERIC
         + COALESCE((SELECT SUM((h ->> 'valor')::NUMERIC)
                     FROM jsonb_array_elements(p -> 'honorarios') h
                     WHERE h ->> 'valor' IS NOT NULL), 0) AS total
FROM public.maternidad_aseguradora a,
     jsonb_array_elements(a.config_cotizacion -> 'presupuesto' -> 'procedimientos') p
WHERE a.config_cotizacion -> 'presupuesto' ->> 'seguro' IS NOT NULL
ORDER BY a.orden, procedimiento;

-- Verificación 2: aseguradoras que NO quedaron con formato de convenio (debería salir solo OTRA / PARTICULAR)
SELECT nombre, estado
FROM public.maternidad_aseguradora
WHERE config_cotizacion -> 'presupuesto' ->> 'seguro' IS NULL
ORDER BY orden;

NOTIFY pgrst, 'reload schema';
