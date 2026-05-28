-- =====================================================
-- 056 - Insert servicios base
-- =====================================================
-- Insertar en sucursal ID 3.

INSERT INTO public.servicio (id_sucursal, area, descripcion, estado)
VALUES
  (3, 'CONSULTA_EXTERNA', 'CONSULTA EXTERNA', 'activo'),
  (3, 'IMAGEN', 'Tomografía', 'activo'),
  (3, 'IMAGEN', 'Rayos X', 'activo'),
  (3, 'IMAGEN', 'Resonancia magnética', 'activo'),
  (3, 'IMAGEN', 'Colongioresonancia', 'activo')
ON CONFLICT DO NOTHING;
