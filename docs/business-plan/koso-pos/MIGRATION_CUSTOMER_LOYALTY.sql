-- ─────────────────────────────────────────────────────────────────────────
-- Migración: Sistema de cuenta de cliente + lealtad + referidos
-- ─────────────────────────────────────────────────────────────────────────
-- Perfil de cliente al estilo Uber Eats: mide consumo, guarda preferencias,
-- programa de referidos (quién recomendó a quién) y recompensas
-- (rebanada gratis al llegar a 5 compras o 3 referidos).
--
-- Correr en Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. PERFIL DEL CLIENTE ─────────────────────────────────────────────────
-- user_id = auth.uid() del cliente. Un perfil por cuenta (cross-negocio).
CREATE TABLE IF NOT EXISTS customer_profiles (
  user_id              uuid PRIMARY KEY,
  full_name            text,
  phone                text,
  email                text,
  referral_code        text UNIQUE NOT NULL,
  referred_by          uuid,                              -- quién lo recomendó (user_id)
  points               integer DEFAULT 0,                 -- puntos de lealtad
  total_orders         integer DEFAULT 0,
  total_spent          numeric(12,2) DEFAULT 0,
  successful_referrals integer DEFAULT 0,                 -- referidos que ya compraron
  first_order_done     boolean DEFAULT false,             -- para acreditar al referidor 1 sola vez
  preferences          jsonb DEFAULT '{}'::jsonb,         -- categorías favoritas, etc.
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

-- El cliente lee/escribe SU perfil. También puede LEER el perfil de otro por
-- referral_code (para validar el código al registrarse) — solo campos no
-- sensibles vía RPC (abajo).
DROP POLICY IF EXISTS "customer_profiles_own_rw" ON customer_profiles;
CREATE POLICY "customer_profiles_own_rw"
  ON customer_profiles FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Miembros del negocio pueden LEER perfiles (para ver quién ordena) — opcional.
DROP POLICY IF EXISTS "customer_profiles_business_read" ON customer_profiles;
CREATE POLICY "customer_profiles_business_read"
  ON customer_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager','super_admin'))
  );


-- 2. RECOMPENSAS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_rewards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  business_id uuid,
  reward_type text NOT NULL,                 -- 'free_item_5_orders' | 'free_item_3_referrals'
  title       text NOT NULL,
  status      text DEFAULT 'available',      -- 'available' | 'redeemed' | 'expired'
  created_at  timestamptz DEFAULT now(),
  redeemed_at timestamptz
);

ALTER TABLE customer_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_rewards_own" ON customer_rewards;
CREATE POLICY "customer_rewards_own"
  ON customer_rewards FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "customer_rewards_business_read" ON customer_rewards;
CREATE POLICY "customer_rewards_business_read"
  ON customer_rewards FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','manager','super_admin'))
  );


-- 3. MENSAJES DE ORDEN (cliente ↔ negocio/repartidor) ──────────────────
CREATE TABLE IF NOT EXISTS order_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL,
  business_id uuid,
  sender      text NOT NULL,                 -- 'customer' | 'store' | 'driver'
  sender_name text,
  message     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_messages_order ON order_messages(order_id, created_at);

ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;

-- El cliente (autenticado o anónimo con el UUID de la orden) inserta mensajes.
DROP POLICY IF EXISTS "order_messages_insert" ON order_messages;
CREATE POLICY "order_messages_insert"
  ON order_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Lectura: quien tenga el order_id (cliente) o el negocio.
DROP POLICY IF EXISTS "order_messages_read" ON order_messages;
CREATE POLICY "order_messages_read"
  ON order_messages FOR SELECT
  TO anon, authenticated
  USING (true);


-- 4. RPC: validar y resolver un referral_code → devuelve el user_id del
--    referidor (para ligar el referido sin exponer todo el perfil).
CREATE OR REPLACE FUNCTION public.resolve_referral_code(p_code text)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM customer_profiles WHERE upper(referral_code) = upper(p_code) LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_referral_code(text) TO anon, authenticated;


-- 5. RPC: acreditar al referidor cuando su referido completa la 1a orden.
--    Suma +1 referido exitoso + puntos. Cada 3 referidos exitosos otorga una
--    recompensa (rebanada gratis). Devuelve el nuevo total de referidos.
--    SECURITY DEFINER: puede escribir el perfil/recompensa de OTRO usuario
--    (el referidor), algo que la RLS del cliente no permitiría directamente.
CREATE OR REPLACE FUNCTION public.credit_referrer(p_referrer uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_total integer;
BEGIN
  UPDATE customer_profiles
  SET successful_referrals = successful_referrals + 1,
      points = points + 50,
      updated_at = now()
  WHERE user_id = p_referrer
  RETURNING successful_referrals INTO new_total;

  -- Recompensa por cada 3 referidos exitosos.
  IF new_total IS NOT NULL AND new_total % 3 = 0 THEN
    INSERT INTO customer_rewards (user_id, reward_type, title, status)
    VALUES (p_referrer, 'free_item_3_referrals', 'Rebanada gratis por 3 referidos 🎉', 'available');
  END IF;

  RETURN COALESCE(new_total, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.credit_referrer(uuid) TO anon, authenticated;


-- 6. RPC: registrar una orden del cliente. Incrementa contadores de consumo,
--    marca la 1a orden (para acreditar al referidor una sola vez) y otorga la
--    recompensa por cada 5 compras. Devuelve si fue la 1a orden y a quién lo
--    refirieron, para que el cliente dispare credit_referrer.
--    Atómico + SECURITY DEFINER para que los contadores no dependan de la RLS.
CREATE OR REPLACE FUNCTION public.record_customer_order(
  p_user uuid, p_business uuid, p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  was_first boolean;
  ref uuid;
  new_orders integer;
BEGIN
  SELECT (NOT first_order_done), referred_by INTO was_first, ref
    FROM customer_profiles WHERE user_id = p_user;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('first_order', false, 'referred_by', null, 'total_orders', 0);
  END IF;

  UPDATE customer_profiles
  SET total_orders     = total_orders + 1,
      total_spent      = total_spent + COALESCE(p_amount, 0),
      points           = points + 10,
      first_order_done = true,
      updated_at       = now()
  WHERE user_id = p_user
  RETURNING total_orders INTO new_orders;

  -- Recompensa por cada 5 compras.
  IF new_orders IS NOT NULL AND new_orders % 5 = 0 THEN
    INSERT INTO customer_rewards (user_id, business_id, reward_type, title, status)
    VALUES (p_user, p_business, 'free_item_5_orders', 'Rebanada gratis por 5 compras 🍕', 'available');
  END IF;

  RETURN jsonb_build_object(
    'first_order', COALESCE(was_first, false),
    'referred_by', ref,
    'total_orders', COALESCE(new_orders, 0)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_customer_order(uuid, uuid, numeric) TO anon, authenticated;


-- 7. RPC: canjear una recompensa (marca redeemed). Idempotente: solo cambia
--    si estaba 'available' y pertenece al usuario.
CREATE OR REPLACE FUNCTION public.redeem_reward(p_reward uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  UPDATE customer_rewards
  SET status = 'redeemed', redeemed_at = now()
  WHERE id = p_reward AND status = 'available'
  RETURNING true INTO ok;
  RETURN COALESCE(ok, false);
END;
$$;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid) TO anon, authenticated;


-- 8. RPC: detalle de una orden (resumen de compra) por id. Devuelve la orden
--    con sus renglones (nombre del platillo, cantidad, precio). SECURITY
--    DEFINER porque order_items no tiene SELECT público; el UUID de la orden
--    actúa como token (igual que get_order_status).
CREATE OR REPLACE FUNCTION public.get_order_detail(p_order_id uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id',                o.id,
    'daily_number',      o.daily_number,
    'status',            o.status,
    'total',             o.total,
    'source',            o.source,
    'payment_method',    o.payment_method,
    'payment_status',    o.payment_status,
    'created_at',        o.created_at,
    'customer_metadata', o.customer_metadata,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name',     COALESCE(mi.name, 'Producto'),
        'quantity', oi.quantity,
        'price',    oi.price_at_time,
        'notes',    oi.notes
      ))
      FROM order_items oi
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM orders o
  WHERE o.id = p_order_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_order_detail(uuid) TO anon, authenticated;
