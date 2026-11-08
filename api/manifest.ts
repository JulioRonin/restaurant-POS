import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Manifest de app instalable POR NEGOCIO.
 *
 * El Storefront (`#/o/{businessId}`) apunta su <link rel="manifest"> aquí,
 * así al instalarlo en el celular la app queda con el nombre y el logo del
 * restaurante — no como "ServiRest" — y abre directo en su tienda.
 *
 * `id` distinto por negocio: un cliente puede tener instaladas las apps de
 * varios restaurantes sin que el sistema operativo las confunda.
 *
 * Solo expone datos públicos (nombre, logo, colores). Usa la service role
 * key porque business_settings no es legible para anónimos.
 */
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const businessId = String(req.query.b || '');
  if (!UUID_RE.test(businessId)) {
    return res.status(400).json({ error: 'Parámetro b inválido' });
  }

  let name = 'Ordena en línea';
  let logoUrl: string | null = null;
  let themeColor = '#1A1E2E';

  try {
    if (supabaseUrl && serviceKey) {
      const sb = createClient(supabaseUrl, serviceKey);
      const [{ data: biz }, { data: cfg }, { data: prog }] = await Promise.all([
        sb.from('businesses').select('name, settings').eq('id', businessId).maybeSingle(),
        sb.from('business_settings').select('value').eq('business_id', businessId).eq('key', 'config').maybeSingle(),
        sb.from('loyalty_programs').select('card_color').eq('business_id', businessId).maybeSingle(),
      ]);
      const settings = { ...((biz as any)?.settings || {}), ...((cfg as any)?.value || {}) };
      name = settings.name || (biz as any)?.name || name;
      logoUrl = settings.logoUrl || null;
      if ((prog as any)?.card_color) themeColor = (prog as any).card_color;
    }
  } catch (e) {
    // Sin datos del negocio igual devolvemos un manifest válido.
    console.warn('[manifest] no se pudo leer el negocio:', (e as any)?.message || e);
  }

  // Logo solo si es una URL https (no data: gigantes ni rutas raras).
  const icons: any[] = [];
  if (logoUrl && /^https:\/\//i.test(logoUrl)) {
    icons.push({ src: logoUrl, sizes: '192x192', purpose: 'any' });
    icons.push({ src: logoUrl, sizes: '512x512', purpose: 'any' });
  }
  icons.push({ src: '/favicon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' });

  const manifest = {
    id: `/o/${businessId}`,
    name,
    short_name: name.length > 14 ? name.slice(0, 14).trim() : name,
    description: `Ordena, revisa tus pedidos y tu tarjeta de sellos de ${name}.`,
    start_url: `/#/o/${businessId}`,
    scope: '/',
    display: 'standalone',
    background_color: '#FAF8F4',
    theme_color: themeColor,
    orientation: 'portrait',
    icons,
  };

  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(JSON.stringify(manifest));
}
