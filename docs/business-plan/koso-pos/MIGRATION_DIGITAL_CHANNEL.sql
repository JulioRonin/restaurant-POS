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


-- ─────────────────────────────────────────────────────────────────────────
-- STOREFRONT PÚBLICO — RLS para lectura anónima
-- ─────────────────────────────────────────────────────────────────────────
-- Necesario para que un cliente entre a #/o/{businessId} sin login y
-- vea el catálogo. Solo lectura de campos NO sensibles. Las órdenes solo
-- se pueden insertar con sesión autenticada (arriba del checkout).
-- ─────────────────────────────────────────────────────────────────────────

-- SELECT público del negocio (solo campos visibles del storefront)
DROP POLICY IF EXISTS "businesses_public_read" ON businesses;
CREATE POLICY "businesses_public_read"
  ON businesses
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- SELECT público de menu_items solo si están publicados online
DROP POLICY IF EXISTS "menu_items_public_read" ON menu_items;
CREATE POLICY "menu_items_public_read"
  ON menu_items
  FOR SELECT
  TO anon, authenticated
  USING (publish_online = true AND status = 'ACTIVE');

-- SELECT público de business_settings (config del canal digital: horario,
-- modo, zonas, mensaje de bienvenida, logo). Solo lectura.
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_settings_public_read" ON business_settings;
CREATE POLICY "business_settings_public_read"
  ON business_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- La tabla `orders` no tenía una columna para guardar los metadatos del
-- cliente del storefront (nombre, teléfono, dirección, customerId). La
-- creamos como JSONB. Si ya existe, no pasa nada.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_metadata JSONB DEFAULT '{}'::jsonb;

-- Índice para poder buscar rápido las órdenes de un cliente (historial).
CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON orders(((customer_metadata->>'customerId')));

-- INSERT de orders desde el storefront público. Permitimos anon +
-- authenticated para soportar checkout de INVITADO (cliente sin cuenta).
-- El pedido queda ligado al negocio por business_id; el frontend valida
-- zona/datos antes de insertar. (Como cualquier formulario de pedido web,
-- un actor malicioso podría spamear órdenes — mitigable con rate-limit /
-- captcha en Fase 2B si hace falta.)
DROP POLICY IF EXISTS "orders_public_insert" ON orders;
CREATE POLICY "orders_public_insert"
  ON orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SELECT de sus propias órdenes (para historial del cliente en Sprint B).
-- customer_metadata->>'customerId' = auth.uid() del cliente que la creó.
DROP POLICY IF EXISTS "orders_customer_read_own" ON orders;
CREATE POLICY "orders_customer_read_own"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    -- Miembros del negocio ven todas las órdenes de ese negocio
    business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid())
    OR
    -- El cliente ve sus propias órdenes por customerId en customer_metadata
    (customer_metadata->>'customerId')::uuid = auth.uid()
  );

-- INSERT de order_items desde el storefront público (invitado o cliente).
DROP POLICY IF EXISTS "order_items_public_insert" ON order_items;
CREATE POLICY "order_items_public_insert"
  ON order_items
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────
-- RPC seguro para que el cliente (incluso invitado / anon) consulte SOLO el
-- estatus de SU pedido por id, sin exponer datos de otros pedidos (PII).
-- El UUID del pedido actúa como token — quien lo tiene puede ver su estatus.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_order_status(p_order_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT status FROM orders WHERE id = p_order_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_status(uuid) TO anon, authenticated;
