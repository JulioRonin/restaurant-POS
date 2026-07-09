/**
 * Cuenta de cliente + lealtad + referidos (estilo Uber Eats) para el canal
 * digital (Storefront). Todo se apoya en las tablas/RPC de
 * MIGRATION_CUSTOMER_LOYALTY.sql:
 *   - customer_profiles: perfil, puntos, consumo, código y referidos.
 *   - customer_rewards:  recompensas (rebanada gratis).
 *   - order_messages:    chat cliente ↔ negocio/repartidor.
 *
 * La lógica sensible (contadores, acreditar referidor, otorgar recompensas)
 * vive en RPCs SECURITY DEFINER para no depender de la RLS del cliente.
 */
import { getSupabase } from './auth';

// Umbrales de recompensa (deben coincidir con el SQL: % 5 y % 3).
export const REWARD_ORDERS_THRESHOLD = 5;
export const REWARD_REFERRALS_THRESHOLD = 3;

// Guardamos el código de quien refiere mientras el invitado se registra.
const PENDING_REF_KEY = 'servirest_pending_referral';

export interface CustomerProfile {
  userId: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  referralCode: string;
  referredBy: string | null;
  points: number;
  totalOrders: number;
  totalSpent: number;
  successfulReferrals: number;
  firstOrderDone: boolean;
  preferences: Record<string, any>;
}

export interface CustomerReward {
  id: string;
  rewardType: string;
  title: string;
  status: 'available' | 'redeemed' | 'expired';
  createdAt: string;
  redeemedAt: string | null;
}

export interface OrderMessage {
  id: string;
  orderId: string;
  sender: 'customer' | 'store' | 'driver';
  senderName: string | null;
  message: string;
  createdAt: string;
}

const mapProfile = (r: any): CustomerProfile => ({
  userId: r.user_id,
  fullName: r.full_name ?? null,
  phone: r.phone ?? null,
  email: r.email ?? null,
  referralCode: r.referral_code,
  referredBy: r.referred_by ?? null,
  points: r.points ?? 0,
  totalOrders: r.total_orders ?? 0,
  totalSpent: Number(r.total_spent ?? 0),
  successfulReferrals: r.successful_referrals ?? 0,
  firstOrderDone: !!r.first_order_done,
  preferences: r.preferences ?? {},
});

/** Genera un código de referido corto y legible: 4 letras del nombre + 4 dígitos. */
function generateReferralCode(name?: string | null): string {
  const letters = (name || '')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, 'X') || 'REST';
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${letters}${digits}`;
}

/**
 * Lee `?ref=CODE` del hash de la URL y lo guarda para ligarlo cuando el
 * invitado cree su cuenta. Llamar al montar el Storefront.
 */
export function capturePendingReferral(): void {
  try {
    const q = window.location.hash.split('?')[1] || '';
    const ref = new URLSearchParams(q).get('ref');
    if (ref && ref.trim()) {
      localStorage.setItem(PENDING_REF_KEY, ref.trim().toUpperCase());
    }
  } catch { /* no-op */ }
}

/** Devuelve el perfil del cliente, o null si no existe / sin Supabase. */
export async function getProfile(userId: string): Promise<CustomerProfile | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from('customer_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return mapProfile(data);
}

/**
 * Garantiza que exista un perfil para la sesión. Si no existe, lo crea:
 * genera un código de referido y liga `referred_by` a partir del código
 * pendiente (si lo hay y no es él mismo). Reintenta ante colisión de código.
 * Devuelve el perfil (nuevo o existente).
 */
export async function ensureProfile(session: any): Promise<CustomerProfile | null> {
  const sb = getSupabase();
  const user = session?.user;
  if (!sb || !user?.id) return null;

  const existing = await getProfile(user.id);
  if (existing) return existing;

  // Resuelve el código pendiente → user_id del referidor.
  let referredBy: string | null = null;
  try {
    const pending = localStorage.getItem(PENDING_REF_KEY);
    if (pending) {
      const { data: refId } = await sb.rpc('resolve_referral_code', { p_code: pending });
      if (refId && refId !== user.id) referredBy = refId as string;
    }
  } catch { /* referidor best-effort */ }

  const fullName =
    user.user_metadata?.full_name || user.user_metadata?.name || null;
  const email = user.email || null;

  // Inserta con reintento por colisión del UNIQUE en referral_code.
  for (let attempt = 0; attempt < 4; attempt++) {
    const record = {
      user_id: user.id,
      full_name: fullName,
      email,
      referral_code: generateReferralCode(fullName),
      referred_by: referredBy,
    };
    const { data, error } = await sb
      .from('customer_profiles')
      .insert(record)
      .select('*')
      .single();
    if (!error && data) {
      localStorage.removeItem(PENDING_REF_KEY);
      return mapProfile(data);
    }
    // 23505 = unique_violation. Si chocó el user_id, ya existe → léelo.
    if (error && (error as any).code === '23505') {
      const again = await getProfile(user.id);
      if (again) { localStorage.removeItem(PENDING_REF_KEY); return again; }
      // si no, fue el código: reintenta con otro
      continue;
    }
    if (error) { console.warn('[customer] ensureProfile:', error.message); break; }
  }
  return null;
}

/**
 * Actualiza campos editables del perfil (nombre, teléfono, preferencias).
 */
export async function updateProfile(
  userId: string,
  fields: Partial<Pick<CustomerProfile, 'fullName' | 'phone' | 'preferences'>>
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const payload: any = { updated_at: new Date().toISOString() };
  if (fields.fullName !== undefined) payload.full_name = fields.fullName;
  if (fields.phone !== undefined) payload.phone = fields.phone;
  if (fields.preferences !== undefined) payload.preferences = fields.preferences;
  await sb.from('customer_profiles').update(payload).eq('user_id', userId);
}

/**
 * Registra el consumo de una orden ya confirmada de un cliente logueado:
 * incrementa contadores, otorga recompensa por 5 compras y, si es su 1a
 * orden y fue referido, acredita al referidor (que a su vez puede ganar su
 * recompensa por 3 referidos). Best-effort — nunca rompe el flujo de orden.
 */
export async function recordOrderConsumption(
  userId: string,
  businessId: string,
  amount: number
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('record_customer_order', {
      p_user: userId,
      p_business: businessId,
      p_amount: amount,
    });
    if (error) { console.warn('[customer] recordOrder:', error.message); return; }
    const res = data as any;
    if (res?.first_order && res?.referred_by) {
      await sb.rpc('credit_referrer', { p_referrer: res.referred_by });
    }
  } catch (e) {
    console.warn('[customer] recordOrderConsumption failed:', e);
  }
}

/** Órdenes del cliente (por customer_metadata.customerId), más recientes primero. */
export async function getMyOrders(userId: string): Promise<any[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('orders')
    .select('id, daily_number, status, total, source, business_id, created_at, customer_metadata')
    .eq('customer_metadata->>customerId', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) { console.warn('[customer] getMyOrders:', error.message); return []; }
  return data || [];
}

/** Detalle/resumen de una orden (renglones + totales) vía RPC seguro. */
export async function getOrderDetail(orderId: string): Promise<any | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('get_order_detail', { p_order_id: orderId });
  if (error) { console.warn('[customer] getOrderDetail:', error.message); return null; }
  return data || null;
}

/**
 * Liga manualmente un código de referido al perfil del cliente (cuando lo
 * escribe en "¿Tienes un código?"). Solo se permite si aún no tiene referidor
 * y no ha hecho su 1a orden (para que el crédito siga siendo válido), y el
 * código no es el suyo. Devuelve {ok, error}.
 */
export async function applyReferralCode(
  userId: string,
  code: string
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Sin conexión' };
  const clean = code.trim().toUpperCase();
  if (!clean) return { ok: false, error: 'Escribe un código' };

  const me = await getProfile(userId);
  if (!me) return { ok: false, error: 'Perfil no encontrado' };
  if (me.referredBy) return { ok: false, error: 'Ya usaste un código de invitación' };
  if (me.firstOrderDone) return { ok: false, error: 'Los códigos solo aplican antes de tu primer pedido' };
  if (clean === me.referralCode.toUpperCase()) return { ok: false, error: 'No puedes usar tu propio código' };

  const { data: refId, error: rErr } = await sb.rpc('resolve_referral_code', { p_code: clean });
  if (rErr) return { ok: false, error: 'No pudimos validar el código' };
  if (!refId || refId === userId) return { ok: false, error: 'Ese código no existe' };

  const { error: uErr } = await sb
    .from('customer_profiles')
    .update({ referred_by: refId, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (uErr) return { ok: false, error: uErr.message };
  return { ok: true };
}

/** Recompensas del cliente. */
export async function getRewards(userId: string): Promise<CustomerReward[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('customer_rewards')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) { console.warn('[customer] getRewards:', error.message); return []; }
  return (data || []).map((r: any) => ({
    id: r.id,
    rewardType: r.reward_type,
    title: r.title,
    status: r.status,
    createdAt: r.created_at,
    redeemedAt: r.redeemed_at ?? null,
  }));
}

/** Canjea una recompensa. Devuelve true si se marcó como canjeada. */
export async function redeemReward(rewardId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data, error } = await sb.rpc('redeem_reward', { p_reward: rewardId });
  if (error) { console.warn('[customer] redeemReward:', error.message); return false; }
  return !!data;
}

/** Mensajes de una orden (chat cliente ↔ negocio/repartidor). */
export async function getOrderMessages(orderId: string): Promise<OrderMessage[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('order_messages')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  if (error) { console.warn('[customer] getOrderMessages:', error.message); return []; }
  return (data || []).map((m: any) => ({
    id: m.id,
    orderId: m.order_id,
    sender: m.sender,
    senderName: m.sender_name ?? null,
    message: m.message,
    createdAt: m.created_at,
  }));
}

/** Envía un mensaje ligado a una orden. */
export async function sendOrderMessage(
  orderId: string,
  businessId: string | null,
  message: string,
  senderName?: string | null
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !message.trim()) return false;
  const { error } = await sb.from('order_messages').insert({
    order_id: orderId,
    business_id: businessId,
    sender: 'customer',
    sender_name: senderName || 'Cliente',
    message: message.trim(),
  });
  if (error) { console.warn('[customer] sendOrderMessage:', error.message); return false; }
  return true;
}

/** URL para compartir el código de referido (abre el storefront con ?ref=). */
export function referralShareUrl(businessId: string, code: string): string {
  return `${window.location.origin}${window.location.pathname}#/o/${businessId}?ref=${encodeURIComponent(code)}`;
}
