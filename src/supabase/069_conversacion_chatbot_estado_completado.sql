-- Ejecutar solo si el CHECK real de conversacion_chatbot.estado no incluye
-- los estados de cierre usados por las solicitudes del chatbot.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.conversacion_chatbot'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%estado%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.conversacion_chatbot DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.conversacion_chatbot
  ADD CONSTRAINT conversacion_chatbot_estado_check
  CHECK (estado IN ('pendiente', 'completado', 'cancelado'));
