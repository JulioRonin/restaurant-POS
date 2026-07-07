/**
 * Storefront público — cliente ordena a domicilio o para recoger sin
 * pasar por el login del negocio. Se accede por `#/o/{businessId}`.
 *
 * Sprint A (este entregable):
 *   - Fetch de business + menu vía anon Supabase key (RLS pública lectura).
 *   - Cart local, checkout con modo delivery/pickup.
 *   - Auth obligatorio antes de confirmar: email + password (Supabase Auth).
 *   - Validación de zona en modo delivery contra digitalDeliveryZones.
 *   - Pago: efectivo al entregar / Stripe link.
 *   - Order se inserta en `orders` con customer_id = auth.uid().
 *
 * Sprint B (siguiente):
 *   - Historial del cliente ("mis pedidos").
 *   - Programa de referidos ("invita 3, tu 4ta orden trae rebanada gratis").
 *   - Notificaciones WhatsApp/SMS.
 *   - OTP en vez de password.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, Plus, Minus, Trash2, X, ChefHat, CheckCircle2,
  Search, Utensils, Truck, Store, PackageCheck, RefreshCw, Check,
  MapPin, Mail, Lock, LogIn, User as UserIcon, ArrowLeft, Phone, AlertCircle,
} from 'lucide-react';
import { getSupabase } from '../services/auth';
import { MenuItem, MenuItemVariant, OrderStatus, OrderSource, PaymentStatus, PaymentMethod } from '../types';
import { SrKicker, SrMono, SrChip, SrLabel, SrInput } from '../components/ui/servirest';

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

type PayMethod = 'stripe_qr' | 'cash';
type Mode = 'delivery' | 'pickup';
type View = 'menu' | 'checkout' | 'auth' | 'success';

const lineTotal = (l: CartLine) => (l.basePrice + l.variants.reduce((s, v) => s + (v.price || 0), 0)) * l.quantity;

// ─────────────────────────────────────────────────────────────────────────
// Entry — lee businessId del hash y renderiza el Storefront o error
// ─────────────────────────────────────────────────────────────────────────
export const StorefrontRoute: React.FC = () => {
  const [businessId, setBusinessId] = useState<string | null>(null);

  useEffect(() => {
    const parse = () => {
      const raw = window.location.hash.replace(/^#\/o\//, '').split(/[?/]/)[0];
      setBusinessId(raw || null);
    };
    parse();
    window.addEventListener('hashchange', parse);
    return () => window.removeEventListener('hashchange', parse);
  }, []);

  if (!businessId) return <BadUrlScreen />;
  return <Storefront businessId={businessId} />;
};

// ─────────────────────────────────────────────────────────────────────────
// Storefront principal
// ─────────────────────────────────────────────────────────────────────────
const Storefront: React.FC<{ businessId: string }> = ({ businessId }) => {
  const [business, setBusiness] = useState<any | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [view, setView] = useState<View>('menu');
  const [mode, setMode] = useState<Mode>('delivery');
  const [category, setCategory] = useState<string>('__all__');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [variantModal, setVariantModal] = useState<MenuItem | null>(null);
  const [selVariants, setSelVariants] = useState<MenuItemVariant[]>([]);
  const [selNotes, setSelNotes] = useState('');

  // Checkout form
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [orderNotes, setOrderNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);
  const [confirmedOrderNum, setConfirmedOrderNum] = useState<string>('----');

  // Auth state
  const [session, setSession] = useState<any | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // ── Fetch business + menu ────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const supabase = getSupabase();
      if (!supabase) {
        setFetchError('Supabase no configurado. Ver docs de despliegue.');
        setLoading(false);
        return;
      }
      try {
        // Fetch business — requiere RLS público de lectura básica (ver
        // MIGRATION_DIGITAL_CHANNEL.sql, sección Storefront público).
        const { data: bData, error: bErr } = await supabase
          .from('businesses')
          .select('id, name, settings')
          .eq('id', businessId)
          .single();
        if (bErr) throw bErr;

        const { data: mData, error: mErr } = await supabase
          .from('menu_items')
          .select('*')
          .eq('business_id', businessId)
          .eq('publish_online', true)
          .eq('status', 'ACTIVE');
        if (mErr) throw mErr;

        if (!alive) return;
        setBusiness(bData);
        setItems((mData || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          price: Number(row.price),
          category: row.category || 'General',
          image: row.image || `https://picsum.photos/seed/${row.id}/400/300`,
          inventoryLevel: row.inventory_level ?? 4,
          description: row.description,
          status: row.status || 'ACTIVE',
          gramaje: row.gramaje,
          businessId: row.business_id,
          variants: row.variants || [],
          variantMode: row.variant_mode || 'single',
          publishOnline: row.publish_online,
          onlinePrice: row.online_price ? Number(row.online_price) : undefined,
          onlineAvailable: row.online_available !== false,
        })));
      } catch (err: any) {
        console.error('[Storefront] fetch error:', err);
        if (alive) setFetchError(err.message || 'No pudimos cargar el menú.');
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [businessId]);

  // ── Session tracking (Supabase Auth) ─────────────────────────────
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const settings = business?.settings || {};
  const availableItems = items.filter((m) => m.onlineAvailable !== false);
  const zonesList = (settings.digitalDeliveryZones || '').split(',').map((z: string) => z.trim().toLowerCase()).filter(Boolean);

  const categories = useMemo(() => {
    const set = new Set(availableItems.map((m) => m.category));
    return ['__all__', ...Array.from(set)];
  }, [availableItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return availableItems.filter((m) => {
      const cat = category === '__all__' || m.category === category;
      const s = !q || m.name.toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q);
      return cat && s;
    });
  }, [availableItems, category, search]);

  const cartCount = cart.reduce((n, l) => n + l.quantity, 0);
  const subtotal = cart.reduce((n, l) => n + lineTotal(l), 0);
  const deliveryFee = mode === 'delivery' ? (settings.digitalDeliveryFee ?? 0) : 0;
  const iva = subtotal * 0.16;
  const total = subtotal + deliveryFee;
  const meetsMinimum = subtotal >= (settings.digitalMinOrder ?? 0);

  // ── Cart handlers ────────────────────────────────────────────────
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
      const key = `${item.id}|${variants.map((v) => v.name).sort().join(',')}|${notes.trim()}`;
      const existing = prev.find((l) => `${l.itemId}|${l.variants.map((v) => v.name).sort().join(',')}|${l.notes.trim()}` === key);
      if (existing) return prev.map((l) => (l.lineId === existing.lineId ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, {
        lineId: crypto.randomUUID(),
        itemId: item.id,
        name: item.name,
        basePrice: item.onlinePrice ?? item.price,
        image: item.image,
        quantity: 1,
        variants,
        notes,
      }];
    });
    setVariantModal(null);
  };

  const decLine = (id: string) => setCart((p) => p.flatMap((l) => (l.lineId === id ? (l.quantity > 1 ? [{ ...l, quantity: l.quantity - 1 }] : []) : [l])));
  const incLine = (id: string) => setCart((p) => p.map((l) => (l.lineId === id ? { ...l, quantity: l.quantity + 1 } : l)));
  const removeLine = (id: string) => setCart((p) => p.filter((l) => l.lineId !== id));

  // ── Auth ─────────────────────────────────────────────────────────
  const handleAuth = async () => {
    setAuthError(null);
    setAuthLoading(true);
    const supabase = getSupabase();
    if (!supabase) { setAuthLoading(false); return; }
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: { data: { full_name: customerName || 'Cliente', role: 'customer' } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      }
      // Después de auth OK, regresa al checkout (session llega por el listener)
      setView('checkout');
    } catch (err: any) {
      setAuthError(err.message || 'No pudimos autenticarte.');
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Zone check ───────────────────────────────────────────────────
  const isAddressInZone = (addr: string): boolean => {
    if (!zonesList.length) return true; // Sin zonas configuradas, acepta todo
    const a = addr.toLowerCase();
    return zonesList.some((z: string) => a.includes(z));
  };

  // ── Checkout submit ──────────────────────────────────────────────
  const handleConfirmOrder = async () => {
    if (!session) { setView('auth'); return; }
    if (mode === 'delivery' && !deliveryAddress.trim()) {
      alert('Necesitamos tu dirección para el envío.');
      return;
    }
    if (mode === 'delivery' && !isAddressInZone(deliveryAddress)) {
      alert(`Esa dirección no está en las zonas cubiertas. Cubrimos: ${settings.digitalDeliveryZones}`);
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      alert('Necesitamos tu nombre y teléfono para contactarte.');
      return;
    }

    setProcessing(true);
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase no configurado');

      const orderId = crypto.randomUUID();
      const paymentMap: Record<PayMethod, PaymentMethod> = {
        stripe_qr: PaymentMethod.CARD,
        cash: PaymentMethod.CASH,
      };

      const orderRecord = {
        id: orderId,
        business_id: businessId,
        table_id: 'STOREFRONT',
        items: cart.map((l) => ({
          id: l.itemId,
          name: l.name,
          price: l.basePrice,
          quantity: l.quantity,
          notes: l.notes,
          selectedVariants: l.variants,
        })),
        status: 'PENDING',
        total,
        waiter_name: 'Storefront público',
        payment_method: paymentMap[payMethod],
        payment_status: payMethod === 'cash' ? 'PENDING' : 'PAID',
        source: mode === 'delivery' ? 'TO_GO' : 'PICKUP',
        // Metadata del cliente en columna JSONB customer_metadata de orders
        // (ver MIGRATION_DIGITAL_CHANNEL.sql). NO usamos 'settings' porque
        // esa columna no existe en la tabla orders.
        customer_metadata: {
          customerId: session.user.id,
          customerName,
          customerPhone,
          customerEmail: session.user.email,
          deliveryAddress: mode === 'delivery' ? deliveryAddress : null,
          orderNotes,
          mode,
        },
        timestamp: new Date().toISOString(),
      };

      if (payMethod === 'stripe_qr') {
        // Registra la orden PENDING primero, redirige a Stripe. El success
        // regresa a #/o/{id}?paid=<orderId> — el useEffect al inicio detecta.
        await supabase.from('orders').insert(orderRecord);
        const res = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId,
            amount: Math.round(total * 100) / 100,
            type: 'DIGITAL_ORDER',
            planName: `Pedido — ${business?.name || 'Restaurante'}`,
            successUrl: `${window.location.origin}${window.location.pathname}#/o/${businessId}?paid=${orderId}`,
            cancelUrl: `${window.location.origin}${window.location.pathname}#/o/${businessId}?cancel=${orderId}`,
            orderId,
          }),
        });
        const { url, error } = await res.json();
        if (error || !url) throw new Error(error || 'No pudimos generar el link de pago');
        window.location.href = url;
        return;
      }

      // Efectivo: la orden entra directo a Cocina como PENDING de cobro
      await supabase.from('orders').insert(orderRecord);
      setConfirmedOrderId(orderId);
      setConfirmedOrderNum(orderId.slice(0, 4).toUpperCase());
      setView('success');
      setCart([]);
    } catch (err: any) {
      console.error('[Storefront] order error:', err);
      alert('No pudimos procesar tu pedido. ' + (err.message || ''));
    } finally {
      setProcessing(false);
    }
  };

  // Detecta retorno de Stripe con ?paid=
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const paid = params.get('paid');
    if (paid) {
      setConfirmedOrderId(paid);
      setConfirmedOrderNum(paid.slice(0, 4).toUpperCase());
      setView('success');
      setCart([]);
    }
  }, []);

  // ── Loading / error ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen w-screen bg-servirest-hueso flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={40} className="mx-auto text-servirest-terracota animate-spin" />
          <p className="text-[13px] mt-4 text-[rgba(42,40,38,0.6)]">Cargando el menú…</p>
        </div>
      </div>
    );
  }

  if (fetchError || !business) {
    return <BadUrlScreen error={fetchError} />;
  }

  // ── VIEWS ────────────────────────────────────────────────────────
  if (view === 'success') return <SuccessView orderNum={confirmedOrderNum} orderId={confirmedOrderId} mode={mode} onOrderMore={() => { setView('menu'); setConfirmedOrderId(null); }} onNewOrder={() => { setView('menu'); setCart([]); setConfirmedOrderId(null); }} />;

  if (view === 'auth') return <AuthView
    mode={authMode}
    setMode={setAuthMode}
    email={authEmail}
    setEmail={setAuthEmail}
    password={authPassword}
    setPassword={setAuthPassword}
    error={authError}
    loading={authLoading}
    onSubmit={handleAuth}
    onBack={() => setView('checkout')}
  />;

  if (view === 'checkout') return <CheckoutView
    business={business}
    settings={settings}
    session={session}
    mode={mode}
    setMode={setMode}
    cart={cart}
    subtotal={subtotal}
    iva={iva}
    deliveryFee={deliveryFee}
    total={total}
    payMethod={payMethod}
    setPayMethod={setPayMethod}
    customerName={customerName}
    setCustomerName={setCustomerName}
    customerPhone={customerPhone}
    setCustomerPhone={setCustomerPhone}
    deliveryAddress={deliveryAddress}
    setDeliveryAddress={setDeliveryAddress}
    orderNotes={orderNotes}
    setOrderNotes={setOrderNotes}
    processing={processing}
    onBack={() => setView('menu')}
    onConfirm={handleConfirmOrder}
    onLoginRequired={() => setView('auth')}
  />;

  // MENU view
  return (
    <div className="h-screen w-screen bg-servirest-hueso overflow-hidden flex flex-col antialiased">
      <header className="flex-shrink-0 px-6 md:px-12 pt-8 pb-6 border-b border-[rgba(42,40,38,0.08)] bg-servirest-surface">
        <div className="max-w-6xl mx-auto">
          <SrKicker>Ordena en línea · {business.name}</SrKicker>
          <h1 className="font-serif italic text-servirest-midnight text-4xl md:text-6xl leading-none mt-3 tracking-[-0.02em]">
            {settings.digitalWelcome || `Bienvenido a ${business.name}`}
          </h1>
          <div className="flex items-center gap-3 mt-5 flex-wrap">
            <button
              onClick={() => setMode('delivery')}
              className={`px-5 h-11 rounded-full text-[12px] font-black uppercase tracking-[0.15em] flex items-center gap-2 transition-all ${
                mode === 'delivery' ? 'bg-servirest-terracota text-servirest-hueso shadow-sr-glow' : 'bg-servirest-hueso text-[rgba(42,40,38,0.6)] border border-[rgba(42,40,38,0.12)]'
              }`}
            >
              <Truck size={13} /> Enviar a domicilio
            </button>
            <button
              onClick={() => setMode('pickup')}
              className={`px-5 h-11 rounded-full text-[12px] font-black uppercase tracking-[0.15em] flex items-center gap-2 transition-all ${
                mode === 'pickup' ? 'bg-servirest-terracota text-servirest-hueso shadow-sr-glow' : 'bg-servirest-hueso text-[rgba(42,40,38,0.6)] border border-[rgba(42,40,38,0.12)]'
              }`}
            >
              <Store size={13} /> Recoger en local
            </button>
            {mode === 'delivery' && deliveryFee > 0 && (
              <SrChip tone="mostaza" size="sm">Envío ${deliveryFee}</SrChip>
            )}
            {(settings.digitalMinOrder ?? 0) > 0 && (
              <SrChip tone="neutral" size="sm">Mínimo ${settings.digitalMinOrder}</SrChip>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-8 flex items-center gap-3 flex-wrap">
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

      <main className="flex-1 overflow-y-auto px-6 md:px-12 py-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 rounded-full bg-servirest-hueso-sunken flex items-center justify-center mb-6">
              <ChefHat size={40} className="text-servirest-terracota" />
            </div>
            <h2 className="font-serif italic text-servirest-midnight text-3xl mb-2">Menú en preparación</h2>
            <p className="text-[14px] text-[rgba(42,40,38,0.6)] max-w-md">Este negocio aún no publica platillos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto pb-32">
            {filtered.map((item, idx) => (
              <ProductCard key={item.id} item={item} idx={idx} onOpen={() => openProduct(item)} />
            ))}
          </div>
        )}
      </main>

      <AnimatePresence>
        {cartCount > 0 && !showCart && (
          <motion.button
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 24 }}
            onClick={() => setShowCart(true)}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-6 py-4 rounded-full bg-servirest-terracota text-servirest-hueso shadow-2xl shadow-servirest-terracota/40 hover:scale-105 transition-transform"
          >
            <div className="relative">
              <ShoppingCart size={22} />
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-servirest-mostaza text-servirest-midnight text-[10px] font-black flex items-center justify-center">{cartCount}</span>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCart(false)} className="fixed inset-0 bg-servirest-midnight/60 backdrop-blur-sm z-40" />
            <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 28 }} className="fixed top-0 right-0 h-full w-full max-w-md bg-servirest-hueso z-50 flex flex-col shadow-2xl">
              <header className="flex items-center justify-between p-6 border-b border-[rgba(42,40,38,0.08)]">
                <div>
                  <SrKicker>Tu orden</SrKicker>
                  <h2 className="font-serif italic text-servirest-midnight text-2xl mt-1">{cartCount} platillos</h2>
                </div>
                <button onClick={() => setShowCart(false)} className="w-11 h-11 rounded-full bg-servirest-hueso-sunken/60 flex items-center justify-center"><X size={20} /></button>
              </header>

              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {cart.map((line) => (
                  <div key={line.lineId} className="p-3 rounded-sr-md bg-servirest-surface border border-[rgba(42,40,38,0.08)]">
                    <div className="flex items-start gap-3">
                      <img src={line.image} alt={line.name} className="w-14 h-14 rounded-sr-sm object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-serif italic text-servirest-midnight text-[14px] leading-tight">{line.name}</div>
                        {line.variants.length > 0 && <div className="text-[10px] text-[rgba(42,40,38,0.55)] mt-1">{line.variants.map((v) => v.name).join(' · ')}</div>}
                        <SrMono className="text-[12px] text-servirest-terracota mt-1">${lineTotal(line).toFixed(2)}</SrMono>
                      </div>
                      <button onClick={() => removeLine(line.lineId)} className="w-8 h-8 rounded-full text-servirest-danger flex items-center justify-center"><Trash2 size={13} /></button>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button onClick={() => decLine(line.lineId)} className="w-9 h-9 rounded-full bg-servirest-hueso-sunken flex items-center justify-center"><Minus size={14} /></button>
                      <span className="w-10 text-center font-black text-[16px]">{line.quantity}</span>
                      <button onClick={() => incLine(line.lineId)} className="w-9 h-9 rounded-full bg-servirest-terracota text-servirest-hueso flex items-center justify-center"><Plus size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>

              <footer className="border-t border-[rgba(42,40,38,0.08)] p-6 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[13px] text-[rgba(42,40,38,0.6)]"><span>Subtotal</span><SrMono>${subtotal.toFixed(2)}</SrMono></div>
                  {deliveryFee > 0 && <div className="flex justify-between text-[13px] text-[rgba(42,40,38,0.6)]"><span>Envío</span><SrMono>${deliveryFee.toFixed(2)}</SrMono></div>}
                  <div className="border-t border-dashed border-[rgba(42,40,38,0.15)] pt-2 flex justify-between items-baseline">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-[rgba(42,40,38,0.5)]">Total</span>
                    <SrMono className="text-[32px] font-extrabold text-servirest-midnight">${total.toFixed(2)}</SrMono>
                  </div>
                </div>
                {!meetsMinimum && (
                  <div className="p-3 rounded-sr-sm bg-mostaza-500/10 border border-servirest-mostaza/30 text-[12px]">
                    Faltan <SrMono className="font-bold">${((settings.digitalMinOrder ?? 0) - subtotal).toFixed(2)}</SrMono> para el mínimo.
                  </div>
                )}
                <button
                  disabled={!meetsMinimum}
                  onClick={() => { setShowCart(false); setView('checkout'); }}
                  className="w-full h-14 rounded-full bg-servirest-terracota text-servirest-hueso font-black italic uppercase tracking-[0.2em] text-[13px] shadow-sr-glow hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-40"
                >
                  Continuar — ${total.toFixed(2)}
                </button>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Variant modal (reuso mismo look que Kiosk) */}
      <AnimatePresence>
        {variantModal && (
          <VariantModal
            item={variantModal}
            selVariants={selVariants}
            setSelVariants={setSelVariants}
            selNotes={selNotes}
            setSelNotes={setSelNotes}
            onClose={() => setVariantModal(null)}
            onAdd={() => addLine(variantModal, selVariants, selNotes)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// ProductCard
// ─────────────────────────────────────────────────────────────────────────
const ProductCard: React.FC<{ item: MenuItem; idx: number; onOpen: () => void }> = ({ item, idx, onOpen }) => {
  const price = item.onlinePrice ?? item.price;
  const hasVariants = !!(item.variants && item.variants.length > 0);
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.35 }}
      onClick={onOpen}
      className="text-left rounded-sr-lg bg-servirest-surface border border-[rgba(42,40,38,0.08)] overflow-hidden shadow-sr-card hover:shadow-sr-lift transition-shadow active:scale-[0.98] group"
    >
      <div className="aspect-[4/3] bg-servirest-hueso-sunken relative overflow-hidden">
        <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.id}/400/300`; }} />
        <div className="absolute top-3 right-3"><SrChip tone="terracota" size="sm">${price.toFixed(2)}</SrChip></div>
        {hasVariants && <div className="absolute top-3 left-3"><SrChip tone="mostaza" size="xs">Opciones</SrChip></div>}
        <div className="absolute bottom-3 right-3 w-14 h-14 rounded-full bg-servirest-terracota text-servirest-hueso flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Plus size={22} strokeWidth={2.5} /></div>
      </div>
      <div className="p-4">
        <div className="font-serif italic text-servirest-midnight text-[17px] leading-tight line-clamp-1">{item.name}</div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[rgba(42,40,38,0.5)] mt-1.5">{item.category}</div>
      </div>
    </motion.button>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// VariantModal
// ─────────────────────────────────────────────────────────────────────────
const VariantModal: React.FC<any> = ({ item, selVariants, setSelVariants, selNotes, setSelNotes, onClose, onAdd }) => {
  const isSingle = (item.variantMode ?? 'single') === 'single';
  const priceBase = item.onlinePrice ?? item.price;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-servirest-midnight/80 backdrop-blur-md z-[55] flex items-center justify-center p-6">
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-servirest-hueso rounded-sr-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="aspect-[16/9] bg-servirest-hueso-sunken relative overflow-hidden">
          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-servirest-midnight/80 text-servirest-hueso flex items-center justify-center"><X size={18} /></button>
        </div>
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <SrKicker>{item.category}</SrKicker>
              <h2 className="font-serif italic text-servirest-midnight text-3xl mt-2 mb-1 leading-tight">{item.name}</h2>
            </div>
            <div className="text-right flex-shrink-0">
              <SrMono className="text-[22px] font-extrabold text-servirest-terracota">${priceBase.toFixed(2)}</SrMono>
              {item.gramaje && <div className="text-[10px] text-[rgba(42,40,38,0.5)] mt-0.5">{item.gramaje}</div>}
            </div>
          </div>
          {item.description ? (
            <p className="text-[14px] text-[rgba(42,40,38,0.65)] mt-3 leading-relaxed">{item.description}</p>
          ) : (
            <p className="text-[13px] text-[rgba(42,40,38,0.4)] mt-3 italic">Sin descripción todavía.</p>
          )}
          {item.variants && item.variants.length > 0 && (
          <div className="mt-6">
            <SrLabel className="block mb-1">{isSingle ? 'Elige UNA opción' : 'Elige tus variantes'}</SrLabel>
            <p className="text-[11px] text-[rgba(42,40,38,0.5)] mb-3">{isSingle ? 'Solo una variante por platillo.' : 'Puedes combinar varias.'}</p>
            <div className="space-y-2">
              {item.variants?.map((v: MenuItemVariant, i: number) => {
                const on = selVariants.some((sv: any) => sv.name === v.name);
                return (
                  <button key={i} type="button" onClick={() => {
                    if (isSingle) setSelVariants(on ? [] : [v]);
                    else setSelVariants((p: any) => (on ? p.filter((x: any) => x.name !== v.name) : [...p, v]));
                  }} className={`w-full flex justify-between items-center p-4 rounded-sr-md border-2 transition-colors ${
                    on ? 'border-servirest-terracota bg-servirest-terracota/5' : 'border-[rgba(42,40,38,0.1)] bg-servirest-surface'
                  }`}>
                    <span className="flex items-center gap-3">
                      {isSingle ? (
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${on ? 'border-servirest-terracota' : 'border-[rgba(42,40,38,0.2)]'}`}>
                          {on && <span className="w-3 h-3 rounded-full bg-servirest-terracota" />}
                        </span>
                      ) : (
                        <span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${on ? 'border-servirest-terracota bg-servirest-terracota' : 'border-[rgba(42,40,38,0.2)]'}`}>
                          {on && <Check size={13} className="text-servirest-hueso" />}
                        </span>
                      )}
                      <span className="font-serif italic text-[16px] text-servirest-midnight">{v.name}</span>
                    </span>
                    <SrMono className={`text-[13px] font-extrabold ${on ? 'text-servirest-terracota' : 'text-[rgba(42,40,38,0.5)]'}`}>{v.price ? `+$${v.price.toFixed(2)}` : 'Incluido'}</SrMono>
                  </button>
                );
              })}
            </div>
          </div>
          )}
          <div className="mt-5">
            <SrLabel className="block mb-2">Notas especiales (opcional)</SrLabel>
            <textarea value={selNotes} onChange={(e) => setSelNotes(e.target.value.slice(0, 120))} placeholder="Ej. sin cebolla…" rows={2} className="w-full px-4 py-3 rounded-sr-md bg-servirest-surface border border-[rgba(42,40,38,0.1)] text-[13px] resize-none focus:outline-none focus:border-servirest-terracota" />
          </div>
          <button onClick={onAdd} className="w-full h-14 mt-6 rounded-full bg-servirest-terracota text-servirest-hueso font-black italic uppercase tracking-[0.2em] text-[13px] shadow-sr-glow hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
            <Plus size={18} strokeWidth={2.5} />
            Agregar — ${(priceBase + selVariants.reduce((s: number, v: any) => s + (v.price || 0), 0)).toFixed(2)}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// CheckoutView
// ─────────────────────────────────────────────────────────────────────────
const CheckoutView: React.FC<any> = ({
  business, settings, session, mode, cart, subtotal, iva, deliveryFee, total,
  payMethod, setPayMethod, customerName, setCustomerName, customerPhone, setCustomerPhone,
  deliveryAddress, setDeliveryAddress, orderNotes, setOrderNotes, processing,
  onBack, onConfirm, onLoginRequired,
}) => {
  const availableMethods: PayMethod[] = ['cash', 'stripe_qr']; // Terminal en local es solo kiosko
  return (
    <div className="h-screen w-screen bg-servirest-hueso overflow-y-auto antialiased">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <button onClick={onBack} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[rgba(42,40,38,0.5)] mb-6">
          <ArrowLeft size={14} /> Seguir viendo el menú
        </button>

        <SrKicker>Confirmar pedido · {business.name}</SrKicker>
        <h1 className="font-serif italic text-servirest-midnight text-4xl md:text-5xl leading-none mt-3 mb-8">
          Últimos detalles
        </h1>

        {/* Auth chip */}
        {!session ? (
          <div className="p-5 rounded-sr-md bg-mostaza-500/10 border border-servirest-mostaza/40 mb-6 flex items-center gap-4 flex-wrap">
            <AlertCircle size={22} className="text-servirest-mostaza flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-serif italic text-servirest-midnight text-[16px]">Inicia sesión para confirmar</div>
              <p className="text-[12px] text-[rgba(42,40,38,0.6)] mt-1">
                Necesitamos guardar tu pedido asociado a tu cuenta.
              </p>
            </div>
            <button onClick={onLoginRequired} className="px-5 h-10 rounded-full bg-servirest-terracota text-servirest-hueso text-[11px] font-black uppercase tracking-[0.15em]">
              <LogIn size={13} className="inline mr-2" /> Iniciar sesión
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-sr-md bg-servirest-success/10 border border-servirest-success/30 mb-6 flex items-center gap-3">
            <UserIcon size={18} className="text-servirest-success" />
            <div className="text-[13px] text-servirest-midnight">Ordenando como <span className="font-bold">{session.user.email}</span></div>
          </div>
        )}

        {/* Datos del cliente */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <SrLabel className="block mb-2">Nombre</SrLabel>
            <SrInput value={customerName} onChange={(e: any) => setCustomerName(e.target.value)} placeholder="Cómo te llamas" />
          </div>
          <div>
            <SrLabel className="block mb-2">Teléfono</SrLabel>
            <SrInput value={customerPhone} onChange={(e: any) => setCustomerPhone(e.target.value)} placeholder="10 dígitos" />
          </div>
        </div>

        {mode === 'delivery' && (
          <div className="mb-6">
            <SrLabel className="block mb-2"><MapPin size={12} className="inline mr-1" /> Dirección de entrega</SrLabel>
            <textarea
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Calle, número, colonia, referencias…"
              rows={3}
              className="w-full px-4 py-3 rounded-sr-md bg-servirest-surface border border-[rgba(42,40,38,0.1)] text-[13px] resize-none focus:outline-none focus:border-servirest-terracota"
            />
            {settings.digitalDeliveryZones && (
              <p className="text-[11px] text-[rgba(42,40,38,0.5)] mt-2">
                Zonas cubiertas: <span className="italic">{settings.digitalDeliveryZones}</span>
              </p>
            )}
          </div>
        )}

        <div className="mb-6">
          <SrLabel className="block mb-2">Notas para el negocio (opcional)</SrLabel>
          <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value.slice(0, 200))} placeholder="Instrucciones especiales…" rows={2} className="w-full px-4 py-3 rounded-sr-md bg-servirest-surface border border-[rgba(42,40,38,0.1)] text-[13px] resize-none focus:outline-none focus:border-servirest-terracota" />
        </div>

        {/* Método de pago */}
        <div className="mb-6">
          <SrLabel className="block mb-3">Cómo pagas</SrLabel>
          <div className="space-y-2">
            <PayOption method="cash" active={payMethod === 'cash'} onClick={() => setPayMethod('cash')} label="Efectivo al recibir/recoger" desc="Pagas cuando te llegue o cuando recojas." icon={ChefHat} />
            <PayOption method="stripe_qr" active={payMethod === 'stripe_qr'} onClick={() => setPayMethod('stripe_qr')} label="Pagar ahora con Stripe" desc="Tarjeta, Apple Pay o Link. Cobramos ya." icon={Lock} />
          </div>
        </div>

        {/* Desglose */}
        <div className="p-5 rounded-sr-md bg-servirest-midnight text-servirest-hueso mb-6">
          <div className="flex justify-between text-[13px] opacity-70"><span>Subtotal</span><SrMono>${subtotal.toFixed(2)}</SrMono></div>
          <div className="flex justify-between text-[11px] opacity-50"><span>IVA (16% incluido)</span><SrMono>${iva.toFixed(2)}</SrMono></div>
          {deliveryFee > 0 && <div className="flex justify-between text-[13px] opacity-70"><span>Envío</span><SrMono>${deliveryFee.toFixed(2)}</SrMono></div>}
          <div className="border-t border-servirest-hueso/20 mt-3 pt-3 flex justify-between items-baseline">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Total</span>
            <SrMono className="text-[32px] font-extrabold text-servirest-mostaza">${total.toFixed(2)}</SrMono>
          </div>
        </div>

        <button
          disabled={!session || processing || cart.length === 0}
          onClick={onConfirm}
          className="w-full h-16 rounded-full bg-servirest-terracota text-servirest-hueso font-black italic uppercase tracking-[0.2em] text-[13px] shadow-sr-glow hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed transition-transform flex items-center justify-center gap-2"
        >
          {processing ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={18} />}
          {processing ? 'Procesando…' : payMethod === 'stripe_qr' ? `Pagar $${total.toFixed(2)} con Stripe` : `Confirmar pedido — $${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
};

const PayOption: React.FC<any> = ({ active, onClick, label, desc, icon: Icon }) => (
  <button onClick={onClick} className={`w-full text-left rounded-sr-md border-2 p-4 flex items-center gap-4 transition-all ${active ? 'border-servirest-terracota bg-servirest-terracota/5' : 'border-[rgba(42,40,38,0.1)] bg-servirest-surface hover:border-servirest-terracota/40'}`}>
    <div className={`w-11 h-11 rounded-sr-md flex items-center justify-center ${active ? 'bg-servirest-terracota text-servirest-hueso' : 'bg-servirest-hueso-sunken text-servirest-midnight'}`}><Icon size={19} /></div>
    <div className="flex-1 min-w-0">
      <div className="font-serif italic text-servirest-midnight text-[15px]">{label}</div>
      <p className="text-[11px] text-[rgba(42,40,38,0.55)]">{desc}</p>
    </div>
    {active && <CheckCircle2 size={20} className="text-servirest-terracota" />}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────
// AuthView (login / signup)
// ─────────────────────────────────────────────────────────────────────────
const AuthView: React.FC<any> = ({ mode, setMode, email, setEmail, password, setPassword, error, loading, onSubmit, onBack }) => (
  <div className="h-screen w-screen bg-servirest-midnight flex items-center justify-center px-6 antialiased">
    <div className="max-w-md w-full">
      <button onClick={onBack} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-servirest-hueso/50 mb-6">
        <ArrowLeft size={14} /> Volver
      </button>
      <SrKicker className="!text-servirest-mostaza">Cliente</SrKicker>
      <h1 className="font-serif italic text-servirest-hueso text-5xl leading-none mt-3 mb-8">
        {mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}
      </h1>

      <div className="space-y-4">
        <div>
          <SrLabel className="!text-servirest-hueso/60 block mb-2"><Mail size={12} className="inline mr-1" /> Correo</SrLabel>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" className="w-full h-12 px-4 rounded-sr-md bg-servirest-hueso/5 border border-servirest-hueso/20 text-servirest-hueso focus:outline-none focus:border-servirest-mostaza" />
        </div>
        <div>
          <SrLabel className="!text-servirest-hueso/60 block mb-2"><Lock size={12} className="inline mr-1" /> Contraseña</SrLabel>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="•••••••" className="w-full h-12 px-4 rounded-sr-md bg-servirest-hueso/5 border border-servirest-hueso/20 text-servirest-hueso focus:outline-none focus:border-servirest-mostaza" />
        </div>

        {error && (
          <div className="p-3 rounded-sr-sm bg-servirest-danger/10 border border-servirest-danger/30 text-[12px] text-servirest-hueso">
            {error}
          </div>
        )}

        <button onClick={onSubmit} disabled={loading || !email || !password} className="w-full h-14 rounded-full bg-servirest-terracota text-servirest-hueso font-black italic uppercase tracking-[0.2em] text-[13px] shadow-sr-glow hover:scale-[1.02] disabled:opacity-40 flex items-center justify-center gap-2">
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <LogIn size={16} />}
          {loading ? 'Procesando…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </button>

        <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="w-full text-[11px] text-servirest-hueso/60 hover:text-servirest-mostaza font-medium">
          {mode === 'login' ? '¿No tienes cuenta? Créala en un tap.' : '¿Ya tienes cuenta? Inicia sesión.'}
        </button>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// SuccessView
// ─────────────────────────────────────────────────────────────────────────
const SuccessView: React.FC<any> = ({ orderNum, mode, onOrderMore, onNewOrder }) => (
  <div className="h-screen w-screen bg-servirest-midnight overflow-hidden flex flex-col items-center justify-center antialiased relative">
    <div className="max-w-2xl w-full px-8 text-center">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 18 }} className="w-28 h-28 rounded-full bg-servirest-terracota text-servirest-hueso mx-auto flex items-center justify-center shadow-sr-glow mb-6">
        <CheckCircle2 size={56} strokeWidth={2.5} />
      </motion.div>
      <SrKicker className="!text-servirest-mostaza">Pedido recibido</SrKicker>
      <h1 className="font-serif italic text-servirest-hueso text-6xl leading-none mt-3 mb-2">Orden #{orderNum}</h1>
      <p className="text-[15px] text-servirest-hueso/60 mb-10">
        Nuestro equipo ya la vio. Te contactaremos en minutos para {mode === 'delivery' ? 'confirmar la entrega' : 'avisarte que puedes venir a recoger'}.
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        <button onClick={onOrderMore} className="px-8 h-14 rounded-full bg-servirest-hueso text-servirest-midnight font-black italic uppercase tracking-[0.2em] text-[12px] hover:scale-105 transition-transform">
          Ordenar algo más
        </button>
        <button onClick={onNewOrder} className="px-8 h-14 rounded-full border-2 border-servirest-hueso/30 text-servirest-hueso font-black italic uppercase tracking-[0.2em] text-[12px] hover:border-servirest-mostaza/60">
          Nueva orden
        </button>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// BadUrlScreen
// ─────────────────────────────────────────────────────────────────────────
const BadUrlScreen: React.FC<{ error?: string | null }> = ({ error }) => (
  <div className="h-screen w-screen bg-servirest-hueso flex items-center justify-center px-6 antialiased">
    <div className="max-w-md text-center">
      <div className="w-24 h-24 rounded-full bg-servirest-danger/10 text-servirest-danger mx-auto flex items-center justify-center mb-6">
        <AlertCircle size={40} />
      </div>
      <SrKicker>Storefront</SrKicker>
      <h1 className="font-serif italic text-servirest-midnight text-4xl mt-3 mb-4 leading-tight">Enlace no válido</h1>
      <p className="text-[14px] text-[rgba(42,40,38,0.6)] leading-relaxed">
        {error || 'Este restaurante no existe o su canal digital no está activo. Confirma el link con el negocio.'}
      </p>
    </div>
  </div>
);

export default StorefrontRoute;
