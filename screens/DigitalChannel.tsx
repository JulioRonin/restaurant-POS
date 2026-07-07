import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe2, ShoppingBag, Utensils, CalendarClock, Truck, Store,
  Search, QrCode, Copy, Check, ExternalLink, MonitorSmartphone,
  Lock, CreditCard, Banknote, Bluetooth, Wallet, Clock, MapPin,
  ChefHat, Sparkles,
} from 'lucide-react';
import {
  SrCard, SrButton, SrChip, SrKicker, SrLabel, SrInput, SrMono,
  SrTabs, SrAlert, SrTierBadge, SrEmptyState,
  SrSectionHeading, SrPanel,
} from '../components/ui/servirest';
import { useMenu } from '../contexts/MenuContext';
import { useSettings } from '../contexts/SettingsContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { MenuItem } from '../types';

type TabKey = 'catalog' | 'mode' | 'kiosk' | 'link';

const MODE_OPTIONS: Array<{
  id: 'delivery' | 'pickup' | 'dine-in' | 'reservation';
  label: string;
  desc: string;
  icon: React.ElementType;
}> = [
  { id: 'delivery',    label: 'Delivery',      desc: 'Envío a domicilio con tarifa fija y zonas',           icon: Truck },
  { id: 'pickup',      label: 'Para recoger',  desc: 'Cliente ordena y pasa por su pedido al local',         icon: Store },
  { id: 'dine-in',     label: 'En mesa',       desc: 'Cliente escanea QR en la mesa y ordena desde ahí',    icon: Utensils },
  { id: 'reservation', label: 'Reservación',   desc: 'Sin comercio: solo reserva de mesa (para boutique)',  icon: CalendarClock },
];

export const DigitalChannelScreen: React.FC = () => {
  const { menuItems, updateItem } = useMenu();
  const { settings, updateSettings } = useSettings();
  const { tier, meetsTier, isFeatureEnabled } = useSubscription();

  const [tab, setTab] = useState<TabKey>('catalog');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  // ── Tier gate ──────────────────────────────────────────
  // Módulo disponible desde Prestige por defecto. SuperAdmin puede
  // habilitar el feature `online_ordering` para clientes de tier inferior.
  const gated = !meetsTier('prestige') && !isFeatureEnabled('online_ordering');

  if (gated) {
    return (
      <div className="min-h-screen bg-servirest-canvas px-6 md:px-12 py-16">
        <div className="max-w-3xl mx-auto">
          <SrKicker>Canal digital · Bloqueado en tu plan</SrKicker>
          <h1 className="font-serif italic text-servirest-midnight text-4xl md:text-[56px] leading-none mt-3 mb-4 tracking-[-0.02em]">
            Vende también sin que el cliente entre al local.
          </h1>
          <p className="text-[14px] text-[rgba(42,40,38,0.65)] font-medium leading-relaxed mb-8 max-w-xl">
            Kiosko, storefront público y pagos digitales están disponibles desde el plan Prestige
            (o antes si tu ejecutivo ServiRest lo activa manualmente para tu cuenta).
          </p>

          <SrCard className="p-8">
            <div className="flex items-center justify-between gap-4 mb-6">
              <SrTierBadge tier={tier} size="md" />
              <span className="text-[rgba(42,40,38,0.4)]">→</span>
              <SrTierBadge tier="prestige" size="md" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {[
                'Catálogo público con URL propia + QR',
                'Kiosko en tablet o pantalla física del local',
                'Pago con terminal Bluetooth, QR Stripe o efectivo',
                'Delivery, pickup o reserva según tu giro',
                'Órdenes online caen directo a Cocina y Bar',
                'SuperAdmin puede activarlo en cualquier plan',
              ].map((b) => (
                <div key={b} className="flex items-start gap-3 text-[13px] text-servirest-midnight leading-relaxed">
                  <Check size={16} className="text-servirest-terracota mt-0.5 flex-shrink-0" />
                  {b}
                </div>
              ))}
            </div>
            <a
              href="#/billing"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sr-lg bg-servirest-terracota text-servirest-hueso font-black italic uppercase tracking-[0.18em] text-[11px] hover:scale-[1.02] transition-transform"
            >
              Ver planes
            </a>
          </SrCard>
        </div>
      </div>
    );
  }

  const publishedCount = menuItems.filter((m) => m.publishOnline).length;
  const totalActive = menuItems.filter((m) => m.status === 'ACTIVE').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return menuItems.filter((m) => m.status === 'ACTIVE');
    return menuItems.filter(
      (m) => m.status === 'ACTIVE' && (m.name.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q))
    );
  }, [menuItems, search]);

  const publicUrl = settings.publicSlug
    ? `https://servirest.mx/o/${settings.publicSlug}`
    : `https://servirest.mx/o/${(settings.name || 'tu-negocio').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard denied */ }
  };

  const togglePublish = (m: MenuItem) => {
    updateItem(m.id, {
      publishOnline: !m.publishOnline,
      onlineAvailable: m.onlineAvailable ?? true,
    });
  };

  const setOnlinePrice = (m: MenuItem, value: string) => {
    const n = Number(value);
    updateItem(m.id, { onlinePrice: Number.isFinite(n) && n > 0 ? n : undefined });
  };

  const toggleOnlineAvailable = (m: MenuItem) => {
    updateItem(m.id, { onlineAvailable: !(m.onlineAvailable ?? true) });
  };

  return (
    <div className="min-h-screen bg-servirest-canvas">
      <div className="px-6 md:px-12 pt-10 pb-6 border-b border-[rgba(42,40,38,0.08)]">
        <div className="flex items-start justify-between flex-wrap gap-6">
          <div>
            <SrKicker>Canal digital · Pedidos y pagos en línea</SrKicker>
            <h1 className="font-serif italic text-servirest-midnight text-4xl md:text-[56px] leading-none mt-3 tracking-[-0.02em]">
              Tu carta, también fuera del local.
            </h1>
            <p className="text-[13px] text-[rgba(42,40,38,0.6)] font-medium mt-3 max-w-xl leading-relaxed">
              Escoge qué platillos publicas online, define delivery, pickup, mesa o reserva, y
              deja que el cliente pague antes de entrar por la puerta.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SrTierBadge tier={tier} size="md" />
            <SrChip tone="mostaza" size="sm">
              <Sparkles size={10} className="mr-1.5" />
              {publishedCount}/{totalActive} publicados
            </SrChip>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat icon={ShoppingBag} label="Platillos online" value={`${publishedCount}`} />
          <MiniStat icon={CalendarClock} label="Modo activo" value={MODE_OPTIONS.find((o) => o.id === settings.digitalMode)?.label || '—'} />
          <MiniStat icon={Clock} label="Horario" value={`${settings.digitalHoursOpen || '—'} – ${settings.digitalHoursClose || '—'}`} />
          <MiniStat icon={Wallet} label="Pago mínimo" value={settings.digitalMinOrder ? `$${settings.digitalMinOrder}` : 'Sin mínimo'} />
        </div>
      </div>

      <div className="px-6 md:px-12 pt-6">
        <SrTabs<TabKey>
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'catalog', label: `Catálogo público (${publishedCount})` },
            { id: 'mode',    label: 'Modo & horarios' },
            { id: 'kiosk',   label: 'Kiosko' },
            { id: 'link',    label: 'URL pública & QR' },
          ]}
        />
      </div>

      <div className="px-6 md:px-12 py-10">
        <AnimatePresence mode="wait">
          {tab === 'catalog' && (
            <motion.div
              key="catalog"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <SrSectionHeading
                kicker="Curaduría"
                title="Qué de tu menú va al mundo"
                right={
                  <div className="relative w-72">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(42,40,38,0.4)]" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar platillo…"
                      className="w-full h-11 pl-11 pr-4 rounded-full bg-servirest-surface border border-[rgba(42,40,38,0.1)] text-[13px] font-medium focus:outline-none focus:border-servirest-terracota"
                    />
                  </div>
                }
              />

              {filtered.length === 0 ? (
                <SrEmptyState
                  icon={<ChefHat size={32} />}
                  title="Sin platillos activos"
                  description="Da de alta platillos en la sección Menú y luego regresa aquí para publicarlos."
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map((m, idx) => (
                    <PublishRow
                      key={m.id}
                      item={m}
                      idx={idx}
                      onTogglePublish={() => togglePublish(m)}
                      onToggleAvailable={() => toggleOnlineAvailable(m)}
                      onPriceChange={(v) => setOnlinePrice(m, v)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'mode' && (
            <motion.div
              key="mode"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <SrPanel kicker="Cómo compra tu cliente" title="Modo del canal digital">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {MODE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = settings.digitalMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => updateSettings({ digitalMode: opt.id })}
                        className={`text-left rounded-sr-lg border-2 p-5 transition-all ${
                          active
                            ? 'border-servirest-terracota bg-servirest-terracota/5 shadow-sr-lift'
                            : 'border-[rgba(42,40,38,0.1)] bg-servirest-surface hover:border-servirest-terracota/40'
                        }`}
                      >
                        <Icon size={22} className={active ? 'text-servirest-terracota' : 'text-servirest-midnight'} />
                        <div className="font-serif italic text-servirest-midnight text-xl mt-2">{opt.label}</div>
                        <p className="text-[12px] text-[rgba(42,40,38,0.6)] mt-1 leading-relaxed">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </SrPanel>

              <SrPanel kicker="Cuándo abre el canal" title="Horario y mínimos">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <SrLabel>Abre</SrLabel>
                    <SrInput
                      type="time"
                      value={settings.digitalHoursOpen || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ digitalHoursOpen: e.target.value })}
                    />
                  </div>
                  <div>
                    <SrLabel>Cierra</SrLabel>
                    <SrInput
                      type="time"
                      value={settings.digitalHoursClose || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ digitalHoursClose: e.target.value })}
                    />
                  </div>
                  <div>
                    <SrLabel>Orden mínima ($)</SrLabel>
                    <SrInput
                      type="number"
                      min={0}
                      value={settings.digitalMinOrder ?? 0}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ digitalMinOrder: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <SrLabel>Costo de envío ($)</SrLabel>
                    <SrInput
                      type="number"
                      min={0}
                      value={settings.digitalDeliveryFee ?? 0}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ digitalDeliveryFee: Number(e.target.value) || 0 })}
                      disabled={settings.digitalMode !== 'delivery'}
                    />
                  </div>
                </div>

                {settings.digitalMode === 'delivery' && (
                  <div className="mt-5">
                    <SrLabel>
                      <MapPin size={12} className="inline mr-1" /> Zonas cubiertas
                    </SrLabel>
                    <textarea
                      value={settings.digitalDeliveryZones || ''}
                      onChange={(e) => updateSettings({ digitalDeliveryZones: e.target.value })}
                      placeholder="Ej. Roma Norte, Condesa, Juárez, Cuauhtémoc — separadas por coma"
                      rows={3}
                      className="w-full mt-2 px-4 py-3 rounded-sr-md bg-servirest-surface border border-[rgba(42,40,38,0.1)] text-[13px] font-medium focus:outline-none focus:border-servirest-terracota resize-none"
                    />
                  </div>
                )}
              </SrPanel>

              <SrPanel kicker="Voz editorial" title="Mensaje de bienvenida" className="lg:col-span-2">
                <textarea
                  value={settings.digitalWelcome || ''}
                  onChange={(e) => updateSettings({ digitalWelcome: e.target.value })}
                  placeholder="Bienvenido. Toca para ordenar."
                  rows={2}
                  maxLength={140}
                  className="w-full px-4 py-3 rounded-sr-md bg-servirest-surface border border-[rgba(42,40,38,0.1)] text-[15px] font-serif italic text-servirest-midnight focus:outline-none focus:border-servirest-terracota resize-none leading-relaxed"
                />
                <p className="text-[11px] text-[rgba(42,40,38,0.4)] mt-2">Aparece en el kiosko y en la portada del storefront público. Máximo 140 caracteres.</p>
              </SrPanel>
            </motion.div>
          )}

          {tab === 'kiosk' && (
            <motion.div
              key="kiosk"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <SrPanel kicker="Auto-servicio en el local" title="Configuración del kiosko">
                <SrAlert tone="info" title="Modo kiosko — próximamente Fase 2">
                  La pantalla táctil de auto-orden se activa desde <SrMono>Ajustes → Apariencia → Modo del dispositivo → Kiosko</SrMono>.
                  Aquí defines los métodos de pago y el PIN para salir del modo.
                </SrAlert>

                <div className="mt-5">
                  <SrLabel>
                    <Lock size={12} className="inline mr-1" /> PIN para salir del kiosko
                  </SrLabel>
                  <SrInput
                    type="password"
                    maxLength={4}
                    value={settings.kioskPin || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({ kioskPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                    placeholder="0000"
                  />
                  <p className="text-[11px] text-[rgba(42,40,38,0.4)] mt-2">
                    4 dígitos. El operador lo pide antes de desbloquear la tablet.
                  </p>
                </div>
              </SrPanel>

              <SrPanel kicker="Cómo cobra" title="Métodos de pago en kiosko">
                <PayToggle
                  icon={Bluetooth}
                  label="Terminal Bluetooth"
                  desc="Cliente pasa tarjeta en la terminal vinculada del negocio. Reusa la config de Ajustes → Hardware."
                  checked={settings.kioskPayMethods?.bluetooth ?? true}
                  onChange={(v) => updateSettings({
                    kioskPayMethods: { ...(settings.kioskPayMethods || {}), bluetooth: v },
                  })}
                />
                <PayToggle
                  icon={QrCode}
                  label="QR de Stripe"
                  desc="Genera un QR de pago en pantalla, el cliente escanea con su banco."
                  checked={settings.kioskPayMethods?.stripe_qr ?? false}
                  onChange={(v) => updateSettings({
                    kioskPayMethods: { ...(settings.kioskPayMethods || {}), stripe_qr: v },
                  })}
                />
                <PayToggle
                  icon={Banknote}
                  label="Efectivo (paga en caja)"
                  desc="Kiosko manda comanda a cocina; cliente paga al recoger."
                  checked={settings.kioskPayMethods?.cash ?? true}
                  onChange={(v) => updateSettings({
                    kioskPayMethods: { ...(settings.kioskPayMethods || {}), cash: v },
                  })}
                />
                <PayToggle
                  icon={CreditCard}
                  label="OXXO Pay"
                  desc="Referencia OXXO. El pedido queda pendiente hasta que se acredita (~24h)."
                  checked={settings.kioskPayMethods?.oxxo ?? false}
                  onChange={(v) => updateSettings({
                    kioskPayMethods: { ...(settings.kioskPayMethods || {}), oxxo: v },
                  })}
                />
              </SrPanel>
            </motion.div>
          )}

          {tab === 'link' && (
            <motion.div
              key="link"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <SrPanel kicker="Tu tienda en la web" title="URL pública">
                <SrAlert tone="info" title="Storefront público — Fase 2">
                  El link ya se muestra a tus clientes, pero la página pública queda lista en la
                  siguiente entrega. Mientras tanto úsalo como marca reservada en flyers y stickers.
                </SrAlert>

                <div className="mt-5">
                  <SrLabel>Slug (aparece en la URL)</SrLabel>
                  <div className="flex items-stretch gap-2 mt-2">
                    <span className="inline-flex items-center px-3 rounded-sr-md bg-[rgba(42,40,38,0.06)] text-[12px] font-mono text-[rgba(42,40,38,0.6)]">
                      servirest.mx/o/
                    </span>
                    <SrInput
                      value={settings.publicSlug || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSettings({
                        publicSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, ''),
                      })}
                      placeholder="tu-negocio"
                    />
                  </div>
                </div>

                <div className="mt-5 p-4 rounded-sr-md bg-servirest-midnight text-servirest-hueso font-mono text-[12px] break-all">
                  {publicUrl}
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <SrButton variant="secondary" onClick={copyLink}>
                    {copied ? <Check size={14} className="mr-2" /> : <Copy size={14} className="mr-2" />}
                    {copied ? 'Copiado' : 'Copiar link'}
                  </SrButton>
                  <SrButton variant="ghost" onClick={() => window.open(publicUrl, '_blank', 'noopener,noreferrer')}>
                    <ExternalLink size={14} className="mr-2" /> Ver preview
                  </SrButton>
                </div>
              </SrPanel>

              <SrPanel kicker="Para el volante y la mesa" title="Código QR imprimible">
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-56 h-56 rounded-sr-lg bg-servirest-surface border-2 border-dashed border-[rgba(42,40,38,0.15)] flex items-center justify-center">
                    <QrCode size={120} className="text-servirest-midnight/30" strokeWidth={0.6} />
                  </div>
                  <p className="text-[11px] text-[rgba(42,40,38,0.5)] mt-4 text-center max-w-xs leading-relaxed">
                    El QR real se genera con la URL de arriba en la siguiente entrega. Diseño editorial listo para impresión en 90×90mm.
                  </p>
                  <SrButton variant="secondary" className="mt-5" disabled>
                    <QrCode size={14} className="mr-2" /> Descargar QR (próximamente)
                  </SrButton>
                </div>
              </SrPanel>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const MiniStat: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="rounded-sr-md bg-servirest-surface border border-[rgba(42,40,38,0.08)] px-4 py-3 flex items-center gap-3">
    <Icon size={18} className="text-servirest-terracota flex-shrink-0" />
    <div className="min-w-0">
      <div className="text-[9px] font-black uppercase tracking-[0.25em] text-[rgba(42,40,38,0.5)]">{label}</div>
      <div className="text-[15px] font-serif italic text-servirest-midnight truncate">{value}</div>
    </div>
  </div>
);

const PublishRow: React.FC<{
  item: MenuItem;
  idx: number;
  onTogglePublish: () => void;
  onToggleAvailable: () => void;
  onPriceChange: (v: string) => void;
}> = ({ item, idx, onTogglePublish, onToggleAvailable, onPriceChange }) => {
  const published = !!item.publishOnline;
  const available = item.onlineAvailable ?? true;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.02, 0.4), duration: 0.3 }}
      className={`rounded-sr-lg border p-4 transition-all ${
        published ? 'border-servirest-terracota/40 bg-servirest-surface shadow-sr-lift' : 'border-[rgba(42,40,38,0.08)] bg-servirest-surface'
      }`}
    >
      <div className="flex items-start gap-3">
        <img
          src={item.image}
          alt={item.name}
          className="w-16 h-16 rounded-sr-md object-cover flex-shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.id}/200/200`; }}
        />
        <div className="flex-1 min-w-0">
          <div className="font-serif italic text-servirest-midnight text-[16px] leading-tight truncate">{item.name}</div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[rgba(42,40,38,0.5)] mt-1">{item.category}</div>
          <div className="text-[12px] text-servirest-terracota font-mono mt-1">${item.price.toFixed(2)}</div>
        </div>
        <button
          onClick={onTogglePublish}
          className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
            published
              ? 'bg-servirest-terracota text-servirest-hueso'
              : 'bg-[rgba(42,40,38,0.06)] text-[rgba(42,40,38,0.6)]'
          }`}
        >
          {published ? 'En línea' : 'Publicar'}
        </button>
      </div>

      {published && (
        <div className="mt-4 pt-4 border-t border-dashed border-[rgba(42,40,38,0.1)] grid grid-cols-2 gap-3">
          <div>
            <SrLabel>Precio online (opcional)</SrLabel>
            <SrInput
              type="number"
              min={0}
              step="0.01"
              value={item.onlinePrice ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPriceChange(e.target.value)}
              placeholder={item.price.toFixed(2)}
            />
          </div>
          <div>
            <SrLabel>Disponibilidad</SrLabel>
            <button
              onClick={onToggleAvailable}
              className={`w-full h-11 rounded-sr-md text-[11px] font-black uppercase tracking-[0.15em] transition-all ${
                available ? 'bg-green-500/10 text-green-700 border border-green-500/30' : 'bg-mostaza-500/10 text-servirest-midnight border border-servirest-mostaza/40'
              }`}
            >
              {available ? 'Compra ahora' : 'Agotado'}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const PayToggle: React.FC<{
  icon: React.ElementType;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ icon: Icon, label, desc, checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-full text-left rounded-sr-md border p-4 mt-3 flex items-start gap-4 transition-all ${
      checked ? 'border-servirest-terracota/40 bg-servirest-terracota/5' : 'border-[rgba(42,40,38,0.1)] bg-servirest-surface hover:border-servirest-terracota/30'
    }`}
  >
    <div className={`w-10 h-10 rounded-sr-md flex items-center justify-center flex-shrink-0 ${
      checked ? 'bg-servirest-terracota text-servirest-hueso' : 'bg-[rgba(42,40,38,0.06)] text-servirest-midnight'
    }`}>
      <Icon size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="font-serif italic text-servirest-midnight text-[15px]">{label}</div>
        <div className={`w-10 h-6 rounded-full relative transition-all ${checked ? 'bg-servirest-terracota' : 'bg-[rgba(42,40,38,0.15)]'}`}>
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all ${checked ? 'left-4' : 'left-0.5'}`} />
        </div>
      </div>
      <p className="text-[11px] text-[rgba(42,40,38,0.55)] mt-1 leading-relaxed">{desc}</p>
    </div>
  </button>
);

export default DigitalChannelScreen;
