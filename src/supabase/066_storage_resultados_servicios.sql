-- ============================================
-- 066: Bucket privado y políticas para PDFs de resultados de servicios
-- Esta aplicación utiliza autenticación propia, por lo que las operaciones
-- de Storage llegan con el rol anon además de authenticated.
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resultados-servicios',
  'resultados-servicios',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "resultados_servicios_insert" ON storage.objects;
CREATE POLICY "resultados_servicios_insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'resultados-servicios');

DROP POLICY IF EXISTS "resultados_servicios_select" ON storage.objects;
CREATE POLICY "resultados_servicios_select"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'resultados-servicios');
DROP POLICY IF EXISTS "resultados_servicios_update" ON storage.objects;
CREATE POLICY "resultados_servicios_update"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'resultados-servicios')
WITH CHECK (bucket_id = 'resultados-servicios');

DROP POLICY IF EXISTS "resultados_servicios_delete" ON storage.objects;
CREATE POLICY "resultados_servicios_delete"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'resultados-servicios');
