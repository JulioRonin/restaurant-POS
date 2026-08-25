/**
 * Servicio del módulo Eventos (banquetes / catering).
 *
 * Administra el catálogo de paquetes (qué incluye cada uno, costos, mínimo de
 * invitados) y los eventos contratados/cotizados (cliente, fecha, paquete,
 * anticipo, estatus).
 *
 * PERSISTENCIA — local-first con push directo a Supabase:
 * A propósito NO usa la cola de sync de IndexedDB (SyncService): este módulo
 * es de planeación del administrador, no de operación offline en piso, y la
 * cola general ya nos ha dado sustos (renglones perdidos por FK). Aquí el
 * modelo es simple y autocontenido:
 *   - Cache en localStorage por negocio → la pantalla abre al instante.
 *   - Toda mutación escribe primero el cache (con bandera _dirty) y luego
 *     intenta subir a Supabase; si no hay red, la bandera queda y se
 *     reintenta en el siguiente load/flush.
 *   - refresh() baja lo del servidor y hace merge: gana el server SALVO en
 *     registros locales _dirty (cambios aún no subidos).
 * Requiere correr docs/business-plan/koso-pos/MIGRATION_EVENTS.sql.
 */
import { getSupabase } from './auth';

/* ─── Tipos ──────────────────────────────────────────────────────────── */

export interface EventPackage {
  id: string;
  name: string;
  description: string;
  /** Costo base del paquete (montaje, renta, etc.). */
  basePrice: number;
  /** Costo adicional por invitado. Total sugerido = base + porPersona × invitados. */
  pricePerPerson: number;
  minGuests: number;
  /** Lo que incluye el paquete (renglones de texto). */
  includes: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _dirty?: boolean;
  _deleted?: boolean;
}

export type CateringEventStatus = 'QUOTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

/** Gasto asociado a un evento (insumos, renta, personal extra…). */
export interface EventExpense {
  id: string;
  description: string;
  amount: number;
}

export interface CateringEvent {
  id: string;
  clientName: string;
  clientPhone: string;
  /** YYYY-MM-DD (día local del evento). */
  eventDate: string;
  /** HH:MM opcional. */
  eventTime: string;
  venue: string;
  guests: number;
  packageId: string | null;
  /** Nombre del paquete congelado al cotizar (por si luego se edita/borra). */
  packageName: string;
  status: CateringEventStatus;
  /** Precio cerrado con el cliente (editable, no siempre el sugerido). */
  quotedTotal: number;
  /** Anticipo recibido. */
  deposit: number;
  /** Gastos del evento — para utilidad neta y % de margen. */
  expenses: EventExpense[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  _dirty?: boolean;
  _deleted?: boolean;
}

/* ─── Cache local ────────────────────────────────────────────────────── */

const pkgKey = (bizId: string) => `sr_event_packages_${bizId}`;
const evtKey = (bizId: string) => `sr_events_${bizId}`;

function readCache<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function writeCache<T>(key: string, rows: T[]) {
  try { localStorage.setItem(key, JSON.stringify(rows)); } catch {}
}

export function getCachedPackages(bizId: string): EventPackage[] {
  return readCache<EventPackage>(pkgKey(bizId)).filter(p => !p._deleted);
}

export function getCachedEvents(bizId: string): CateringEvent[] {
  return readCache<CateringEvent>(evtKey(bizId)).filter(e => !e._deleted);
}

/* ─── Transformación fila ⇄ registro ─────────────────────────────────── */

function pkgFromRow(r: any): EventPackage {
  return {
    id: r.id,
    name: r.name || '',
    description: r.description || '',
    basePrice: Number(r.base_price || 0),
    pricePerPerson: Number(r.price_per_person || 0),
    minGuests: Number(r.min_guests || 0),
    includes: Array.isArray(r.includes) ? r.includes : [],
    active: r.active !== false,
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
  };
}

function pkgToRow(p: EventPackage, bizId: string) {
  return {
    id: p.id,
    business_id: bizId,
    name: p.name,
    description: p.description,
    base_price: p.basePrice,
    price_per_person: p.pricePerPerson,
    min_guests: p.minGuests,
    includes: p.includes,
    active: p.active,
    updated_at: p.updatedAt,
    created_at: p.createdAt,
  };
}

function evtFromRow(r: any): CateringEvent {
  return {
    id: r.id,
    clientName: r.client_name || '',
    clientPhone: r.client_phone || '',
    eventDate: r.event_date || '',
    eventTime: r.event_time || '',
    venue: r.venue || '',
    guests: Number(r.guests || 0),
    packageId: r.package_id || null,
    packageName: r.package_name || '',
    status: (r.status as CateringEventStatus) || 'QUOTED',
    quotedTotal: Number(r.quoted_total || 0),
    deposit: Number(r.deposit || 0),
    expenses: Array.isArray(r.expenses) ? r.expenses : [],
    notes: r.notes || '',
    createdAt: r.created_at || new Date().toISOString(),
    updatedAt: r.updated_at || new Date().toISOString(),
  };
}

function evtToRow(e: CateringEvent, bizId: string) {
  return {
    id: e.id,
    business_id: bizId,
    client_name: e.clientName,
    client_phone: e.clientPhone,
    event_date: e.eventDate,
    event_time: e.eventTime,
    venue: e.venue,
    guests: e.guests,
    package_id: e.packageId,
    package_name: e.packageName,
    status: e.status,
    quoted_total: e.quotedTotal,
    deposit: e.deposit,
    expenses: e.expenses,
    notes: e.notes,
    updated_at: e.updatedAt,
    created_at: e.createdAt,
  };
}

/* ─── Flush de pendientes (dirty/deleted → Supabase) ─────────────────── */

async function flushTable<T extends { id: string; _dirty?: boolean; _deleted?: boolean }>(
  bizId: string,
  cacheKeyFn: (b: string) => string,
  table: string,
  toRow: (rec: T, bizId: string) => any
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const key = cacheKeyFn(bizId);
  const rows = readCache<T>(key);
  let changed = false;

  for (const rec of rows) {
    try {
      if (rec._deleted) {
        const { error } = await sb.from(table).delete().eq('id', rec.id).eq('business_id', bizId);
        if (!error) { (rec as any).__purge = true; changed = true; }
      } else if (rec._dirty) {
        const { error } = await sb.from(table).upsert(toRow(rec, bizId), { onConflict: 'id' });
        if (!error) { delete rec._dirty; changed = true; }
        else console.warn(`[events] upsert ${table}:`, error.message);
      }
    } catch (e) {
      console.warn(`[events] flush ${table} falló (se reintenta luego):`, e);
    }
  }

  if (changed) writeCache(key, rows.filter(r => !(r as any).__purge));
}

export async function flushPendingEvents(bizId: string): Promise<void> {
  if (!bizId) return;
  await flushTable<EventPackage>(bizId, pkgKey, 'event_packages', pkgToRow);
  await flushTable<CateringEvent>(bizId, evtKey, 'catering_events', evtToRow);
}

/* ─── Refresh (server → cache, respetando cambios locales) ───────────── */

async function refreshTable<T extends { id: string; updatedAt: string; _dirty?: boolean; _deleted?: boolean }>(
  bizId: string,
  cacheKeyFn: (b: string) => string,
  table: string,
  fromRow: (r: any) => T
): Promise<T[]> {
  const key = cacheKeyFn(bizId);
  const local = readCache<T>(key);
  const sb = getSupabase();
  if (!sb) return local.filter(r => !r._deleted);

  try {
    const { data, error } = await sb.from(table).select('*').eq('business_id', bizId);
    if (error) throw error;

    const merged: T[] = (data || []).map(fromRow);
    const serverIds = new Set(merged.map(r => r.id));

    // Cambios locales aún no subidos ganan sobre el server; los registros
    // locales que el server no conoce (creados offline) se conservan.
    for (const loc of local) {
      if (loc._deleted) {
        // Sigue pendiente de borrar en el server: se conserva la lápida y se
        // quita de la vista (flush la ejecutará).
        const idx = merged.findIndex(r => r.id === loc.id);
        if (idx >= 0) merged.splice(idx, 1);
        merged.push(loc);
      } else if (loc._dirty) {
        const idx = merged.findIndex(r => r.id === loc.id);
        if (idx >= 0) merged[idx] = loc; else merged.push(loc);
      } else if (!serverIds.has(loc.id)) {
        // Limpio pero ausente en el server → fue borrado desde otro equipo.
        // No se conserva.
      }
    }

    writeCache(key, merged);
    return merged.filter(r => !r._deleted);
  } catch (e) {
    console.warn(`[events] refresh ${table} sin red (se usa cache):`, e);
    return local.filter(r => !r._deleted);
  }
}

/** Baja del server, mezcla con cambios locales y reintenta pendientes. */
export async function refreshEventsData(bizId: string): Promise<{
  packages: EventPackage[];
  events: CateringEvent[];
}> {
  if (!bizId) return { packages: [], events: [] };
  await flushPendingEvents(bizId);
  const [packages, events] = await Promise.all([
    refreshTable<EventPackage>(bizId, pkgKey, 'event_packages', pkgFromRow),
    refreshTable<CateringEvent>(bizId, evtKey, 'catering_events', evtFromRow),
  ]);
  return { packages, events };
}

/* ─── Mutaciones (cache primero, server best-effort) ─────────────────── */

function upsertLocal<T extends { id: string }>(key: string, rec: T) {
  const rows = readCache<T>(key);
  const idx = rows.findIndex(r => r.id === rec.id);
  if (idx >= 0) rows[idx] = rec; else rows.push(rec);
  writeCache(key, rows);
}

function markDeletedLocal<T extends { id: string; _deleted?: boolean; _dirty?: boolean }>(key: string, id: string) {
  const rows = readCache<T>(key);
  const idx = rows.findIndex(r => r.id === id);
  if (idx >= 0) { rows[idx]._deleted = true; rows[idx]._dirty = false; writeCache(key, rows); }
}

export function saveEventPackage(bizId: string, pkg: EventPackage): EventPackage {
  const rec: EventPackage = { ...pkg, updatedAt: new Date().toISOString(), _dirty: true };
  upsertLocal(pkgKey(bizId), rec);
  flushPendingEvents(bizId).catch(() => {});
  return rec;
}

export function deleteEventPackage(bizId: string, id: string) {
  markDeletedLocal<EventPackage>(pkgKey(bizId), id);
  flushPendingEvents(bizId).catch(() => {});
}

export function saveCateringEvent(bizId: string, evt: CateringEvent): CateringEvent {
  const rec: CateringEvent = { ...evt, updatedAt: new Date().toISOString(), _dirty: true };
  upsertLocal(evtKey(bizId), rec);
  flushPendingEvents(bizId).catch(() => {});
  return rec;
}

export function deleteCateringEvent(bizId: string, id: string) {
  markDeletedLocal<CateringEvent>(evtKey(bizId), id);
  flushPendingEvents(bizId).catch(() => {});
}

/* ─── Utilidades de negocio ──────────────────────────────────────────── */

/** Precio sugerido según el paquete y el número de invitados. */
export function suggestedTotal(pkg: EventPackage | undefined, guests: number): number {
  if (!pkg) return 0;
  return pkg.basePrice + pkg.pricePerPerson * Math.max(guests, 0);
}

/** Total de gastos registrados en un evento. */
export function eventCosts(evt: CateringEvent): number {
  return (evt.expenses || []).reduce((s, x) => s + Number(x.amount || 0), 0);
}

/** Utilidad neta del evento = precio pactado - gastos. */
export function eventProfit(evt: CateringEvent): number {
  return (evt.quotedTotal || 0) - eventCosts(evt);
}

export const EVENT_STATUS_META: Record<CateringEventStatus, { label: string; tone: string }> = {
  QUOTED:    { label: 'Cotizado',   tone: 'mostaza' },
  CONFIRMED: { label: 'Confirmado', tone: 'terracota' },
  COMPLETED: { label: 'Realizado',  tone: 'success' },
  CANCELLED: { label: 'Cancelado',  tone: 'danger' },
};
