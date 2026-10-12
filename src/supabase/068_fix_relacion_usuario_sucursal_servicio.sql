-- =====================================================
-- 068 - Corrige la relación usuario_sucursal -> servicio
-- =====================================================
-- Ejecutar en Supabase SQL Editor.
--
-- PostgREST reportaba error al intentar embeber `servicio` en consultas sobre
-- `usuario_sucursal` ("Could not find a relationship between 'usuario_sucursal'
-- and 'servicio' in the schema cache"). La migración 057 ya crea este
-- constraint, pero puede no haberse ejecutado en este entorno o el cache de
-- esquema de PostgREST haber quedado desactualizado tras algún cambio
-- posterior. Este script es idempotente: re-asegura el constraint si falta y
-- fuerza a PostgREST a recargar su caché de esquema.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'usuario_sucursal'
      AND constraint_name = 'usuario_sucursal_id_servicio_fkey'
  ) THEN
    ALTER TABLE public.usuario_sucursal
      ADD CONSTRAINT usuario_sucursal_id_servicio_fkey
      FOREIGN KEY (id_servicio)
      REFERENCES public.servicio(id_servicio)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Fuerza a PostgREST a recargar su caché de esquema (necesario para que
-- reconozca el constraint sin tener que reiniciar el proyecto de Supabase).
NOTIFY pgrst, 'reload schema';
