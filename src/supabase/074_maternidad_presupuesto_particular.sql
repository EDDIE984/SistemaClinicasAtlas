-- ============================================
-- 074: Maternidad — presupuesto de la aseguradora "OTRA / PARTICULAR"
-- Valores tomados de docs/formatos-cotizaciones/MATERNIDAD-PARTICULAR.xlsx
-- (Cesárea $1.130 + anestesiólogo $260 = $1.390, abono $850 · Parto normal $770, abono $600).
-- Se usa cuando la paciente no tiene seguro o su aseguradora no está en la lista.
-- Los valores se editan después en Aseguradoras Maternidad → Cotización
-- (se guardan en config_cotizacion.presupuesto, el PDF se arma desde ahí).
-- Se carga en la aseguradora cuyo nombre contiene PARTICULAR (si aún no tiene presupuesto);
-- si no existe ninguna, se crea "OTRA / PARTICULAR".
-- ============================================

DO $$
DECLARE
  v_config JSONB := '{
  "presupuesto": {
    "especialidad": "GINECÓLOGO",
    "firma": {
      "nombre": "Valeria Quezada",
      "cargo": "Presupuestos",
      "telefono": "0988400810"
    },
    "adicionales": [
      {
        "concepto": "Tamizaje neonatal metabólico + fibrosis",
        "valor": 99
      },
      {
        "concepto": "Tamizaje neonatal metabólico",
        "valor": 88
      },
      {
        "concepto": "Tamizaje auditivo:",
        "valor": 38
      },
      {
        "grupo": "Laboratorios:",
        "concepto": "Coombs directo\nGrupo y factor",
        "valor": 31
      },
      {
        "concepto": "Monitoreo Fetal",
        "valor": 30
      }
    ],
    "procedimientos": [
      {
        "procedimiento": "CESÁREA",
        "internacion": "3 DÍAS - 2 NOCHES",
        "clinica": 1130,
        "incluye": [
          "HABITACIÓN INDIVIDUAL :  3 DÍAS - 2 NOCHES",
          "ALIMENTACIÓN: (5 COMIDAS DIARIAS)",
          "ADMINISTRACIÓN DE MEDICAMENTOS",
          "SERVICIO DE HOSPITALIZACIÓN",
          "DERECHO  DE QUIRÓFANO (1 HORA USO DE QUIRÓFANO )",
          "MEDICINAS E INSUMOS",
          "SERVICIO DE NEONATOLOGÍA (CUIDADO DE RUTINA)",
          "ASESORIA EN LACTANCIA MATERNA, CUIDADO Y MANEJO DEL RECIEN NACIDO"
        ],
        "honorarios": [
          {
            "concepto": "HONORARIOS MÉDICO CIRUJANO",
            "valor": null
          },
          {
            "concepto": "HONORARIOS MÉDICO AYUDANTE",
            "valor": null
          },
          {
            "concepto": "HONORARIOS  MÉDICO PEDIATRA",
            "valor": null
          },
          {
            "concepto": "HONORARIOS  ANESTESIÓLOGO",
            "valor": 260
          }
        ],
        "notas": [
          "Los valores son aproximados y pueden variar de acuerdo al tiempo y complejidad de cada procedimiento,  estado del paciente o decisión del Médico Tratante.",
          "No incluye: Honorarios médicos Cirujano, Ayudante, Pediatra, exámenes de laboratorio, imagen, patología.",
          "Tarifa promocional y valor preferencial aplicable para pagos en efectivo o transferencia."
        ],
        "abono": 850
      },
      {
        "procedimiento": "PARTO NORMAL",
        "internacion": "2 DÍAS - 1 NOCHE",
        "clinica": 770,
        "incluye": [
          "HABITACIÓN:  2 DÍAS - 1 NOCHE",
          "ALIMENTACIÓN: (5 COMIDAS DIARIAS)",
          "ADMINISTRACIÓN DE MEDICAMENTOS",
          "SERVICIO DE CLÍNICA",
          "DERECHO SALA DE PARTO",
          "SERVICIO SALA DE PARTO",
          "MEDICINAS E INSUMOS",
          "SERVICIO DE NEONATOLOGÍA (CUIDADO DE RUTINA)",
          "ASESORIA EN LACTANCIA MATERNA, CUIDADO Y MANEJO DEL RECIEN NACIDO"
        ],
        "honorarios": [
          {
            "concepto": "HONORARIOS MÉDICO CIRUJANO",
            "valor": null
          },
          {
            "concepto": "HONORARIOS  PEDIATRA",
            "valor": null
          }
        ],
        "notas": [
          "Los valores son aproximados y pueden variar de acuerdo a la complejidad de cada procedimiento,  estado del paciente o decisión del Médico Tratante.",
          "No incluye: Honorarios médicos Ginecologo, Pediatra, exámenes de laboratorio, imagen, patología.",
          "Tarifa promocional y valor preferencial aplicable para pagos en efectivo o transferencia."
        ],
        "abono": 600
      }
    ]
  }
}'::jsonb;
  v_actualizadas INTEGER;
BEGIN
  -- Reutiliza la aseguradora particular si ya fue creada desde la pantalla (p. ej. "OTRA / PARTICULAR")
  UPDATE public.maternidad_aseguradora
  SET config_cotizacion = COALESCE(config_cotizacion, '{}'::jsonb) || v_config,
      updated_at = NOW()
  WHERE UPPER(nombre) LIKE '%PARTICULAR%'
    AND (config_cotizacion -> 'presupuesto') IS NULL;
  GET DIAGNOSTICS v_actualizadas = ROW_COUNT;

  IF v_actualizadas = 0 AND NOT EXISTS (
    SELECT 1 FROM public.maternidad_aseguradora WHERE UPPER(nombre) LIKE '%PARTICULAR%'
  ) THEN
    INSERT INTO public.maternidad_aseguradora (nombre, orden, config_cotizacion)
    VALUES ('OTRA / PARTICULAR', 99, v_config);
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
