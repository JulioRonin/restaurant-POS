/**
 * Notificaciones locales del navegador (Opción A del canal digital).
 *
 * Dispara una notificación + vibración + beep cuando el estatus de un pedido
 * cambia, mientras la pestaña/PWA esté abierta (aunque esté en segundo plano
 * en el celular). No requiere backend ni Service Worker.
 *
 * Para push real con la app cerrada, ver Opción B (Web Push + VAPID) en el
 * roadmap del canal digital.
 */

const ICON = '/icon-192.png'; // ícono de la PWA (si existe)

/** Pide permiso de notificaciones. Devuelve true si quedó concedido. */
export async function requestNotifyPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch {
    return false;
  }
}

/** True si ya tenemos permiso concedido. */
export function canNotify(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
}

/** Beep corto sin archivo de audio (Web Audio API). Best-effort. */
function beep() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => ctx.close();
  } catch { /* audio best-effort */ }
}

/**
 * Muestra una notificación con título y cuerpo. Vibra y suena.
 * Si no hay permiso, no hace nada (el caller debió pedirlo antes).
 */
export function notify(title: string, body: string) {
  // Vibración (móvil) — funciona aunque no haya permiso de notificación.
  try { navigator.vibrate?.([120, 60, 120]); } catch { /* no-op */ }
  beep();

  if (!canNotify()) return;
  try {
    const n = new Notification(title, { body, icon: ICON, badge: ICON, tag: 'servirest-order' });
    // Al tocar la notificación, enfoca la pestaña.
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* notification best-effort */ }
}

/**
 * Copy amigable por estatus de pedido, para reusar en storefront y kiosko.
 */
export function statusNotifyCopy(status: string, mode: 'delivery' | 'pickup', orderNum: string): { title: string; body: string } | null {
  const map: Record<string, { title: string; body: string }> = {
    COOKING: {
      title: `Tu orden #${orderNum} ya está en la cocina 👨‍🍳`,
      body: 'La estamos preparando con cariño.',
    },
    READY: {
      title: `¡Tu orden #${orderNum} está lista! ✅`,
      body: mode === 'delivery' ? 'En breve sale para tu domicilio.' : 'Ya puedes pasar a recogerla.',
    },
    SERVED: {
      title: mode === 'delivery' ? `Tu orden #${orderNum} va en camino 🛵` : `Tu orden #${orderNum} fue entregada 🎉`,
      body: mode === 'delivery' ? 'El repartidor ya salió. ¡Buen provecho!' : '¡Gracias por tu compra!',
    },
    COMPLETED: {
      title: `Tu orden #${orderNum} fue entregada 🎉`,
      body: '¡Gracias por tu compra! Te esperamos pronto.',
    },
  };
  return map[status] || null;
}
