-- ─────────────────────────────────────────────────────────────────────────
-- Migración: Fotos del menú en Supabase Storage
-- ─────────────────────────────────────────────────────────────────────────
-- Reemplaza el guardado de fotos como base64 en la columna image (frágil,
-- infla la BD, se trunca al sincronizar) por un bucket de Storage donde se
-- suben los archivos y solo se guarda la URL pública.
--
-- Cómo correrlo:
--   1. Supabase → tu proyecto ServiRest → SQL Editor → New query.
--   2. Pega TODO este archivo.
--   3. Run.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Crear el bucket público 'menu-photos' (si no existe).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-photos',
  'menu-photos',
  true,                                   -- público: cualquiera puede VER las fotos (storefront)
  5242880,                                -- 5 MB máx por archivo
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

-- 2. Policies del bucket (sobre storage.objects).

-- Lectura pública (el storefront/kiosko muestran las fotos sin login).
DROP POLICY IF EXISTS "menu_photos_public_read" ON storage.objects;
CREATE POLICY "menu_photos_public_read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'menu-photos');

-- Subida: cualquier usuario autenticado del negocio puede subir fotos.
-- (La ruta del archivo empieza con el businessId, ver el frontend.)
DROP POLICY IF EXISTS "menu_photos_authenticated_insert" ON storage.objects;
CREATE POLICY "menu_photos_authenticated_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'menu-photos');

-- Actualizar / reemplazar la foto de un platillo.
DROP POLICY IF EXISTS "menu_photos_authenticated_update" ON storage.objects;
CREATE POLICY "menu_photos_authenticated_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'menu-photos');

-- Borrar foto.
DROP POLICY IF EXISTS "menu_photos_authenticated_delete" ON storage.objects;
CREATE POLICY "menu_photos_authenticated_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'menu-photos');
