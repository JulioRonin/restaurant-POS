-- ============================================================================
-- PASO 2 — ¿De qué están hechas las ventas de hoy?
-- ============================================================================
-- El paso 1 descartó órdenes viejas mal fechadas. Ahora vemos orden por orden
-- para encontrar dónde está el monto de más.
--
-- Cambia el business_id y dale Run. Devuelve una fila por orden de hoy.
--
-- QUÉ BUSCAR en el resultado:
--   * dif_total ≠ 0  → el total cobrado NO coincide con la suma de sus
--     platillos. Si dif_total es positivo y grande, ahí está el inflado.
--   * n_items = 0    → orden con monto pero SIN platillos registrados
--     (los items se perdieron o nunca se guardaron).
--   * filas con mismo total, misma hora aproximada y mismos platillos
--     → la misma venta capturada dos veces.
--   * source distinto de DINE_IN → vino del kiosko / canal digital / repartidor,
--     revisa si esas son ventas reales o pruebas.
-- ============================================================================

WITH params AS (
  SELECT
    -- 👇 CAMBIA ESTO por tu business_id
    '00000000-0000-0000-0000-000000000000'::uuid AS biz,
    'America/Mexico_City'                        AS tz
),
hoy AS (
  SELECT o.*
  FROM orders o, params p
  WHERE o.business_id = p.biz
    AND (o.created_at AT TIME ZONE p.tz)::date = (now() AT TIME ZONE p.tz)::date
),
items AS (
  SELECT
    oi.order_id,
    count(*)                                          AS n_lineas,
    coalesce(sum(oi.quantity), 0)                     AS n_items,
    coalesce(sum(oi.quantity * oi.price_at_time), 0)  AS suma_items
  FROM order_items oi
  WHERE oi.order_id IN (SELECT id FROM hoy)
  GROUP BY oi.order_id
)
SELECT
  to_char(h.created_at AT TIME ZONE (SELECT tz FROM params), 'HH24:MI:SS') AS hora,
  h.daily_number                                   AS folio,
  h.status,
  h.source,
  h.payment_method                                 AS metodo,
  h.total::numeric(12,2)                           AS total_cobrado,
  coalesce(i.n_lineas, 0)                          AS n_lineas,
  coalesce(i.n_items, 0)                           AS n_items,
  coalesce(i.suma_items, 0)::numeric(12,2)         AS suma_platillos,
  (h.total - coalesce(i.suma_items, 0))::numeric(12,2) AS dif_total,
  h.id
FROM hoy h
LEFT JOIN items i ON i.order_id = h.id
ORDER BY h.created_at;

-- ============================================================================
-- Si prefieres el resumen en una sola línea, corre ESTO en su lugar:
-- ============================================================================
-- WITH params AS (
--   SELECT '<TU_BUSINESS_ID>'::uuid AS biz, 'America/Mexico_City' AS tz
-- ),
-- hoy AS (
--   SELECT o.* FROM orders o, params p
--   WHERE o.business_id = p.biz
--     AND (o.created_at AT TIME ZONE p.tz)::date = (now() AT TIME ZONE p.tz)::date
-- ),
-- items AS (
--   SELECT oi.order_id, coalesce(sum(oi.quantity * oi.price_at_time),0) AS suma
--   FROM order_items oi WHERE oi.order_id IN (SELECT id FROM hoy)
--   GROUP BY oi.order_id
-- )
-- SELECT n, metrica, valor FROM (
--   SELECT 1 AS n, 'Órdenes COMPLETED' AS metrica, count(*)::text AS valor
--     FROM hoy WHERE status='COMPLETED'
--   UNION ALL SELECT 2, 'Total cobrado ($)',
--     coalesce(sum(total),0)::numeric(12,2)::text FROM hoy WHERE status='COMPLETED'
--   UNION ALL SELECT 3, 'Suma de platillos ($)',
--     coalesce((SELECT sum(i.suma) FROM hoy h JOIN items i ON i.order_id=h.id
--               WHERE h.status='COMPLETED'),0)::numeric(12,2)::text
--   UNION ALL SELECT 4, '⚠ Diferencia sin explicar ($)',
--     (coalesce((SELECT sum(total) FROM hoy WHERE status='COMPLETED'),0)
--      - coalesce((SELECT sum(i.suma) FROM hoy h JOIN items i ON i.order_id=h.id
--                  WHERE h.status='COMPLETED'),0))::numeric(12,2)::text
--   UNION ALL SELECT 5, '⚠ Órdenes COMPLETED sin platillos',
--     count(*)::text FROM hoy h
--     WHERE h.status='COMPLETED' AND NOT EXISTS (SELECT 1 FROM items i WHERE i.order_id=h.id)
-- ) t ORDER BY n;
-- ============================================================================
