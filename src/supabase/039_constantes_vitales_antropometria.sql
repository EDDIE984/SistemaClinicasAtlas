-- 039_constantes_vitales_antropometria.sql
-- Amplia la tabla signo_vital para soportar el formulario de constantes vitales y antropometria.

BEGIN;

ALTER TABLE IF EXISTS public.signo_vital DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.signo_vital
  ADD COLUMN IF NOT EXISTS perimetro_cefalico_cm NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS glucosa_mg_dl INTEGER,
  ADD COLUMN IF NOT EXISTS glasgow_ocular INTEGER,
  ADD COLUMN IF NOT EXISTS glasgow_verbal INTEGER,
  ADD COLUMN IF NOT EXISTS glasgow_motora INTEGER,
  ADD COLUMN IF NOT EXISTS reaccion_pupilar VARCHAR(50),
  ADD COLUMN IF NOT EXISTS tiempo_llenado_capilar_seg NUMERIC(4,2);

ALTER TABLE public.signo_vital
  DROP CONSTRAINT IF EXISTS chk_signo_vital_glasgow_ocular,
  DROP CONSTRAINT IF EXISTS chk_signo_vital_glasgow_verbal,
  DROP CONSTRAINT IF EXISTS chk_signo_vital_glasgow_motora;

ALTER TABLE public.signo_vital
  ADD CONSTRAINT chk_signo_vital_glasgow_ocular
    CHECK (glasgow_ocular IS NULL OR glasgow_ocular BETWEEN 1 AND 4),
  ADD CONSTRAINT chk_signo_vital_glasgow_verbal
    CHECK (glasgow_verbal IS NULL OR glasgow_verbal BETWEEN 1 AND 5),
  ADD CONSTRAINT chk_signo_vital_glasgow_motora
    CHECK (glasgow_motora IS NULL OR glasgow_motora BETWEEN 1 AND 6);

COMMENT ON COLUMN public.signo_vital.perimetro_cefalico_cm IS 'Perimetro cefalico en centimetros';
COMMENT ON COLUMN public.signo_vital.glucosa_mg_dl IS 'Glucemia capilar en mg/dL';
COMMENT ON COLUMN public.signo_vital.glasgow_ocular IS 'Escala de Glasgow ocular (1-4)';
COMMENT ON COLUMN public.signo_vital.glasgow_verbal IS 'Escala de Glasgow verbal (1-5)';
COMMENT ON COLUMN public.signo_vital.glasgow_motora IS 'Escala de Glasgow motora (1-6)';
COMMENT ON COLUMN public.signo_vital.reaccion_pupilar IS 'Descripcion breve de reaccion pupilar';
COMMENT ON COLUMN public.signo_vital.tiempo_llenado_capilar_seg IS 'Tiempo de llenado capilar en segundos';

COMMIT;
