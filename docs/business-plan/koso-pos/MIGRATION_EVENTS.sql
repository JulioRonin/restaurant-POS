-- ─────────────────────────────────────────────────────────────────────────
-- Migración: Módulo Eventos (banquetes / catering)
-- ─────────────────────────────────────────────────────────────────────────
-- Catálogo de paquetes (costos, qué incluye, mínimo de invitados) y eventos
-- contratados/cotizados (cliente, fecha, paquete, anticipo, estatus), con el
-- panel de gestión: vendido / cotizado / programado.
--
-- Correr en Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. PAQUETES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_packages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL,
  name             text NOT NULL,
  description      text DEFAULT '',
  base_price       numeric(12,2) DEFAULT 0,   -- costo fijo (montaje, renta…)
  price_per_person numeric(12,2) DEFAULT 0,   -- adicional por invitado
  min_guests       integer DEFAULT 0,
  includes         jsonb DEFAULT '[]'::jsonb, -- ["Mobiliario", "Meseros", …]
  active           boolean DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_packages_biz ON event_packages(business_id);

-- 2. EVENTOS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catering_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL,
  client_name  text NOT NULL,
  client_phone text DEFAULT '',
  event_date   date NOT NULL,
  event_time   text DEFAULT '',
  venue        text DEFAULT '',
  guests       integer DEFAULT 0,
  package_id   uuid,                          -- sin FK dura: si el paquete se
  package_name text DEFAULT '',               -- borra, el evento conserva el
                                              -- nombre y precio congelados
  status       text DEFAULT 'QUOTED',         -- QUOTED|CONFIRMED|COMPLETED|CANCELLED
  quoted_total numeric(12,2) DEFAULT 0,       -- precio pactado con el cliente
  deposit      numeric(12,2) DEFAULT 0,       -- anticipo recibido
  expenses     jsonb DEFAULT '[]'::jsonb,     -- gastos del evento
                                              -- [{id, description, amount}, …]
                                              -- utilidad = quoted_total - Σ
  notes        text DEFAULT '',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catering_events_biz ON catering_events(business_id, event_date DESC);

-- Si ya habías corrido una versión anterior de esta migración (sin gastos),
-- esto agrega la columna sin tocar tus datos. En instalación nueva no hace nada.
ALTER TABLE catering_events ADD COLUMN IF NOT EXISTS expenses jsonb DEFAULT '[]'::jsonb;

-- 3. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE event_packages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_packages_member_rw" ON event_packages;
CREATE POLICY "event_packages_member_rw"
  ON event_packages FOR ALL
  TO authenticated
  USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "catering_events_member_rw" ON catering_events;
CREATE POLICY "catering_events_member_rw"
  ON catering_events FOR ALL
  TO authenticated
  USING (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid()));

-- 4. FEATURE FLAG (add-on que el SuperAdmin activa por negocio) ──────────
INSERT INTO features (key, name, description)
SELECT 'events_catering', 'Eventos (banquetes y catering)',
       'Paquetes de eventos, agenda con cliente/fecha/anticipos y panel de gestión (vendido, cotizado, programado)'
WHERE NOT EXISTS (SELECT 1 FROM features WHERE key = 'events_catering');
