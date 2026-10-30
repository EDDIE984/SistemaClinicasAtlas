-- ============================================
-- 075: Maternidad — valores del formato Excel en todas las aseguradoras
-- Copia el presupuesto de "OTRA / PARTICULAR" (valores de
-- docs/formatos-cotizaciones/MATERNIDAD-PARTICULAR.xlsx, cargados en 074:
-- Cesárea $1.130 + anestesiólogo $260 = $1.390, abono $850 · Parto normal $770, abono $600)
-- a cada aseguradora que todavía NO tiene presupuesto propio.
-- No sobrescribe las aseguradoras que ya tienen valores guardados.
-- Requiere haber corrido 074. Después cada aseguradora se ajusta en
-- Aseguradoras Maternidad → Cotización.
-- ============================================

UPDATE public.maternidad_aseguradora destino
SET config_cotizacion = COALESCE(destino.config_cotizacion, '{}'::jsonb)
                        || jsonb_build_object('presupuesto', origen.config_cotizacion -> 'presupuesto'),
    updated_at = NOW()
FROM (
  SELECT config_cotizacion
  FROM public.maternidad_aseguradora
  WHERE UPPER(nombre) LIKE '%PARTICULAR%'
    AND config_cotizacion -> 'presupuesto' IS NOT NULL
  ORDER BY id_aseguradora_mat
  LIMIT 1
) origen
WHERE destino.config_cotizacion -> 'presupuesto' IS NULL;

-- Verificación: todas deben mostrar CESÁREA y PARTO NORMAL
SELECT a.nombre,
       p ->> 'procedimiento'        AS procedimiento,
       (p ->> 'clinica')::NUMERIC   AS clinica,
       (p ->> 'abono')::NUMERIC     AS abono
FROM public.maternidad_aseguradora a,
     jsonb_array_elements(a.config_cotizacion -> 'presupuesto' -> 'procedimientos') p
ORDER BY a.orden, procedimiento;

NOTIFY pgrst, 'reload schema';
