-- =====================================================
-- 058 - Tipos de usuario para modulo de imagen
-- =====================================================
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE public.usuario
  DROP CONSTRAINT IF EXISTS usuario_tipo_usuario_check;

ALTER TABLE public.usuario
  ADD CONSTRAINT usuario_tipo_usuario_check
  CHECK (
    tipo_usuario IN (
      'medico',
      'administrativo',
      'enfermera',
      'secretaria',
      'USUARIO_IMANGE',
      'GESTOR_IMAGEN'
    )
  );
