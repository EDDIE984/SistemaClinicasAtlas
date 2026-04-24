-- 038_antecedentes_patologicos_personales_familiares.sql
-- Objetivo:
-- 1) Consolidar antecedentes legacy en la nueva categoria:
--    antecedentesPatologicosPersonalesFamiliares
-- 2) Desactivar categorias legacy activas para evitar duplicidad funcional.
-- 3) Limpiar columnas obsoletas de la tabla antecedente.

BEGIN;

-- Convencion del proyecto: RLS deshabilitado.
ALTER TABLE IF EXISTS public.antecedente DISABLE ROW LEVEL SECURITY;

-- 1) Migracion de datos legacy -> nueva categoria funcional
WITH pacientes_con_legacy AS (
  SELECT DISTINCT id_paciente
  FROM public.antecedente
  WHERE categoria IN ('antecedentesPatologicos', 'antecedentesHeredofamiliares')
    AND estado = 'activo'
),
ultimo_patologicos AS (
  SELECT DISTINCT ON (id_paciente)
    id_paciente,
    descripcion::jsonb AS data
  FROM public.antecedente
  WHERE categoria = 'antecedentesPatologicos'
    AND estado = 'activo'
  ORDER BY id_paciente, updated_at DESC NULLS LAST, id_antecedente DESC
),
ultimo_familiares AS (
  SELECT DISTINCT ON (id_paciente)
    id_paciente,
    descripcion::jsonb AS data
  FROM public.antecedente
  WHERE categoria = 'antecedentesHeredofamiliares'
    AND estado = 'activo'
  ORDER BY id_paciente, updated_at DESC NULLS LAST, id_antecedente DESC
),
datos_migrados AS (
  SELECT
    p.id_paciente,
    jsonb_build_object(
      'alergicos', jsonb_build_object('respuesta', '', 'notas', ''),
      'clinicos', jsonb_build_object(
        'respuesta', CASE
          WHEN EXISTS (
            SELECT 1
            FROM jsonb_each_text(COALESCE(up.data->'clinicos', '{}'::jsonb)) kv
            WHERE lower(kv.value) = 'si'
          ) THEN 'si'
          WHEN EXISTS (
            SELECT 1
            FROM jsonb_each_text(COALESCE(up.data->'clinicos', '{}'::jsonb)) kv
            WHERE lower(kv.value) = 'no'
          ) THEN 'no'
          ELSE ''
        END,
        'notas', COALESCE(up.data->>'notaLibreDoctor', '')
      ),
      'ginecologicos', jsonb_build_object('respuesta', '', 'notas', ''),
      'traumatologicos', jsonb_build_object('respuesta', '', 'notas', ''),
      'pediatricos', jsonb_build_object('respuesta', '', 'notas', ''),
      'quirurgicos', jsonb_build_object(
        'respuesta', CASE
          WHEN EXISTS (
            SELECT 1
            FROM jsonb_each_text(COALESCE(up.data->'quirurgicos', '{}'::jsonb)) kv
            WHERE lower(kv.value) = 'si'
          ) THEN 'si'
          WHEN EXISTS (
            SELECT 1
            FROM jsonb_each_text(COALESCE(up.data->'quirurgicos', '{}'::jsonb)) kv
            WHERE lower(kv.value) = 'no'
          ) THEN 'no'
          ELSE ''
        END,
        'notas', ''
      ),
      'farmacologicos', jsonb_build_object('respuesta', '', 'notas', ''),
      'habitos', jsonb_build_object('respuesta', '', 'notas', ''),
      'familiares', jsonb_build_object(
        'respuesta', CASE
          WHEN jsonb_typeof(COALESCE(uf.data->'items', uf.data, '[]'::jsonb)) = 'array'
               AND jsonb_array_length(COALESCE(uf.data->'items', uf.data, '[]'::jsonb)) > 0
            THEN 'si'
          ELSE ''
        END,
        'notas', COALESCE((
          SELECT string_agg(value, ', ')
          FROM jsonb_array_elements_text(COALESCE(uf.data->'items', uf.data, '[]'::jsonb))
        ), '')
      ),
      'otros', jsonb_build_object('respuesta', '', 'notas', '')
    ) AS payload
  FROM pacientes_con_legacy p
  LEFT JOIN ultimo_patologicos up ON up.id_paciente = p.id_paciente
  LEFT JOIN ultimo_familiares uf ON uf.id_paciente = p.id_paciente
)
INSERT INTO public.antecedente (id_paciente, categoria, tipo, descripcion, estado)
SELECT
  d.id_paciente,
  'antecedentesPatologicosPersonalesFamiliares',
  'json',
  d.payload::text,
  'activo'
FROM datos_migrados d
WHERE NOT EXISTS (
  SELECT 1
  FROM public.antecedente a
  WHERE a.id_paciente = d.id_paciente
    AND a.categoria = 'antecedentesPatologicosPersonalesFamiliares'
    AND a.estado = 'activo'
);

-- 2) Desactivar categorias legacy activas (la app ya no las usa para esta pantalla)
UPDATE public.antecedente
SET estado = 'inactivo'
WHERE categoria IN ('antecedentesPatologicos', 'antecedentesHeredofamiliares')
  AND estado = 'activo';

-- 3) Limpieza de columnas no usadas por el modelo actual de persistencia JSON
ALTER TABLE public.antecedente DROP COLUMN IF EXISTS fecha_diagnostico;
ALTER TABLE public.antecedente DROP COLUMN IF EXISTS tratamiento;
ALTER TABLE public.antecedente DROP COLUMN IF EXISTS observaciones;

-- Indice orientado a lectura de ultima version por seccion
CREATE INDEX IF NOT EXISTS idx_antecedente_paciente_categoria_updated
ON public.antecedente (id_paciente, categoria, updated_at DESC);

COMMENT ON COLUMN public.antecedente.descripcion IS
'Contenido serializado JSON de cada seccion (incluye antecedentesPatologicosPersonalesFamiliares)';

COMMIT;
