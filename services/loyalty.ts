/**
 * Tarjeta de sellos digital (por negocio).
 *
 * - El negocio configura su programa (sellos, premio, color) → loyalty_programs.
 * - El cliente ve su tarjeta en el Storefront; su código es su referral_code.
 * - Sellos y canjes SOLO por RPCs que validan que quien llama es del negocio
 *   (ver MIGRATION_STAMP_CARD.sql): el cliente no puede sumarse sellos.
 */
import { getSupabase } from './auth';

export interface LoyaltyProgram {
  businessId: string;
  enabled: boolean;
  stampsRequired: number;
  rewardTitle: string;
  cardColor: string;
  terms: string;
}

export interface LoyaltyCardState {
  found: boolean;
  customerName?: string | null;
  stamps: number;
  stampsRequired: number;
  rewardsAvailable: number;
  rewardsRedeemed: number;
  lifetimeStamps: number;
  rewardTitle: string;
  rewardsEarnedNow?: number;
}

export const DEFAULT_PROGRAM = (businessId: string): LoyaltyProgram => ({
  businessId,
  enabled: false,
  stampsRequired: 8,
  rewardTitle: 'Un producto gratis',
  cardColor: '#1A1E2E',
  terms: '',
});

const fromRow = (r: any, businessId: string): LoyaltyProgram => ({
  businessId,
  enabled: !!r?.enabled,
  stampsRequired: Number(r?.stamps_required || 8),
  rewardTitle: r?.reward_title || 'Un producto gratis',
  cardColor: r?.card_color || '#1A1E2E',
  terms: r?.terms || '',
});

const cardFromJson = (j: any): LoyaltyCardState => ({
  found: !!j?.found,
  customerName: j?.customer_name ?? null,
  stamps: Number(j?.stamps || 0),
  stampsRequired: Number(j?.stamps_required || 8),
  rewardsAvailable: Number(j?.rewards_available || 0),
  rewardsRedeemed: Number(j?.rewards_redeemed || 0),
  lifetimeStamps: Number(j?.lifetime_stamps || 0),
  rewardTitle: j?.reward_title || 'Un producto gratis',
  rewardsEarnedNow: j?.rewards_earned_now !== undefined ? Number(j.rewards_earned_now) : undefined,
});

/** Mensaje legible a partir de un error de Supabase/RPC. */
function errText(e: any): string {
  const m = String(e?.message || e || '');
  if (m.includes('loyalty_') && (m.includes('does not exist') || m.includes('schema cache'))) {
    return 'Falta correr MIGRATION_STAMP_CARD.sql en Supabase.';
  }
  return m || 'Error desconocido';
}

/* ─── Programa del negocio ─────────────────────────────────────────── */

export async function getLoyaltyProgram(businessId: string): Promise<LoyaltyProgram | null> {
  const sb = getSupabase();
  if (!sb || !businessId) return null;
  const { data, error } = await sb
    .from('loyalty_programs')
    .select('*')
    .eq('business_id', businessId)
    .maybeSingle();
  if (error) { console.warn('[loyalty] program:', error.message); return null; }
  return data ? fromRow(data, businessId) : DEFAULT_PROGRAM(businessId);
}

export async function saveLoyaltyProgram(p: LoyaltyProgram): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'Sin conexión con la nube' };
  const { error } = await sb.from('loyalty_programs').upsert({
    business_id: p.businessId,
    enabled: p.enabled,
    stamps_required: Math.min(30, Math.max(2, Math.round(p.stampsRequired))),
    reward_title: p.rewardTitle.trim() || 'Un producto gratis',
    card_color: p.cardColor,
    terms: p.terms,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'business_id' });
  return error ? { ok: false, error: errText(error) } : { ok: true };
}

/* ─── Caja: consultar, sellar y canjear ────────────────────────────── */

export async function lookupCard(businessId: string, code: string): Promise<{ card?: LoyaltyCardState; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: 'Sin conexión con la nube' };
  const { data, error } = await sb.rpc('loyalty_lookup', { p_business: businessId, p_code: code });
  if (error) return { error: errText(error) };
  return { card: cardFromJson(data) };
}

export async function addStamps(businessId: string, code: string, count: number, staff?: string): Promise<{ card?: LoyaltyCardState; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: 'Sin conexión con la nube' };
  const { data, error } = await sb.rpc('loyalty_add_stamps', {
    p_business: businessId, p_code: code, p_count: count, p_staff: staff || null,
  });
  if (error) return { error: errText(error) };
  return { card: cardFromJson(data) };
}

export async function redeemStampReward(businessId: string, code: string, staff?: string): Promise<{ card?: LoyaltyCardState; error?: string }> {
  const sb = getSupabase();
  if (!sb) return { error: 'Sin conexión con la nube' };
  const { data, error } = await sb.rpc('loyalty_redeem', {
    p_business: businessId, p_code: code, p_staff: staff || null,
  });
  if (error) return { error: errText(error) };
  return { card: cardFromJson(data) };
}

/* ─── Cliente: su tarjeta en este negocio ──────────────────────────── */

export async function getMyStampCard(businessId: string, userId: string): Promise<{ stamps: number; rewardsAvailable: number; rewardsRedeemed: number } | null> {
  const sb = getSupabase();
  if (!sb || !businessId || !userId) return null;
  const { data, error } = await sb
    .from('loyalty_cards')
    .select('stamps, rewards_available, rewards_redeemed')
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) { console.warn('[loyalty] my card:', error.message); return null; }
  return {
    stamps: Number(data?.stamps || 0),
    rewardsAvailable: Number(data?.rewards_available || 0),
    rewardsRedeemed: Number(data?.rewards_redeemed || 0),
  };
}

/**
 * Extrae el código del cliente de lo que leyó un escáner o la cámara. El QR
 * lleva "SERVIREST:CODIGO"; un lector USB también puede mandar el texto tal
 * cual. Acepta ambos.
 */
export function parseCustomerCode(raw: string): string {
  const t = (raw || '').trim();
  const m = t.match(/SERVIREST:([A-Z0-9-]+)/i);
  return (m ? m[1] : t).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export const qrPayloadFor = (code: string) => `SERVIREST:${code}`;
