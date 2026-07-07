import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Plus, Minus, Trash2, X, ChefHat, CheckCircle2,
  Bluetooth, QrCode, Banknote, CreditCard, ArrowLeft, Search, Utensils,
  Truck, Store, Lock, Clock as ClockIcon, PackageCheck, RefreshCw, Check,
} from 'lucide-react';
import { useMenu } from '../contexts/MenuContext';
import { useSettings } from '../contexts/SettingsContext';
import { useOrders } from '../contexts/OrderContext';
import { useUser } from '../contexts/UserContext';
import { MenuItem, MenuItemVariant, OrderStatus, OrderSource, PaymentStatus, PaymentMethod, Order } from '../types';
import { SrKicker, SrMono, SrChip, SrLabel } from '../components/ui/servirest';

type CartLine = {
  lineId: string;
  itemId: string;
  name: string;
  basePrice: number;
  image: string;
  quantity: number;
  variants: MenuItemVariant[];
  notes: string;
};

type PayMethod = 'bluetooth' | 'stripe_qr' | 'cash' | 'oxxo';
type ViewState = 'menu' | 'success';

const MODE_META: Record<string, { label: string; icon: React.ElementType; verb: string }> = {
  delivery:    { label: 'Enviar a domicilio', icon: Truck,    verb: 'Envío' },
  pickup:      { label: 'Recoger en local',   icon: Store,    verb: 'Recoger' },
  'dine-in':   { label: 'Comer en mesa',      icon: Utensils, verb: 'En mesa' },
  reservation: { label: 'Reservar mesa',      icon: ChefHat,  verb: 'Reservar' },
};

const PAY_META: Record<PayMethod, { label: string; icon: React.ElementType; desc: string }> = {
  bluetooth: { label: 'Terminal en local',   icon: Bluetooth,  desc: 'Pasa tu tarjeta en la terminal' },
  stripe_qr: { label: 'Pagar con Stripe',    icon: QrCode,     desc: 'Link seguro con tarjeta o Apple Pay' },
  cash:      { label: 'Efectivo al recoger', icon: Banknote,   desc: 'Pagas al recibir tu pedido' },
  oxxo:      { label: 'OXXO Pay',            icon: CreditCard, desc: 'Referencia para pagar en tienda' },
};

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const lineTotal = (l: CartLine) => (l.basePrice + l.variants.reduce((s, v) => s + (v.price || 0), 0)) * l.quantity;

/* -------------------------------------------------------------------------- */
/* KioskScreen — cliente ordena, paga y ve el estatus                          */
/* -------------------------------------------------------------------------- */
export const KioskScreen: React.FC = () => {
  const { menuItems } = useMenu();
  const { settings, updateSettings } = useSettings();
  const { addOrder, orders } = useOrders();
  const { authProfile } = useUser();

  const [view, setView] = useState<ViewState>('menu');
  const [category, setCategory] = useState<string>('__all__');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [processing, setProcessing] = useState(false);
  const [variantModal, setVariantModal] = useState<MenuItem | null>(null);
  const [selVariants, setSelVariants] = useState<MenuItemVariant[]>([]);
  const [selNotes, setSelNotes] = useState('');
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [showExitPin, setShowExitPin] = useState(false);
  const [exitPinValue, setExitPinValue] = useState('');
  const [exitPinError, setExitPinError] = useState(false);

  // ── Días de servicio ──────────────────────────────────────────────
  const todayKey = DAY_KEYS[new Date().getDay()];
  const isOpenToday = settings.digitalServiceDays?.[todayKey as keyof typeof settings.digitalServiceDays] ?? true;

  // ── Productos publicados online ──────────────────────────────────
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
  const subtotal = cart.reduce((n, l) => n + lineTotal(l), 0);
  const deliveryFee = settings.digitalMode === 'delivery' ? (settings.digitalDeliveryFee ?? 0) : 0;
  const iva = subtotal * 0.16;
  const total = subtotal + deliveryFee;
  const meetsMinimum = subtotal >= (settings.digitalMinOrder ?? 0);

  // ── Handlers ──────────────────────────────────────────────────────
  const openProduct = (item: MenuItem) => {
    if (item.variants && item.variants.length > 0) {
      setVariantModal(item);
      setSelVariants([]);
      setSelNotes('');
    } else {
      addLine(item, [], '');
    }
  };

  const addLine = (item: MenuItem, variants: MenuItemVariant[], notes: string) => {
    setCart((prev) => {
      // Si el ítem tiene las mismas variantes y notas, agrupa cantidad
      const key = `${item.id}|${[...variants].map((v) => v.name).sort().join(',')}|${notes.trim()}`;
      const existing = prev.find((l) => `${l.itemId}|${[...l.variants].map((v) => v.name).sort().join(',')}|${l.notes.trim()}` === key);
      if (existing) {
        return prev.map((l) => (l.lineId === existing.lineId ? { ...l, quantity: l.quantity + 1 } : l));
      }
      const basePrice = item.onlinePrice ?? item.price;
      return [...prev, {
        lineId: crypto.randomUUID(),
        itemId: item.id,
        name: item.name,
        basePrice,
        image: item.image,
        quantity: 1,
        variants,
        notes,
      }];
    });
    setVariantModal(null);
  };

  const decLine = (lineId: string) => {
    setCart((prev) => prev.flatMap((l) => (l.lineId === lineId ? (l.quantity > 1 ? [{ ...l, quantity: l.quantity - 1 }] : []) : [l])));
  };
  const incLine = (lineId: string) => setCart((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + 1 } : l)));
  const removeLine = (lineId: string) => setCart((prev) => prev.filter((l) => l.lineId !== lineId));

  // ── Enviar orden a Cocina (crea Order real) ──────────────────────
  const sendOrderToKitchen = async (method: PayMethod): Promise<Order | null> => {
    if (!authProfile?.businessId) return null;

    const sourceMap: Record<string, OrderSource> = {
      delivery: OrderSource.TO_GO,
      pickup: OrderSource.PICKUP,
      'dine-in': OrderSource.DINE_IN,
      reservation: OrderSource.DINE_IN,
    };
    const paymentMap: Record<PayMethod, PaymentMethod> = {
      bluetooth: PaymentMethod.CARD,
      stripe_qr: PaymentMethod.CARD,
      cash: PaymentMethod.CASH,
      oxxo: PaymentMethod.TRANSFER,
    };

    const orderId = crypto.randomUUID();
    const orderItems = cart.map((l) => {
      const item: any = {
        id: l.itemId,
        name: l.name,
        price: l.basePrice,
        image: l.image,
        quantity: l.quantity,
        notes: l.notes,
        selectedVariants: l.variants,
        category: '',
        status: 'ACTIVE',
        inventoryLevel: 4,
        businessId: authProfile.businessId,
      };
      return item;
    });

    const order: Order = {
      id: orderId,
      tableId: 'KIOSK',
      items: orderItems as any,
      status: OrderStatus.PENDING,
      timestamp: new Date(),
      total,
      waiterName: 'Canal digital',
      paymentStatus: method === 'cash' || method === 'oxxo' ? PaymentStatus.PENDING : PaymentStatus.PAID,
      paymentMethod: paymentMap[method],
      source: sourceMap[settings.digitalMode || 'pickup'],
      businessId: authProfile.businessId,
    };

    return await addOrder(order);
  };

  // ── Checkout ─────────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (!payMethod || processing) return;
    setProcessing(true);
    try {
      if (payMethod === 'stripe_qr') {
        // Redirige a Stripe Checkout con line_items dinámicos
        await stripeCheckout();
        return; // El redirect toma control; el kiosko queda esperando el retorno.
      }
      const placed = await sendOrderToKitchen(payMethod);
      if (placed) {
        setConfirmedOrderId(placed.id);
        setView('success');
        setShowCheckout(false);
        setShowCart(false);
      }
    } catch (err) {
      console.error('[Kiosk] Checkout error:', err);
      alert('Hubo un problema procesando tu orden. Intenta de nuevo.');
    } finally {
      setProcessing(false);
    }
  };

  const stripeCheckout = async () => {
    if (!authProfile?.businessId) return;
    try {
      // Envía primero la orden a Cocina (queda como PENDING hasta que Stripe confirme)
      const placed = await sendOrderToKitchen('stripe_qr');
      if (!placed) throw new Error('No pudimos crear la orden');
      setConfirmedOrderId(placed.id);

      // Genera Stripe Checkout Session
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: authProfile.businessId,
          amount: Math.round(total * 100) / 100,
          mode: 'payment',
          type: 'DIGITAL_ORDER',
          planName: `Pedido #${placed.dailyNumber ?? placed.id.slice(0, 8)} — ${settings.name || 'ServiRest'}`,
          successUrl: `${window.location.origin}${window.location.pathname}#/kiosk?paid=${placed.id}`,
          cancelUrl: `${window.location.origin}${window.location.pathname}#/kiosk?cancel=${placed.id}`,
        }),
      });
      const { url, error } = await res.json();
      if (error || !url) throw new Error(error || 'No pudimos generar el link de pago');
      window.location.href = url;
    } catch (err: any) {
      console.error('[Kiosk] Stripe error:', err);
      alert('No pudimos generar el link de pago. ' + (err.message || ''));
      setProcessing(false);
    }
  };

  // Detecta retorno de Stripe (successUrl) → muestra pantalla de éxito
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const paid = params.get('paid');
    if (paid) {
      setConfirmedOrderId(paid);
      setView('success');
      setCart([]);
    }
  }, []);

  const handleNewOrder = () => {
    setView('menu');
    setCart([]);
    setPayMethod(null);
    setConfirmedOrderId(null);
    setShowCart(false);
  };

  const handleOrderMore = () => {
    setView('menu');
    setPayMethod(null);
    setConfirmedOrderId(null);
    // NO limpia el carrito — el cliente puede seguir agregando y hace un nuevo cobro
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

  // ── PANTALLA DE CERRADO ─────────────────────────────────────────
  if (!isOpenToday && view === 'menu') {
    return (
      <ClosedTodayScreen
        settings={settings}
        onExit={() => setShowExitPin(true)}
        showExitPin={showExitPin}
        setShowExitPin={setShowExitPin}
        exitPinValue={exitPinValue}
        setExitPinValue={setExitPinValue}
        exitPinError={exitPinError}
        onExitConfirm={handleExitKiosk}
      />
    );
  }

  // ── PANTALLA DE ESTATUS DE LA ORDEN ─────────────────────────────
  if (view === 'success' && confirmedOrderId) {
    const placedOrder = orders.find((o) => o.id === confirmedOrderId);
    return (
      <OrderStatusScreen
        order={placedOrder}
        mode={digitalMode}
        onOrderMore={handleOrderMore}
        onNewOrder={handleNewOrder}
        onExit={() => setShowExitPin(true)}
      />
    );
  }

  // ── PANTALLA PRINCIPAL DEL KIOSKO ───────────────────────────────
  return (
    <div className="h-screen w-screen bg-servirest-hueso overflow-hidden flex flex-col antialiased">
      {/* Header */}
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
                <SrChip tone="mostaza" size="sm">Mínimo ${settings.digitalMinOrder}</SrChip>
              )}
              <SrChip tone="neutral" size="sm">{publishedItems.length} platillos</SrChip>
              <SrChip tone="success" size="sm">
                <ClockIcon size={10} className="mr-1.5" /> Abierto hoy · {settings.digitalHoursOpen}–{settings.digitalHoursClose}
              </SrChip>
            </div>
          </div>
          <button
            onClick={() => setShowExitPin(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-[rgba(42,40,38,0.15)] hover:border-servirest-terracota/40 transition-colors text-[10px] font-black uppercase tracking-[0.2em] text-[rgba(42,40,38,0.5)] hover:text-servirest-terracota"
          >
            <Lock size={12} /> Salir del kiosko
          </button>
        </div>

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

      {/* Catálogo */}
      <main className="flex-1 overflow-y-auto px-8 md:px-12 py-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 rounded-full bg-servirest-hueso-sunken flex items-center justify-center mb-6">
              <ChefHat size={40} className="text-servirest-terracota" />
            </div>
            <h2 className="font-serif italic text-servirest-midnight text-3xl mb-2">Menú en preparación</h2>
            <p className="text-[14px] text-[rgba(42,40,38,0.6)] max-w-md">
              El negocio aún no publica platillos en el canal digital.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-7xl mx-auto pb-24">
            {filtered.map((item, idx) => (
              <ProductCard key={item.id} item={item} idx={idx} onOpen={() => openProduct(item)} />
            ))}
          </div>
        )}
      </main>

      {/* FAB carrito */}
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

      {/* Cart drawer */}
      <AnimatePresence>
        {showCart && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="fixed inset-0 bg-servirest-midnight/60 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
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
                  <div key={line.lineId} className="p-3 rounded-sr-md bg-servirest-surface border border-[rgba(42,40,38,0.08)]">
                    <div className="flex items-start gap-3">
                      <img src={line.image} alt={line.name} className="w-14 h-14 rounded-sr-sm object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-serif italic text-servirest-midnight text-[14px] leading-tight">{line.name}</div>
                        {line.variants.length > 0 && (
                          <div className="text-[10px] text-[rgba(42,40,38,0.55)] mt-1 leading-relaxed">
                            {line.variants.map((v) => v.name).join(' · ')}
                          </div>
                        )}
                        {line.notes && (
                          <div className="text-[10px] text-servirest-terracota italic mt-1">"{line.notes}"</div>
                        )}
                        <SrMono className="text-[12px] text-servirest-terracota mt-1">${lineTotal(line).toFixed(2)}</SrMono>
                      </div>
                      <button
                        onClick={() => removeLine(line.lineId)}
                        className="w-8 h-8 rounded-full text-servirest-danger hover:bg-servirest-danger/10 flex items-center justify-center"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        onClick={() => decLine(line.lineId)}
                        className="w-9 h-9 rounded-full bg-servirest-hueso-sunken hover:bg-[rgba(42,40,38,0.1)] flex items-center justify-center"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-10 text-center font-black text-[16px]">{line.quantity}</span>
                      <button
                        onClick={() => incLine(line.lineId)}
                        className="w-9 h-9 rounded-full bg-servirest-terracota text-servirest-hueso hover:scale-105 transition-transform flex items-center justify-center"
                      >
                        <Plus size={14} />
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
                  <div className="flex justify-between text-[11px] text-[rgba(42,40,38,0.45)]">
                    <span>IVA incluido (16%)</span>
                    <SrMono>${iva.toFixed(2)}</SrMono>
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
                    Faltan <SrMono className="font-bold">${((settings.digitalMinOrder ?? 0) - subtotal).toFixed(2)}</SrMono> para llegar al mínimo.
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

      {/* Variant modal */}
      <AnimatePresence>
        {variantModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-servirest-midnight/80 backdrop-blur-md z-[55] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9 }}
              className="bg-servirest-hueso rounded-sr-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl"
            >
              <div className="aspect-[16/9] bg-servirest-hueso-sunken relative overflow-hidden">
                <img src={variantModal.image} alt={variantModal.name} className="w-full h-full object-cover" />
                <button
                  onClick={() => setVariantModal(null)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-servirest-midnight/80 text-servirest-hueso flex items-center justify-center hover:bg-servirest-midnight"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6">
                <SrKicker>{variantModal.category}</SrKicker>
                <h2 className="font-serif italic text-servirest-midnight text-3xl mt-2 mb-1 leading-tight">{variantModal.name}</h2>
                {variantModal.description && (
                  <p className="text-[13px] text-[rgba(42,40,38,0.6)] mt-2 leading-relaxed">{variantModal.description}</p>
                )}

                <div className="mt-6">
                  <SrLabel className="block mb-1">
                    {(variantModal.variantMode ?? 'single') === 'single' ? 'Elige UNA opción' : 'Elige tus variantes'}
                  </SrLabel>
                  <p className="text-[11px] text-[rgba(42,40,38,0.5)] mb-3">
                    {(variantModal.variantMode ?? 'single') === 'single'
                      ? 'Solo puedes seleccionar una variante para este platillo.'
                      : 'Puedes combinar varias variantes.'}
                  </p>
                  <div className="space-y-2">
                    {variantModal.variants?.map((v, i) => {
                      const isSingle = (variantModal.variantMode ?? 'single') === 'single';
                      const on = selVariants.some((sv) => sv.name === v.name);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            if (isSingle) {
                              // Radio: reemplaza la selección por esta variante.
                              setSelVariants(on ? [] : [v]);
                            } else {
                              // Checkbox: toggle en la lista.
                              setSelVariants((p) => (on ? p.filter((x) => x.name !== v.name) : [...p, v]));
                            }
                          }}
                          className={`w-full flex justify-between items-center p-4 rounded-sr-md border-2 transition-colors ${
                            on ? 'border-servirest-terracota bg-servirest-terracota/5' : 'border-[rgba(42,40,38,0.1)] bg-servirest-surface hover:border-servirest-terracota/40'
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            {isSingle ? (
                              // Radio circular
                              <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                on ? 'border-servirest-terracota' : 'border-[rgba(42,40,38,0.2)]'
                              }`}>
                                {on && <span className="w-3 h-3 rounded-full bg-servirest-terracota" />}
                              </span>
                            ) : (
                              // Checkbox
                              <span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                                on ? 'border-servirest-terracota bg-servirest-terracota' : 'border-[rgba(42,40,38,0.2)]'
                              }`}>
                                {on && <Check size={13} className="text-servirest-hueso" />}
                              </span>
                            )}
                            <span className="font-serif italic text-[16px] text-servirest-midnight">{v.name}</span>
                          </span>
                          <SrMono className={`text-[13px] font-extrabold ${on ? 'text-servirest-terracota' : 'text-[rgba(42,40,38,0.5)]'}`}>
                            {v.price ? `+$${v.price.toFixed(2)}` : 'Incluido'}
                          </SrMono>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5">
                  <SrLabel className="block mb-2">Notas especiales (opcional)</SrLabel>
                  <textarea
                    value={selNotes}
                    onChange={(e) => setSelNotes(e.target.value.slice(0, 120))}
                    placeholder="Ej. sin cebolla, extra picoso…"
                    rows={2}
                    className="w-full px-4 py-3 rounded-sr-md bg-servirest-surface border border-[rgba(42,40,38,0.1)] text-[13px] font-medium focus:outline-none focus:border-servirest-terracota resize-none"
                  />
                </div>

                <button
                  onClick={() => addLine(variantModal, selVariants, selNotes)}
                  className="w-full h-14 mt-6 rounded-full bg-servirest-terracota text-servirest-hueso font-black italic uppercase tracking-[0.2em] text-[13px] shadow-sr-glow hover:scale-[1.02] active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <Plus size={18} strokeWidth={2.5} />
                  Agregar — ${((variantModal.onlinePrice ?? variantModal.price) + selVariants.reduce((s, v) => s + (v.price || 0), 0)).toFixed(2)}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checkout modal */}
      <AnimatePresence>
        {showCheckout && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-servirest-midnight/80 backdrop-blur-md z-[60] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9 }}
              className="bg-servirest-hueso rounded-sr-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl"
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

                {/* Desglose editorial */}
                <div className="mt-6 p-4 rounded-sr-md bg-servirest-hueso-sunken/50 space-y-1.5">
                  <div className="flex justify-between text-[13px] text-[rgba(42,40,38,0.6)]">
                    <span>Subtotal</span>
                    <SrMono>${subtotal.toFixed(2)}</SrMono>
                  </div>
                  <div className="flex justify-between text-[11px] text-[rgba(42,40,38,0.4)]">
                    <span>IVA (16% incluido)</span>
                    <SrMono>${iva.toFixed(2)}</SrMono>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-[13px] text-[rgba(42,40,38,0.6)]">
                      <span>Envío</span>
                      <SrMono>${deliveryFee.toFixed(2)}</SrMono>
                    </div>
                  )}
                  <div className="border-t border-dashed border-[rgba(42,40,38,0.15)] pt-2 mt-2 flex justify-between items-baseline">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[rgba(42,40,38,0.6)]">Total</span>
                    <SrMono className="text-[24px] font-extrabold text-servirest-midnight">${total.toFixed(2)}</SrMono>
                  </div>
                </div>
              </header>

              <div className="p-8 space-y-3">
                {availablePays.length === 0 && (
                  <div className="p-4 rounded-sr-md bg-mostaza-500/10 text-[13px] text-servirest-midnight">
                    Este negocio no tiene métodos de pago habilitados. Configúralos en Canal Digital → Kiosko.
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
                  disabled={!payMethod || processing}
                  onClick={handleCheckout}
                  className="w-full h-16 rounded-full bg-servirest-midnight text-servirest-hueso font-black italic uppercase tracking-[0.2em] text-[13px] hover:bg-servirest-midnight/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-6 flex items-center justify-center gap-2"
                >
                  {processing ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={18} />}
                  {processing ? 'Procesando…' : payMethod === 'stripe_qr' ? 'Ir a pagar con Stripe' : `Confirmar — $${total.toFixed(2)}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit PIN modal */}
      <AnimatePresence>
        {showExitPin && (
          <ExitPinModal
            value={exitPinValue}
            setValue={setExitPinValue}
            error={exitPinError}
            onCancel={() => { setShowExitPin(false); setExitPinValue(''); }}
            onConfirm={handleExitKiosk}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* ProductCard                                                                */
/* -------------------------------------------------------------------------- */
const ProductCard: React.FC<{ item: MenuItem; idx: number; onOpen: () => void }> = ({ item, idx, onOpen }) => {
  const price = item.onlinePrice ?? item.price;
  const hasVariants = !!(item.variants && item.variants.length > 0);
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.35 }}
      onClick={onOpen}
      className="text-left rounded-sr-lg bg-servirest-surface border border-[rgba(42,40,38,0.08)] overflow-hidden shadow-sr-card hover:shadow-sr-lift transition-shadow active:scale-[0.98] group"
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
        {hasVariants && (
          <div className="absolute top-3 left-3">
            <SrChip tone="mostaza" size="xs">{item.variants!.length} opciones</SrChip>
          </div>
        )}
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

/* -------------------------------------------------------------------------- */
/* OrderStatusScreen — cliente ve el estatus + delivery + volver a ordenar    */
/* -------------------------------------------------------------------------- */
const STATUS_STEPS: { key: OrderStatus; label: string; icon: React.ElementType }[] = [
  { key: OrderStatus.PENDING,  label: 'Recibida',        icon: PackageCheck },
  { key: OrderStatus.COOKING,  label: 'En preparación',  icon: ChefHat },
  { key: OrderStatus.READY,    label: 'Lista',           icon: CheckCircle2 },
  { key: OrderStatus.SERVED,   label: 'Entregada',       icon: Truck },
];

const OrderStatusScreen: React.FC<{
  order: Order | undefined;
  mode: string;
  onOrderMore: () => void;
  onNewOrder: () => void;
  onExit: () => void;
}> = ({ order, mode, onOrderMore, onNewOrder, onExit }) => {
  const activeIdx = order ? STATUS_STEPS.findIndex((s) => s.key === order.status) : 0;
  const orderNum = order?.dailyNumber !== undefined ? String(order.dailyNumber + 1).padStart(4, '0') : '----';

  return (
    <div className="h-screen w-screen bg-servirest-midnight overflow-hidden flex flex-col items-center justify-center antialiased relative">
      <button
        onClick={onExit}
        className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 rounded-full border border-servirest-hueso/20 hover:border-servirest-mostaza/60 text-[10px] font-black uppercase tracking-[0.2em] text-servirest-hueso/50 hover:text-servirest-mostaza"
      >
        <Lock size={12} /> Salir del kiosko
      </button>

      <div className="max-w-2xl w-full px-8 text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18 }}
          className="w-28 h-28 rounded-full bg-servirest-terracota text-servirest-hueso mx-auto flex items-center justify-center shadow-sr-glow mb-6"
        >
          <CheckCircle2 size={56} strokeWidth={2.5} />
        </motion.div>

        <SrKicker className="!text-servirest-mostaza">Pedido confirmado</SrKicker>
        <h1 className="font-serif italic text-servirest-hueso text-6xl leading-none mt-3 mb-2">
          Orden #{orderNum}
        </h1>
        <p className="text-[15px] text-servirest-hueso/60 leading-relaxed mb-10">
          Tu pedido ya está en cocina. Sigue el estatus aquí — te avisamos cuando cambie.
        </p>

        {/* Progress ladder */}
        <div className="grid grid-cols-4 gap-2 mb-10">
          {STATUS_STEPS.map((step, i) => {
            const done = i <= activeIdx;
            const current = i === activeIdx;
            return (
              <div key={step.key} className="flex flex-col items-center">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  done
                    ? 'bg-servirest-terracota text-servirest-hueso shadow-sr-glow'
                    : 'bg-servirest-hueso/5 text-servirest-hueso/30 border border-servirest-hueso/10'
                } ${current ? 'animate-pulse' : ''}`}>
                  <step.icon size={22} strokeWidth={2.2} />
                </div>
                <span className={`mt-3 text-[10px] font-black uppercase tracking-[0.15em] ${
                  done ? 'text-servirest-mostaza' : 'text-servirest-hueso/40'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Order summary */}
        {order && (
          <div className="p-6 rounded-sr-lg bg-servirest-hueso/5 border border-servirest-hueso/10 mb-8 text-left">
            <div className="flex justify-between items-center mb-3">
              <SrLabel className="!text-servirest-mostaza">Resumen</SrLabel>
              <SrMono className="text-[13px] text-servirest-hueso">${order.total.toFixed(2)}</SrMono>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {order.items.map((it: any) => (
                <div key={it.id + (it.selectedVariants || []).map((v: any) => v.name).join()} className="flex justify-between text-[12px] text-servirest-hueso/70">
                  <span>{it.quantity}× {it.name} {it.selectedVariants && it.selectedVariants.length > 0 && (
                    <span className="text-servirest-mostaza/60">· {it.selectedVariants.map((v: any) => v.name).join(', ')}</span>
                  )}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-servirest-hueso/10 text-[11px] text-servirest-hueso/50">
              Modo: {MODE_META[mode]?.label || mode}
            </div>
          </div>
        )}

        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={onOrderMore}
            className="px-8 h-14 rounded-full bg-servirest-hueso text-servirest-midnight font-black italic uppercase tracking-[0.2em] text-[12px] hover:scale-105 transition-transform"
          >
            Ordenar algo más
          </button>
          <button
            onClick={onNewOrder}
            className="px-8 h-14 rounded-full border-2 border-servirest-hueso/30 text-servirest-hueso font-black italic uppercase tracking-[0.2em] text-[12px] hover:border-servirest-mostaza/60 hover:text-servirest-mostaza transition-colors"
          >
            Nueva orden
          </button>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* ClosedTodayScreen                                                          */
/* -------------------------------------------------------------------------- */
const ClosedTodayScreen: React.FC<any> = ({ settings, onExit, showExitPin, setShowExitPin, exitPinValue, setExitPinValue, exitPinError, onExitConfirm }) => (
  <div className="h-screen w-screen bg-servirest-hueso flex items-center justify-center antialiased relative">
    <button
      onClick={onExit}
      className="absolute top-6 right-6 flex items-center gap-2 px-4 py-2 rounded-full border border-[rgba(42,40,38,0.15)] text-[10px] font-black uppercase tracking-[0.2em] text-[rgba(42,40,38,0.5)]"
    >
      <Lock size={12} /> Salir
    </button>
    <div className="max-w-lg text-center px-8">
      <div className="w-24 h-24 rounded-full bg-servirest-mostaza/20 text-servirest-mostaza mx-auto flex items-center justify-center mb-6">
        <ClockIcon size={40} />
      </div>
      <SrKicker>Canal digital · {settings.name}</SrKicker>
      <h1 className="font-serif italic text-servirest-midnight text-5xl leading-none mt-3 mb-4">
        Cerrado hoy
      </h1>
      <p className="text-[15px] text-[rgba(42,40,38,0.6)] leading-relaxed">
        Estamos descansando. Regresa mañana en horario de {settings.digitalHoursOpen} a {settings.digitalHoursClose}.
      </p>
    </div>

    <AnimatePresence>
      {showExitPin && (
        <ExitPinModal
          value={exitPinValue}
          setValue={setExitPinValue}
          error={exitPinError}
          onCancel={() => setShowExitPin(false)}
          onConfirm={onExitConfirm}
        />
      )}
    </AnimatePresence>
  </div>
);

/* -------------------------------------------------------------------------- */
/* ExitPinModal                                                               */
/* -------------------------------------------------------------------------- */
const ExitPinModal: React.FC<{
  value: string;
  setValue: (v: string) => void;
  error: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ value, setValue, error, onCancel, onConfirm }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 bg-servirest-midnight/80 backdrop-blur-md z-[80] flex items-center justify-center p-6"
  >
    <motion.div
      initial={{ scale: 0.9 }} animate={{ scale: 1 }}
      className="bg-servirest-hueso rounded-sr-2xl p-8 max-w-sm w-full text-center"
    >
      <div className="w-16 h-16 rounded-full bg-servirest-midnight text-servirest-mostaza mx-auto flex items-center justify-center mb-5">
        <Lock size={24} />
      </div>
      <SrKicker>Modo kiosko</SrKicker>
      <h2 className="font-serif italic text-servirest-midnight text-2xl mt-2 mb-6">PIN del operador</h2>
      <input
        type="password"
        autoFocus
        maxLength={4}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
        className={`w-full h-14 text-center text-[24px] font-black tracking-[0.4em] rounded-sr-md border-2 bg-servirest-surface focus:outline-none ${
          error ? 'border-servirest-danger animate-shake' : 'border-[rgba(42,40,38,0.12)] focus:border-servirest-terracota'
        }`}
        placeholder="••••"
      />
      <div className="flex gap-3 mt-6">
        <button
          onClick={onCancel}
          className="flex-1 h-12 rounded-full border border-[rgba(42,40,38,0.15)] text-[11px] font-black uppercase tracking-[0.15em] text-[rgba(42,40,38,0.6)]"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 h-12 rounded-full bg-servirest-terracota text-servirest-hueso text-[11px] font-black uppercase tracking-[0.15em]"
        >
          Salir
        </button>
      </div>
    </motion.div>
  </motion.div>
);

export default KioskScreen;
