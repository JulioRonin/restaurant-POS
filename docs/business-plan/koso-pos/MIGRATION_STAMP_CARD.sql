-- ─────────────────────────────────────────────────────────────────────────
-- Migración: Tarjeta de sellos digital (por negocio)
-- ─────────────────────────────────────────────────────────────────────────
-- Cada negocio configura su propia tarjeta: cuántos sellos, qué premio y el
-- color. El cliente ve su tarjeta (con el logo del negocio) y su QR en el
-- Storefront; el cajero escanea ese QR en Caja y le da sellos o le canjea
-- el premio.
--
-- El código del cliente es su `customer_profiles.referral_code` (ya es único
-- por cliente), así que requiere MIGRATION_CUSTOMER_LOYALTY.sql.
--
-- SEGURIDAD: las tarjetas NO se escriben directo desde el cliente. Sellos y
-- canjes solo pasan por RPCs que validan que quien llama es usuario del
-- negocio (profiles.business_id). Un cliente no puede sumarse sellos.
--
-- Idempotente. Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. CONFIGURACIÓN DEL PROGRAMA (una por negocio) ───────────────────────
CREATE TABLE IF NOT EXISTS loyalty_programs (
  business_id     uuid PRIMARY KEY,
  enabled         boolean DEFAULT false,
  stamps_required integer DEFAULT 8 CHECK (stamps_required BETWEEN 2 AND 30),
  reward_title    text DEFAULT 'Un producto gratis',
  card_color      text DEFAULT '#1A1E2E',
  terms           text DEFAULT '',
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede LEER la configuración (el Storefront público la necesita
-- para dibujar la tarjeta antes de iniciar sesión).
DROP POLICY IF EXISTS "loyalty_programs_public_read" ON loyalty_programs;
CREATE POLICY "loyalty_programs_public_read"
  ON loyalty_programs FOR SELECT TO anon, authenticated USING (true);

-- Solo el negocio la edita.
DROP POLICY IF EXISTS "loyalty_programs_member_write" ON loyalty_programs;
CREATE POLICY "loyalty_programs_member_write"
  ON loyalty_programs FOR ALL TO authenticated
  USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

-- 2. TARJETAS (una por cliente por negocio) ─────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_cards (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL,
  user_id           uuid NOT NULL,
  stamps            integer DEFAULT 0,  -- sellos en la tarjeta actual
  lifetime_stamps   integer DEFAULT 0,
  rewards_available integer DEFAULT 0,  -- premios ganados sin canjear
  rewards_redeemed  integer DEFAULT 0,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (business_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_cards_user ON loyalty_cards (user_id);

ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;

-- El cliente lee SUS tarjetas; el negocio lee las suyas. Nadie escribe
-- directo: solo los RPCs de abajo (SECURITY DEFINER).
DROP POLICY IF EXISTS "loyalty_cards_read" ON loyalty_cards;
CREATE POLICY "loyalty_cards_read"
  ON loyalty_cards FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid())
  );

-- 3. BITÁCORA (quién dio cada sello / canje y cuándo) ───────────────────
CREATE TABLE IF NOT EXISTS loyalty_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  user_id     uuid NOT NULL,
  type        text NOT NULL,          -- 'stamp' | 'redeem'
  amount      integer DEFAULT 1,
  staff_name  text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_events_biz ON loyalty_events (business_id, created_at DESC);

ALTER TABLE loyalty_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_events_read" ON loyalty_events;
CREATE POLICY "loyalty_events_read"
  ON loyalty_events FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid())
  );

-- 4. RPCs DEL NEGOCIO ───────────────────────────────────────────────────
-- ¿El usuario que llama pertenece a este negocio?
CREATE OR REPLACE FUNCTION public.loyalty_is_member(p_business uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND business_id = p_business);
$$;

-- Estado de la tarjeta de un cliente por su código. Si aún no tiene tarjeta
-- en este negocio la devuelve en ceros (se crea al dar el primer sello).
CREATE OR REPLACE FUNCTION public.loyalty_lookup(p_business uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cust record;
  card record;
  prog record;
BEGIN
  IF NOT loyalty_is_member(p_business) THEN
    RAISE EXCEPTION 'No autorizado para este negocio';
  END IF;

  SELECT user_id, full_name INTO cust
    FROM customer_profiles WHERE upper(referral_code) = upper(trim(p_code)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO prog FROM loyalty_programs WHERE business_id = p_business;
  SELECT * INTO card FROM loyalty_cards WHERE business_id = p_business AND user_id = cust.user_id;

  RETURN jsonb_build_object(
    'found', true,
    'customer_name', cust.full_name,
    'stamps', COALESCE(card.stamps, 0),
    'stamps_required', COALESCE(prog.stamps_required, 8),
    'rewards_available', COALESCE(card.rewards_available, 0),
    'rewards_redeemed', COALESCE(card.rewards_redeemed, 0),
    'lifetime_stamps', COALESCE(card.lifetime_stamps, 0),
    'reward_title', COALESCE(prog.reward_title, 'Un producto gratis')
  );
END;
$$;

-- Da N sellos. Al completar la tarjeta se reinicia y suma un premio
-- (varios si N alcanza para más de una vuelta).
CREATE OR REPLACE FUNCTION public.loyalty_add_stamps(
  p_business uuid, p_code text, p_count integer DEFAULT 1, p_staff text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cust_id uuid;
  req integer;
  is_on boolean;
  cur integer;
  earned integer;
BEGIN
  IF NOT loyalty_is_member(p_business) THEN
    RAISE EXCEPTION 'No autorizado para este negocio';
  END IF;
  IF p_count IS NULL OR p_count < 1 OR p_count > 20 THEN
    RAISE EXCEPTION 'Cantidad de sellos inválida';
  END IF;

  SELECT stamps_required, enabled INTO req, is_on FROM loyalty_programs WHERE business_id = p_business;
  IF NOT COALESCE(is_on, false) THEN
    RAISE EXCEPTION 'La tarjeta de sellos no está activada';
  END IF;

  SELECT user_id INTO cust_id FROM customer_profiles
    WHERE upper(referral_code) = upper(trim(p_code)) LIMIT 1;
  IF cust_id IS NULL THEN
    RAISE EXCEPTION 'Código de cliente no encontrado';
  END IF;

  INSERT INTO loyalty_cards (business_id, user_id) VALUES (p_business, cust_id)
    ON CONFLICT (business_id, user_id) DO NOTHING;

  SELECT stamps INTO cur FROM loyalty_cards
    WHERE business_id = p_business AND user_id = cust_id FOR UPDATE;

  cur := cur + p_count;
  earned := cur / req;

  UPDATE loyalty_cards SET
    stamps            = cur % req,
    lifetime_stamps   = lifetime_stamps + p_count,
    rewards_available = rewards_available + earned,
    updated_at        = now()
  WHERE business_id = p_business AND user_id = cust_id;

  INSERT INTO loyalty_events (business_id, user_id, type, amount, staff_name)
    VALUES (p_business, cust_id, 'stamp', p_count, p_staff);

  RETURN loyalty_lookup(p_business, p_code) || jsonb_build_object('rewards_earned_now', earned);
END;
$$;

-- Canjea un premio disponible.
CREATE OR REPLACE FUNCTION public.loyalty_redeem(
  p_business uuid, p_code text, p_staff text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cust_id uuid;
  ok boolean;
BEGIN
  IF NOT loyalty_is_member(p_business) THEN
    RAISE EXCEPTION 'No autorizado para este negocio';
  END IF;

  SELECT user_id INTO cust_id FROM customer_profiles
    WHERE upper(referral_code) = upper(trim(p_code)) LIMIT 1;
  IF cust_id IS NULL THEN
    RAISE EXCEPTION 'Código de cliente no encontrado';
  END IF;

  UPDATE loyalty_cards SET
    rewards_available = rewards_available - 1,
    rewards_redeemed  = rewards_redeemed + 1,
    updated_at        = now()
  WHERE business_id = p_business AND user_id = cust_id AND rewards_available > 0
  RETURNING true INTO ok;

  IF NOT COALESCE(ok, false) THEN
    RAISE EXCEPTION 'El cliente no tiene premios disponibles';
  END IF;

  INSERT INTO loyalty_events (business_id, user_id, type, amount, staff_name)
    VALUES (p_business, cust_id, 'redeem', 1, p_staff);

  RETURN loyalty_lookup(p_business, p_code);
END;
$$;

REVOKE ALL ON FUNCTION public.loyalty_lookup(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.loyalty_add_stamps(uuid, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.loyalty_redeem(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.loyalty_lookup(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_add_stamps(uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.loyalty_redeem(uuid, text, text) TO authenticated;

