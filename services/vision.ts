/**
 * Servicio del módulo Visión IA — persistencia de eventos, snapshots y
 * alertas por WhatsApp.
 *
 * Los eventos los genera screens/Vision.tsx (detección de personas por zona
 * en el navegador). Aquí solo se guardan/notifican, todo best-effort para
 * nunca frenar el loop de detección.
 *
 * WhatsApp: usa CallMeBot (gratuito, para pruebas/experimental). El dueño
 * registra su teléfono una vez con el bot y pega su apikey en el módulo.
 * Para producción ver la guía (WhatsApp Business Cloud API / Twilio).
 */
import { getSupabase } from './auth';

export type VisionEventType = 'zone_vacant' | 'zone_intrusion' | 'zone_recovered';

export interface VisionEvent {
  id: string;
  camera: string;
  zone: string;
  type: VisionEventType;
  message: string;
  durationSec: number | null;
  snapshotUrl: string | null;
  createdAt: string;
}

/** Sube una captura JPEG (dataURL) al bucket vision-snapshots. */
export async function uploadVisionSnapshot(
  businessId: string,
  dataUrl: string
): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || !dataUrl.startsWith('data:')) return null;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${businessId}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage
      .from('vision-snapshots')
      .upload(path, blob, { contentType: 'image/jpeg' });
    if (error) { console.warn('[vision] snapshot upload:', error.message); return null; }
    const { data } = sb.storage.from('vision-snapshots').getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.warn('[vision] snapshot failed:', e);
    return null;
  }
}

/** Registra un evento en Supabase. Devuelve el snapshot_url subido (si hubo). */
export async function logVisionEvent(
  businessId: string,
  camera: string,
  zone: string,
  type: VisionEventType,
  message: string,
  durationSec?: number | null,
  snapshotDataUrl?: string | null
): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || !businessId) return null;
  let snapshotUrl: string | null = null;
  try {
    if (snapshotDataUrl) {
      snapshotUrl = await uploadVisionSnapshot(businessId, snapshotDataUrl);
    }
    const { error } = await sb.from('vision_events').insert({
      business_id: businessId,
      camera,
      zone,
      type,
      message,
      duration_sec: durationSec ?? null,
      snapshot_url: snapshotUrl,
    });
    if (error) console.warn('[vision] logVisionEvent:', error.message);
  } catch (e) {
    console.warn('[vision] logVisionEvent failed:', e);
  }
  return snapshotUrl;
}

/** Últimos eventos del negocio (para el timeline del módulo). */
export async function loadVisionEvents(businessId: string, limit = 50): Promise<VisionEvent[]> {
  const sb = getSupabase();
  if (!sb || !businessId) return [];
  const { data, error } = await sb
    .from('vision_events')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.warn('[vision] loadVisionEvents:', error.message); return []; }
  return (data || []).map((r: any) => ({
    id: r.id,
    camera: r.camera,
    zone: r.zone,
    type: r.type,
    message: r.message,
    durationSec: r.duration_sec,
    snapshotUrl: r.snapshot_url,
    createdAt: r.created_at,
  }));
}

/**
 * Envía una alerta por WhatsApp vía CallMeBot (experimental / pruebas).
 * fire-and-forget con no-cors: no podemos leer la respuesta, pero el GET
 * sí llega al servicio. Para producción usar la Cloud API oficial.
 */
export function sendWhatsAppAlert(phone: string, apikey: string, text: string): void {
  if (!phone.trim() || !apikey.trim()) return;
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone.trim())}&apikey=${encodeURIComponent(apikey.trim())}&text=${encodeURIComponent(text)}`;
    fetch(url, { mode: 'no-cors' }).catch(() => { /* best-effort */ });
  } catch { /* best-effort */ }
}
