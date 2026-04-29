-- Migración: Secuencial de Receta Médica
-- Ejecutar en Supabase SQL Editor

-- 1. Crear secuencia independiente para numeración de recetas
CREATE SEQUENCE IF NOT EXISTS public.seq_receta_medica
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

-- 2. Agregar columna numero_receta a consulta_medica (nullable hasta primera impresión)
ALTER TABLE public.consulta_medica
  ADD COLUMN IF NOT EXISTS numero_receta INTEGER;

-- 3. Función RPC: obtiene o asigna el numero_receta de una consulta
--    - Si ya tiene número, lo devuelve sin modificar
--    - Si no tiene, toma nextval de la secuencia, lo guarda y lo devuelve
CREATE OR REPLACE FUNCTION public.get_or_assign_numero_receta(p_id_consulta integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_numero integer;
BEGIN
  SELECT numero_receta INTO v_numero
  FROM public.consulta_medica
  WHERE id_consulta_medica = p_id_consulta;

  IF v_numero IS NULL THEN
    v_numero := nextval('public.seq_receta_medica');
    UPDATE public.consulta_medica
    SET numero_receta = v_numero
    WHERE id_consulta_medica = p_id_consulta;
  END IF;

  RETURN v_numero;
END;
$$;
