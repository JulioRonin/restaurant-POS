-- ─────────────────────────────────────────────────────────────────────────
-- Migración: Módulo Visión IA (control de zonas y tiempos por cámara)
-- ─────────────────────────────────────────────────────────────────────────
-- Guarda los eventos que detecta el módulo experimental de visión
-- computacional (zona desatendida, intrusión, recuperación) con su snapshot,
-- para historial, reportes y auditoría.
--
-- Correr en Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. EVENTOS DE VISIÓN ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vision_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL,
  camera       text DEFAULT 'PC',            -- nombre de la cámara/punto
  zone         text NOT NULL,                -- nombre de la zona dibujada
  type         text NOT NULL,                -- zona: 'zone_vacant' | 'zone_intrusion' | 'zone_recovered'
                                             -- recepción: 'guest_waiting' | 'guest_attended' | 'guest_unattended'
  message      text,
  duration_sec integer,                      -- cuánto duró (vacancia, etc.)
  snapshot_url text,                         -- captura del momento (Storage)
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vision_events_biz ON vision_events(business_id, created_at DESC);

ALTER TABLE vision_events ENABLE ROW LEVEL SECURITY;

-- Miembros del negocio leen e insertan los eventos de SU negocio.
DROP POLICY IF EXISTS "vision_events_member_rw" ON vision_events;
CREATE POLICY "vision_events_member_rw"
  ON vision_events FOR ALL
  TO authenticated
  USING (
    business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT business_id FROM profiles WHERE id = auth.uid())
  );

-- 2. FEATURE FLAG (add-on que el SuperAdmin activa por negocio) ─────────
INSERT INTO features (key, name, description)
SELECT 'vision_ai', 'Visión IA (experimental)',
       'Control de zonas y tiempos por cámara con detección de personas (add-on)'
WHERE NOT EXISTS (SELECT 1 FROM features WHERE key = 'vision_ai');

-- 3. BUCKET DE SNAPSHOTS ────────────────────────────────────────────────
-- Capturas del momento del evento. Lectura pública (para abrir el link
-- desde la alerta de WhatsApp); escritura solo autenticados.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vision-snapshots', 'vision-snapshots', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "vision_snapshots_public_read" ON storage.objects;
CREATE POLICY "vision_snapshots_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'vision-snapshots');

DROP POLICY IF EXISTS "vision_snapshots_auth_write" ON storage.objects;
CREATE POLICY "vision_snapshots_auth_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'vision-snapshots');

DROP POLICY IF EXISTS "vision_snapshots_auth_update" ON storage.objects;
CREATE POLICY "vision_snapshots_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'vision-snapshots');
