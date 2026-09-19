-- ─────────────────────────────────────────────────────────────────────────
-- DIAGNÓSTICO DE EGRESS — ¿por qué ServiRest consumió 300 GB?
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ IMPORTANTE: el SQL Editor de Supabase solo muestra el resultado del
-- ÚLTIMO SELECT cuando corres varias consultas juntas. Por eso abajo está
-- TODO EN UNA SOLA CONSULTA: seleccionas el bloque de la PARTE 1, le das
-- Run, y ves todos los números de un jalón.
--
-- Contexto: el bug principal ya está corregido en el código (el sync
-- descargaba las 9 tablas COMPLETAS cada 60 segundos). Esto sirve para
-- confirmar si además hay datos pesados que convenga limpiar.
-- ─────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════
-- PARTE 1 · RESUMEN COMPLETO (selecciona desde aquí hasta el ';' y corre)
-- ═════════════════════════════════════════════════════════════════════════
WITH menu AS (
  SELECT
    count(*)                                                    AS total,
    count(*) FILTER (WHERE image LIKE 'data:%')                 AS base64,
    count(*) FILTER (WHERE image LIKE 'http%')                  AS en_storage,
    COALESCE(sum(length(image)) FILTER (WHERE image LIKE 'data:%'), 0) AS bytes_base64
  FROM menu_items
),
ord AS (
  SELECT
    count(*)                                                       AS total,
    count(*) FILTER (WHERE created_at > now() - interval '7 days')  AS recientes
  FROM orders
),
items AS (SELECT count(*) AS total FROM order_items)
SELECT * FROM (
  SELECT 1 AS n, '📦 Peso total de menu_items'          AS metrica,
         pg_size_pretty(pg_total_relation_size('menu_items'))  AS valor
  UNION ALL
  SELECT 2, '📦 Peso total de orders',
         pg_size_pretty(pg_total_relation_size('orders'))
  UNION ALL
  SELECT 3, '📦 Peso total de order_items',
         pg_size_pretty(pg_total_relation_size('order_items'))
  UNION ALL
  SELECT 4, '🖼️ Platillos con foto BASE64 (el problema)',
         (SELECT base64::text FROM menu)
  UNION ALL
  SELECT 5, '🖼️ Peso de esas fotos base64',
         (SELECT pg_size_pretty(bytes_base64::bigint) FROM menu)
  UNION ALL
  SELECT 6, '✅ Platillos con foto en Storage (correcto)',
         (SELECT en_storage::text FROM menu)
  UNION ALL
  SELECT 7, '📋 Platillos totales',
         (SELECT total::text FROM menu)
  UNION ALL
  SELECT 8, '🧾 Órdenes totales (histórico completo)',
         (SELECT total::text FROM ord)
  UNION ALL
  SELECT 9, '🧾 Órdenes de los últimos 7 días',
         (SELECT recientes::text FROM ord)
  UNION ALL
  SELECT 10, '🧾 Renglones de orden totales',
         (SELECT total::text FROM items)
  UNION ALL
  SELECT 11, '💾 PESO DE CADA SYNC (se bajaba cada 60 seg)',
         pg_size_pretty(
           pg_total_relation_size('menu_items')
           + pg_total_relation_size('orders')
           + pg_total_relation_size('order_items')
         )
) resumen
ORDER BY n;


-- ═════════════════════════════════════════════════════════════════════════
-- PARTE 2 · ¿Cuáles son los platillos más pesados? (corre esto aparte)
-- ═════════════════════════════════════════════════════════════════════════
-- Solo tiene sentido si la métrica 4 de arriba dio más de 0.
--
-- SELECT name,
--        pg_size_pretty(length(image)::bigint) AS peso_foto,
--        left(image, 25)                       AS tipo
-- FROM menu_items
-- WHERE image IS NOT NULL AND image <> ''
-- ORDER BY length(image) DESC
-- LIMIT 15;


-- ═════════════════════════════════════════════════════════════════════════
-- PARTE 3 · LIMPIEZA (solo si la métrica 4 dio un número alto)
-- ═════════════════════════════════════════════════════════════════════════
-- ⚠️ Esto BORRA las fotos base64 de la base. Los platillos quedan sin foto
-- y hay que volver a subirlas desde el módulo Menú (que ya las manda a
-- Storage correctamente, no como base64).
--
-- UPDATE menu_items SET image = '' WHERE image LIKE 'data:%';
--
-- Alternativa sin perder nada de golpe: no borres, y ve volviendo a subir
-- la foto de cada platillo desde Menú — al guardarla se reemplaza sola el
-- base64 por la URL de Storage.
-- ─────────────────────────────────────────────────────────────────────────
