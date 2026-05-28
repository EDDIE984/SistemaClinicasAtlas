-- =====================================================
-- 057 - Servicio asignado por usuario-sucursal
-- =====================================================
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE public.usuario_sucursal
  ADD COLUMN IF NOT EXISTS id_servicio INTEGER;

-- Garantiza que cada sucursal con usuarios tenga el servicio base de consulta externa.
INSERT INTO public.servicio (id_sucursal, area, descripcion, estado)
SELECT DISTINCT us.id_sucursal, 'CONSULTA_EXTERNA', 'CONSULTA EXTERNA', 'activo'
FROM public.usuario_sucursal us
WHERE NOT EXISTS (
  SELECT 1
  FROM public.servicio s
  WHERE s.id_sucursal = us.id_sucursal
    AND upper(s.area) = 'CONSULTA_EXTERNA'
    AND upper(s.descripcion) = 'CONSULTA EXTERNA'
);

-- Asigna CONSULTA EXTERNA a todos los registros existentes.
UPDATE public.usuario_sucursal us
SET id_servicio = s.id_servicio
FROM public.servicio s
WHERE s.id_sucursal = us.id_sucursal
  AND upper(s.area) = 'CONSULTA_EXTERNA'
  AND upper(s.descripcion) = 'CONSULTA EXTERNA'
  AND us.id_servicio IS NULL;

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

CREATE INDEX IF NOT EXISTS idx_usuario_sucursal_id_servicio
  ON public.usuario_sucursal(id_servicio);

COMMENT ON COLUMN public.usuario_sucursal.id_servicio IS 'Servicio asignado al usuario dentro de la sucursal';
