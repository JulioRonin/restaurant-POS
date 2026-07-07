import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Plus, Minus, Trash2, X, ChefHat, CheckCircle2,
  Bluetooth, QrCode, Banknote, CreditCard, ArrowLeft, Search, Utensils,
  Truck, Store, Lock,
} from 'lucide-react';
import { useMenu } from '../contexts/MenuContext';
import { useSettings } from '../contexts/SettingsContext';
import { MenuItem } from '../types';
import {
  SrKicker, SrMono, SrChip, SrLabel,
} from '../components/ui/servirest';

type CartLine = {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
};

type PayMethod = 'bluetooth' | 'stripe_qr' | 'cash' | 'oxxo';

const MODE_META: Record<string, { label: string; icon: React.ElementType; verb: string }> = {
  delivery:    { label: 'Enviar a domicilio', icon: Truck,    verb: 'Envío' },
  pickup:      { label: 'Recoger en local',   icon: Store,    verb: 'Recoger' },
  'dine-in':   { label: 'Comer en mesa',      icon: Utensils, verb: 'En mesa' },
  reservation: { label: 'Reservar mesa',      icon: ChefHat,  verb: 'Reservar' },
};

const PAY_META: Record<PayMethod, { label: string; icon: React.ElementType; desc: string }> = {
  bluetooth: { label: 'Terminal en local', icon: Bluetooth,  desc: 'Pasa tu tarjeta en la terminal' },
  stripe_qr: { label: 'QR de pago',        icon: QrCode,     desc: 'Escanea con tu app bancaria' },
  cash:      { label: 'Efectivo al recoger', icon: Banknote, desc: 'Pagas al recibir tu pedido' },
  oxxo:      { label: 'OXXO Pay',          icon: CreditCard, desc: 'Referencia para pagar en tienda' },
};

/* -------------------------------------------------------------------------- */
/* KioskScreen — pantalla táctil del cliente                                  */
/* -------------------------------------------------------------------------- */
export const KioskScreen: React.FC = () => {
  const { menuItems } = useMenu();
  const { settings, updateSettings } = useSettings();
  const [category, setCategory] = useState<string>('__all__');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [showExitPin, setShowExitPin] = useState(false);
  const [exitPinValue, setExitPinValue] = useState('');
  const [exitPinError, setExitPinError] = useState(false);

  // Productos publicados online. Si publishOnline es undefined en items viejos,
  // caemos a "activo" para no dejar el kiosko vacío en la demo inicial.
  const publishedItems = useMemo(() => {
    return menuItems.filter((m) => {
      const isPublished = m.publishOnline === true || (m.publishOnline === undefined && m.status === 'ACTIVE');
      const availableOnline = m.onlineAvailable !== false;
      return isPublished && availableOnline && m.status === 'ACTIVE';
    });
  }, [menuItems]);

  const categories = useMemo(() => {
    const set = new Set(publishedItems.map((m) => m.category));
    return ['__all__', ...Array.from(set)];
  }, [publishedItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return publishedItems.filter((m) => {
      const matchesCat = category === '__all__' || m.category === category;
      const matchesQ = !q || m.name.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });
  }, [publishedItems, category, search]);

  const cartCount = cart.reduce((n, l) => n + l.quantity, 0);
  const subtotal = cart.reduce((n, l) => n + l.price * l.quantity, 0);
  const deliveryFee = settings.digitalMode === 'delivery' ? (settings.digitalDeliveryFee ?? 0) : 0;
  const total = subtotal + deliveryFee;
  const meetsMinimum = subtotal >= (settings.digitalMinOrder ?? 0);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const line = prev.find((l) => l.id === item.id);
      if (line) return prev.map((l) => (l.id === item.id ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, {
        id: item.id,
        name: item.name,
        price: item.onlinePrice ?? item.price,
        image: item.image,
        quantity: 1,
      }];
    });
  };

  const decLine = (id: string) => {
    setCart((prev) => prev.flatMap((l) => (l.id === id ? (l.quantity > 1 ? [{ ...l, quantity: l.quantity - 1 }] : []) : [l])));
  };

  const incLine = (id: string) => {
    setCart((prev) => prev.map((l) => (l.id === id ? { ...l, quantity: l.quantity + 1 } : l)));
  };

  const removeLine = (id: string) => setCart((prev) => prev.filter((l) => l.id !== id));

  const handleCheckout = () => {
    // Simulación — en Fase 2B esto llama al gateway real (Stripe QR, terminal BT, etc.)
    setOrderSuccess(true);
    setTimeout(() => {
      setOrderSuccess(false);
      setShowCheckout(false);
      setShowCart(false);
      setCart([]);
      setPayMethod(null);
    }, 3500);
  };

  const handleExitKiosk = () => {
    if (exitPinValue === (settings.kioskPin || '0000')) {
      updateSettings({ terminalMode: 'standard' });
      setShowExitPin(false);
      window.location.hash = '/dashboard';
    } else {
      setExitPinError(true);
      setTimeout(() => { setExitPinError(false); setExitPinValue(''); }, 800);
    }
  };

  const digitalMode = settings.digitalMode || 'pickup';
  const modeMeta = MODE_META[digitalMode] || MODE_META.pickup;
  const enabledPays = settings.kioskPayMethods || { bluetooth: true, cash: true };
  const availablePays = (Object.keys(PAY_META) as PayMethod[]).filter((k) => enabledPays[k]);

  return (
    <div className="h-screen w-screen bg-servirest-hueso overflow-hidden flex flex-col antialiased">
      {/* ── Header editorial ─────────────────────────────────────────── */}
      <header className="flex-shrink-0 px-8 md:px-12 pt-8 pb-6 border-b border-[rgba(42,40,38,0.08)] bg-servirest-surface">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-0">
            <SrKicker>Sobremesa Lúcida · {settings.name || 'ServiRest'}</SrKicker>
            <h1 className="font-serif italic text-servirest-midnight text-4xl md:text-6xl leading-none mt-3 tracking-[-0.02em]">
              {settings.digitalWelcome || 'Bienvenido. Toca para ordenar.'}
            </h1>
            <div className="flex items-center gap-3 mt-5 flex-wrap">
              <SrChip tone="terracota" size="sm">
                <modeMeta.icon size={11} className="mr-1.5" /> {modeMeta.label}
              </SrChip>
              {(settings.digitalMinOrder ?? 0) > 0 && (
                <SrChip tone="mostaza" size="sm">
                  Mínimo ${settings.digitalMinOrder}
                </SrChip>
              )}
              <SrChip tone="neutral" size="sm">
                {publishedItems.length} platillos disponibles
              </SrChip>
            </div>
          </div>

          {/* Salida del kiosko (PIN del operador) */}
          <button
            onClick={() => setShowExitPin(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-[rgba(42,40,38,0.15)] hover:border-servirest-terracota/40 transition-colors text-[10px] font-black uppercase tracking-[0.2em] text-[rgba(42,40,38,0.5)] hover:text-servirest-terracota"
          >
            <Lock size={12} /> Salir del kiosko
          </button>
        </div>

        {/* Search + categorías */}
        <div className="mt-8 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[rgba(42,40,38,0.4)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar platillo…"
              className="w-full h-14 pl-14 pr-5 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.1)] text-[15px] font-medium focus:outline-none focus:border-servirest-terracota"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`flex-shrink-0 px-5 h-14 rounded-full text-[13px] font-black uppercase tracking-[0.15em] transition-all ${
                  category === cat
                    ? 'bg-servirest-midnight text-servirest-hueso shadow-md'
                    : 'bg-servirest-hueso text-[rgba(42,40,38,0.6)] border border-[rgba(42,40,38,0.1)] hover:border-servirest-midnight/40'
                }`}
              >
                {cat === '__all__' ? 'Todo' : cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Catálogo ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 rounded-full bg-servirest-hueso-sunken flex items-center justify-center mb-6">
              <ChefHat size={40} className="text-servirest-terracota" />
            </div>
            <h2 className="font-serif italic text-servirest-midnight text-3xl mb-2">Menú en preparación</h2>
            <p className="text-[14px] text-[rgba(42,40,38,0.6)] max-w-md">
              El negocio aún no publica platillos en el canal digital. Regresa en un rato.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
            {filtered.map((item, idx) => (
              <ProductCard key={item.id} item={item} idx={idx} onAdd={() => addToCart(item)} />
            ))}
          </div>
        )}
      </main>

      {/* ── Carrito flotante (bottom bar) ────────────────────────────── */}
      <AnimatePresence>
        {cartCount > 0 && !showCart && (
          <motion.button
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 24 }}
            onClick={() => setShowCart(true)}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-6 py-4 rounded-full bg-servirest-terracota text-servirest-hueso shadow-2xl shadow-servirest-terracota/40 hover:scale-105 transition-transform"
          >
            <div className="relative">
              <ShoppingCart size={22} />
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-servirest-mostaza text-servirest-midnight text-[10px] font-black flex items-center justify-center">
                {cartCount}
              </span>
            </div>
            <span className="font-black italic uppercase tracking-[0.15em] text-[13px]">Ver mi orden</span>
            <SrMono className="text-[14px] font-extrabold">${total.toFixed(2)}</SrMono>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Cart drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="fixed inset-0 bg-servirest-midnight/60 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-servirest-hueso z-50 flex flex-col shadow-2xl"
            >
              <header className="flex items-center justify-between p-6 border-b border-[rgba(42,40,38,0.08)]">
                <div>
                  <SrKicker>Tu orden</SrKicker>
                  <h2 className="font-serif italic text-servirest-midnight text-2xl mt-1">{cartCount} platillos</h2>
                </div>
                <button
                  onClick={() => setShowCart(false)}
                  className="w-11 h-11 rounded-full bg-servirest-hueso-sunken/60 flex items-center justify-center hover:bg-servirest-hueso-sunken"
                >
                  <X size={20} />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {cart.map((line) => (
                  <div key={line.id} className="flex items-center gap-3 p-3 rounded-sr-md bg-servirest-surface border border-[rgba(42,40,38,0.08)]">
                    <img src={line.image} alt={line.name} className="w-14 h-14 rounded-sr-sm object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-serif italic text-servirest-midnight text-[14px] leading-tight truncate">{line.name}</div>
                      <SrMono className="text-[12px] text-servirest-terracota mt-1">
                        ${line.price.toFixed(2)} · Sub ${(line.price * line.quantity).toFixed(2)}
                      </SrMono>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => decLine(line.id)}
                        className="w-9 h-9 rounded-full bg-servirest-hueso-sunken hover:bg-[rgba(42,40,38,0.1)] flex items-center justify-center"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-black text-[15px]">{line.quantity}</span>
                      <button
                        onClick={() => incLine(line.id)}
                        className="w-9 h-9 rounded-full bg-servirest-terracota text-servirest-hueso hover:scale-105 transition-transform flex items-center justify-center"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => removeLine(line.id)}
                        className="w-9 h-9 rounded-full text-servirest-danger hover:bg-servirest-danger/10 flex items-center justify-center ml-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <footer className="border-t border-[rgba(42,40,38,0.08)] p-6 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[13px] text-[rgba(42,40,38,0.6)]">
                    <span>Subtotal</span>
                    <SrMono>${subtotal.toFixed(2)}</SrMono>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-[13px] text-[rgba(42,40,38,0.6)]">
                      <span>Envío</span>
                      <SrMono>${deliveryFee.toFixed(2)}</SrMono>
                    </div>
                  )}
                  <div className="border-t border-dashed border-[rgba(42,40,38,0.15)] pt-2 flex justify-between items-baseline">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[rgba(42,40,38,0.5)]">Total</span>
                    <SrMono className="text-[32px] font-extrabold text-servirest-midnight">${total.toFixed(2)}</SrMono>
                  </div>
                </div>

                {!meetsMinimum && (
                  <div className="p-3 rounded-sr-sm bg-mostaza-500/10 border border-servirest-mostaza/30 text-[12px] text-servirest-midnight">
                    Faltan <SrMono className="font-bold">${((settings.digitalMinOrder ?? 0) - subtotal).toFixed(2)}</SrMono> para llegar al mínimo de la orden.
                  </div>
                )}

                <button
                  disabled={!meetsMinimum}
                  onClick={() => setShowCheckout(true)}
                  className="w-full h-14 rounded-full bg-servirest-terracota text-servirest-hueso font-black italic uppercase tracking-[0.2em] text-[13px] shadow-sr-glow hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {modeMeta.verb} — ${total.toFixed(2)}
                </button>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Checkout / Payment modal ─────────────────────────────────── */}
      <AnimatePresence>
        {showCheckout && !orderSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-servirest-midnight/80 backdrop-blur-md z-[60] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-servirest-hueso rounded-sr-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <header className="p-8 border-b border-[rgba(42,40,38,0.08)]">
                <button
                  onClick={() => setShowCheckout(false)}
                  className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[rgba(42,40,38,0.5)] hover:text-servirest-terracota mb-4"
                >
                  <ArrowLeft size={14} /> Volver a mi orden
                </button>
                <SrKicker>Confirmar pedido</SrKicker>
                <h2 className="font-serif italic text-servirest-midnight text-3xl mt-2">¿Cómo prefieres pagar?</h2>
                <p className="text-[13px] text-[rgba(42,40,38,0.6)] mt-2">
                  Total: <SrMono className="text-servirest-midnight font-bold">${total.toFixed(2)}</SrMono>
                </p>
              </header>

              <div className="p-8 space-y-3">
                {availablePays.length === 0 && (
                  <div className="p-4 rounded-sr-md bg-mostaza-500/10 text-[13px] text-servirest-midnight">
                    Este negocio no tiene métodos de pago configurados en el canal digital.
                  </div>
                )}
                {availablePays.map((k) => {
                  const meta = PAY_META[k];
                  const active = payMethod === k;
                  return (
                    <button
                      key={k}
                      onClick={() => setPayMethod(k)}
                      className={`w-full text-left rounded-sr-md border-2 p-5 flex items-center gap-4 transition-all ${
                        active
                          ? 'border-servirest-terracota bg-servirest-terracota/5 shadow-sr-lift'
                          : 'border-[rgba(42,40,38,0.1)] bg-servirest-surface hover:border-servirest-terracota/40'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-sr-md flex items-center justify-center flex-shrink-0 ${
                        active ? 'bg-servirest-terracota text-servirest-hueso' : 'bg-servirest-hueso-sunken text-servirest-midnight'
                      }`}>
                        <meta.icon size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-serif italic text-servirest-midnight text-[17px] leading-tight">{meta.label}</div>
                        <p className="text-[12px] text-[rgba(42,40,38,0.55)] mt-0.5">{meta.desc}</p>
                      </div>
                      {active && <CheckCircle2 size={20} className="text-servirest-terracota flex-shrink-0" />}
                    </button>
                  );
                })}

                <button
                  disabled={!payMethod}
                  onClick={handleCheckout}
                  className="w-full h-16 rounded-full bg-servirest-midnight text-servirest-hueso font-black italic uppercase tracking-[0.2em] text-[13px] hover:bg-servirest-midnight/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-6"
                >
                  Confirmar pedido — ${total.toFixed(2)}
                </button>
                <p className="text-[10px] text-[rgba(42,40,38,0.4)] text-center mt-3 italic">
                  Simulación · el gateway real se conecta en Fase 2B (Stripe, terminal Bluetooth, OXXO).
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}

        {orderSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-servirest-midnight/90 backdrop-blur-md z-[70] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 18 }}
              className="text-center max-w-md"
            >
              <div className="w-32 h-32 rounded-full bg-servirest-terracota text-servirest-hueso mx-auto flex items-center justify-center shadow-sr-glow mb-6">
                <CheckCircle2 size={64} strokeWidth={2.5} />
              </div>
              <SrKicker className="!text-servirest-mostaza">Pedido confirmado</SrKicker>
              <h2 className="font-serif italic text-servirest-hueso text-5xl leading-none mt-3 mb-4">¡Listo!</h2>
              <p className="text-[15px] text-servirest-hueso/70 leading-relaxed">
                Tu pedido ya llegó a cocina. Recibirás actualizaciones en pantalla mientras lo preparamos.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Exit PIN modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showExitPin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-servirest-midnight/80 backdrop-blur-md z-[80] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-servirest-hueso rounded-sr-2xl p-8 max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 rounded-full bg-servirest-midnight text-servirest-mostaza mx-auto flex items-center justify-center mb-5">
                <Lock size={24} />
              </div>
              <SrKicker>Modo kiosko</SrKicker>
              <h2 className="font-serif italic text-servirest-midnight text-2xl mt-2 mb-2">PIN del operador</h2>
              <p className="text-[12px] text-[rgba(42,40,38,0.6)] mb-6">
                Ingresa el PIN configurado en Canal Digital → Kiosko para salir del modo.
              </p>
              <input
                type="password"
                autoFocus
                maxLength={4}
                value={exitPinValue}
                onChange={(e) => setExitPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={(e) => e.key === 'Enter' && handleExitKiosk()}
                className={`w-full h-14 text-center text-[24px] font-black tracking-[0.4em] rounded-sr-md border-2 bg-servirest-surface focus:outline-none ${
                  exitPinError
                    ? 'border-servirest-danger animate-shake'
                    : 'border-[rgba(42,40,38,0.12)] focus:border-servirest-terracota'
                }`}
                placeholder="••••"
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowExitPin(false); setExitPinValue(''); }}
                  className="flex-1 h-12 rounded-full border border-[rgba(42,40,38,0.15)] text-[11px] font-black uppercase tracking-[0.15em] text-[rgba(42,40,38,0.6)]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleExitKiosk}
                  className="flex-1 h-12 rounded-full bg-servirest-terracota text-servirest-hueso text-[11px] font-black uppercase tracking-[0.15em]"
                >
                  Salir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* ProductCard — big touch card                                               */
/* -------------------------------------------------------------------------- */
const ProductCard: React.FC<{ item: MenuItem; idx: number; onAdd: () => void }> = ({ item, idx, onAdd }) => {
  const [pulse, setPulse] = useState(false);
  const price = item.onlinePrice ?? item.price;
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.35 }}
      onClick={() => { onAdd(); setPulse(true); setTimeout(() => setPulse(false), 400); }}
      className="text-left rounded-sr-lg bg-servirest-surface border border-[rgba(42,40,38,0.08)] overflow-hidden shadow-sr-card hover:shadow-sr-lift transition-shadow active:scale-[0.98] transition-transform group"
    >
      <div className="aspect-[4/3] bg-servirest-hueso-sunken relative overflow-hidden">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.id}/400/300`; }}
        />
        <div className="absolute top-3 right-3">
          <SrChip tone="terracota" size="sm">${price.toFixed(2)}</SrChip>
        </div>
        <AnimatePresence>
          {pulse && (
            <motion.div
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 3, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute bottom-3 right-3 w-14 h-14 rounded-full bg-servirest-terracota"
            />
          )}
        </AnimatePresence>
        <div className="absolute bottom-3 right-3 w-14 h-14 rounded-full bg-servirest-terracota text-servirest-hueso flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <Plus size={22} strokeWidth={2.5} />
        </div>
      </div>
      <div className="p-4">
        <div className="font-serif italic text-servirest-midnight text-[17px] leading-tight line-clamp-1">{item.name}</div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[rgba(42,40,38,0.5)] mt-1.5">{item.category}</div>
        {item.description && (
          <p className="text-[12px] text-[rgba(42,40,38,0.6)] mt-2 line-clamp-2 leading-relaxed">{item.description}</p>
        )}
      </div>
    </motion.button>
  );
};

export default KioskScreen;
