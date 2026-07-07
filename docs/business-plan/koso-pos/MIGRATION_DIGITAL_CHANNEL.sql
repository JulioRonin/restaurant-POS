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
