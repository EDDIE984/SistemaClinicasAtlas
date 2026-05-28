-- =====================================================
-- 055 - Servicios por Sucursal
-- =====================================================
-- Ejecutar en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.servicio (
  id_servicio SERIAL PRIMARY KEY,
  id_sucursal INTEGER NOT NULL REFERENCES public.sucursal(id_sucursal) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  area VARCHAR(150) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servicio_id_sucursal
  ON public.servicio(id_sucursal);

CREATE INDEX IF NOT EXISTS idx_servicio_estado
  ON public.servicio(estado);

CREATE UNIQUE INDEX IF NOT EXISTS uq_servicio_sucursal_area_descripcion
  ON public.servicio(id_sucursal, area, lower(descripcion));

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_servicio_updated_at ON public.servicio;
CREATE TRIGGER update_servicio_updated_at
  BEFORE UPDATE ON public.servicio
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.servicio IS 'Servicios disponibles por sucursal';
COMMENT ON COLUMN public.servicio.descripcion IS 'Descripcion del servicio ofrecido';
COMMENT ON COLUMN public.servicio.area IS 'Area interna o clinica asociada al servicio';
