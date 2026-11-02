/**
 * Historial bajo demanda para reportes (Dashboard).
 *
 * El sync de fondo solo baja los últimos LOCAL_WINDOW_DAYS días de órdenes y
 * gastos (ver FULL_PULL_WINDOW_DAYS en SyncService — es lo que bajó el egress
 * de Supabase). Todo lo anterior SIGUE en la nube, pero no en el IndexedDB del
 * equipo, así que el Dashboard no lo veía.
 *
 * Aquí se consulta a Supabase SOLO el rango que el usuario está viendo y solo
 * cuando cae fuera de la ventana local. Se cachea en memoria por rango para no
 * repetir la consulta al cambiar de pestaña o volver al mismo día.
 */
import { getSupabase } from './auth';
import { getAll } from './db';
import { Order, Expense } from '../types';

/** Ventana que el sync garantiza tener en local (con margen de seguridad). */
export const LOCAL_WINDOW_DAYS = 6;

const PAGE = 1000;     // límite por request de PostgREST
const ID_CHUNK = 150;  // ids por consulta .in() para no exceder el largo de URL

type HistoryResult = { orders: Order[]; expenses: Expense[] };
const cache = new Map<string, HistoryResult>();

/** Olvida lo cacheado (p. ej. tras borrar una venta o gasto histórico). */
export function invalidateHistoryCache() {
  cache.clear();
}

/** Inicio de la ventana local: antes de esto, el equipo no tiene datos. */
export function localWindowStart(): Date {
  return new Date(Date.now() - LOCAL_WINDOW_DAYS * 86400000);
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
      .select('id, table_id, status, total, tip, payment_method, payment_status, source, daily_number, waiter_name, customer_metadata, created_at')
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
    if (error) throw error;
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

  const expenseRows = await fetchAllPages((from, to) =>
    sb.from('expenses')
      .select('*')
      .eq('business_id', businessId)
      .gte('created_at', startISO)
      .lt('created_at', endISO)
      .range(from, to)
  );

  const expenses: Expense[] = expenseRows.map((e) => ({
    id: e.id,
    description: e.description || '',
    amount: Number(e.amount || 0),
    category: e.category || 'Otros',
    date: e.date || e.expense_date || e.created_at,
    user: e.user || '',
  }));

  const result = { orders, expenses };
  cache.set(key, result);
  return result;
}
