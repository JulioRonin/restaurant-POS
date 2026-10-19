import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Tipo de cambio USD → MXN desde el SIE de Banco de México.
 *
 * POR QUÉ VIVE EN EL SERVIDOR
 * BANXICO_TOKEN es un secreto. Si el navegador llamara a Banxico directo, el
 * token quedaría expuesto en el bundle y cualquiera podría quemarte la cuota
 * (además de que Banxico no manda cabeceras CORS, así que ni funcionaría).
 * Esta función es el único lugar que ve el token.
 *
 * SERIE
 * SF43718 = "Tipo de cambio Pesos por dólar E.U.A., para solventar
 * obligaciones denominadas en moneda extranjera (FIX)". Es el que publica el
 * DOF y el que usa la mayoría de los negocios como referencia.
 * Se puede cambiar con BANXICO_SERIE si se quiere otra (p. ej. SF60653, el
 * tipo de cambio para pagos).
 *
 * CACHÉ
 * El FIX se publica UNA vez al día (alrededor del mediodía). Consultarlo en
 * cada cobro sería tirar cuota a la basura, así que se cachea en memoria del
 * lambda y se manda Cache-Control para que el CDN de Vercel también lo
 * sostenga. Si Banxico falla pero hay un valor cacheado, se devuelve ese
 * marcado como `stale` — es preferible cobrar con el tipo de ayer que dejar
 * la caja sin poder cobrar en dólares.
 *
 * Variables de entorno (Vercel):
 *   BANXICO_TOKEN   — token del SIE (https://www.banxico.org.mx/SieAPIRest)
 *   BANXICO_SERIE   — opcional, default SF43718
 */

const DEFAULT_SERIE = 'SF43718';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 h

type FxPayload = {
  rate: number;
  date: string;      // dd/mm/aaaa tal como lo publica Banxico
  serie: string;
  source: 'banxico';
  fetchedAt: string;
  stale?: boolean;
};

// Caché en memoria del lambda. Sobrevive mientras la instancia esté caliente.
let cached: FxPayload | null = null;
let cachedAt = 0;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.BANXICO_TOKEN;
  const serie = process.env.BANXICO_SERIE || DEFAULT_SERIE;

  // Caché fresco: se responde sin tocar Banxico.
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json(cached);
  }

  if (!token) {
    // Sin token no hay forma de consultar. Se avisa explícito para que la UI
    // pueda ofrecer captura manual del tipo de cambio en vez de fallar mudo.
    return res.status(503).json({
      error: 'BANXICO_TOKEN no está configurado en el servidor',
      code: 'NO_TOKEN',
    });
  }

  const url = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${serie}/datos/oportuno`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch(url, {
      headers: { 'Bmx-Token': token, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) throw new Error(`Banxico respondió ${resp.status}`);

    const json: any = await resp.json();
    const dato = json?.bmx?.series?.[0]?.datos?.[0];
    const rate = parseFloat(dato?.dato);

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('Banxico devolvió un dato no numérico');
    }

    const payload: FxPayload = {
      rate,
      date: dato?.fecha || '',
      serie,
      source: 'banxico',
      fetchedAt: new Date().toISOString(),
    };

    cached = payload;
    cachedAt = Date.now();

    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json(payload);
  } catch (err: any) {
    console.error('[fx] Error consultando Banxico:', err?.message || err);

    // Mejor un tipo de cambio viejo que una caja que no puede cobrar.
    if (cached) {
      return res.status(200).json({ ...cached, stale: true });
    }

    return res.status(502).json({
      error: 'No se pudo obtener el tipo de cambio de Banxico',
      code: 'UPSTREAM_ERROR',
      detail: err?.message || String(err),
    });
  }
}
