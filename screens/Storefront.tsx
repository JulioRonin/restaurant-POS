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
  Banknote, CreditCard, Bell, Gift, Award, MessageCircle, Send, Copy,
  Share2, ClipboardList, ChevronRight, LogOut, Sparkles, Receipt,
  TrendingUp, KeyRound, Eye, Ticket,
} from 'lucide-react';
import { getSupabase } from '../services/auth';
import { notify, canNotify, requestNotifyPermission, statusNotifyCopy } from '../services/notify';
import {
  capturePendingReferral, ensureProfile, getProfile, getMyOrders, getRewards,
  redeemReward, recordOrderConsumption, sendOrderMessage, getOrderMessages,
  referralShareUrl, getOrderDetail, applyReferralCode,
  REWARD_ORDERS_THRESHOLD, REWARD_REFERRALS_THRESHOLD,
  type CustomerProfile, type CustomerReward,
} from '../services/customer';
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
type View = 'menu' | 'checkout' | 'auth' | 'success' | 'account';

const lineTotal = (l: CartLine) => (l.basePrice + l.variants.reduce((s, v) => s + (v.price || 0), 0)) * l.quantity;

// ── Órdenes activas locales (para la burbuja flotante de estatus) ───────────
// Persisten en localStorage por negocio para que la burbuja sobreviva al
// recargar; sirven a invitados y a clientes con cuenta por igual.
type ActiveOrder = { id: string; num: string; mode: Mode };
const ACTIVE_ORDERS_KEY = (bid: string) => `servirest_active_orders_${bid}`;
const readActiveOrders = (bid: string): ActiveOrder[] => {
  try { return JSON.parse(localStorage.getItem(ACTIVE_ORDERS_KEY(bid)) || '[]'); } catch { return []; }
};
const addActiveOrder = (bid: string, o: ActiveOrder) => {
  const list = readActiveOrders(bid).filter((x) => x.id !== o.id);
  list.unshift(o);
  localStorage.setItem(ACTIVE_ORDERS_KEY(bid), JSON.stringify(list.slice(0, 8)));
};
const removeActiveOrder = (bid: string, id: string) => {
  localStorage.setItem(ACTIVE_ORDERS_KEY(bid), JSON.stringify(readActiveOrders(bid).filter((x) => x.id !== id)));
};

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
  const [geoErrorMsg, setGeoErrorMsg] = useState<string | null>(null);
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
  const [authReturnTo, setAuthReturnTo] = useState<View>('checkout');

  // Cuenta de cliente / lealtad / referidos
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [rewards, setRewards] = useState<CustomerReward[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [accountLoading, setAccountLoading] = useState(false);
  // Tras confirmar checkout, a dónde volver: si venías de "auth" para ver
  // cuenta, etc. Guardamos la vista previa del checkout para no perderla.

  // Captura ?ref= al abrir el storefront (para ligar referidos).
  useEffect(() => { capturePendingReferral(); }, []);

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

  // Al aparecer una sesión, garantiza el perfil de cliente (crea código de
  // referido, liga referred_by) y precarga sus datos de lealtad.
  useEffect(() => {
    if (!session?.user?.id) { setProfile(null); return; }
    let alive = true;
    (async () => {
      const p = await ensureProfile(session);
      if (!alive) return;
      setProfile(p);
      // Prellena nombre/teléfono del checkout si el perfil los tiene.
      if (p?.fullName && !customerName) setCustomerName(p.fullName);
      if (p?.phone && !customerPhone) setCustomerPhone(p.phone);
    })();
    return () => { alive = false; };
  }, [session?.user?.id]);

  // Carga (o recarga) los datos de la vista "Mi cuenta".
  const loadAccount = async () => {
    if (!session?.user?.id) return;
    setAccountLoading(true);
    try {
      const [p, r, o] = await Promise.all([
        getProfile(session.user.id),
        getRewards(session.user.id),
        getMyOrders(session.user.id),
      ]);
      setProfile(p);
      setRewards(r);
      setMyOrders(o);
    } finally {
      setAccountLoading(false);
    }
  };

  const openAccount = () => {
    if (!session) { setAuthMode('login'); setAuthReturnTo('account'); setView('auth'); return; }
    setView('account');
    loadAccount();
  };

  const handleSignOut = async () => {
    const supabase = getSupabase();
    await supabase?.auth.signOut();
    setProfile(null); setRewards([]); setMyOrders([]);
    setView('menu');
  };

  const handleRedeem = async (rewardId: string) => {
    const ok = await redeemReward(rewardId);
    if (ok) setRewards((prev) => prev.map((r) => r.id === rewardId ? { ...r, status: 'redeemed' } : r));
  };

  // Reabre la pantalla de estatus de una orden previa desde "Mis pedidos".
  const reopenOrderStatus = (order: any) => {
    setConfirmedOrderId(order.id);
    setConfirmedOrderNum(String((order.daily_number ?? 0) + 1).padStart(4, '0'));
    setMode(order.source === 'TO_GO' ? 'delivery' : 'pickup');
    setView('success');
  };

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
      // Después de auth OK, vuelve a donde el usuario venía (checkout o su
      // cuenta). La session llega por el listener onAuthStateChange.
      setView(authReturnTo);
      if (authReturnTo === 'account') loadAccount();
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
    setGeoErrorMsg(null);
    if (!navigator.geolocation) {
      setGeoState('error');
      setGeoErrorMsg('Tu navegador no soporta ubicación. Escribe tu dirección manualmente abajo.');
      return;
    }
    setGeoState('checking');

    const onSuccess = async (pos: GeolocationPosition) => {
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
    };

    // Manejo por código de error. En iPhone el GPS de alta precisión a veces
    // agota el tiempo; si eso pasa (code 3) reintentamos UNA vez con baja
    // precisión y más tiempo antes de rendirnos.
    const onError = (err: GeolocationPositionError, canRetry: boolean) => {
      if (err.code === 3 /* TIMEOUT */ && canRetry) {
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          (e2) => onError(e2, false),
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 120000 }
        );
        return;
      }
      setGeoState('error');
      if (err.code === 1 /* PERMISSION_DENIED */) {
        setGeoErrorMsg('Bloqueaste el permiso de ubicación. En iPhone: toca "aA" a la izquierda de la barra de Safari → Ajustes del sitio web → Ubicación → Permitir. O ve a Ajustes → Privacidad → Localización → Safari. Luego reintenta.');
      } else if (err.code === 2 /* POSITION_UNAVAILABLE */) {
        setGeoErrorMsg('No pudimos obtener tu señal GPS. Revisa que la Localización esté activada y que tengas buena señal, y reintenta.');
      } else {
        setGeoErrorMsg('Se agotó el tiempo buscando tu ubicación. Reintenta o escribe tu dirección manualmente abajo.');
      }
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => onError(err, true),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
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

      if (payMethod === 'stripe_qr') {
        // STRIPE: NO insertamos la orden todavía. Si insertáramos aquí y el
        // cliente abandona el pago (o reintenta), quedaría una orden huérfana
        // en Cocina → duplicados. En su lugar guardamos el pedido en
        // localStorage y lo insertamos SOLO al volver pagado (?paid).
        localStorage.setItem(
          `servirest_pending_order_${orderId}`,
          JSON.stringify({ orderRecord, itemRows, dailyNumber })
        );
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
        if (error || !url) {
          localStorage.removeItem(`servirest_pending_order_${orderId}`);
          throw new Error(error || 'No pudimos generar el link de pago');
        }
        window.location.href = url;
        return;
      }

      // Efectivo / terminal: se cobra al entregar, así que la orden SÍ entra
      // a Cocina de una vez (PENDING de cobro).
      const { error: oErr } = await supabase.from('orders').insert(orderRecord);
      if (oErr) throw oErr;
      const { error: iErr } = await supabase.from('order_items').insert(itemRows);
      if (iErr) console.warn('[Storefront] order_items insert warn:', iErr.message);

      const orderNumStr = String(dailyNumber + 1).padStart(4, '0');
      setConfirmedOrderId(orderId);
      setConfirmedOrderNum(orderNumStr);
      setView('success');
      setCart([]);
      addActiveOrder(businessId, { id: orderId, num: orderNumStr, mode });

      // Lealtad: si hay cliente logueado, registra el consumo (contadores,
      // recompensas y acreditación al referidor). Best-effort.
      if (session?.user?.id) {
        recordOrderConsumption(session.user.id, businessId, total);
      }
    } catch (err: any) {
      console.error('[Storefront] order error:', err);
      alert('No pudimos procesar tu pedido. ' + (err.message || ''));
    } finally {
      setProcessing(false);
    }
  };

  // Detecta retorno de Stripe con ?paid= e inserta la orden UNA sola vez
  // (usando el payload guardado en localStorage antes del redirect).
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const paid = params.get('paid');
    const cancelled = params.get('cancel');

    // Si el cliente canceló el pago en Stripe, limpiamos el pedido pendiente
    // (nunca se insertó, así que no hay orden huérfana).
    if (cancelled) {
      localStorage.removeItem(`servirest_pending_order_${cancelled}`);
      return;
    }
    if (!paid) return;

    const insertPaidOrder = async () => {
      const supabase = getSupabase();
      const key = `servirest_pending_order_${paid}`;
      const raw = localStorage.getItem(key);

      // Muestra la pantalla de estatus de inmediato.
      setConfirmedOrderId(paid);
      setView('success');
      setCart([]);

      if (!supabase || !raw) {
        setConfirmedOrderNum(paid.slice(0, 4).toUpperCase());
        return;
      }
      try {
        const { orderRecord, itemRows, dailyNumber } = JSON.parse(raw);
        const paidNum = String((dailyNumber ?? 0) + 1).padStart(4, '0');
        setConfirmedOrderNum(paidNum);
        addActiveOrder(orderRecord.business_id, {
          id: paid,
          num: paidNum,
          mode: orderRecord?.source === 'TO_GO' ? 'delivery' : 'pickup',
        });
        // Idempotencia: si ya existe (doble retorno), no re-insertamos.
        const { data: existing } = await supabase.from('orders').select('id').eq('id', paid).maybeSingle();
        if (!existing) {
          await supabase.from('orders').insert(orderRecord);
          if (Array.isArray(itemRows) && itemRows.length) {
            await supabase.from('order_items').insert(itemRows);
          }
          // Lealtad: registra el consumo solo la 1a vez (idempotente por el
          // guard de `existing`). El customerId viaja en customer_metadata.
          const custId = orderRecord?.customer_metadata?.customerId;
          if (custId) {
            recordOrderConsumption(custId, orderRecord.business_id, Number(orderRecord.total) || 0);
          }
        }
      } catch (e) {
        console.warn('[Storefront] insert paid order failed:', e);
      } finally {
        localStorage.removeItem(key);
      }
    };
    insertPaidOrder();
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
  if (view === 'success') return <SuccessView
    orderNum={confirmedOrderNum}
    orderId={confirmedOrderId}
    mode={mode}
    businessId={businessId}
    customerName={customerName || profile?.fullName}
    onOrderMore={() => { setView('menu'); setConfirmedOrderId(null); }}
    onNewOrder={() => { setView('menu'); setCart([]); setConfirmedOrderId(null); }}
    onAccount={openAccount}
  />;

  if (view === 'account') return <AccountView
    business={business}
    businessId={businessId}
    session={session}
    profile={profile}
    rewards={rewards}
    orders={myOrders}
    loading={accountLoading}
    onBack={() => setView('menu')}
    onReload={loadAccount}
    onRedeem={handleRedeem}
    onReopenOrder={reopenOrderStatus}
    onSignOut={handleSignOut}
  />;

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
    geoErrorMsg={geoErrorMsg}
    onBack={() => setView('menu')}
    onConfirm={handleConfirmOrder}
    onLoginRequired={() => { setAuthReturnTo('checkout'); setView('auth'); }}
  />;

  // MENU view
  return (
    <div className="h-[100dvh] w-full max-w-full overflow-x-hidden bg-servirest-hueso flex flex-col antialiased">
      <header className="flex-shrink-0 px-4 sm:px-6 md:px-12 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-[rgba(42,40,38,0.08)] bg-servirest-surface">
        <div className="max-w-6xl mx-auto">
          {/* Fila compacta: logo + nombre + toggle delivery/pickup segmentado */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt={business.name} className="w-9 h-9 sm:w-10 sm:h-10 rounded-sr-sm object-contain bg-servirest-hueso border border-[rgba(42,40,38,0.08)] p-1 flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-sr-sm bg-servirest-midnight text-servirest-mostaza flex items-center justify-center font-serif italic text-lg flex-shrink-0">{business.name?.[0] || 'R'}</div>
              )}
              <div className="min-w-0">
                <div className="font-serif italic text-servirest-midnight text-[17px] sm:text-[19px] leading-none truncate">{business.name}</div>
                <div className="text-[8px] font-black uppercase tracking-[0.2em] text-servirest-terracota mt-0.5">Ordena en línea</div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Toggle segmentado esbelto */}
              <div className="flex items-center bg-servirest-hueso rounded-full p-0.5 border border-[rgba(42,40,38,0.1)]">
                <button
                  onClick={() => deliveryEnabled && setMode('delivery')}
                  disabled={!deliveryEnabled}
                  title={deliveryEnabled ? undefined : 'El negocio aún no configura su zona de entrega'}
                  className={`px-2.5 sm:px-3 h-8 rounded-full text-[10px] font-black uppercase tracking-[0.1em] flex items-center gap-1.5 transition-all ${
                    !deliveryEnabled ? 'text-[rgba(42,40,38,0.25)] cursor-not-allowed line-through'
                    : mode === 'delivery' ? 'bg-servirest-terracota text-servirest-hueso shadow-sm' : 'text-[rgba(42,40,38,0.55)]'
                  }`}
                >
                  <Truck size={12} /> <span className="hidden xs:inline sm:inline">Domicilio</span>
                </button>
                <button
                  onClick={() => setMode('pickup')}
                  className={`px-2.5 sm:px-3 h-8 rounded-full text-[10px] font-black uppercase tracking-[0.1em] flex items-center gap-1.5 transition-all ${
                    mode === 'pickup' ? 'bg-servirest-terracota text-servirest-hueso shadow-sm' : 'text-[rgba(42,40,38,0.55)]'
                  }`}
                >
                  <Store size={12} /> <span className="hidden xs:inline sm:inline">Recoger</span>
                </button>
              </div>

              {/* Mi cuenta — perfil, pedidos, recompensas, referidos */}
              <button
                onClick={openAccount}
                title={session ? 'Mi cuenta' : 'Iniciar sesión'}
                className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-servirest-midnight text-servirest-hueso flex items-center justify-center hover:bg-servirest-terracota transition-colors flex-shrink-0"
              >
                <UserIcon size={16} />
                {rewards.some((r) => r.status === 'available') && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-servirest-mostaza border-2 border-servirest-surface" />
                )}
              </button>
            </div>
          </div>

          {/* Search + categorías en una sola fila compacta */}
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-shrink-0 w-10 sm:w-auto sm:flex-1 sm:max-w-xs">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgba(42,40,38,0.4)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar…"
                className="w-full h-10 pl-10 pr-3 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.1)] text-[14px] font-medium focus:outline-none focus:border-servirest-terracota"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex-shrink-0 px-3.5 h-10 rounded-full text-[11px] font-black uppercase tracking-[0.1em] transition-all ${
                    category === cat
                      ? 'bg-servirest-midnight text-servirest-hueso shadow-sm'
                      : 'bg-servirest-hueso text-[rgba(42,40,38,0.6)] border border-[rgba(42,40,38,0.1)]'
                  }`}
                >
                  {cat === '__all__' ? 'Todo' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Chips de info (solo si aplican) */}
          {((mode === 'delivery' && deliveryFee > 0) || (settings.digitalMinOrder ?? 0) > 0) && (
            <div className="flex items-center gap-2 mt-2">
              {mode === 'delivery' && deliveryFee > 0 && (
                <SrChip tone="mostaza" size="xs">Envío ${deliveryFee}</SrChip>
              )}
              {(settings.digitalMinOrder ?? 0) > 0 && (
                <SrChip tone="neutral" size="xs">Mínimo ${settings.digitalMinOrder}</SrChip>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 pt-4 pb-6">
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

      {/* Burbuja flotante: estatus en vivo de la orden activa */}
      <FloatingOrderBubble
        businessId={businessId}
        onOpen={(o: ActiveOrder) => { setConfirmedOrderId(o.id); setConfirmedOrderNum(o.num); setMode(o.mode); setView('success'); }}
      />

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
  zonesList, isAddressInZone, hasGeoRadius, radiusKm, geoState, geoDistance, onValidateGeo, geoErrorMsg,
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
                      <div className="mt-2">
                        <p className="text-[11px] text-servirest-danger leading-relaxed">{geoErrorMsg || 'No pudimos leer tu ubicación. Da permiso e intenta de nuevo.'}</p>
                        <button
                          onClick={onValidateGeo}
                          className="mt-2 px-4 h-9 rounded-full bg-servirest-midnight text-servirest-hueso text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2"
                        >
                          <RefreshCw size={12} /> Reintentar
                        </button>
                      </div>
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
// FloatingOrderBubble — pastilla flotante con el estatus en vivo de la orden
// activa más reciente. Sobrevive recargas (localStorage) y sirve a invitados
// y a clientes con cuenta. Al tocarla abre la pantalla de estatus.
// ─────────────────────────────────────────────────────────────────────────
const FloatingOrderBubble: React.FC<{ businessId: string; onOpen: (o: ActiveOrder) => void }> = ({ businessId, onOpen }) => {
  const [active, setActive] = useState<ActiveOrder[]>(() => readActiveOrders(businessId));
  const [status, setStatus] = useState<string>('PENDING');

  // Re-lee la lista cuando cambia el negocio o al volver a la pestaña.
  useEffect(() => {
    const refresh = () => setActive(readActiveOrders(businessId));
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [businessId]);

  const current = active[0]; // la más reciente

  // Polling del estatus. Cuando la orden se completa/cancela, la sacamos de
  // la lista y mostramos la siguiente activa (si hay).
  useEffect(() => {
    if (!current) return;
    let alive = true;
    const poll = async () => {
      const sb = getSupabase();
      if (!sb) return;
      const { data } = await sb.rpc('get_order_status', { p_order_id: current.id });
      if (!alive) return;
      const s = String(data || 'PENDING');
      setStatus(s);
      if (s === 'COMPLETED' || s === 'CANCELLED') {
        removeActiveOrder(businessId, current.id);
        setActive(readActiveOrders(businessId));
      }
    };
    poll();
    const iv = setInterval(poll, 15000);
    return () => { alive = false; clearInterval(iv); };
  }, [current?.id, businessId]);

  if (!current) return null;

  const isDelivery = current.mode === 'delivery';
  const st = orderStatusLabel(status, isDelivery);
  const Icon = isDelivery ? Truck : Store;

  return (
    <motion.button
      initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      onClick={() => onOpen(current)}
      style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      className="fixed left-4 z-40 flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full bg-servirest-midnight text-servirest-hueso shadow-2xl shadow-black/30 hover:scale-105 transition-transform max-w-[calc(100vw-2rem)]"
    >
      <span className="relative flex-shrink-0 w-8 h-8 rounded-full bg-servirest-terracota flex items-center justify-center">
        <Icon size={15} />
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-servirest-mostaza border-2 border-servirest-midnight animate-pulse" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-[8px] font-black uppercase tracking-[0.18em] text-servirest-mostaza leading-none">Orden #{current.num} · en vivo</span>
        <span className="block text-[12px] font-bold leading-tight truncate">{st.label}</span>
      </span>
    </motion.button>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// SuccessView — pantalla de progreso con polling en vivo del estatus
// ─────────────────────────────────────────────────────────────────────────
// Los pasos y el copy dependen del modo: en delivery el ciclo cierra "en
// camino / entregado"; en pickup cierra al recoger y cobrar en la tienda.
const stepsFor = (mode: 'delivery' | 'pickup'): { keys: string[]; label: string; icon: React.ElementType }[] => {
  const isDelivery = mode === 'delivery';
  return [
    { keys: ['PENDING'],             label: 'Recibida',                                    icon: PackageCheck },
    { keys: ['COOKING'],             label: 'En preparación',                              icon: ChefHat },
    { keys: ['READY'],               label: isDelivery ? 'Lista' : 'Lista para recoger',   icon: CheckCircle2 },
    isDelivery
      ? { keys: ['SERVED', 'COMPLETED'], label: 'En camino',           icon: Truck }
      : { keys: ['SERVED', 'COMPLETED'], label: 'Recogida y cobrada',  icon: Store },
  ];
};

const SuccessView: React.FC<any> = ({ orderNum, orderId, mode, businessId, customerName, onOrderMore, onNewOrder, onAccount }) => {
  const [status, setStatus] = useState<string>('PENDING');
  const [pollError, setPollError] = useState(false);
  const [notifyOn, setNotifyOn] = useState(canNotify());
  const [chatOpen, setChatOpen] = useState(false);
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

  const isDelivery = mode === 'delivery';
  const steps = stepsFor(mode);
  const activeIdx = steps.findIndex((s) => s.keys.includes(status));
  const currentIdx = activeIdx === -1 ? 0 : activeIdx;
  const isDone = status === 'SERVED' || status === 'COMPLETED';
  // En pickup, el momento de "ya ve por él" es READY (lista para recoger).
  const readyForPickup = !isDelivery && status === 'READY';

  const kicker = isDone
    ? (isDelivery ? '¡Pedido en camino!' : '¡Pedido recogido!')
    : readyForPickup ? '¡Listo para recoger!'
    : 'Pedido recibido';

  const HeroIcon = isDone
    ? (isDelivery ? Truck : Store)
    : readyForPickup ? Store
    : CheckCircle2;

  const heroCopy = isDone
    ? (isDelivery ? 'Tu pedido ya salió. Llega en unos minutos.' : 'Gracias por tu compra. ¡Te esperamos pronto!')
    : readyForPickup ? 'Pasa a la tienda por tu pedido. El cobro se hace al recogerlo.'
    : 'Sigue el estatus aquí — se actualiza solo mientras lo preparamos.';

  return (
    <div className="min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-servirest-midnight overflow-y-auto flex flex-col items-center justify-center antialiased relative py-10">
      <div className="max-w-2xl w-full px-5 sm:px-8 text-center">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 18 }} className="w-28 h-28 rounded-full bg-servirest-terracota text-servirest-hueso mx-auto flex items-center justify-center shadow-sr-glow mb-6">
          <HeroIcon size={isDone ? 52 : 56} strokeWidth={2.2} />
        </motion.div>
        <SrKicker className="!text-servirest-mostaza">{kicker}</SrKicker>
        <h1 className="font-serif italic text-servirest-hueso text-4xl sm:text-6xl leading-tight mt-3 mb-2">Orden #{orderNum}</h1>
        <p className="text-[15px] text-servirest-hueso/60 mb-6">{heroCopy}</p>

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
          {steps.map((step, i) => {
            const done = i <= currentIdx;
            const current = i === currentIdx && !isDone;
            const label = step.label;
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

        {/* Botón de mensaje al negocio / repartidor */}
        {orderId && (
          <button
            onClick={() => setChatOpen(true)}
            className="inline-flex items-center gap-2 px-6 h-12 rounded-full bg-servirest-mostaza text-servirest-midnight font-black uppercase tracking-[0.15em] text-[11px] hover:scale-105 transition-transform mb-6"
          >
            <MessageCircle size={15} /> {mode === 'delivery' ? 'Mensaje a la tienda / repartidor' : 'Mensaje a la tienda'}
          </button>
        )}

        <div className="flex gap-3 flex-wrap justify-center">
          <button onClick={onOrderMore} className="px-8 h-14 rounded-full bg-servirest-hueso text-servirest-midnight font-black italic uppercase tracking-[0.2em] text-[12px] hover:scale-105 transition-transform">
            Ordenar algo más
          </button>
          <button onClick={onNewOrder} className="px-8 h-14 rounded-full border-2 border-servirest-hueso/30 text-servirest-hueso font-black italic uppercase tracking-[0.2em] text-[12px] hover:border-servirest-mostaza/60">
            Nueva orden
          </button>
        </div>

        {onAccount && (
          <button onClick={onAccount} className="mt-6 inline-flex items-center gap-1.5 text-servirest-hueso/50 hover:text-servirest-mostaza text-[11px] font-bold uppercase tracking-[0.15em] transition-colors">
            <UserIcon size={13} /> Ver mis pedidos y recompensas
          </button>
        )}
      </div>

      {chatOpen && orderId && (
        <OrderChat
          orderId={orderId}
          businessId={businessId}
          customerName={customerName}
          onClose={() => setChatOpen(false)}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// OrderChat — panel de mensajes cliente ↔ negocio/repartidor (por orden)
// ─────────────────────────────────────────────────────────────────────────
const OrderChat: React.FC<any> = ({ orderId, businessId, customerName, onClose }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);

  const load = async () => setMessages(await getOrderMessages(orderId));

  // Carga inicial + polling cada 8s para ver respuestas del negocio.
  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [orderId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    // Optimista: pinta el mensaje de inmediato.
    const optimistic = { id: `tmp-${Date.now()}`, sender: 'customer', sender_name: customerName || 'Cliente', message: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    setDraft('');
    const ok = await sendOrderMessage(orderId, businessId, text, customerName);
    if (ok) await load();
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full sm:max-w-md h-[75dvh] sm:h-[70vh] bg-servirest-hueso rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-[rgba(42,40,38,0.08)] bg-servirest-surface">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-servirest-midnight text-servirest-mostaza flex items-center justify-center"><MessageCircle size={16} /></div>
            <div>
              <div className="font-serif italic text-servirest-midnight text-[16px] leading-none">Mensajes</div>
              <div className="text-[10px] text-[rgba(42,40,38,0.5)] mt-0.5">Con la tienda y tu repartidor</div>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.1)] flex items-center justify-center text-[rgba(42,40,38,0.5)] hover:text-servirest-terracota"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <MessageCircle size={32} className="text-[rgba(42,40,38,0.2)] mb-3" />
              <p className="text-[13px] text-[rgba(42,40,38,0.5)]">Escríbele a la tienda si necesitas cambiar algo de tu pedido o dar indicaciones al repartidor.</p>
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.sender === 'customer';
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-snug ${
                    mine ? 'bg-servirest-terracota text-servirest-hueso rounded-br-sm' : 'bg-servirest-surface border border-[rgba(42,40,38,0.08)] text-servirest-midnight rounded-bl-sm'
                  }`}>
                    {!mine && <div className="text-[9px] font-black uppercase tracking-[0.1em] text-servirest-terracota mb-0.5">{m.sender === 'driver' ? '🛵 Repartidor' : '🏪 Tienda'}</div>}
                    {m.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="flex-shrink-0 flex items-center gap-2 p-3 border-t border-[rgba(42,40,38,0.08)] bg-servirest-surface pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Escribe un mensaje…"
            className="flex-1 h-11 px-4 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.12)] text-[14px] focus:outline-none focus:border-servirest-terracota"
          />
          <button onClick={send} disabled={sending || !draft.trim()} className="w-11 h-11 rounded-full bg-servirest-terracota text-servirest-hueso flex items-center justify-center disabled:opacity-40 flex-shrink-0">
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// AccountView — "Mi cuenta": perfil, lealtad, referidos y mis pedidos
// ─────────────────────────────────────────────────────────────────────────
const mxn = (n: number) => `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// El texto depende del modo (source): TO_GO = domicilio, PICKUP = recoger.
const orderStatusLabel = (status: string, isDelivery: boolean): { label: string; cls: string } => {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING:   { label: 'Recibida',       cls: 'bg-servirest-mostaza/20 text-servirest-mostaza' },
    COOKING:   { label: 'En preparación', cls: 'bg-servirest-terracota/15 text-servirest-terracota' },
    READY:     { label: isDelivery ? 'Lista' : 'Lista para recoger', cls: 'bg-blue-500/15 text-blue-600' },
    SERVED:    { label: isDelivery ? 'En camino' : 'Recogida',        cls: 'bg-servirest-terracota/15 text-servirest-terracota' },
    COMPLETED: { label: isDelivery ? 'Entregada' : 'Recogida y cobrada', cls: 'bg-green-600/15 text-green-700' },
    CANCELLED: { label: 'Cancelada',      cls: 'bg-servirest-danger/15 text-servirest-danger' },
  };
  return map[status] || { label: status, cls: 'bg-servirest-hueso text-[rgba(42,40,38,0.6)]' };
};
const isActiveStatus = (s: string) => ['PENDING', 'COOKING', 'READY', 'SERVED'].includes(s);

const AccountView: React.FC<any> = ({ business, businessId, session, profile, rewards, orders, loading, onBack, onReload, onRedeem, onReopenOrder, onSignOut }) => {
  const [copied, setCopied] = useState(false);
  const [summaryOrder, setSummaryOrder] = useState<any | null>(null); // orden para ver resumen
  const [redeemTarget, setRedeemTarget] = useState<CustomerReward | null>(null); // recompensa a canjear
  const [refInput, setRefInput] = useState('');
  const [refMsg, setRefMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [refBusy, setRefBusy] = useState(false);

  const availableRewards = (rewards || []).filter((r: CustomerReward) => r.status === 'available');
  const ordersProgress = profile ? profile.totalOrders % REWARD_ORDERS_THRESHOLD : 0;
  const refsProgress = profile ? profile.successfulReferrals % REWARD_REFERRALS_THRESHOLD : 0;
  const activeOrders = (orders || []).filter((o: any) => isActiveStatus(o.status));
  const pastOrders = (orders || []).filter((o: any) => !isActiveStatus(o.status));
  // Puede meter código de invitación solo si aún no tiene referidor ni 1a orden.
  const canApplyReferral = profile && !profile.referredBy && !profile.firstOrderDone;

  const submitReferral = async () => {
    if (!profile || refBusy) return;
    setRefBusy(true);
    setRefMsg(null);
    const res = await applyReferralCode(profile.userId, refInput);
    setRefMsg({ ok: res.ok, text: res.ok ? '¡Código aplicado! Tu amigo recibirá crédito con tu primer pedido.' : (res.error || 'No se pudo aplicar') });
    if (res.ok) { setRefInput(''); onReload(); }
    setRefBusy(false);
  };

  const shareUrl = profile ? referralShareUrl(businessId, profile.referralCode) : '';

  const copyCode = async () => {
    if (!profile) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard best-effort */ }
  };

  const share = async () => {
    if (!profile) return;
    const text = `¡Pide en ${business?.name || 'este restaurante'} con mi código ${profile.referralCode} y apóyame! 🍕`;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: business?.name || 'Ordena en línea', text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(`${text} ${shareUrl}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch { /* share best-effort */ }
  };

  return (
    <div className="h-[100dvh] w-full max-w-full overflow-x-hidden bg-servirest-hueso flex flex-col antialiased">
      {/* Header */}
      <header className="flex-shrink-0 px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 border-b border-[rgba(42,40,38,0.08)] bg-servirest-surface z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <button onClick={onBack} className="w-9 h-9 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.1)] flex items-center justify-center text-[rgba(42,40,38,0.6)] hover:text-servirest-terracota flex-shrink-0"><ArrowLeft size={17} /></button>
          <div className="font-serif italic text-servirest-midnight text-[18px] leading-none">Mi cuenta</div>
          <button onClick={onSignOut} title="Cerrar sesión" className="w-9 h-9 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.1)] flex items-center justify-center text-[rgba(42,40,38,0.5)] hover:text-servirest-danger flex-shrink-0"><LogOut size={16} /></button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {loading && !profile ? (
            <div className="py-20 text-center"><RefreshCw size={32} className="mx-auto text-servirest-terracota animate-spin" /></div>
          ) : (
            <>
              {/* Tarjeta de perfil */}
              <div className="rounded-3xl bg-servirest-midnight text-servirest-hueso p-5 sm:p-6 shadow-lg">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-full bg-servirest-terracota text-servirest-hueso flex items-center justify-center font-serif italic text-2xl flex-shrink-0">
                    {(profile?.fullName || session?.user?.email || '?')[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-serif italic text-[22px] leading-tight truncate">{profile?.fullName || 'Cliente'}</div>
                    <div className="text-[12px] text-servirest-hueso/50 truncate">{session?.user?.email}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-5">
                  <div className="text-center bg-servirest-hueso/5 rounded-2xl py-3">
                    <div className="font-serif italic text-servirest-mostaza text-2xl leading-none">{profile?.points ?? 0}</div>
                    <div className="text-[9px] uppercase tracking-[0.12em] text-servirest-hueso/50 mt-1.5">Puntos</div>
                  </div>
                  <div className="text-center bg-servirest-hueso/5 rounded-2xl py-3">
                    <div className="font-serif italic text-servirest-hueso text-2xl leading-none">{profile?.totalOrders ?? 0}</div>
                    <div className="text-[9px] uppercase tracking-[0.12em] text-servirest-hueso/50 mt-1.5">Pedidos</div>
                  </div>
                  <div className="text-center bg-servirest-hueso/5 rounded-2xl py-3">
                    <div className="font-serif italic text-servirest-hueso text-[17px] leading-none pt-1.5">{mxn(profile?.totalSpent ?? 0)}</div>
                    <div className="text-[9px] uppercase tracking-[0.12em] text-servirest-hueso/50 mt-1.5">Consumo</div>
                  </div>
                </div>
              </div>

              {/* Gráfica de preferencias (lo que más pide) */}
              <PreferencesChart orders={orders} />

              {/* Recompensas disponibles */}
              {availableRewards.length > 0 && (
                <div className="space-y-2.5">
                  {availableRewards.map((r: CustomerReward) => (
                    <div key={r.id} className="rounded-2xl bg-gradient-to-r from-servirest-mostaza/20 to-servirest-terracota/10 border border-servirest-mostaza/40 p-4 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-servirest-mostaza text-servirest-midnight flex items-center justify-center flex-shrink-0"><Gift size={20} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-servirest-midnight text-[14px] leading-tight">{r.title}</div>
                        <div className="text-[11px] text-[rgba(42,40,38,0.55)]">Toca "Usar" para ver tu código de canje</div>
                      </div>
                      <button onClick={() => setRedeemTarget(r)} className="px-4 h-9 rounded-full bg-servirest-terracota text-servirest-hueso text-[11px] font-black uppercase tracking-[0.1em] flex-shrink-0 hover:scale-105 transition-transform flex items-center gap-1.5"><KeyRound size={13} /> Usar</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Progreso de lealtad */}
              <div className="rounded-3xl bg-servirest-surface border border-[rgba(42,40,38,0.08)] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Award size={16} className="text-servirest-terracota" />
                  <div className="font-serif italic text-servirest-midnight text-[17px]">Tu progreso</div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="font-bold text-servirest-midnight">Rebanada gratis por compras</span>
                    <span className="text-[rgba(42,40,38,0.5)] font-mono">{ordersProgress}/{REWARD_ORDERS_THRESHOLD}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-servirest-hueso overflow-hidden">
                    <div className="h-full bg-servirest-terracota rounded-full transition-all" style={{ width: `${(ordersProgress / REWARD_ORDERS_THRESHOLD) * 100}%` }} />
                  </div>
                  <div className="text-[11px] text-[rgba(42,40,38,0.5)] mt-1.5">Te faltan {REWARD_ORDERS_THRESHOLD - ordersProgress} pedido(s) para tu próxima rebanada gratis 🍕</div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="font-bold text-servirest-midnight">Rebanada gratis por referidos</span>
                    <span className="text-[rgba(42,40,38,0.5)] font-mono">{refsProgress}/{REWARD_REFERRALS_THRESHOLD}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-servirest-hueso overflow-hidden">
                    <div className="h-full bg-servirest-mostaza rounded-full transition-all" style={{ width: `${(refsProgress / REWARD_REFERRALS_THRESHOLD) * 100}%` }} />
                  </div>
                  <div className="text-[11px] text-[rgba(42,40,38,0.5)] mt-1.5">{profile?.successfulReferrals ?? 0} amigos ya pidieron gracias a ti. ¡{REWARD_REFERRALS_THRESHOLD - refsProgress} más y ganas otra!</div>
                </div>
              </div>

              {/* Referidos */}
              <div className="rounded-3xl bg-servirest-surface border border-[rgba(42,40,38,0.08)] p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={16} className="text-servirest-mostaza" />
                  <div className="font-serif italic text-servirest-midnight text-[17px]">Invita y gana</div>
                </div>
                <p className="text-[12px] text-[rgba(42,40,38,0.55)] mb-4">Comparte tu código. Cuando un amigo haga su primer pedido, sumas un referido — y a los 3, otra rebanada gratis.</p>

                <div className="flex items-center gap-2 bg-servirest-hueso rounded-2xl border border-dashed border-servirest-terracota/40 p-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] uppercase tracking-[0.15em] text-[rgba(42,40,38,0.45)] mb-0.5">Tu código</div>
                    <div className="font-mono font-black text-servirest-terracota text-xl tracking-[0.15em] truncate">{profile?.referralCode || '—'}</div>
                  </div>
                  <button onClick={copyCode} className="px-3 h-10 rounded-full bg-servirest-midnight text-servirest-hueso text-[11px] font-bold flex items-center gap-1.5 flex-shrink-0">
                    {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar link</>}
                  </button>
                </div>
                <button onClick={share} className="w-full h-12 rounded-full bg-servirest-terracota text-servirest-hueso font-black uppercase tracking-[0.15em] text-[12px] flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                  <Share2 size={16} /> Compartir mi código
                </button>

                {/* Introducir el código de quien te invitó */}
                {canApplyReferral ? (
                  <div className="mt-4 pt-4 border-t border-dashed border-[rgba(42,40,38,0.12)]">
                    <div className="text-[11px] font-bold text-servirest-midnight mb-2">¿Te invitó alguien? Escribe su código</div>
                    <div className="flex items-center gap-2">
                      <input
                        value={refInput}
                        onChange={(e) => { setRefInput(e.target.value.toUpperCase()); setRefMsg(null); }}
                        placeholder="EJ. JUAN1234"
                        className="flex-1 h-11 px-4 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.12)] text-[14px] font-mono tracking-[0.1em] uppercase focus:outline-none focus:border-servirest-terracota"
                      />
                      <button onClick={submitReferral} disabled={refBusy || !refInput.trim()} className="px-4 h-11 rounded-full bg-servirest-midnight text-servirest-hueso text-[11px] font-black uppercase tracking-[0.1em] disabled:opacity-40 flex-shrink-0">
                        {refBusy ? '…' : 'Aplicar'}
                      </button>
                    </div>
                    {refMsg && (
                      <p className={`text-[11px] mt-2 font-medium ${refMsg.ok ? 'text-green-700' : 'text-servirest-danger'}`}>{refMsg.text}</p>
                    )}
                  </div>
                ) : profile?.referredBy ? (
                  <p className="text-[11px] text-[rgba(42,40,38,0.45)] mt-3 text-center">Ya tienes un código de invitación aplicado ✓</p>
                ) : null}
              </div>

              {/* Mis pedidos */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={16} className="text-servirest-terracota" />
                    <div className="font-serif italic text-servirest-midnight text-[17px]">Mis pedidos</div>
                  </div>
                  <button onClick={onReload} className="text-[rgba(42,40,38,0.4)] hover:text-servirest-terracota"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
                </div>

                {activeOrders.length === 0 && pastOrders.length === 0 ? (
                  <div className="rounded-2xl bg-servirest-surface border border-[rgba(42,40,38,0.08)] p-8 text-center">
                    <ClipboardList size={28} className="mx-auto text-[rgba(42,40,38,0.2)] mb-2" />
                    <p className="text-[13px] text-[rgba(42,40,38,0.5)]">Aún no tienes pedidos. ¡Haz el primero!</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activeOrders.length > 0 && (
                      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-servirest-terracota px-1 pt-1">Activos ahora</div>
                    )}
                    {activeOrders.map((o: any) => <OrderRow key={o.id} order={o} onOpen={() => setSummaryOrder(o)} active />)}
                    {pastOrders.length > 0 && (
                      <div className="text-[10px] font-black uppercase tracking-[0.15em] text-[rgba(42,40,38,0.35)] px-1 pt-2">Anteriores</div>
                    )}
                    {pastOrders.map((o: any) => <OrderRow key={o.id} order={o} onOpen={() => setSummaryOrder(o)} />)}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal: resumen de la compra */}
      {summaryOrder && (
        <OrderSummaryModal
          order={summaryOrder}
          onClose={() => setSummaryOrder(null)}
          onLiveStatus={() => { const o = summaryOrder; setSummaryOrder(null); onReopenOrder(o); }}
        />
      )}

      {/* Modal: código de canje de recompensa */}
      {redeemTarget && (
        <RedeemModal
          reward={redeemTarget}
          onClose={() => setRedeemTarget(null)}
          onConfirm={async () => { await onRedeem(redeemTarget.id); setRedeemTarget(null); }}
        />
      )}
    </div>
  );
};

// Código corto legible derivado del UUID de la recompensa (para el cajero).
const rewardCode = (id: string) => id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();

// ── Resumen de compra (no la pantalla de estatus) ──────────────────────────
const OrderSummaryModal: React.FC<any> = ({ order, onClose, onLiveStatus }) => {
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const isDelivery = order.source === 'TO_GO';
  const active = isActiveStatus(order.status);
  const st = orderStatusLabel(order.status, isDelivery);
  const num = String((order.daily_number ?? 0) + 1).padStart(4, '0');

  useEffect(() => {
    let alive = true;
    getOrderDetail(order.id).then((d) => { if (alive) { setDetail(d); setLoading(false); } });
    return () => { alive = false; };
  }, [order.id]);

  const meta = detail?.customer_metadata || order.customer_metadata || {};
  const items = detail?.items || [];
  const subtotal = items.reduce((s: number, it: any) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
  const when = (() => {
    try { return new Date(order.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  })();
  const payLabel = (m: string) => m === 'CARD' ? 'Tarjeta' : m === 'CASH' ? 'Efectivo' : m || '—';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[88dvh] bg-servirest-hueso rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-[rgba(42,40,38,0.08)] bg-servirest-surface">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-servirest-midnight text-servirest-mostaza flex items-center justify-center flex-shrink-0"><Receipt size={16} /></div>
            <div className="min-w-0">
              <div className="font-serif italic text-servirest-midnight text-[16px] leading-none">Orden #{num}</div>
              <div className="text-[10px] text-[rgba(42,40,38,0.5)] mt-0.5 truncate">{when}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-servirest-hueso border border-[rgba(42,40,38,0.1)] flex items-center justify-center text-[rgba(42,40,38,0.5)] hover:text-servirest-terracota flex-shrink-0"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-[10px] font-black uppercase tracking-[0.08em] px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[rgba(42,40,38,0.5)] flex items-center gap-1">
              {isDelivery ? <><Truck size={12} /> Domicilio</> : <><Store size={12} /> Recoger</>}
            </span>
          </div>

          {loading ? (
            <div className="py-10 text-center"><RefreshCw size={24} className="mx-auto text-servirest-terracota animate-spin" /></div>
          ) : (
            <>
              <div className="space-y-2.5 mb-4">
                {items.length === 0 && <p className="text-[13px] text-[rgba(42,40,38,0.5)] text-center py-4">No pudimos cargar los productos.</p>}
                {items.map((it: any, i: number) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-servirest-terracota/10 text-servirest-terracota text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{it.quantity}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-servirest-midnight leading-tight">{it.name}</div>
                      {it.notes && <div className="text-[11px] text-[rgba(42,40,38,0.5)] mt-0.5">{it.notes}</div>}
                    </div>
                    <div className="text-[13px] font-mono text-servirest-midnight flex-shrink-0">{mxn(Number(it.price || 0) * Number(it.quantity || 0))}</div>
                  </div>
                ))}
              </div>

              <div className="border-t border-[rgba(42,40,38,0.08)] pt-3 space-y-1.5">
                {subtotal > 0 && (
                  <div className="flex justify-between text-[12px] text-[rgba(42,40,38,0.6)]"><span>Subtotal</span><span className="font-mono">{mxn(subtotal)}</span></div>
                )}
                <div className="flex justify-between items-center pt-1">
                  <span className="font-serif italic text-servirest-midnight text-[17px]">Total</span>
                  <span className="font-serif italic text-servirest-terracota text-[20px]">{mxn(order.total)}</span>
                </div>
                <div className="flex justify-between text-[11px] text-[rgba(42,40,38,0.5)] pt-1">
                  <span>Pago</span>
                  <span>{payLabel(detail?.payment_method)} · {detail?.payment_status === 'PAID' ? 'Pagado' : 'Por cobrar'}</span>
                </div>
              </div>

              {isDelivery && meta.deliveryAddress && (
                <div className="mt-4 flex items-start gap-2 bg-servirest-surface rounded-2xl p-3 border border-[rgba(42,40,38,0.08)]">
                  <MapPin size={15} className="text-servirest-terracota flex-shrink-0 mt-0.5" />
                  <div className="text-[12px] text-servirest-midnight leading-snug">{meta.deliveryAddress}</div>
                </div>
              )}
            </>
          )}
        </div>

        {active && (
          <div className="flex-shrink-0 p-4 border-t border-[rgba(42,40,38,0.08)] bg-servirest-surface pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button onClick={onLiveStatus} className="w-full h-12 rounded-full bg-servirest-midnight text-servirest-hueso font-black uppercase tracking-[0.15em] text-[12px] flex items-center justify-center gap-2">
              <Eye size={16} /> Ver estatus en vivo
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Modal de canje de recompensa (código para el cajero) ────────────────────
const RedeemModal: React.FC<any> = ({ reward, onClose, onConfirm }) => {
  const [confirming, setConfirming] = useState(false);
  const code = rewardCode(reward.id);
  const done = reward.status === 'redeemed';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-5" onClick={onClose}>
      <div className="w-full max-w-sm bg-servirest-hueso rounded-3xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="bg-servirest-midnight text-servirest-hueso px-6 pt-7 pb-6 text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-servirest-hueso/10 flex items-center justify-center text-servirest-hueso/70 hover:text-servirest-hueso"><X size={15} /></button>
          <div className="w-14 h-14 rounded-full bg-servirest-mostaza text-servirest-midnight mx-auto flex items-center justify-center mb-3"><Gift size={26} /></div>
          <div className="font-serif italic text-[20px] leading-tight">{reward.title}</div>
        </div>
        <div className="px-6 py-6 text-center">
          <p className="text-[12px] text-[rgba(42,40,38,0.6)] mb-3">Muéstrale este código al cajero para aplicar tu recompensa:</p>
          <div className="rounded-2xl border-2 border-dashed border-servirest-terracota/50 bg-servirest-surface py-4 mb-4">
            <div className="font-mono font-black text-servirest-terracota text-3xl tracking-[0.3em]">{code}</div>
          </div>
          {done ? (
            <div className="inline-flex items-center gap-2 text-green-700 text-[13px] font-bold"><Check size={16} /> Recompensa canjeada</div>
          ) : (
            <>
              <button
                onClick={async () => { setConfirming(true); await onConfirm(); }}
                disabled={confirming}
                className="w-full h-12 rounded-full bg-servirest-terracota text-servirest-hueso font-black uppercase tracking-[0.15em] text-[12px] disabled:opacity-50"
              >
                {confirming ? 'Marcando…' : 'Ya la usé — marcar como canjeada'}
              </button>
              <p className="text-[10px] text-[rgba(42,40,38,0.4)] mt-3">Solo márcala cuando el cajero la haya aplicado. No se puede deshacer.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Gráfica de preferencias (lo que más pide el cliente) ─────────────────────
// Agrega los productos de sus pedidos recientes y muestra sus favoritos como
// barras horizontales. Lee el detalle de cada orden vía RPC (get_order_detail).
const PreferencesChart: React.FC<{ orders: any[] }> = ({ orders }) => {
  const [prefs, setPrefs] = useState<{ name: string; qty: number }[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const recent = (orders || []).filter((o: any) => o.status !== 'CANCELLED').slice(0, 6);
      if (recent.length === 0) { if (alive) { setPrefs([]); setLoading(false); } return; }
      const details = await Promise.all(recent.map((o: any) => getOrderDetail(o.id)));
      if (!alive) return;
      const counts: Record<string, number> = {};
      details.forEach((d: any) => (d?.items || []).forEach((it: any) => {
        const n = (it.name || 'Producto').trim();
        counts[n] = (counts[n] || 0) + (Number(it.quantity) || 0);
      }));
      const arr = Object.entries(counts)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);
      setPrefs(arr);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [orders]);

  if (loading) {
    return (
      <div className="rounded-3xl bg-servirest-surface border border-[rgba(42,40,38,0.08)] p-5">
        <div className="flex items-center gap-2 mb-4"><Sparkles size={16} className="text-servirest-mostaza" /><div className="font-serif italic text-servirest-midnight text-[17px]">Tus favoritos</div></div>
        <div className="py-6 text-center"><RefreshCw size={20} className="mx-auto text-servirest-terracota animate-spin" /></div>
      </div>
    );
  }
  if (!prefs || prefs.length === 0) return null;

  const max = Math.max(...prefs.map((p) => p.qty), 1);
  const total = prefs.reduce((s, p) => s + p.qty, 0);

  return (
    <div className="rounded-3xl bg-servirest-surface border border-[rgba(42,40,38,0.08)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-servirest-mostaza" />
          <div className="font-serif italic text-servirest-midnight text-[17px]">Tus favoritos</div>
        </div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-[rgba(42,40,38,0.45)]">Lo que más pides</div>
      </div>
      <div className="space-y-3" role="img" aria-label="Tus productos más pedidos">
        {prefs.map((p, i) => {
          const pct = (p.qty / max) * 100;
          const isTop = i === 0;
          return (
            <div key={p.name}>
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span className="font-bold text-servirest-midnight truncate pr-2 flex items-center gap-1.5">
                  {isTop && <Award size={12} className="text-servirest-mostaza flex-shrink-0" />}{p.name}
                </span>
                <span className="text-[rgba(42,40,38,0.5)] font-mono flex-shrink-0">{p.qty}×</span>
              </div>
              <div className="h-2.5 rounded-full bg-servirest-hueso overflow-hidden">
                <div className={`h-full rounded-full transition-all ${isTop ? 'bg-servirest-terracota' : 'bg-servirest-mostaza/60'}`} style={{ width: `${Math.max(8, pct)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-[rgba(42,40,38,0.4)] mt-3 text-center">Basado en tus últimos pedidos · {total} productos</div>
    </div>
  );
};

const OrderRow: React.FC<any> = ({ order, onOpen, active }) => {
  const isDelivery = order.source === 'TO_GO';
  const st = orderStatusLabel(order.status, isDelivery);
  const num = String((order.daily_number ?? 0) + 1).padStart(4, '0');
  const when = (() => {
    try { return new Date(order.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  })();
  return (
    <button
      onClick={onOpen}
      className={`w-full text-left rounded-2xl border p-4 flex items-center gap-3 transition-colors ${active ? 'bg-servirest-surface border-servirest-terracota/40 hover:border-servirest-terracota' : 'bg-servirest-surface border-[rgba(42,40,38,0.08)] hover:border-[rgba(42,40,38,0.2)]'}`}
    >
      <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${order.source === 'TO_GO' ? 'bg-servirest-terracota/10 text-servirest-terracota' : 'bg-servirest-midnight/5 text-servirest-midnight'}`}>
        {order.source === 'TO_GO' ? <Truck size={18} /> : <Store size={18} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-servirest-midnight text-[14px]">Orden #{num}</span>
          <span className={`text-[9px] font-black uppercase tracking-[0.08em] px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
        </div>
        <div className="text-[11px] text-[rgba(42,40,38,0.5)] mt-0.5">{when} · {mxn(order.total)}</div>
      </div>
      {active && <ChevronRight size={18} className="text-servirest-terracota flex-shrink-0" />}
    </button>
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
