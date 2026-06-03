-- ServiRest — Bootstrap completo de tablas para Stripe + SaaS
-- Ejecutar en Supabase SQL Editor en este orden exacto.

-- ============================================================================
-- 1. app_config — tabla global key/value para configuración del sistema
--    (price_ids de Stripe, precio global, feature flags, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Trigger auto-update updated_at
CREATE OR REPLACE FUNCTION update_app_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_config_updated_at ON app_config;
CREATE TRIGGER app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW EXECUTE FUNCTION update_app_config_timestamp();

-- RLS: cualquier usuario autenticado lee, solo super_admin escribe.
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_config_read_authenticated" ON app_config;
CREATE POLICY "app_config_read_authenticated"
  ON app_config FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "app_config_write_super_admin" ON app_config;
CREATE POLICY "app_config_write_super_admin"
  ON app_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- ============================================================================
-- 2. Ahora SÍ los precios de Stripe (reemplaza los price_xxx con los tuyos)
-- ============================================================================
INSERT INTO app_config (key, value, description) VALUES
  ('stripe_price_esencial_monthly',    'price_1TeImb7vbDuHdmHoH90VyRUq', 'Esencial mensual'),
  ('stripe_price_esencial_yearly',     'price_1TeK967vbDuHdmHojpAMb6o3', 'Esencial anual'),
  ('stripe_price_profesional_monthly', 'price_1TeKAK7vbDuHdmHobNLS6hjW', 'Profesional mensual'),
  ('stripe_price_profesional_yearly',  'price_1TeKBc7vbDuHdmHohmeANhHA', 'Profesional anual'),
  ('stripe_price_prestige_monthly',    'price_1TeKBo7vbDuHdmHonIJf5wi6', 'Prestige mensual'),
  ('stripe_price_prestige_yearly',     'price_1TeKCU7vbDuHdmHoThC1kXs7', 'Prestige anual'),
  ('stripe_price_equipment_kit',       'price_1TeKDK7vbDuHdmHo2IHkYRUo', 'Equipo POS kit'),
  ('membership_monthly_price',         '899',                            'Precio base global MXN')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- ============================================================================
-- 3. Columnas nuevas en businesses (para webhook + tier system)
-- ============================================================================
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS saas_status text DEFAULT 'ACTIVE'
    CHECK (saas_status IN ('ACTIVE','WARNING','GRACE_PERIOD','SUSPENDED','DEBT_BLOCKED')),
  ADD COLUMN IF NOT EXISTS business_tier text DEFAULT 'esencial'
    CHECK (business_tier IN ('esencial','profesional','prestige','enterprise')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS last_payment_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_failed_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cfdi_stamps_used_this_month integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cfdi_stamps_reset_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS businesses_stripe_customer_idx
  ON businesses (stripe_customer_id);
CREATE INDEX IF NOT EXISTS businesses_stripe_subscription_idx
  ON businesses (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS businesses_saas_status_idx
  ON businesses (saas_status);

-- ============================================================================
-- 4. RPC para incrementar contador CFDI (con reset mensual automático)
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_cfdi_counter(biz uuid)
RETURNS void AS $$
BEGIN
  -- Reset si pasó más de un mes desde el último reset
  UPDATE businesses
  SET cfdi_stamps_used_this_month = 0,
      cfdi_stamps_reset_at = now()
  WHERE id = biz
    AND cfdi_stamps_reset_at < (now() - interval '30 days');

  -- Incrementar contador
  UPDATE businesses
  SET cfdi_stamps_used_this_month = cfdi_stamps_used_this_month + 1
  WHERE id = biz;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Tabla cfdi_issued — historial de facturas timbradas
-- ============================================================================
CREATE TABLE IF NOT EXISTS cfdi_issued (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  order_id uuid,
  cfdi_uuid text UNIQUE NOT NULL,
  xml_url text NOT NULL,
  pdf_url text NOT NULL,
  receiver_rfc text,
  receiver_name text,
  receiver_email text,
  cfdi_use text,
  amount numeric(10,2),
  status text DEFAULT 'STAMPED'
    CHECK (status IN ('STAMPED','CANCELED','PENDING')),
  cancellation_reason text,
  issued_at timestamptz DEFAULT now(),
  canceled_at timestamptz
);

CREATE INDEX IF NOT EXISTS cfdi_business_idx ON cfdi_issued (business_id);
CREATE INDEX IF NOT EXISTS cfdi_order_idx ON cfdi_issued (order_id);
CREATE INDEX IF NOT EXISTS cfdi_status_idx ON cfdi_issued (status);

ALTER TABLE cfdi_issued ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cfdi_select_own_business" ON cfdi_issued;
CREATE POLICY "cfdi_select_own_business"
  ON cfdi_issued FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- 6. Columnas fiscales en businesses (para el CSD del emisor)
-- ============================================================================
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS fiscal_csd_cer_url text,
  ADD COLUMN IF NOT EXISTS fiscal_csd_key_url text,
  ADD COLUMN IF NOT EXISTS fiscal_csd_password text,   -- TODO: encrypt at rest
  ADD COLUMN IF NOT EXISTS fiscal_regime text,
  ADD COLUMN IF NOT EXISTS fiscal_postal_code text;

-- ============================================================================
-- LISTO. Verifica con:
--   SELECT key, value FROM app_config ORDER BY key;
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'businesses' AND column_name LIKE '%stripe%' OR column_name = 'saas_status';
-- ============================================================================
