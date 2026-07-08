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
  Banknote, CreditCard, Bell,
} from 'lucide-react';
import { getSupabase } from '../services/auth';
import { notify, canNotify, requestNotifyPermission, statusNotifyCopy } from '../services/notify';
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

type PayMethod = 'stripe_qr' | 'cash' | 'terminal';
type Mode = 'delivery' | 'pickup';
type View = 'menu' | 'checkout' | 'auth' | 'success';

const lineTotal = (l: CartLine) => (l.basePrice + l.variants.reduce((s, v) => s + (v.price || 0), 0)) * l.quantity;

// Distancia entre dos coordenadas (haversine) en km.
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

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

  // Checkout form — dirección estructurada para entregas precisas.
  const [addrStreet, setAddrStreet] = useState('');   // calle y número
  const [addrColonia, setAddrColonia] = useState('');
  const [addrCP, setAddrCP] = useState('');           // código postal (5 dígitos)
  const [addrRefs, setAddrRefs] = useState('');       // referencias para el repartidor
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [orderNotes, setOrderNotes] = useState('');
  // Geo-validación de la ubicación del cliente vs el radio del local.
  const [geoState, setGeoState] = useState<'idle' | 'checking' | 'inside' | 'outside' | 'error'>('idle');
  const [geoDistance, setGeoDistance] = useState<number | null>(null);
  const [clientCoords, setClientCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Dirección compuesta a partir de los campos estructurados — se usa para
  // el match de zonas por texto y para la metadata de la orden.
  const deliveryAddress = [
    addrStreet.trim(),
    addrColonia.trim(),
    addrCP.trim() ? `CP ${addrCP.trim()}` : '',
  ].filter(Boolean).join(', ') + (addrRefs.trim() ? ` (Ref: ${addrRefs.trim()})` : '');
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

        // La config del canal digital (digitalMode, welcome, zonas, logoUrl,
        // kioskPayMethods, etc.) vive en la tabla business_settings, NO en
        // businesses.settings. La leemos aparte y la fusionamos.
        let digitalConfig: any = {};
        const { data: sData } = await supabase
          .from('business_settings')
          .select('value')
          .eq('business_id', businessId)
          .eq('key', 'config')
          .maybeSingle();
        if (sData?.value && typeof sData.value === 'object') {
          digitalConfig = sData.value;
        }

        // location_id de la primera sucursal del negocio (orders.location_id
        // es NOT NULL en el esquema, así que lo necesitamos para el insert).
        let locationId: string | null = null;
        const { data: locData } = await supabase
          .from('locations')
          .select('id')
          .eq('business_id', businessId)
          .limit(1);
        if (locData && locData.length > 0) locationId = locData[0].id;

        const { data: mData, error: mErr } = await supabase
          .from('menu_items')
          .select('*')
          .eq('business_id', businessId)
          .eq('publish_online', true)
          .eq('status', 'ACTIVE');
        if (mErr) throw mErr;

        if (!alive) return;
        // Merge: businesses.settings (logo legacy) + business_settings.value
        // (config del canal digital). digitalConfig gana.
        setBusiness({ ...bData, locationId, settings: { ...(bData?.settings || {}), ...digitalConfig } });
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
  // Todos los productos abren el modal de detalle (foto grande +
  // descripción), igual que el kiosko. Las variantes se muestran solo si
  // el platillo las tiene.
  const openProduct = (item: MenuItem) => {
    setVariantModal(item);
    setSelVariants([]);
    setSelNotes('');
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

  // ── Zone check (texto, fallback) ─────────────────────────────────
  const isAddressInZone = (addr: string): boolean => {
    if (!zonesList.length) return true;
    const a = addr.toLowerCase();
    return zonesList.some((z: string) => a.includes(z));
  };

  // ── Geo check por radio (GPS del cliente vs local) ───────────────
  const hasGeoRadius = !!(settings.businessLat && settings.businessLng);
  const radiusKm = settings.digitalDeliveryRadiusKm ?? 2;

  // ── REGLA DURA: sin zona configurada NO hay delivery ─────────────
  // Si el negocio no capturó su ubicación GPS ni definió zonas de texto,
  // el modo delivery se DESHABILITA por completo — nadie (invitado o
  // registrado) puede ordenar un envío sin candado de ubicación.
  const deliveryEnabled = hasGeoRadius || zonesList.length > 0;

  useEffect(() => {
    if (!deliveryEnabled && mode === 'delivery') setMode('pickup');
  }, [deliveryEnabled, mode]);

  const validateGeoLocation = () => {
    setGeoState('checking');
    if (!navigator.geolocation) { setGeoState('error'); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const d = haversineKm(pos.coords.latitude, pos.coords.longitude, settings.businessLat, settings.businessLng);
        setGeoDistance(d);
        setClientCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState(d <= radiusKm ? 'inside' : 'outside');

        // Reverse-geocoding con Nominatim (OpenStreetMap, gratis, sin API
        // key): pre-llena calle, colonia y CP desde el GPS validado. El
        // cliente solo corrige el número y agrega referencias. Best-effort:
        // si falla, los campos quedan manuales.
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&accept-language=es`,
            { headers: { Accept: 'application/json' } }
          );
          if (res.ok) {
            const geo = await res.json();
            const a = geo.address || {};
            const street = [a.road, a.house_number].filter(Boolean).join(' ');
            const colonia = a.neighbourhood || a.suburb || a.quarter || a.village || '';
            const cp = a.postcode || '';
            setAddrStreet((prev) => prev || street);
            setAddrColonia((prev) => prev || colonia);
            setAddrCP((prev) => prev || cp);
          }
        } catch { /* geocoding best-effort */ }
      },
      () => setGeoState('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── Checkout submit ──────────────────────────────────────────────
  const handleConfirmOrder = async () => {
    // Guest permitido: no exigimos session. Si el cliente quiere cuenta,
    // usa el botón de login; si no, ordena como invitado.
    // Guard absoluto: delivery sin zona configurada NO existe.
    if (mode === 'delivery' && !deliveryEnabled) {
      alert('Este negocio aún no habilita envíos a domicilio. Elige "Recoger en local".');
      setMode('pickup');
      return;
    }
    if (mode === 'delivery' && (!addrStreet.trim() || !addrCP.trim())) {
      alert('Necesitamos tu calle con número y tu código postal para el envío.');
      return;
    }
    if (mode === 'delivery' && addrCP.trim() && !/^\d{5}$/.test(addrCP.trim())) {
      alert('El código postal debe ser de 5 dígitos.');
      return;
    }
    // ── ENFORCEMENT DURO del radio de entrega ─────────────────────
    // El botón de la UI ya bloquea, pero este es el guard real: si el
    // negocio tiene radio configurado, NADIE confirma un envío sin haber
    // validado su GPS dentro del radio. Sin excepciones.
    if (mode === 'delivery' && hasGeoRadius && geoState !== 'inside') {
      alert(
        geoState === 'outside'
          ? `Estás fuera de nuestra zona de entrega (cubrimos ${radiusKm} km del local). Prueba "Recoger en local".`
          : 'Valida tu ubicación con el botón "Validar mi ubicación" antes de confirmar el envío.'
      );
      return;
    }
    // Fallback por texto de zonas (solo cuando NO hay radio GPS configurado)
    if (mode === 'delivery' && !hasGeoRadius && !isAddressInZone(deliveryAddress)) {
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
        terminal: PaymentMethod.CARD,
      };

      // Número consecutivo diario (para "Orden #NNNN" y para que Cocina lo
      // ordene por llegada). Contamos las órdenes de hoy de este negocio.
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .gte('created_at', startOfDay.toISOString());
      const dailyNumber = (todayCount || 0);

      // ── ORDEN (sin columna items — los items van a order_items) ──────
      // Este shape replica lo que SyncService empuja desde el POS/kiosko,
      // así el módulo de Cocina del restaurante lo lee igual al hacer pull.
      const orderRecord: any = {
        id: orderId,
        business_id: businessId,
        location_id: business?.locationId || null, // orders.location_id es NOT NULL
        table_id: null, // pedido remoto, sin mesa física
        status: 'PENDING',
        total,
        daily_number: dailyNumber,
        waiter_name: 'Canal digital',
        payment_method: paymentMap[payMethod],
        payment_status: payMethod === 'stripe_qr' ? 'PAID' : 'PENDING', // efectivo/terminal se cobra al entregar
        source: mode === 'delivery' ? 'TO_GO' : 'PICKUP',
        is_kitchen_ready: false,
        is_bar_ready: false,
        customer_metadata: {
          customerId: session?.user?.id || null,
          isGuest: !session,
          customerName,
          customerPhone,
          customerEmail: session?.user?.email || null,
          deliveryAddress: mode === 'delivery' ? deliveryAddress : null,
          // Dirección estructurada — más precisa para el repartidor.
          addrStreet: mode === 'delivery' ? addrStreet.trim() : null,
          addrColonia: mode === 'delivery' ? addrColonia.trim() : null,
          addrCP: mode === 'delivery' ? addrCP.trim() : null,
          addrRefs: mode === 'delivery' ? addrRefs.trim() : null,
          // Coordenadas GPS validadas del cliente + distancia al local.
          // El repartidor puede abrirlas directo en Maps.
          clientLat: mode === 'delivery' ? clientCoords?.lat ?? null : null,
          clientLng: mode === 'delivery' ? clientCoords?.lng ?? null : null,
          distanceKm: mode === 'delivery' ? (geoDistance !== null ? Number(geoDistance.toFixed(2)) : null) : null,
          orderNotes,
          mode,
        },
        updated_at: new Date().toISOString(),
      };

      // ── ORDER_ITEMS (una fila por línea del carrito) ─────────────────
      const itemRows = cart.map((l) => {
        const variantNames = l.variants.map((v) => v.name).join(', ');
        const combinedNotes = [l.notes, variantNames && `Variantes: ${variantNames}`]
          .filter(Boolean).join(' | ');
        return {
          id: crypto.randomUUID(),
          order_id: orderId,
          menu_item_id: l.itemId,
          quantity: l.quantity,
          price_at_time: l.basePrice + l.variants.reduce((s, v) => s + (v.price || 0), 0),
          notes: combinedNotes,
          business_id: businessId,
          location_id: business?.locationId || null,
          updated_at: new Date().toISOString(),
        };
      });

      // Insertar orden + items. Si order_items falla (schema distinto),
      // la orden ya existe y Cocina la ve; los items se re-piden si es
      // necesario. No bloqueamos el flujo del cliente por eso.
      const { error: oErr } = await supabase.from('orders').insert(orderRecord);
      if (oErr) throw oErr;
      const { error: iErr } = await supabase.from('order_items').insert(itemRows);
      if (iErr) console.warn('[Storefront] order_items insert warn:', iErr.message);

      if (payMethod === 'stripe_qr') {
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

      // Efectivo: la orden ya está en Cocina como PENDING de cobro
      setConfirmedOrderId(orderId);
      setConfirmedOrderNum(String(dailyNumber + 1).padStart(4, '0'));
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
      <div className="h-[100dvh] w-full bg-servirest-hueso flex items-center justify-center">
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
    addrStreet={addrStreet} setAddrStreet={setAddrStreet}
    addrColonia={addrColonia} setAddrColonia={setAddrColonia}
    addrCP={addrCP} setAddrCP={setAddrCP}
    addrRefs={addrRefs} setAddrRefs={setAddrRefs}
    orderNotes={orderNotes}
    setOrderNotes={setOrderNotes}
    processing={processing}
    zonesList={zonesList}
    isAddressInZone={isAddressInZone}
    hasGeoRadius={hasGeoRadius}
    radiusKm={radiusKm}
    geoState={geoState}
    geoDistance={geoDistance}
    onValidateGeo={validateGeoLocation}
    onBack={() => setView('menu')}
    onConfirm={handleConfirmOrder}
    onLoginRequired={() => setView('auth')}
  />;

  // MENU view
  return (
    <div className="h-[100dvh] w-full max-w-full overflow-x-hidden bg-servirest-hueso flex flex-col antialiased">
      <header className="flex-shrink-0 px-4 sm:px-6 md:px-12 pt-[max(1.5rem,env(safe-area-inset-top))] pb-5 border-b border-[rgba(42,40,38,0.08)] bg-servirest-surface">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt={business.name} className="w-12 h-12 sm:w-16 sm:h-16 rounded-sr-md object-contain bg-servirest-hueso border border-[rgba(42,40,38,0.08)] p-1.5 flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-sr-md bg-servirest-midnight text-servirest-mostaza flex items-center justify-center font-serif italic text-2xl sm:text-3xl flex-shrink-0">{business.name?.[0] || 'R'}</div>
            )}
            <SrKicker className="!text-[9px] sm:!text-[11px]">Ordena en línea · {business.name}</SrKicker>
          </div>
          <h1 className="font-serif italic text-servirest-midnight text-3xl sm:text-4xl md:text-6xl leading-[1.05] mt-2 sm:mt-3 tracking-[-0.02em]">
            {settings.digitalWelcome || `Bienvenido a ${business.name}`}
          </h1>
          <div className="flex items-center gap-3 mt-5 flex-wrap">
            <button
              onClick={() => deliveryEnabled && setMode('delivery')}
              disabled={!deliveryEnabled}
              title={deliveryEnabled ? undefined : 'El negocio aún no configura su zona de entrega'}
              className={`px-5 h-11 rounded-full text-[12px] font-black uppercase tracking-[0.15em] flex items-center gap-2 transition-all ${
                !deliveryEnabled ? 'bg-servirest-hueso text-[rgba(42,40,38,0.3)] border border-[rgba(42,40,38,0.08)] cursor-not-allowed line-through'
                : mode === 'delivery' ? 'bg-servirest-terracota text-servirest-hueso shadow-sr-glow' : 'bg-servirest-hueso text-[rgba(42,40,38,0.6)] border border-[rgba(42,40,38,0.12)]'
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

        <div className="max-w-6xl mx-auto mt-5 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:max-w-md">
            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[rgba(42,40,38,0.4)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar platillo…"
              className="w-full h-12 sm:h-14 pl-14 pr-5 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.1)] text-[15px] font-medium focus:outline-none focus:border-servirest-terracota"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`flex-shrink-0 px-4 sm:px-5 h-12 sm:h-14 rounded-full text-[12px] sm:text-[13px] font-black uppercase tracking-[0.15em] transition-all ${
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

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 py-6 sm:py-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-24 h-24 rounded-full bg-servirest-hueso-sunken flex items-center justify-center mb-6">
              <ChefHat size={40} className="text-servirest-terracota" />
            </div>
            <h2 className="font-serif italic text-servirest-midnight text-3xl mb-2">Menú en preparación</h2>
            <p className="text-[14px] text-[rgba(42,40,38,0.6)] max-w-md">Este negocio aún no publica platillos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 max-w-6xl mx-auto pb-32">
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
            style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
            className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 sm:gap-4 px-5 sm:px-6 py-4 rounded-full bg-servirest-terracota text-servirest-hueso shadow-2xl shadow-servirest-terracota/40 hover:scale-105 transition-transform max-w-[calc(100vw-2rem)]"
          >
            <div className="relative flex-shrink-0">
              <ShoppingCart size={22} />
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-servirest-mostaza text-servirest-midnight text-[10px] font-black flex items-center justify-center">{cartCount}</span>
            </div>
            <span className="font-black italic uppercase tracking-[0.15em] text-[12px] sm:text-[13px] whitespace-nowrap">Ver mi orden</span>
            <SrMono className="text-[14px] font-extrabold flex-shrink-0">${total.toFixed(2)}</SrMono>
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
        {item.description && (
          <p className="text-[12px] text-[rgba(42,40,38,0.6)] mt-2 line-clamp-2 leading-relaxed">{item.description}</p>
        )}
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
  business, settings, session, mode, setMode, cart, subtotal, iva, deliveryFee, total,
  payMethod, setPayMethod, customerName, setCustomerName, customerPhone, setCustomerPhone,
  deliveryAddress, addrStreet, setAddrStreet, addrColonia, setAddrColonia,
  addrCP, setAddrCP, addrRefs, setAddrRefs, orderNotes, setOrderNotes, processing,
  zonesList, isAddressInZone, hasGeoRadius, radiusKm, geoState, geoDistance, onValidateGeo,
  onBack, onConfirm, onLoginRequired,
}) => {
  // ── Validación de entrega ────────────────────────────────────────
  // Si el negocio configuró radio por GPS, usamos eso (más confiable).
  // Si no, caemos al match de texto de zonas.
  const geoValidated = geoState === 'inside';
  const geoRejected = geoState === 'outside';

  // Dirección completa: calle+número y CP de 5 dígitos obligatorios.
  const addrComplete = addrStreet.trim().length > 3 && /^\d{5}$/.test(addrCP.trim());
  const inZoneText = !zonesList.length || (addrComplete && isAddressInZone(deliveryAddress));
  const zoneTextChecked = !hasGeoRadius && zonesList.length > 0 && addrComplete;

  // La dirección se desbloquea solo tras validar GPS (si hay radio config).
  const addressUnlocked = !hasGeoRadius || geoValidated;

  const deliveryOk = mode !== 'delivery' || (
    hasGeoRadius
      ? (geoValidated && addrComplete)
      : (addrComplete && inZoneText)
  );

  const contactOk = customerName.trim() && customerPhone.trim();
  const canConfirm = contactOk && deliveryOk && cart.length > 0 && !processing;

  return (
    <div className="h-[100dvh] w-full max-w-full overflow-x-hidden overflow-y-auto bg-servirest-hueso antialiased">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <button onClick={onBack} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-[rgba(42,40,38,0.5)] mb-6">
          <ArrowLeft size={14} /> Seguir viendo el menú
        </button>

        {/* Branding del restaurante */}
        <div className="flex items-center gap-3 mb-4">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt={business.name} className="w-12 h-12 rounded-sr-md object-contain bg-servirest-surface border border-[rgba(42,40,38,0.08)] p-1" />
          ) : (
            <div className="w-12 h-12 rounded-sr-md bg-servirest-midnight text-servirest-mostaza flex items-center justify-center font-serif italic text-xl">{business.name?.[0] || 'R'}</div>
          )}
          <div>
            <SrKicker>{business.name}</SrKicker>
            <div className="text-[10px] text-[rgba(42,40,38,0.4)]">{mode === 'delivery' ? 'Envío a domicilio' : 'Recoger en local'}</div>
          </div>
        </div>
        <h1 className="font-serif italic text-servirest-midnight text-3xl sm:text-4xl md:text-5xl leading-tight mt-3 mb-6 sm:mb-8">
          Últimos detalles
        </h1>

        {/* Cuenta: invitado por default, login opcional con beneficios */}
        {session ? (
          <div className="p-4 rounded-sr-md bg-servirest-success/10 border border-servirest-success/30 mb-6 flex items-center gap-3">
            <UserIcon size={18} className="text-servirest-success" />
            <div className="text-[13px] text-servirest-midnight">Ordenando como <span className="font-bold">{session.user.email}</span></div>
          </div>
        ) : (
          <div className="mb-6 rounded-sr-md border-2 border-servirest-mostaza/40 bg-mostaza-500/10 overflow-hidden">
            <div className="p-4 flex items-center gap-3 flex-wrap">
              <span className="px-3 h-7 rounded-full bg-servirest-mostaza text-servirest-midnight text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-1.5">
                <UserIcon size={11} /> Invitado
              </span>
              <div className="flex-1 min-w-0 text-[13px] font-serif italic text-servirest-midnight">
                Estás ordenando sin cuenta.
              </div>
              <button onClick={onLoginRequired} className="px-5 h-10 rounded-full bg-servirest-terracota text-servirest-hueso text-[10px] font-black uppercase tracking-[0.15em] hover:scale-[1.02] transition-transform">
                <LogIn size={12} className="inline mr-1.5" /> Crear cuenta gratis
              </button>
            </div>
            <div className="px-4 pb-4">
              <div className="text-[11px] text-[rgba(42,40,38,0.7)] leading-relaxed">
                <span className="font-bold text-servirest-midnight">Al registrarte obtienes:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                  <span className="flex items-center gap-1.5"><Check size={12} className="text-servirest-terracota" /> Precios de apertura</span>
                  <span className="flex items-center gap-1.5"><Check size={12} className="text-servirest-terracota" /> Promos por recomendar</span>
                  <span className="flex items-center gap-1.5"><Check size={12} className="text-servirest-terracota" /> Historial y repetir pedido</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Datos del cliente */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <SrLabel className="block mb-2">Nombre *</SrLabel>
            <SrInput value={customerName} onChange={(e: any) => setCustomerName(e.target.value)} placeholder="Cómo te llamas" />
          </div>
          <div>
            <SrLabel className="block mb-2">Teléfono *</SrLabel>
            <SrInput value={customerPhone} onChange={(e: any) => setCustomerPhone(e.target.value)} placeholder="10 dígitos" />
          </div>
        </div>

        {/* Dirección — SOLO en delivery, con validación por GPS (radio) */}
        {mode === 'delivery' && (
          <div className="mb-6">
            {/* Si el negocio configuró radio, primero valida ubicación */}
            {hasGeoRadius && (
              <div className={`p-4 rounded-sr-md border-2 mb-4 ${
                geoValidated ? 'border-servirest-success/40 bg-servirest-success/5'
                : geoRejected ? 'border-servirest-danger/40 bg-servirest-danger/5'
                : 'border-servirest-mostaza/40 bg-mostaza-500/10'
              }`}>
                <div className="flex items-start gap-3">
                  <MapPin size={20} className={geoValidated ? 'text-servirest-success' : geoRejected ? 'text-servirest-danger' : 'text-servirest-mostaza'} />
                  <div className="flex-1 min-w-0">
                    <div className="font-serif italic text-servirest-midnight text-[15px]">
                      {geoValidated ? '¡Sí llegamos a tu ubicación!'
                        : geoRejected ? 'Estás fuera de nuestro radio de entrega'
                        : 'Valida que llegamos a tu domicilio'}
                    </div>
                    <p className="text-[11px] text-[rgba(42,40,38,0.6)] mt-1 leading-relaxed">
                      {geoValidated ? `Estás a ${geoDistance?.toFixed(1)} km del local (cubrimos ${radiusKm} km).`
                        : geoRejected ? `Estás a ${geoDistance?.toFixed(1)} km — cubrimos hasta ${radiusKm} km. Prueba "Recoger en local".`
                        : `Entregamos en ${radiusKm} km a la redonda. Te pediremos permiso de ubicación.`}
                    </p>
                    {!geoValidated && !geoRejected && (
                      <button
                        onClick={onValidateGeo}
                        disabled={geoState === 'checking'}
                        className="mt-3 px-5 h-10 rounded-full bg-servirest-midnight text-servirest-hueso text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 disabled:opacity-50"
                      >
                        {geoState === 'checking' ? <RefreshCw size={13} className="animate-spin" /> : <MapPin size={13} />}
                        {geoState === 'checking' ? 'Ubicándote…' : 'Validar mi ubicación'}
                      </button>
                    )}
                    {/* Fuera de rango → ofrecer cambiar a recoger en local */}
                    {geoRejected && (
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <button
                          onClick={() => setMode('pickup')}
                          className="px-5 h-10 rounded-full bg-servirest-terracota text-servirest-hueso text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 hover:scale-[1.02] transition-transform"
                        >
                          <Store size={13} /> Mejor recojo en el local
                        </button>
                        <button
                          onClick={onValidateGeo}
                          disabled={geoState === 'checking'}
                          className="px-4 h-10 rounded-full border border-[rgba(42,40,38,0.2)] text-[rgba(42,40,38,0.6)] text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={geoState === 'checking' ? 'animate-spin' : ''} /> Reintentar
                        </button>
                      </div>
                    )}
                    {geoState === 'error' && (
                      <p className="text-[11px] text-servirest-danger mt-2">No pudimos leer tu ubicación. Da permiso e intenta de nuevo.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <SrLabel className="block mb-2">
              {!addressUnlocked && <Lock size={12} className="inline mr-1 text-[rgba(42,40,38,0.4)]" />}
              <MapPin size={12} className="inline mr-1" /> Dirección de entrega *
            </SrLabel>

            {!addressUnlocked && (
              <p className="text-[11px] text-[rgba(42,40,38,0.5)] mb-3 italic">
                Valida tu ubicación arriba — al validarla llenamos tu calle, colonia y CP automáticamente.
              </p>
            )}

            {/* Campos estructurados: al validar el GPS se pre-llenan con
                reverse-geocoding; el cliente solo corrige número y refs. */}
            <div className={`space-y-3 ${!addressUnlocked ? 'opacity-50 pointer-events-none select-none' : ''}`}>
              <div>
                <SrLabel className="block mb-1.5 !text-[10px]">Calle y número *</SrLabel>
                <SrInput
                  value={addrStreet}
                  onChange={(e: any) => setAddrStreet(e.target.value)}
                  disabled={!addressUnlocked}
                  placeholder="Av. Tecnológico 1234"
                />
              </div>
              <div className="grid grid-cols-[1fr_130px] gap-3">
                <div>
                  <SrLabel className="block mb-1.5 !text-[10px]">Colonia</SrLabel>
                  <SrInput
                    value={addrColonia}
                    onChange={(e: any) => setAddrColonia(e.target.value)}
                    disabled={!addressUnlocked}
                    placeholder="Cantares Residencial"
                  />
                </div>
                <div>
                  <SrLabel className="block mb-1.5 !text-[10px]">C.P. *</SrLabel>
                  <SrInput
                    value={addrCP}
                    onChange={(e: any) => setAddrCP(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    disabled={!addressUnlocked}
                    placeholder="32000"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div>
                <SrLabel className="block mb-1.5 !text-[10px]">Referencias para el repartidor</SrLabel>
                <SrInput
                  value={addrRefs}
                  onChange={(e: any) => setAddrRefs(e.target.value)}
                  disabled={!addressUnlocked}
                  placeholder="Casa blanca, portón negro, frente al parque…"
                />
              </div>
            </div>

            {addressUnlocked && addrCP.trim() && !/^\d{5}$/.test(addrCP.trim()) && (
              <p className="text-[11px] text-servirest-danger mt-2">El código postal debe tener 5 dígitos.</p>
            )}

            {/* Fallback: validación por texto si NO hay radio GPS */}
            {zoneTextChecked && (
              inZoneText ? (
                <div className="flex items-center gap-2 mt-2 text-[12px] text-servirest-success font-medium"><CheckCircle2 size={14} /> ¡Sí llegamos a tu zona!</div>
              ) : (
                <div className="flex items-center gap-2 mt-2 text-[12px] text-servirest-danger font-medium"><AlertCircle size={14} /> Fuera de nuestras zonas de entrega.</div>
              )
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
            <PayOption method="cash" active={payMethod === 'cash'} onClick={() => setPayMethod('cash')} label={mode === 'delivery' ? 'Efectivo al recibir' : 'Efectivo al recoger'} desc="Pagas cuando te llegue o cuando recojas." icon={Banknote} />
            <PayOption method="terminal" active={payMethod === 'terminal'} onClick={() => setPayMethod('terminal')} label={mode === 'delivery' ? 'Terminal al recibir' : 'Terminal al recoger'} desc="El repartidor/cajero lleva terminal para tu tarjeta." icon={CreditCard} />
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
          disabled={!canConfirm}
          onClick={onConfirm}
          className="w-full h-16 rounded-full bg-servirest-terracota text-servirest-hueso font-black italic uppercase tracking-[0.2em] text-[13px] shadow-sr-glow hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed transition-transform flex items-center justify-center gap-2"
        >
          {processing ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={18} />}
          {processing ? 'Procesando…'
            : (mode === 'delivery' && !deliveryOk) ? (hasGeoRadius ? 'Valida tu ubicación primero' : 'Fuera de zona de entrega')
            : payMethod === 'stripe_qr' ? `Pagar $${total.toFixed(2)} con Stripe`
            : `Confirmar pedido — $${total.toFixed(2)}`}
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
  <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-servirest-midnight flex items-center justify-center px-4 sm:px-6 py-10 antialiased">
    <div className="max-w-md w-full">
      <button onClick={onBack} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-servirest-hueso/50 mb-6">
        <ArrowLeft size={14} /> Volver
      </button>
      <SrKicker className="!text-servirest-mostaza">Cliente</SrKicker>
      <h1 className="font-serif italic text-servirest-hueso text-4xl sm:text-5xl leading-tight mt-3 mb-8">
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
// SuccessView — pantalla de progreso con polling en vivo del estatus
// ─────────────────────────────────────────────────────────────────────────
const STOREFRONT_STEPS: { keys: string[]; label: string; icon: React.ElementType }[] = [
  { keys: ['PENDING'],                 label: 'Recibida',       icon: PackageCheck },
  { keys: ['COOKING'],                 label: 'En preparación', icon: ChefHat },
  { keys: ['READY'],                   label: 'Lista',          icon: CheckCircle2 },
  { keys: ['SERVED', 'COMPLETED'],     label: mode => mode === 'delivery' ? 'En camino' : 'Entregada', icon: Truck },
];

const SuccessView: React.FC<any> = ({ orderNum, orderId, mode, onOrderMore, onNewOrder }) => {
  const [status, setStatus] = useState<string>('PENDING');
  const [pollError, setPollError] = useState(false);
  const [notifyOn, setNotifyOn] = useState(canNotify());
  const prevStatusRef = React.useRef<string>('PENDING');

  // Al entrar a la pantalla de estatus, ofrecemos activar avisos.
  useEffect(() => {
    if (!canNotify() && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      requestNotifyPermission().then(setNotifyOn);
    }
  }, []);

  // Polling del estatus cada 12s. Al detectar un CAMBIO, dispara la
  // notificación local (aviso + vibración + beep).
  useEffect(() => {
    if (!orderId) return;
    let alive = true;
    const poll = async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data, error } = await supabase.rpc('get_order_status', { p_order_id: orderId });
      if (!alive) return;
      if (error) { setPollError(true); return; }
      const next = String(data || 'PENDING');
      if (next !== prevStatusRef.current) {
        const copy = statusNotifyCopy(next, mode, orderNum);
        if (copy) notify(copy.title, copy.body);
        prevStatusRef.current = next;
      }
      setStatus(next);
    };
    poll();
    const iv = setInterval(poll, 12000);
    return () => { alive = false; clearInterval(iv); };
  }, [orderId, mode, orderNum]);

  const activeIdx = STOREFRONT_STEPS.findIndex((s) => s.keys.includes(status));
  const currentIdx = activeIdx === -1 ? 0 : activeIdx;
  const isDone = status === 'SERVED' || status === 'COMPLETED';

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-servirest-midnight overflow-y-auto flex flex-col items-center justify-center antialiased relative py-10">
      <div className="max-w-2xl w-full px-5 sm:px-8 text-center">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 18 }} className="w-28 h-28 rounded-full bg-servirest-terracota text-servirest-hueso mx-auto flex items-center justify-center shadow-sr-glow mb-6">
          {isDone ? <Truck size={52} strokeWidth={2.2} /> : <CheckCircle2 size={56} strokeWidth={2.5} />}
        </motion.div>
        <SrKicker className="!text-servirest-mostaza">{isDone ? '¡Pedido en camino!' : 'Pedido recibido'}</SrKicker>
        <h1 className="font-serif italic text-servirest-hueso text-4xl sm:text-6xl leading-tight mt-3 mb-2">Orden #{orderNum}</h1>
        <p className="text-[15px] text-servirest-hueso/60 mb-6">
          {isDone
            ? (mode === 'delivery' ? 'Tu pedido ya salió. Llega en unos minutos.' : 'Tu pedido está listo para recoger.')
            : 'Sigue el estatus aquí — se actualiza solo mientras lo preparamos.'}
        </p>

        {/* Toggle de avisos push locales */}
        {!isDone && (
          notifyOn ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-servirest-success/10 border border-servirest-success/30 text-[11px] font-bold text-servirest-mostaza mb-8">
              <Bell size={13} /> Avisos activados — te notificamos cada cambio
            </div>
          ) : (
            <button
              onClick={() => requestNotifyPermission().then(setNotifyOn)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-servirest-hueso/10 border border-servirest-hueso/20 text-[11px] font-black uppercase tracking-[0.15em] text-servirest-hueso hover:bg-servirest-hueso/20 mb-8 transition-colors"
            >
              <Bell size={13} /> Avísame cuando cambie
            </button>
          )
        )}

        {/* Progress ladder en vivo */}
        <div className="grid grid-cols-4 gap-2 mb-10">
          {STOREFRONT_STEPS.map((step, i) => {
            const done = i <= currentIdx;
            const current = i === currentIdx && !isDone;
            const label = typeof step.label === 'function' ? step.label(mode) : step.label;
            return (
              <div key={i} className="flex flex-col items-center">
                <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all ${
                  done ? 'bg-servirest-terracota text-servirest-hueso shadow-sr-glow' : 'bg-servirest-hueso/5 text-servirest-hueso/30 border border-servirest-hueso/10'
                } ${current ? 'animate-pulse' : ''}`}>
                  <step.icon size={18} strokeWidth={2.2} className="sm:hidden" />
                  <step.icon size={22} strokeWidth={2.2} className="hidden sm:block" />
                </div>
                <span className={`mt-2 sm:mt-3 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.08em] sm:tracking-[0.12em] text-center leading-tight ${done ? 'text-servirest-mostaza' : 'text-servirest-hueso/40'}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {pollError && (
          <p className="text-[11px] text-servirest-hueso/40 mb-6 italic">
            No pudimos leer el estatus en vivo, pero tu pedido sí llegó al negocio.
          </p>
        )}

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
};

// ─────────────────────────────────────────────────────────────────────────
// BadUrlScreen
// ─────────────────────────────────────────────────────────────────────────
const BadUrlScreen: React.FC<{ error?: string | null }> = ({ error }) => (
  <div className="h-[100dvh] w-full bg-servirest-hueso flex items-center justify-center px-6 antialiased">
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
