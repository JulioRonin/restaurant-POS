-- ============================================================================
-- DIAGNÓSTICO: ¿por qué las ventas del día salen infladas?
-- ============================================================================
-- Pégalo COMPLETO en el SQL Editor de Supabase y dale Run.
-- Devuelve un solo resultado con varias filas numeradas (el editor solo
-- muestra el último SELECT, por eso va todo unido).
--
-- QUÉ BUSCAMOS
-- Hasta este fix, la app mandaba las órdenes a Supabase SIN fecha, y Postgres
-- ponía created_at = now() en el momento de sincronizar. Si la cola de sync
-- traía atraso, órdenes viejas entraban fechadas HOY.
-- La firma de eso es: muchas órdenes con created_at casi idéntico (se
-- insertaron todas juntas en un vaciado de cola) y/o daily_number repetido
-- dentro del mismo día (los consecutivos se calculan por día en el equipo,
-- así que dos órdenes de días distintos pueden traer el mismo número).
--
-- IMPORTANTE: cambia el business_id de abajo por el tuyo.
-- ============================================================================

WITH params AS (
  SELECT
    -- 👇 CAMBIA ESTO por tu business_id
    '00000000-0000-0000-0000-000000000000'::uuid AS biz,
    'America/Mexico_City'                        AS tz
),
ord AS (
  SELECT
    o.id,
    o.status,
    o.total,
    o.daily_number,
    o.created_at,
    (o.created_at AT TIME ZONE p.tz)::date AS dia_local,
    date_trunc('second', o.created_at)     AS seg
  FROM orders o, params p
  WHERE o.business_id = p.biz
),
hoy AS (
  SELECT * FROM ord, params p
  WHERE dia_local = (now() AT TIME ZONE p.tz)::date
),
-- Órdenes de hoy insertadas en el mismo segundo = firma de vaciado de cola
rafagas AS (
  SELECT seg, count(*) AS n
  FROM hoy
  GROUP BY seg
  HAVING count(*) > 1
),
-- daily_number repetido dentro de hoy = órdenes que NO nacieron hoy
dups AS (
  SELECT daily_number, count(*) AS n
  FROM hoy
  WHERE daily_number IS NOT NULL
  GROUP BY daily_number
  HAVING count(*) > 1
)
SELECT n, metrica, valor FROM (
  SELECT 1 AS n, 'Órdenes hoy (todas)' AS metrica,
         count(*)::text AS valor FROM hoy
  UNION ALL
  SELECT 2, 'Órdenes hoy COMPLETED',
         count(*)::text FROM hoy WHERE status = 'COMPLETED'
  UNION ALL
  SELECT 3, 'Venta hoy COMPLETED ($)',
         coalesce(sum(total),0)::numeric(12,2)::text FROM hoy WHERE status = 'COMPLETED'
  UNION ALL
  SELECT 4, 'Primera orden de hoy (hora local)',
         coalesce(to_char(min(created_at AT TIME ZONE (SELECT tz FROM params)), 'HH24:MI:SS'), '—') FROM hoy
  UNION ALL
  SELECT 5, 'Última orden de hoy (hora local)',
         coalesce(to_char(max(created_at AT TIME ZONE (SELECT tz FROM params)), 'HH24:MI:SS'), '—') FROM hoy
  UNION ALL
  -- 👇 SI ESTE NÚMERO ES ALTO, ahí está el problema
  SELECT 6, '⚠ Órdenes insertadas en ráfaga (mismo segundo)',
         coalesce(sum(n),0)::text FROM rafagas
  UNION ALL
  SELECT 7, '⚠ Ráfaga más grande (órdenes en 1 segundo)',
         coalesce(max(n),0)::text FROM rafagas
  UNION ALL
  -- 👇 SI ESTE NÚMERO ES > 0, hay órdenes de otros días fechadas hoy
  SELECT 8, '⚠ daily_number repetidos hoy',
         coalesce(count(*),0)::text FROM dups
  UNION ALL
  SELECT 9, 'Venta en ráfagas ($) — probable inflado',
         coalesce((SELECT sum(h.total) FROM hoy h JOIN rafagas r ON h.seg = r.seg
                   WHERE h.status = 'COMPLETED'),0)::numeric(12,2)::text
  UNION ALL
  SELECT 10, 'Venta fuera de ráfagas ($) — probable real',
         coalesce((SELECT sum(h.total) FROM hoy h
                   WHERE h.status = 'COMPLETED'
                     AND h.seg NOT IN (SELECT seg FROM rafagas)),0)::numeric(12,2)::text
  UNION ALL
  SELECT 11, 'Total histórico de órdenes del negocio',
         count(*)::text FROM ord
) t
ORDER BY n;

-- ============================================================================
-- CÓMO LEERLO
-- ============================================================================
-- Fila 6/7 altas + fila 8 > 0  → confirmado: hay órdenes viejas fechadas hoy.
--   Compara la fila 9 (venta en ráfagas) contra la 10 (venta fuera de ráfagas).
--   La 10 debería parecerse a lo que realmente vendiste hoy.
--
-- Fila 6 en 0 y fila 8 en 0 → las ventas de hoy son legítimas y el monto alto
--   viene de otro lado (revisa el Historial de Caja orden por orden: ya se
--   puede hacer scroll y ver folio, hora, productos y monto de cada una).
--
-- ============================================================================
-- SI CONFIRMASTE ÓRDENES MAL FECHADAS
-- ============================================================================
-- No hay forma automática de recuperar la fecha real: se perdió al no
-- mandarse nunca al servidor. Lo que SÍ puedes hacer es aislarlas para que
-- dejen de contar como ventas de hoy. Revisa primero qué vas a tocar:
--
-- SELECT o.id, o.daily_number, o.total, o.status,
--        o.created_at AT TIME ZONE 'America/Mexico_City' AS hora_local
-- FROM orders o
-- WHERE o.business_id = '<TU_BUSINESS_ID>'
--   AND date_trunc('second', o.created_at) IN (
--     SELECT date_trunc('second', created_at)
--     FROM orders
--     WHERE business_id = '<TU_BUSINESS_ID>'
--       AND (created_at AT TIME ZONE 'America/Mexico_City')::date
--           = (now() AT TIME ZONE 'America/Mexico_City')::date
--     GROUP BY 1 HAVING count(*) > 1
--   )
-- ORDER BY o.created_at;
--
-- De aquí en adelante el problema no se repite: la app ya manda la hora real
-- de la venta como created_at.
-- ============================================================================
