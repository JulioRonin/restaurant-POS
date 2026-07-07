-- ─────────────────────────────────────────────────────────────────────────
-- Migración: Canal Digital (Fase 1)
-- ─────────────────────────────────────────────────────────────────────────
-- Corre este script una sola vez en el editor SQL de Supabase para agregar
-- las columnas que la pantalla /digital-channel necesita para persistir
-- qué platillos están publicados online, su precio online opcional y su
-- disponibilidad instantánea.
--
-- Cómo correrlo:
--   1. Ve a Supabase → tu proyecto ServiRest → SQL Editor → New query.
--   2. Pega TODO este archivo.
--   3. Click "Run".
--   4. Verifica: en "Table Editor" abre menu_items, deben aparecer 3 columnas
--      nuevas: publish_online, online_price, online_available.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS publish_online   BOOLEAN         DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS online_price     NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS online_available BOOLEAN         DEFAULT TRUE;

-- Índice para acelerar la query del kiosko / storefront público
CREATE INDEX IF NOT EXISTS idx_menu_items_publish_online
  ON menu_items(business_id, publish_online)
  WHERE publish_online = TRUE;

COMMENT ON COLUMN menu_items.publish_online IS
  'Si TRUE, el platillo aparece en el kiosko y en el storefront público del canal digital.';
COMMENT ON COLUMN menu_items.online_price IS
  'Precio opcional específico para el canal digital. Si es NULL, se usa price.';
COMMENT ON COLUMN menu_items.online_available IS
  'Disponibilidad instantánea online. FALSE = "Agotado" en el kiosko sin borrar del catálogo.';


-- ─────────────────────────────────────────────────────────────────────────
-- FIX: RLS de la tabla `tables` (Hostess)
-- ─────────────────────────────────────────────────────────────────────────
-- Bug reportado: "Error guardando tables: new row violates row-level
-- security policy for table 'tables'". Sucede cuando el admin crea una
-- mesa desde Hostess. Falta un policy que permita a los miembros del
-- negocio insertar/actualizar sus propias mesas.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier miembro del negocio ve sus mesas
DROP POLICY IF EXISTS "tables_select_own_business" ON tables;
CREATE POLICY "tables_select_own_business"
  ON tables
  FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM profiles WHERE id = auth.uid()
    )
  );

-- INSERT: cualquier miembro puede crear mesas para su negocio
DROP POLICY IF EXISTS "tables_insert_own_business" ON tables;
CREATE POLICY "tables_insert_own_business"
  ON tables
  FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM profiles WHERE id = auth.uid()
    )
  );

-- UPDATE: mismo criterio
DROP POLICY IF EXISTS "tables_update_own_business" ON tables;
CREATE POLICY "tables_update_own_business"
  ON tables
  FOR UPDATE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM profiles WHERE id = auth.uid()
    )
  );

-- DELETE: solo admins/managers borran mesas
DROP POLICY IF EXISTS "tables_delete_admin" ON tables;
CREATE POLICY "tables_delete_admin"
  ON tables
  FOR DELETE
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager', 'super_admin')
    )
  );
