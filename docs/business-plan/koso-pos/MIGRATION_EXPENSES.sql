-- ─────────────────────────────────────────────────────────────────────────
-- Gastos: dejar la tabla `expenses` compatible con la app + diagnóstico
-- ─────────────────────────────────────────────────────────────────────────
-- Contexto: la app mandaba quién registró el gasto como `user`, columna que
-- no existe (la tabla usa `executor`). Supabase rechazaba cada gasto y
-- ninguno llegaba a la nube. El código ya está corregido; esto asegura que
-- la tabla tenga todas las columnas que la app usa, por si tu base se creó
-- con un script viejo.
--
-- Es idempotente: correrlo varias veces no rompe nada ni borra datos.
-- Supabase → SQL Editor → pega TODO → Run.
-- ─────────────────────────────────────────────────────────────────────────

-- 1. Columnas que la app escribe
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS business_id text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category    text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS date        timestamptz DEFAULT now();
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS executor    text;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_at  timestamptz DEFAULT now();

-- 2. Los ids de gastos de la app son texto (p. ej. "1730582400000"). Si tu
--    tabla nació con id uuid, esos ids no caben. Lo pasamos a texto.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE expenses ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE expenses ALTER COLUMN id TYPE text USING id::text;
    ALTER TABLE expenses ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  END IF;
  -- category como enum viejo rechazaría categorías nuevas; texto libre.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'category' AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE expenses ALTER COLUMN category DROP DEFAULT;
    ALTER TABLE expenses ALTER COLUMN category TYPE text USING category::text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expenses_biz_date ON expenses (business_id, date DESC);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. DIAGNÓSTICO — cambia el business_id y corre SOLO esta parte
--    (el editor muestra solo el último resultado).
-- ─────────────────────────────────────────────────────────────────────────
-- Ventas cobradas y gastos por día, últimos 45 días. Si un día tiene ventas
-- aquí pero el Dashboard dice $0, es un problema de la app. Si aquí tampoco
-- aparecen, las órdenes no se están subiendo desde el equipo que cobra.
--
-- WITH p AS (SELECT '<TU_BUSINESS_ID>'::text AS biz, 'America/Mexico_City' AS tz),
-- d AS (
--   SELECT generate_series((now() AT TIME ZONE (SELECT tz FROM p))::date - 44,
--                          (now() AT TIME ZONE (SELECT tz FROM p))::date, '1 day')::date AS dia
-- ),
-- v AS (
--   SELECT (created_at AT TIME ZONE (SELECT tz FROM p))::date AS dia,
--          count(*) FILTER (WHERE status = 'COMPLETED')               AS ordenes_cobradas,
--          count(*) FILTER (WHERE status NOT IN ('COMPLETED','CANCELLED')) AS ordenes_abiertas,
--          coalesce(sum(total) FILTER (WHERE status = 'COMPLETED'),0) AS venta
--   FROM orders WHERE business_id::text = (SELECT biz FROM p) GROUP BY 1
-- ),
-- g AS (
--   SELECT (date AT TIME ZONE (SELECT tz FROM p))::date AS dia, count(*) AS gastos, sum(amount) AS monto_gastos
--   FROM expenses WHERE business_id = (SELECT biz FROM p) GROUP BY 1
-- )
-- SELECT d.dia, coalesce(v.ordenes_cobradas,0) AS ordenes_cobradas,
--        coalesce(v.ordenes_abiertas,0) AS ordenes_abiertas,
--        coalesce(v.venta,0) AS venta,
--        coalesce(g.gastos,0) AS gastos, coalesce(g.monto_gastos,0) AS monto_gastos
-- FROM d LEFT JOIN v USING (dia) LEFT JOIN g USING (dia)
-- ORDER BY d.dia DESC;
