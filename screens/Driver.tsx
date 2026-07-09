/**
 * Módulo Repartidor — seguimiento de entregas a domicilio del canal digital.
 *
 * El admin/gerente ve aquí las órdenes de envío (source TO_GO) activas, con la
 * dirección, teléfono y GPS del cliente, los productos y el estado de pago.
 * Puede: abrir la ruta en Maps, llamar al cliente, mensajearlo, marcar la
 * orden "en camino" y cerrarla al entregar (cobrando efectivo si aplica).
 *
 * Lee directo de Supabase (como el storefront) porque la capa de sync del POS
 * no arrastra customer_metadata (dirección/coordenadas/teléfono).
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bike, MapPin, Phone, MessageCircle, Navigation, CheckCircle2, Package,
  RefreshCw, X, Send, Banknote, CreditCard, Clock, ChefHat,
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useSettings } from '../contexts/SettingsContext';
import { getSupabase } from '../services/auth';
import { getOrderDetail, getOrderMessages, sendStoreMessage } from '../services/customer';
import { SrKicker, SrEmptyState } from '../components/ui/servirest';

const mxn = (n: number) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_META: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'En cocina', cls: 'bg-servirest-mostaza/20 text-servirest-mostaza' },
  COOKING: { label: 'Preparando', cls: 'bg-servirest-terracota/15 text-servirest-terracota' },
  READY:   { label: 'Lista para salir', cls: 'bg-blue-500/15 text-blue-600' },
  SERVED:  { label: 'En camino', cls: 'bg-servirest-terracota/15 text-servirest-terracota' },
};

export const DriverScreen: React.FC = () => {
  const { authProfile } = useUser();
  const { settings } = useSettings();
  const businessId = authProfile?.businessId;

  const [orders, setOrders] = useState<any[]>([]);
  const [items, setItems] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [chatOrder, setChatOrder] = useState<any | null>(null);

  const fetchDeliveries = async () => {
    if (!businessId) return;
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    const { data, error } = await sb
      .from('orders')
      .select('id, daily_number, status, total, source, payment_method, payment_status, created_at, customer_metadata')
      .eq('business_id', businessId)
      .eq('source', 'TO_GO')
      .in('status', ['PENDING', 'COOKING', 'READY', 'SERVED'])
      .order('created_at', { ascending: true });
    if (error) { console.warn('[Driver] fetch:', error.message); setLoading(false); return; }
    const list = data || [];
    setOrders(list);
    setLoading(false);
    // Trae los productos de cada orden (para el resumen del repartidor).
    const missing = list.filter((o) => !items[o.id]);
    if (missing.length) {
      const details = await Promise.all(missing.map((o) => getOrderDetail(o.id)));
      setItems((prev) => {
        const next = { ...prev };
        missing.forEach((o, i) => { next[o.id] = details[i]?.items || []; });
        return next;
      });
    }
  };

  useEffect(() => {
    fetchDeliveries();
    const iv = setInterval(fetchDeliveries, 15000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // Cambia el estatus (y cobra al entregar si el pago estaba pendiente).
  const setStatus = async (order: any, next: 'SERVED' | 'COMPLETED') => {
    const sb = getSupabase();
    if (!sb) return;
    setBusy(order.id);
    const patch: any = { status: next, updated_at: new Date().toISOString() };
    // Al entregar, si era efectivo/terminal por cobrar, lo marcamos pagado.
    if (next === 'COMPLETED' && order.payment_status !== 'PAID') patch.payment_status = 'PAID';
    const { error } = await sb.from('orders').update(patch).eq('id', order.id);
    if (error) { console.warn('[Driver] setStatus:', error.message); }
    await fetchDeliveries();
    setBusy(null);
  };

  const enRoute = orders.filter((o) => o.status === 'SERVED').length;
  const ready = orders.filter((o) => o.status === 'READY').length;

  return (
    <div className="h-full w-full bg-servirest-hueso text-servirest-carbon flex flex-col overflow-hidden antialiased">
      {/* Header */}
      <header className="flex-shrink-0 px-6 md:px-10 pt-8 pb-5 border-b border-[rgba(42,40,38,0.08)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <SrKicker>Canal digital</SrKicker>
            <h1 className="font-serif italic text-servirest-midnight text-3xl md:text-4xl mt-1 flex items-center gap-3">
              <Bike size={30} className="text-servirest-terracota" /> Repartidor
            </h1>
            <p className="text-[13px] text-[rgba(42,40,38,0.55)] mt-1">Sigue y cierra tus entregas a domicilio.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center px-4 py-2 rounded-2xl bg-servirest-surface border border-[rgba(42,40,38,0.08)]">
              <div className="font-serif italic text-blue-600 text-2xl leading-none">{ready}</div>
              <div className="text-[9px] uppercase tracking-[0.12em] text-[rgba(42,40,38,0.5)] mt-1">Por salir</div>
            </div>
            <div className="text-center px-4 py-2 rounded-2xl bg-servirest-surface border border-[rgba(42,40,38,0.08)]">
              <div className="font-serif italic text-servirest-terracota text-2xl leading-none">{enRoute}</div>
              <div className="text-[9px] uppercase tracking-[0.12em] text-[rgba(42,40,38,0.5)] mt-1">En camino</div>
            </div>
            <button onClick={fetchDeliveries} className="w-11 h-11 rounded-full bg-servirest-midnight text-servirest-hueso flex items-center justify-center hover:scale-105 transition-transform">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-6 md:px-10 py-6">
        {loading && orders.length === 0 ? (
          <div className="py-24 text-center"><RefreshCw size={34} className="mx-auto text-servirest-terracota animate-spin" /></div>
        ) : orders.length === 0 ? (
          <SrEmptyState icon={<Bike size={40} />} title="Sin entregas activas" description="Cuando entre un pedido a domicilio del canal digital, aparecerá aquí para darle seguimiento." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
            {orders.map((o) => (
              <DeliveryCard
                key={o.id}
                order={o}
                items={items[o.id] || []}
                busy={busy === o.id}
                onEnRoute={() => setStatus(o, 'SERVED')}
                onDelivered={() => setStatus(o, 'COMPLETED')}
                onMessage={() => setChatOrder(o)}
              />
            ))}
          </div>
        )}
      </div>

      {chatOrder && (
        <DriverChat
          order={chatOrder}
          businessId={businessId!}
          driverName={settings.name ? `${settings.name} · Repartidor` : 'Repartidor'}
          onClose={() => setChatOrder(null)}
        />
      )}
    </div>
  );
};

const DeliveryCard: React.FC<any> = ({ order, items, busy, onEnRoute, onDelivered, onMessage }) => {
  const meta = order.customer_metadata || {};
  const num = String((order.daily_number ?? 0) + 1).padStart(4, '0');
  const st = STATUS_META[order.status] || { label: order.status, cls: 'bg-servirest-hueso text-[rgba(42,40,38,0.6)]' };
  const paid = order.payment_status === 'PAID';
  const inKitchen = order.status === 'PENDING' || order.status === 'COOKING';

  const mapsUrl = meta.clientLat && meta.clientLng
    ? `https://www.google.com/maps/dir/?api=1&destination=${meta.clientLat},${meta.clientLng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(meta.deliveryAddress || '')}`;

  return (
    <div className="rounded-3xl bg-servirest-surface border border-[rgba(42,40,38,0.1)] p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="font-serif italic text-servirest-midnight text-xl">Orden #{num}</span>
          <span className={`text-[10px] font-black uppercase tracking-[0.08em] px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
        </div>
        {meta.distanceKm != null && (
          <span className="text-[11px] font-mono text-[rgba(42,40,38,0.5)]">{meta.distanceKm} km</span>
        )}
      </div>

      {/* Cliente */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-9 h-9 rounded-full bg-servirest-midnight text-servirest-hueso flex items-center justify-center font-bold text-[13px] flex-shrink-0">
          {(meta.customerName || '?')[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-servirest-midnight text-[14px] truncate">{meta.customerName || 'Cliente'}</div>
          {meta.customerPhone && <div className="text-[11px] text-[rgba(42,40,38,0.5)]">{meta.customerPhone}</div>}
        </div>
        {meta.customerPhone && (
          <a href={`tel:${meta.customerPhone}`} className="w-9 h-9 rounded-full bg-green-600/10 text-green-700 flex items-center justify-center flex-shrink-0"><Phone size={16} /></a>
        )}
        <button onClick={onMessage} className="w-9 h-9 rounded-full bg-servirest-terracota/10 text-servirest-terracota flex items-center justify-center flex-shrink-0"><MessageCircle size={16} /></button>
      </div>

      {/* Dirección */}
      <div className="flex items-start gap-2 bg-servirest-hueso rounded-2xl p-3 mb-3 border border-[rgba(42,40,38,0.06)]">
        <MapPin size={15} className="text-servirest-terracota flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 text-[12px] text-servirest-midnight leading-snug">
          {meta.deliveryAddress || 'Sin dirección'}
          {meta.addrRefs && <div className="text-[11px] text-[rgba(42,40,38,0.5)] mt-0.5">Ref: {meta.addrRefs}</div>}
        </div>
      </div>

      {/* Productos */}
      {items.length > 0 && (
        <div className="mb-3 space-y-1">
          {items.map((it: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[12px]">
              <span className="w-5 h-5 rounded-full bg-servirest-terracota/10 text-servirest-terracota text-[10px] font-black flex items-center justify-center flex-shrink-0">{it.quantity}</span>
              <span className="text-servirest-midnight truncate">{it.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Pago */}
      <div className="flex items-center justify-between mb-4 pt-2 border-t border-[rgba(42,40,38,0.06)]">
        <span className="text-[12px] text-[rgba(42,40,38,0.6)] flex items-center gap-1.5">
          {order.payment_method === 'CASH' ? <Banknote size={14} /> : <CreditCard size={14} />}
          {paid ? 'Pagado' : 'Cobrar al entregar'}
        </span>
        <span className="font-serif italic text-servirest-terracota text-lg">{mxn(order.total)}</span>
      </div>

      {/* Acciones */}
      <div className="mt-auto flex items-center gap-2">
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex-1 h-11 rounded-full bg-servirest-midnight text-servirest-hueso text-[11px] font-black uppercase tracking-[0.1em] flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
          <Navigation size={15} /> Ruta
        </a>
        {inKitchen ? (
          <div className="flex-1 h-11 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.12)] text-[rgba(42,40,38,0.5)] text-[11px] font-black uppercase tracking-[0.1em] flex items-center justify-center gap-2">
            <ChefHat size={15} /> En cocina
          </div>
        ) : order.status === 'READY' ? (
          <button onClick={onEnRoute} disabled={busy} className="flex-1 h-11 rounded-full bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.1em] flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <RefreshCw size={14} className="animate-spin" /> : <Bike size={15} />} Salir a entregar
          </button>
        ) : (
          <button onClick={onDelivered} disabled={busy} className="flex-1 h-11 rounded-full bg-servirest-terracota text-servirest-hueso text-[11px] font-black uppercase tracking-[0.1em] flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />} Entregada
          </button>
        )}
      </div>
    </div>
  );
};

// Chat del repartidor con el cliente (por orden).
const DriverChat: React.FC<any> = ({ order, businessId, driverName, onClose }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const num = String((order.daily_number ?? 0) + 1).padStart(4, '0');

  const load = async () => setMessages(await getOrderMessages(order.id));
  useEffect(() => { load(); const iv = setInterval(load, 8000); return () => clearInterval(iv); /* eslint-disable-next-line */ }, [order.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setMessages((p) => [...p, { id: `tmp-${p.length}`, sender: 'driver', senderName: driverName, message: text, createdAt: new Date().toISOString() }]);
    setDraft('');
    if (await sendStoreMessage(order.id, businessId, text, 'driver', driverName)) await load();
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-md h-[75dvh] sm:h-[70vh] bg-servirest-hueso rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-[rgba(42,40,38,0.08)] bg-servirest-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-servirest-midnight text-servirest-mostaza flex items-center justify-center"><MessageCircle size={16} /></div>
            <div>
              <div className="font-serif italic text-servirest-midnight text-[16px] leading-none">Orden #{num}</div>
              <div className="text-[10px] text-[rgba(42,40,38,0.5)] mt-0.5">Mensaje al cliente</div>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.1)] flex items-center justify-center text-[rgba(42,40,38,0.5)]"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <MessageCircle size={30} className="text-[rgba(42,40,38,0.2)] mb-3" />
              <p className="text-[13px] text-[rgba(42,40,38,0.5)]">Avísale al cliente que vas en camino o pídele referencias para llegar.</p>
            </div>
          ) : messages.map((m) => {
            const mine = m.sender !== 'customer';
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-snug ${mine ? 'bg-servirest-terracota text-servirest-hueso rounded-br-sm' : 'bg-servirest-surface border border-[rgba(42,40,38,0.08)] text-servirest-midnight rounded-bl-sm'}`}>
                  {!mine && <div className="text-[9px] font-black uppercase tracking-[0.1em] text-servirest-terracota mb-0.5">👤 {m.senderName || 'Cliente'}</div>}
                  {m.message}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        <div className="flex-shrink-0 flex items-center gap-2 p-3 border-t border-[rgba(42,40,38,0.08)] bg-servirest-surface">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} placeholder="Escribe un mensaje…" className="flex-1 h-11 px-4 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.12)] text-[14px] focus:outline-none focus:border-servirest-terracota" />
          <button onClick={send} disabled={sending || !draft.trim()} className="w-11 h-11 rounded-full bg-servirest-terracota text-servirest-hueso flex items-center justify-center disabled:opacity-40"><Send size={17} /></button>
        </div>
      </div>
    </div>
  );
};

export default DriverScreen;
