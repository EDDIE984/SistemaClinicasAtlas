-- 043_remove_alergicos_antecedentes_ppf.sql
-- Elimina las claves no requeridas del JSON de antecedentesPatologicosPersonalesFamiliares.

BEGIN;

ALTER TABLE IF EXISTS public.antecedente DISABLE ROW LEVEL SECURITY;

UPDATE public.antecedente
SET descripcion = (
  (descripcion::jsonb - 'alergicos' - 'ginecologicos' - 'farmacologicos' - 'habitos')::text
),
updated_at = NOW()
WHERE categoria = 'antecedentesPatologicosPersonalesFamiliares'
  AND descripcion IS NOT NULL
  AND jsonb_typeof(descripcion::jsonb) = 'object'
  AND (descripcion::jsonb ?| array['alergicos', 'ginecologicos', 'farmacologicos', 'habitos']);

COMMIT;