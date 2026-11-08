/**
 * App instalable por negocio (PWA).
 *
 * El Storefront vive en `#/o/{businessId}`: el servidor no ve el hash, así
 * que la marca del negocio (nombre, logo, manifest) se aplica aquí, en el
 * navegador, en cuanto se sabe qué negocio es. El manifest lo arma
 * api/manifest.ts.
 *
 * `beforeinstallprompt` puede dispararse antes de que el Storefront monte,
 * por eso se escucha desde que se carga este módulo.
 */

let deferredPrompt: any = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault(); // la mostramos nosotros con el botón "Instalar app"
    deferredPrompt = e;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((l) => l());
  });
}

export function onInstallAvailabilityChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export const canPromptInstall = () => !!deferredPrompt;

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice.catch(() => null);
  deferredPrompt = null;
  listeners.forEach((l) => l());
  return choice?.outcome === 'accepted';
}

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;

function setMeta(selector: string, create: () => HTMLElement, apply: (el: any) => void) {
  let el = document.head.querySelector(selector) as any;
  if (!el) { el = create(); document.head.appendChild(el); }
  apply(el);
}

/** Pone nombre, logo y manifest del negocio en la página. */
export function applyBusinessBranding(businessId: string, name: string, logoUrl?: string, color?: string) {
  document.title = name;

  setMeta('link[rel="manifest"]', () => Object.assign(document.createElement('link'), { rel: 'manifest' }),
    (el) => { el.href = `/api/manifest?b=${encodeURIComponent(businessId)}`; });

  setMeta('meta[name="apple-mobile-web-app-title"]',
    () => Object.assign(document.createElement('meta'), { name: 'apple-mobile-web-app-title' }),
    (el) => { el.content = name; });

  if (logoUrl) {
    setMeta('link[rel="apple-touch-icon"]', () => Object.assign(document.createElement('link'), { rel: 'apple-touch-icon' }),
      (el) => { el.href = logoUrl; });
    setMeta('link[rel="icon"]', () => Object.assign(document.createElement('link'), { rel: 'icon' }),
      (el) => { el.href = logoUrl; el.removeAttribute('type'); });
  }

  if (color) {
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => (m as HTMLMetaElement).content = color);
  }
}
