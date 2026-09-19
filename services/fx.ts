/**
 * Tipo de cambio USD → MXN para cobrar en dólares.
 *
 * El token de Banxico vive SOLO en el servidor (api/fx.ts). Aquí solo se
 * consulta ese endpoint y se cachea localmente, porque una caja no puede
 * quedarse sin cobrar por una falla de red: si Banxico o el internet fallan,
 * se usa el último tipo conocido (marcado como vencido para que el cajero lo
 * sepa) y, en última instancia, el tipo manual que el negocio haya guardado
 * en Ajustes.
 */

const CACHE_KEY = 'sr_fx_usd_mxn';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 h — el FIX se publica 1 vez al día

export interface FxRate {
  /** Pesos por dólar. */
  rate: number;
  /** Fecha del dato según Banxico (dd/mm/aaaa). */
  date: string;
  /** De dónde salió: Banxico, caché local vencido, o captura manual. */
  origin: 'banxico' | 'cache' | 'manual';
  /** true = el dato no es de hoy / no se pudo refrescar. */
  stale: boolean;
  fetchedAt: string;
}

function readCache(): FxRate | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Number.isFinite(parsed?.rate) && parsed.rate > 0 ? parsed : null;
  } catch { return null; }
}

function writeCache(v: FxRate) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch {}
}

/** Último tipo conocido sin pegarle a la red (para pintar la UI al instante). */
export function getCachedFxRate(): FxRate | null {
  const c = readCache();
  if (!c) return null;
  const age = Date.now() - new Date(c.fetchedAt).getTime();
  return { ...c, stale: c.stale || age > CACHE_TTL_MS };
}

/**
 * Trae el tipo de cambio. Usa el caché si sigue fresco; si no, consulta el
 * endpoint. Nunca lanza: si todo falla devuelve el caché vencido o null.
 */
export async function fetchFxRate(force = false): Promise<FxRate | null> {
  const cached = readCache();
  if (!force && cached) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age < CACHE_TTL_MS) return { ...cached, stale: false };
  }

  try {
    const resp = await fetch('/api/fx', { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error(`/api/fx respondió ${resp.status}`);
    const json = await resp.json();
    if (!Number.isFinite(json?.rate) || json.rate <= 0) throw new Error('Respuesta sin tipo de cambio');

    const value: FxRate = {
      rate: json.rate,
      date: json.date || '',
      origin: 'banxico',
      stale: !!json.stale,
      fetchedAt: new Date().toISOString(),
    };
    writeCache(value);
    return value;
  } catch (e) {
    console.warn('[fx] No se pudo actualizar el tipo de cambio:', e);
    // El tipo de ayer sirve para cobrar; una caja detenida, no.
    return cached ? { ...cached, origin: 'cache', stale: true } : null;
  }
}

/**
 * Tipo de cambio efectivo del negocio.
 *
 * Casi ningún restaurante cobra al FIX exacto: aplica un ajuste para cubrir
 * el costo de convertir los dólares en el banco. `spreadPct` resta ese
 * porcentaje al tipo de referencia (ej. FIX 18.50 con 3% → 17.95 pesos por
 * dólar), que es como se cobra en la práctica en la frontera.
 * Si el negocio prefiere fijar el tipo a mano, `manualRate` gana sobre todo.
 */
export function effectiveRate(
  reference: number,
  opts: { spreadPct?: number; manualRate?: number } = {}
): number {
  if (opts.manualRate && opts.manualRate > 0) return opts.manualRate;
  const spread = opts.spreadPct || 0;
  return reference * (1 - spread / 100);
}

/** Convierte pesos a dólares y redondea a 2 decimales hacia arriba. */
export function mxnToUsd(amountMxn: number, rate: number): number {
  if (!rate || rate <= 0) return 0;
  return Math.ceil((amountMxn / rate) * 100) / 100;
}

/** Convierte dólares a pesos. */
export function usdToMxn(amountUsd: number, rate: number): number {
  return amountUsd * rate;
}
