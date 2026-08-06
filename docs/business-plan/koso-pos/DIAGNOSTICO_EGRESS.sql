-- ─────────────────────────────────────────────────────────────────────────
-- DIAGNÓSTICO DE EGRESS — ¿por qué ServiRest consumió 300 GB?
-- ─────────────────────────────────────────────────────────────────────────
-- Corre estas consultas en Supabase → SQL Editor (una por una) para ver
-- QUÉ tabla está pesada y si quedan fotos guardadas como base64 dentro de
-- la base de datos (que es lo que multiplicaba el costo de cada sync).
--
-- Contexto: el bug principal ya está corregido en el código (el sync
-- descargaba las 9 tablas COMPLETAS cada 60 segundos). Esto es para
-- confirmar si además hay datos pesados que convenga limpiar.
-- ─────────────────────────────────────────────────────────────────────────


-- 1. TAMAÑO REAL DE CADA TABLA ──────────────────────────────────────────
-- Te dice cuánto pesaba cada descarga completa que hacía el sync.
SELECT
  relname                                        AS tabla,
  to_char(n_live_tup, 'FM999,999,999')           AS filas,
  pg_size_pretty(pg_total_relation_size(relid))  AS peso_total
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;


-- 2. ¿QUEDAN FOTOS EN BASE64 DENTRO DE LA BASE? ─────────────────────────
-- Las fotos deben vivir en Storage (URL corta https://...), NO como
-- 'data:image/...' incrustado en la fila. Una sola foto base64 puede pesar
-- 200-500 KB, y el sync las re-descargaba TODAS cada minuto.
SELECT
  count(*) FILTER (WHERE image LIKE 'data:%')                AS fotos_base64_pesadas,
  count(*) FILTER (WHERE image LIKE 'http%')                 AS fotos_en_storage_ok,
  count(*) FILTER (WHERE image IS NULL OR image = '')        AS sin_foto,
  pg_size_pretty(COALESCE(sum(length(image)) FILTER (WHERE image LIKE 'data:%'), 0)::bigint)
                                                             AS peso_de_las_base64
FROM menu_items;


-- 3. LAS FILAS MÁS PESADAS DEL MENÚ ─────────────────────────────────────
-- Si el punto 2 arrojó base64, aquí ves cuáles son y cuánto pesan.
SELECT
  id,
  name,
  pg_size_pretty(length(image)::bigint) AS peso_imagen,
  left(image, 30)                       AS empieza_con
FROM menu_items
WHERE image IS NOT NULL AND image <> ''
ORDER BY length(image) DESC
LIMIT 15;


-- 4. VOLUMEN HISTÓRICO DE ÓRDENES ───────────────────────────────────────
-- El sync viejo re-descargaba TODAS las órdenes desde el inicio de los
-- tiempos, cada minuto. Esto te dice cuánto historial se estaba arrastrando.
SELECT
  count(*)                                          AS ordenes_totales,
  count(*) FILTER (WHERE created_at > now() - interval '7 days')  AS ultimos_7_dias,
  min(created_at)::date                             AS orden_mas_vieja
FROM orders;

SELECT count(*) AS renglones_de_orden_totales FROM order_items;


-- 5. MENSAJES DEL CANAL DIGITAL ─────────────────────────────────────────
-- La pantalla de Cocina los re-descargaba (hasta 300) cada 10 segundos.
SELECT count(*) AS mensajes_totales FROM order_messages;


-- ─────────────────────────────────────────────────────────────────────────
-- LIMPIEZA OPCIONAL (solo si el punto 2 mostró base64)
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ ESTO BORRA LAS FOTOS BASE64 de la base de datos. Los platillos
-- quedarán SIN FOTO y tendrás que volver a subirlas desde Menú (que ahora
-- ya las manda a Storage correctamente).
--
-- Haz esto solo si el punto 2 muestra un peso considerable. Descomenta:
--
-- UPDATE menu_items SET image = '' WHERE image LIKE 'data:%';
--
-- Alternativa sin perder nada: no borres, y simplemente vuelve a subir la
-- foto de cada platillo desde el módulo Menú — al guardarla, se reemplaza
-- el base64 por la URL de Storage automáticamente.
-- ─────────────────────────────────────────────────────────────────────────
