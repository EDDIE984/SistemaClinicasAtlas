-- =====================================================
-- ORIGEN DE AGENDAMIENTO EN CITA_SERVICIO
-- Igual que cita.origen_agendamiento (ADD_ORIGEN_AGENDAMIENTO_CITA.sql):
--   'SISTEMA' = agendada directamente en el sistema (valor por defecto)
--   'CHATBOT' = agendada a partir de una solicitud del chatbot
-- =====================================================

ALTER TABLE public.cita_servicio
ADD COLUMN IF NOT EXISTS origen_agendamiento VARCHAR(20);

-- Citas de servicio vinculadas a una conversación del chatbot
UPDATE public.cita_servicio cs
SET origen_agendamiento = 'CHATBOT'
FROM public.conversacion_chatbot cc
WHERE cc.id_cita_servicio = cs.id_cita_servicio
  AND cs.origen_agendamiento IS NULL;

-- Resto de registros existentes
UPDATE public.cita_servicio
SET origen_agendamiento = 'SISTEMA'
WHERE origen_agendamiento IS NULL;

ALTER TABLE public.cita_servicio
ALTER COLUMN origen_agendamiento SET DEFAULT 'SISTEMA';

ALTER TABLE public.cita_servicio
ALTER COLUMN origen_agendamiento SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cita_servicio_origen_agendamiento_check'
  ) THEN
    ALTER TABLE public.cita_servicio
    ADD CONSTRAINT cita_servicio_origen_agendamiento_check
    CHECK (origen_agendamiento IN ('SISTEMA', 'CHATBOT'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cita_servicio_origen_agendamiento
  ON public.cita_servicio(origen_agendamiento);

-- Recargar el caché de esquema de PostgREST para que la API vea la columna nueva
NOTIFY pgrst, 'reload schema';
