/**
 * Historial bajo demanda para reportes (Dashboard y Caja).
 *
 * El sync de fondo solo baja una ventana reciente de órdenes y gastos (ver
 * FULL_PULL_WINDOW_DAYS en SyncService — es lo que bajó el egress de
 * Supabase), y aun dentro de esa ventana el equipo puede no tener todo
 * (venta cobrada en otra tablet, navegador limpiado, otra sesión).
 *
 * Por eso cualquier periodo anterior a hoy se consulta en Supabase — solo el
 * rango que el usuario está viendo — y se mezcla con lo local. Se cachea en
 * memoria por rango para no repetir la consulta.
 */
import { getSupabase } from './auth';
import { getAll } from './db';
import { Order, Expense } from '../types';

const PAGE = 1000;     // límite por request de PostgREST
const ID_CHUNK = 150;  // ids por consulta .in() para no exceder el largo de URL

type HistoryResult = { orders: Order[]; expenses: Expense[] };
const cache = new Map<string, HistoryResult>();

/** Olvida lo cacheado (p. ej. tras borrar una venta o gasto histórico). */
export function invalidateHistoryCache() {
  cache.clear();
}

/** Medianoche local de hoy. Todo lo anterior se consulta en la nube. */
export function startOfToday(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const TERMINAL = new Set(['COMPLETED', 'CANCELLED']);

/**
 * Junta órdenes locales con las de la nube para un periodo pasado.
 * La nube es la fuente de verdad (el equipo puede no tener la orden, o
 * tenerla con un estatus viejo, p. ej. COOKING cuando otra tablet ya la
 * cobró). Excepción: si el equipo ya la cerró y ese cambio aún no sube,
 * gana la versión local.
 */
export function mergeOrders<T extends { id: string; status: any; items?: any[] }>(local: T[], cloud: T[]): T[] {
  if (cloud.length === 0) return local;
  const localById = new Map(local.map((o) => [o.id, o]));
  const merged: T[] = [];
  const seen = new Set<string>();
  for (const c of cloud) {
    const l = localById.get(c.id);
    seen.add(c.id);
    if (l && TERMINAL.has(l.status) && !TERMINAL.has(c.status)) { merged.push(l); continue; }
    // Si la nube no trae renglones pero el equipo sí, se conservan los locales.
    merged.push(l && (!c.items || c.items.length === 0) && l.items?.length ? { ...c, items: l.items } : c);
  }
  for (const l of local) if (!seen.has(l.id)) merged.push(l);
  return merged;
}

async function fetchAllPages(build: (from: number, to: number) => any): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function fetchHistory(businessId: string, start: Date, end: Date): Promise<HistoryResult> {
  const key = `${businessId}|${start.toISOString()}|${end.toISOString()}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const sb = getSupabase();
  if (!sb || !businessId) return { orders: [], expenses: [] };

  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const orderRows = await fetchAllPages((from, to) =>
    sb.from('orders')
      .select('*')
      .eq('business_id', businessId)
      .gte('created_at', startISO)
      .lt('created_at', endISO)
      .order('created_at', { ascending: true })
      .range(from, to)
  );

  // Renglones de esas órdenes, para "platillos vendidos" y filtro por categoría.
  const ids = orderRows.map((o) => o.id);
  const itemRows: any[] = [];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    const { data, error } = await sb.from('order_items')
      .select('order_id, menu_item_id, quantity, price_at_time')
      .in('order_id', chunk);
    // Sin renglones el total del día sigue siendo correcto; solo se pierde
    // el conteo de platillos. No se tira toda la consulta por esto.
    if (error) { console.warn('[history] order_items:', error.message); break; }
    itemRows.push(...(data || []));
  }

  // Nombre/categoría desde el menú local (ya está en el equipo, 0 egress).
  let products: any[] = [];
  try { products = (await getAll('products')) as any[]; } catch { /* sin menú local */ }
  const productById = new Map(products.map((p) => [p.id, p]));

  const itemsByOrder = new Map<string, any[]>();
  for (const it of itemRows) {
    const p = productById.get(it.menu_item_id);
    const list = itemsByOrder.get(it.order_id) || [];
    list.push({
      id: it.menu_item_id,
      name: p?.name || 'Platillo',
      category: p?.category || 'Uncategorized',
      price: Number(it.price_at_time || 0),
      quantity: it.quantity || 1,
    });
    itemsByOrder.set(it.order_id, list);
  }

  const orders: Order[] = orderRows.map((o) => ({
    id: o.id,
    tableId: o.table_id || 'COUNTER',
    status: o.status,
    total: Number(o.total || 0),
    tip: Number(o.tip || 0),
    paymentMethod: o.payment_method || undefined,
    paymentStatus: o.payment_status || undefined,
    source: o.source || undefined,
    dailyNumber: o.daily_number ?? undefined,
    waiterName: o.waiter_name || undefined,
    customerName: o.customer_metadata?.customerName || undefined,
    payments: o.customer_metadata?.payments || undefined,
    timestamp: new Date(o.created_at),
    items: itemsByOrder.get(o.id) || [],
  } as Order));

  // Gastos por su FECHA (`date`), no por cuándo se insertaron: los gastos
  // rescatados del navegador se insertan hoy aunque sean de semanas atrás.
  // Si una base vieja no tiene `date`, se usa created_at.
  let expenseRows: any[] = [];
  const expensesBy = (col: string) => fetchAllPages((from, to) =>
    sb.from('expenses')
      .select('*')
      .eq('business_id', businessId)
      .gte(col, startISO)
      .lt(col, endISO)
      .range(from, to)
  );
  try {
    expenseRows = await expensesBy('date');
  } catch {
    try { expenseRows = await expensesBy('created_at'); }
    catch (e: any) { console.warn('[history] expenses:', e?.message || e); } // no esconde las ventas
  }

  const expenses: Expense[] = expenseRows.map((e) => ({
    id: e.id,
    description: e.description || '',
    amount: Number(e.amount || 0),
    category: e.category || 'Otros',
    date: e.date || e.expense_date || e.created_at,
    user: e.user || e.executor || '',
  }));

  const result = { orders, expenses };
  cache.set(key, result);
  return result;
}
