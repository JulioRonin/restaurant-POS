/**
 * Panel de mensajes de órdenes para el personal (Cocina y Repartidor).
 *
 * Muestra un botón flotante con el número de mensajes NUEVOS del cliente.
 * Al abrirlo lista las conversaciones por orden y permite responder. Los
 * mensajes nuevos disparan un aviso sonoro y vibración.
 *
 * Reutilizable: el remitente del negocio puede ser 'store' (cocina/tienda) o
 * 'driver' (repartidor), según `senderRole`.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, ChevronLeft } from 'lucide-react';
import { getBusinessMessages, sendStoreMessage, type OrderMessage } from '../services/customer';

type Msg = OrderMessage;

const LAST_SEEN_KEY = (bid: string) => `servirest_msgs_lastseen_${bid}`;

const beep = () => {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1040;
    gain.gain.value = 0.12;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => ctx.close();
  } catch { /* best-effort */ }
};

export const OrderMessagesPanel: React.FC<{
  businessId: string;
  businessName?: string;
  senderRole?: 'store' | 'driver';
  /** Mapea order_id → número visible de orden (para el encabezado). */
  orderLabel?: (orderId: string) => string | null;
}> = ({ businessId, businessName, senderRole = 'store', orderLabel }) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [open, setOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(() => {
    const v = Number(localStorage.getItem(LAST_SEEN_KEY(businessId)) || 0);
    return v;
  });
  const knownIdsRef = useRef<Set<string>>(new Set());
  const hydratedRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const all = await getBusinessMessages(businessId);
    // Aviso sonoro si llegaron mensajes NUEVOS del cliente (no en la 1a carga).
    const fresh = all.filter((m) => !knownIdsRef.current.has(m.id));
    if (hydratedRef.current && fresh.some((m) => m.sender === 'customer')) {
      beep();
      try { navigator.vibrate?.([80, 40, 80]); } catch { /* no-op */ }
    }
    all.forEach((m) => knownIdsRef.current.add(m.id));
    hydratedRef.current = true;
    setMessages(all);
  };

  useEffect(() => {
    if (!businessId) return;
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeOrder, messages.length]);

  // Agrupa por orden; ordena por el mensaje más reciente.
  const byOrder = messages.reduce<Record<string, Msg[]>>((acc, m) => {
    (acc[m.orderId] ||= []).push(m);
    return acc;
  }, {});
  const threads = Object.entries(byOrder)
    .map(([orderId, msgs]) => ({ orderId, msgs, last: msgs[msgs.length - 1] }))
    .sort((a, b) => new Date(b.last.createdAt).getTime() - new Date(a.last.createdAt).getTime());

  // Mensajes de cliente sin leer (más nuevos que lastSeen).
  const unread = messages.filter((m) => m.sender === 'customer' && new Date(m.createdAt).getTime() > lastSeen).length;

  const openPanel = () => {
    setOpen(true);
    const now = Date.now();
    setLastSeen(now);
    localStorage.setItem(LAST_SEEN_KEY(businessId), String(now));
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !activeOrder || sending) return;
    setSending(true);
    const optimistic: Msg = { id: `tmp-${knownIdsRef.current.size}-${text.length}`, orderId: activeOrder, sender: senderRole, senderName: businessName || 'Tienda', message: text, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    const ok = await sendStoreMessage(activeOrder, businessId, text, senderRole, businessName);
    if (ok) await load();
    setSending(false);
  };

  const label = (orderId: string) => (orderLabel?.(orderId)) || `#${orderId.slice(0, 4).toUpperCase()}`;
  const activeMsgs = activeOrder ? (byOrder[activeOrder] || []) : [];

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={openPanel}
        title="Mensajes de clientes"
        className="fixed z-40 right-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] w-14 h-14 rounded-full bg-servirest-midnight text-servirest-hueso shadow-2xl shadow-black/30 flex items-center justify-center hover:scale-105 transition-transform"
      >
        <MessageCircle size={22} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1.5 rounded-full bg-servirest-terracota text-servirest-hueso text-[11px] font-black flex items-center justify-center border-2 border-servirest-hueso animate-pulse">{unread}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setOpen(false); setActiveOrder(null); }} className="fixed inset-0 bg-servirest-midnight/60 backdrop-blur-sm z-[60]" />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-servirest-hueso z-[61] flex flex-col shadow-2xl"
            >
              <header className="flex-shrink-0 flex items-center gap-3 px-5 py-4 border-b border-[rgba(42,40,38,0.08)] bg-servirest-surface">
                {activeOrder ? (
                  <button onClick={() => setActiveOrder(null)} className="w-9 h-9 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.1)] flex items-center justify-center text-[rgba(42,40,38,0.6)]"><ChevronLeft size={18} /></button>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-servirest-midnight text-servirest-mostaza flex items-center justify-center"><MessageCircle size={17} /></div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-serif italic text-servirest-midnight text-[17px] leading-none">{activeOrder ? `Orden ${label(activeOrder)}` : 'Mensajes de clientes'}</div>
                  <div className="text-[10px] text-[rgba(42,40,38,0.5)] mt-0.5">{activeOrder ? 'Responde al cliente' : `${threads.length} conversación(es)`}</div>
                </div>
                <button onClick={() => { setOpen(false); setActiveOrder(null); }} className="w-9 h-9 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.1)] flex items-center justify-center text-[rgba(42,40,38,0.5)]"><X size={16} /></button>
              </header>

              {/* Lista de conversaciones */}
              {!activeOrder ? (
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {threads.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center px-8 py-16">
                      <MessageCircle size={32} className="text-[rgba(42,40,38,0.2)] mb-3" />
                      <p className="text-[13px] text-[rgba(42,40,38,0.5)]">Aún no hay mensajes de clientes. Cuando alguien te escriba desde su pedido, aparecerá aquí.</p>
                    </div>
                  ) : threads.map(({ orderId, msgs, last }) => {
                    const fromCustomer = last.sender === 'customer';
                    const unseen = msgs.filter((m) => m.sender === 'customer' && new Date(m.createdAt).getTime() > lastSeen).length;
                    return (
                      <button key={orderId} onClick={() => setActiveOrder(orderId)} className="w-full text-left rounded-2xl bg-servirest-surface border border-[rgba(42,40,38,0.08)] p-3.5 flex items-center gap-3 hover:border-servirest-terracota/40 transition-colors">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${unseen ? 'bg-servirest-terracota text-servirest-hueso' : 'bg-servirest-hueso text-[rgba(42,40,38,0.5)]'}`}>
                          <MessageCircle size={17} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-servirest-midnight text-[13px]">Orden {label(orderId)}</span>
                            {unseen > 0 && <span className="text-[9px] font-black text-servirest-hueso bg-servirest-terracota rounded-full px-1.5 py-0.5">{unseen} nuevo</span>}
                          </div>
                          <div className="text-[12px] text-[rgba(42,40,38,0.55)] truncate mt-0.5">{fromCustomer ? '' : '↩ '}{last.message}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Hilo de una orden */
                <>
                  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
                    {activeMsgs.map((m) => {
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
                  <div className="flex-shrink-0 flex items-center gap-2 p-3 border-t border-[rgba(42,40,38,0.08)] bg-servirest-surface pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                      placeholder="Escribe una respuesta…"
                      className="flex-1 h-11 px-4 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.12)] text-[14px] focus:outline-none focus:border-servirest-terracota"
                    />
                    <button onClick={send} disabled={sending || !draft.trim()} className="w-11 h-11 rounded-full bg-servirest-terracota text-servirest-hueso flex items-center justify-center disabled:opacity-40 flex-shrink-0"><Send size={17} /></button>
                  </div>
                </>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
