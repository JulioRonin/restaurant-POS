import React, { useState, useMemo, useEffect } from 'react';
import { MenuItem, OrderItem, Order, OrderStatus, Table, OrderSource, MenuItemVariant } from '../types';
import { useOrders } from '../contexts/OrderContext';
import { useUser } from '../contexts/UserContext';
import { useSettings } from '../contexts/SettingsContext';
import { useMenu } from '../contexts/MenuContext';
import { useTables } from '../contexts/TableContext';
import { KitchenTicket } from '../components/KitchenTicket';
import { printerService } from '../services/PrinterService';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Printer, ShoppingCart, X, Minus, ChefHat,
  Table as TableIcon, ShoppingBag, Truck, ArrowRight, Trash2,
  SlidersHorizontal, Check, Wifi, WifiOff,
} from 'lucide-react';
import {
  SrCard, SrButton, SrChip, SrInput, SrLabel, SrKicker, SrMono,
  SrProgressRing, SrModal, SrModalHeader, SrArrowBadge, SrTabs,
  SrEmptyState,
} from '../components/ui/servirest';


/* -------------------------------------------------------------------------- */
/* OrderProgressCard — kitchen-line ticket. Bigger, more editorial.            */
/* -------------------------------------------------------------------------- */
type OrderCardProps = {
  id: string;
  customer: string;
  tableName: string;
  pct: number;
  items: number;
  onClick?: () => void;
};
const OrderProgressCard: React.FC<OrderCardProps> = ({ id, customer, tableName, pct, items, onClick }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
  >
    <SrCard
      hover
      className="p-5 cursor-pointer"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="flex items-center justify-between mb-2.5">
        <SrMono className="text-[11px] text-servirest-terracota">{id}</SrMono>
        <SrChip tone="neutral" size="xs">{tableName}</SrChip>
      </div>
      <div className="font-serif italic font-medium text-[20px] text-servirest-midnight tracking-[-0.015em] mb-[18px] truncate leading-tight">
        {customer}
      </div>
      <div className="flex items-center gap-3 pt-4 border-t border-[rgba(42,40,38,0.08)]">
        <SrProgressRing pct={pct} size={42} stroke={4} />
        <span className="font-extrabold text-[12px] text-servirest-midnight flex-1 tracking-tight">
          En preparación
        </span>
        <span className="inline-flex items-center gap-2 font-bold text-[11px] text-[rgba(42,40,38,0.6)]">
          <span className="font-mono">{items}</span>
          <SrArrowBadge />
        </span>
      </div>
    </SrCard>
  </motion.div>
);

/* -------------------------------------------------------------------------- */
/* DishCard — refined imagery + price treatment                                 */
/* -------------------------------------------------------------------------- */
type DishCardProps = { item: MenuItem; onClick: () => void };
const DishCard: React.FC<DishCardProps> = ({ item, onClick }) => {
  const available = item.status === 'ACTIVE';
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!available}
      whileHover={available ? { y: -4 } : undefined}
      whileTap={available ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="bg-transparent border-none text-left p-0 disabled:cursor-default group"
      style={{ opacity: available ? 1 : 0.5 }}
    >
      <div className="relative h-[150px] rounded-sr-lg overflow-hidden shadow-sr-card">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.08]"
          />
        ) : (
          <div className="w-full h-full bg-servirest-hueso-sunken flex items-center justify-center">
            <ChefHat size={36} className="text-[rgba(42,40,38,0.2)]" />
          </div>
        )}

        {/* Subtle dark wash so the price tag and badges always pop over any image */}
        <div
          className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(26,30,46,0.55) 0%, transparent 100%)' }}
          aria-hidden="true"
        />

        {/* Price tag — top-right, terracota, ESC-POS receipt vibe */}
        <span className="absolute top-2.5 right-2.5 bg-servirest-terracota text-servirest-hueso font-mono font-extrabold text-[13px] px-3 py-1.5 rounded-sr-md shadow-sr-glow">
          ${item.price.toFixed(0)}
        </span>

        {/* State badges — top-left */}
        {!available && (
          <span className="absolute top-2.5 left-2.5 font-black text-[8px] uppercase tracking-[0.16em] text-servirest-hueso bg-[rgba(225,85,75,0.92)] px-2.5 py-1 rounded-sr-sm">
            Agotado
          </span>
        )}
        {item.variants && item.variants.length > 0 && available && (
          <span className="absolute top-2.5 left-2.5 font-black text-[8px] uppercase tracking-[0.16em] text-servirest-hueso bg-servirest-midnight/85 px-2.5 py-1 rounded-sr-sm backdrop-blur-sm">
            Variantes
          </span>
        )}

        {/* Dish name at bottom, over the dark wash for readability */}
        <span className="absolute bottom-2 left-3 right-12 font-serif italic font-medium text-[15px] text-servirest-hueso tracking-[-0.01em] leading-tight truncate drop-shadow-md">
          {item.name}
        </span>

        {/* Quick-add CTA bottom-right */}
        <span className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-servirest-terracota text-servirest-hueso flex items-center justify-center opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 shadow-sr-glow">
          <Plus size={18} />
        </span>
      </div>
      <div className="text-[11px] text-[rgba(42,40,38,0.5)] mt-2 mx-0.5 font-medium truncate uppercase tracking-[0.06em]">
        {item.category}
      </div>
    </motion.button>
  );
};

/* -------------------------------------------------------------------------- */
/* POSScreen — Punto de Venta editorial                                        */
/* -------------------------------------------------------------------------- */
export const POSScreen: React.FC = () => {
  const { activeEmployee, authProfile } = useUser();
  const { addOrder, orders } = useOrders();
  const { tables: TABLES } = useTables();
  const { settings } = useSettings();
  const { menuItems } = useMenu();

  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [kitchenOrderToPrint, setKitchenOrderToPrint] = useState<Order | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedSource, setSelectedSource] = useState<OrderSource>(OrderSource.DINE_IN);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [variantItem, setVariantItem] = useState<MenuItem | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<MenuItemVariant[]>([]);
  const [printerReady, setPrinterReady] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setPrinterReady(printerService.isConnected()), 2000);
    return () => clearInterval(interval);
  }, []);

  const dynamicCategories = useMemo(() => {
    const cats = new Set<string>();
    menuItems.forEach((i) => { if (i.category) cats.add(i.category); });
    return Array.from(cats).sort();
  }, [menuItems]);

  const activeMenuItems = useMemo(() => menuItems.filter((i) => i.status === 'ACTIVE'), [menuItems]);

  const filteredItems = useMemo(
    () =>
      activeMenuItems.filter((item) => {
        const catOk = activeCategory === 'All' || item.category === activeCategory;
        const searchOk = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return catOk && searchOk;
      }),
    [activeCategory, searchQuery, activeMenuItems]
  );

  const categoryTabs = useMemo(() => {
    const counts = activeMenuItems.reduce((acc: Record<string, number>, item) => {
      acc[item.category || ''] = (acc[item.category || ''] || 0) + 1;
      return acc;
    }, {});
    return [
      { id: 'All', label: 'Todos', count: activeMenuItems.length },
      ...dynamicCategories.map((c) => ({ id: c, label: c, count: counts[c] || 0 })),
    ];
  }, [activeMenuItems, dynamicCategories]);

  const activeKitchenOrders = useMemo(() => {
    const cooking = orders.filter(
      (o) => o.status === OrderStatus.COOKING || o.status === OrderStatus.PENDING
    );
    cooking.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return cooking.slice(0, 4).map((o) => {
      const itemsDone = o.items.filter((i: any) => i.status === 'READY' || i.status === 'SERVED').length;
      const total = o.items.length || 1;
      const pct = Math.round((itemsDone / total) * 100);
      const tableName = TABLES.find((t) => t.id === o.tableId)?.name || (o.tableId === 'COUNTER' ? 'Barra' : o.tableId);
      const idShort = `#${(o.id || '').slice(0, 9).toUpperCase()}`;
      const customer = (o as any).customerName || o.waiterName || 'Cliente';
      return { id: idShort, customer, tableName, pct, items: o.items.length };
    });
  }, [orders, TABLES]);

  const addToCart = (item: MenuItem, variants?: MenuItemVariant[]) => {
    setCart((prev) => {
      const variantKey = (variants || []).map((v) => v.name).sort().join('|');
      const existing = prev.find(
        (i) =>
          i.id === item.id &&
          (i.selectedVariants || []).map((v) => v.name).sort().join('|') === variantKey
      );
      if (existing) {
        return prev.map((i) =>
          i.id === item.id &&
          (i.selectedVariants || []).map((v) => v.name).sort().join('|') === variantKey
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1, notes: '', selectedVariants: variants }];
    });
    setVariantItem(null);
    setSelectedVariants([]);
  };

  const updateQuantity = (index: number, delta: number) =>
    setCart((prev) =>
      prev.map((it, i) => (i === index ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it))
    );

  const lineTotal = (item: OrderItem) => {
    const variantExtras = (item.selectedVariants || []).reduce((s, v) => s + (v.price || 0), 0);
    return (item.price + variantExtras) * item.quantity;
  };

  const subtotal = cart.reduce((s, it) => s + lineTotal(it), 0);
  const tax = subtotal * 0.16;
  const total = subtotal + tax;
  const cartItemCount = cart.reduce((s, it) => s + it.quantity, 0);

  const handleSendOrder = async () => {
    if (cart.length === 0) return;
    const newOrder: Order = {
      id: crypto.randomUUID(),
      tableId: selectedTable?.id || 'COUNTER',
      items: [...cart],
      status: OrderStatus.COOKING,
      timestamp: new Date(),
      total,
      waiterName: activeEmployee?.name || 'Sistema',
      source: selectedSource,
      businessId: authProfile?.businessId,
      locationId: authProfile?.locationId,
    };

    try {
      const savedOrder = await addOrder(newOrder);
      if (settings.isKitchenPrintingEnabled) {
        let printSuccess = false;
        const tableName = TABLES.find((t) => t.id === savedOrder.tableId)?.name || savedOrder.tableId;
        const enriched = { ...savedOrder, tableId: tableName };

        if (
          printerService.isConnected() ||
          (settings.connectedDeviceName && settings.connectedDeviceName !== 'None')
        ) {
          try { printSuccess = await printerService.printKitchenTicket(enriched, settings); }
          catch { printSuccess = false; }
        }
        if (!printSuccess) {
          document.body.classList.add('print-mode');
          setKitchenOrderToPrint(enriched);
          setTimeout(() => {
            window.print();
            setKitchenOrderToPrint(null);
            document.body.classList.remove('print-mode');
          }, 1200);
        }
      }
      setCart([]);
      setShowSuccessModal(true);
      setTimeout(() => setShowSuccessModal(false), 2000);
    } catch {
      alert('Error al enviar la orden.');
    }
  };

  const sourceOptions: { id: OrderSource; icon: React.ComponentType<any>; label: string }[] = [
    { id: OrderSource.DINE_IN,   icon: TableIcon,   label: 'En mesa' },
    { id: OrderSource.TO_GO,     icon: ShoppingBag, label: 'Para llevar' },
    { id: OrderSource.RAPPI,     icon: Truck,       label: 'Rappi' },
    { id: OrderSource.UBER_EATS, icon: ChefHat,     label: 'Uber Eats' },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-servirest-hueso antialiased relative">
      {/* Print root (hidden) */}
      <div className="hidden print:block absolute inset-0 z-[9999] bg-white">
        {kitchenOrderToPrint && <KitchenTicket order={kitchenOrderToPrint} settings={settings} />}
      </div>

      {/* MAIN COLUMN */}
      <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-6 md:p-8 lg:px-10 lg:py-9">
        {/* Editorial header */}
        <div className="flex items-start justify-between flex-wrap gap-5 mb-9">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <SrKicker className="block mb-2">Punto de venta</SrKicker>
            <h1 className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0">
              Línea de órdenes
            </h1>
            <p className="text-[13px] text-[rgba(42,40,38,0.6)] font-medium mt-2 leading-relaxed max-w-[460px]">
              {activeEmployee?.name ? `${activeEmployee.name} · ` : ''}arma la orden y mándala a cocina sin cambiar de pantalla.
            </p>
          </motion.div>

          {/* Status rail */}
          <div className="flex items-center gap-3 flex-wrap">
            {settings.isDirectPrintingEnabled && (
              <div
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-sr-md border ${printerReady ? 'border-servirest-success/30 bg-[rgba(34,160,107,0.05)] text-servirest-success' : 'border-servirest-danger/30 bg-[rgba(225,85,75,0.04)] text-servirest-danger animate-pulse'}`}
                title={printerReady ? 'Impresora conectada' : 'Impresora desconectada'}
              >
                <Printer size={14} />
                <span className="font-black uppercase tracking-[0.14em] text-[9px]">
                  {printerReady ? 'Impresora ok' : 'Sin impresora'}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-sr-md border border-[rgba(42,40,38,0.12)] bg-servirest-surface">
              {navigator.onLine ? (
                <Wifi size={14} className="text-servirest-success" />
              ) : (
                <WifiOff size={14} className="text-servirest-danger" />
              )}
              <span className="font-black uppercase tracking-[0.14em] text-[9px] text-[rgba(42,40,38,0.6)]">
                {navigator.onLine ? 'En línea' : 'Sin conexión'}
              </span>
            </div>
          </div>
        </div>

        {/* Active kitchen orders */}
        {activeKitchenOrders.length > 0 && (
          <div className="mb-9">
            <div className="flex items-center justify-between mb-4">
              <div>
                <SrKicker className="block mb-1">Pedidos en cocina</SrKicker>
                <h2 className="font-serif italic font-medium text-[28px] text-servirest-midnight tracking-[-0.015em] m-0 leading-tight">
                  {activeKitchenOrders.length === 1 ? '1 pedido activo' : `${activeKitchenOrders.length} pedidos activos`}
                </h2>
              </div>
              <SrLabel>En tiempo real</SrLabel>
            </div>
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              <AnimatePresence>
                {activeKitchenOrders.map((o) => (
                  <OrderProgressCard key={o.id} {...o} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Menu section divider */}
        <div className="flex items-end justify-between flex-wrap gap-5 mt-10 mb-6 pb-4 border-b border-[rgba(42,40,38,0.10)]">
          <div>
            <SrKicker className="block mb-1.5">Catálogo</SrKicker>
            <h2 className="font-serif italic font-medium text-[36px] text-servirest-midnight tracking-[-0.02em] m-0 leading-none">
              Menú
            </h2>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-[280px] max-w-full">
              <SrInput
                shape="pill"
                placeholder="Buscar platillo…"
                value={searchQuery}
                icon={<Search size={16} />}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="w-12 h-12 flex-shrink-0 rounded-full border border-[rgba(42,40,38,0.20)] bg-servirest-surface text-[rgba(42,40,38,0.6)] hover:border-servirest-terracota hover:text-servirest-terracota flex items-center justify-center transition-colors"
              aria-label="Filtros"
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
        </div>

        {/* Category tabs with counts */}
        <div className="mb-7">
          <SrTabs
            tabs={categoryTabs}
            active={activeCategory}
            onChange={setActiveCategory}
          />
        </div>

        {/* Food grid */}
        {filteredItems.length === 0 ? (
          <SrCard variant="solaris" className="p-10 my-6">
            <SrEmptyState
              icon={<ChefHat size={28} />}
              title={searchQuery ? 'Sin coincidencias' : 'Sin platillos en esta categoría'}
              description={searchQuery
                ? 'Prueba con otro término o cambia de categoría.'
                : 'Agrega platillos desde Menú para empezar a vender.'}
            />
          </SrCard>
        ) : (
          <div
            className="grid gap-x-5 gap-y-[22px] pb-40 lg:pb-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}
          >
            <AnimatePresence>
              {filteredItems.map((item) => (
                <DishCard
                  key={item.id}
                  item={item}
                  onClick={() => (item.variants && item.variants.length > 0 ? setVariantItem(item) : addToCart(item))}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* MOBILE CART TRIGGER */}
      <div className="lg:hidden fixed z-[90]" style={{ bottom: 100, right: 20 }}>
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          aria-label="Abrir orden actual"
          className="w-14 h-14 rounded-full bg-servirest-terracota text-servirest-hueso flex items-center justify-center shadow-sr-glow relative"
        >
          <ShoppingCart size={22} />
          {cartItemCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-servirest-hueso text-servirest-terracota w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] border-2 border-servirest-terracota">
              {cartItemCount}
            </span>
          )}
        </button>
      </div>

      {/* ORDER RAIL */}
      <div
        className={`
          ${isCartOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0
          fixed lg:relative inset-y-0 right-0 z-[60] lg:z-10
          w-full xs:w-[400px] sm:w-[420px] lg:w-[368px] flex-shrink-0
          bg-servirest-surface border-l border-[rgba(42,40,38,0.12)]
          flex flex-col transition-transform duration-300 ease-sr-solaris
          shadow-[-30px_0_60px_rgba(0,0,0,0.06)]
        `}
      >
        {/* Rail header */}
        <div className="px-7 pt-7 pb-4 border-b border-[rgba(42,40,38,0.08)]">
          <div className="flex items-start justify-between mb-4">
            <div>
              <SrKicker className="block mb-1">Tu orden</SrKicker>
              <h2 className="font-serif italic font-medium text-[28px] text-servirest-midnight tracking-[-0.02em] m-0 leading-none">
                Orden actual
              </h2>
            </div>
            <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                title="Vaciar orden"
                className="w-9 h-9 rounded-sr-md bg-[rgba(225,85,75,0.06)] text-servirest-danger/60 hover:text-servirest-danger flex items-center justify-center transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCartOpen(false)}
              aria-label="Cerrar"
              className="lg:hidden w-9 h-9 rounded-sr-md bg-[rgba(42,40,38,0.05)] text-[rgba(42,40,38,0.6)] flex items-center justify-center"
            >
              <X size={16} />
            </button>
          </div>
          </div>

          {/* Prominent table picker — full-width button so the waiter never
              forgets to assign before sending to kitchen */}
          <button
            type="button"
            onClick={() => setShowTableModal(true)}
            className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-sr-md border-2 transition-all ${selectedTable
              ? 'bg-[rgba(196,99,63,0.08)] border-servirest-terracota text-servirest-terracota hover:bg-[rgba(196,99,63,0.12)]'
              : 'bg-servirest-hueso-sunken border-dashed border-[rgba(42,40,38,0.20)] text-[rgba(42,40,38,0.6)] hover:border-servirest-terracota hover:text-servirest-terracota'}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-sr-sm flex items-center justify-center shrink-0 ${selectedTable ? 'bg-servirest-terracota text-servirest-hueso' : 'bg-[rgba(42,40,38,0.08)]'}`}>
                <TableIcon size={14} />
              </div>
              <div className="text-left min-w-0">
                <div className="font-black italic uppercase tracking-[0.16em] text-[9px] opacity-70">Mesa</div>
                <div className="font-serif italic font-medium text-[16px] leading-none mt-0.5 truncate">
                  {selectedTable ? selectedTable.name : 'Sin asignar'}
                </div>
              </div>
            </div>
            <ArrowRight size={14} className="shrink-0" />
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-7 py-3">
          {cart.length === 0 ? (
            <SrEmptyState
              icon={<ShoppingCart size={26} />}
              title="Sin platillos aún"
              description="Toca un platillo del menú para iniciar la orden."
            />
          ) : (
            <AnimatePresence mode="popLayout">
              {cart.map((it, idx) => (
                <motion.div
                  key={`${it.id}-${idx}`}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-start gap-3 py-3.5 border-b border-[rgba(42,40,38,0.06)] group last:border-0"
                >
                  <span className="w-9 h-9 flex-shrink-0 rounded-sr-md bg-[rgba(196,99,63,0.10)] text-servirest-terracota flex items-center justify-center font-black italic text-[13px]">
                    {it.quantity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-[13px] text-servirest-midnight tracking-tight leading-tight truncate">
                      {it.name}
                    </div>
                    <div className="text-[10px] text-[rgba(42,40,38,0.45)] font-bold mt-0.5 uppercase tracking-[0.1em]">
                      {(it.selectedVariants || []).length > 0
                        ? it.selectedVariants!.map((v) => v.name).join(' · ')
                        : 'Sin indicaciones'}
                    </div>
                    <input
                      type="text"
                      value={it.notes || ''}
                      placeholder="Nota para cocina…"
                      onChange={(e) =>
                        setCart((prev) => prev.map((p, i) => (i === idx ? { ...p, notes: e.target.value } : p)))
                      }
                      className="mt-2 w-full bg-servirest-hueso-sunken/60 border border-[rgba(42,40,38,0.08)] rounded-sr-sm px-2.5 py-1.5 text-[11px] font-medium italic text-[rgba(42,40,38,0.7)] placeholder:text-[rgba(42,40,38,0.25)] outline-none focus:border-servirest-terracota/50 transition-colors"
                    />
                    <div className="mt-2 flex justify-end gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, -1)}
                        className="w-7 h-7 rounded-sr-sm bg-servirest-hueso-sunken text-[rgba(42,40,38,0.6)] hover:bg-[rgba(42,40,38,0.10)] flex items-center justify-center transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateQuantity(idx, 1)}
                        className="w-7 h-7 rounded-sr-sm bg-servirest-hueso-sunken text-[rgba(42,40,38,0.6)] hover:bg-[rgba(42,40,38,0.10)] flex items-center justify-center transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCart((prev) => prev.filter((_, i) => i !== idx))}
                        className="w-7 h-7 rounded-sr-sm bg-[rgba(225,85,75,0.08)] text-servirest-danger/60 hover:text-servirest-danger flex items-center justify-center transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <SrMono className="text-[13px] text-servirest-midnight font-extrabold ml-1">
                    ${lineTotal(it).toFixed(0)}
                  </SrMono>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Rail footer */}
        <div className="px-7 py-5 border-t border-[rgba(42,40,38,0.08)] bg-servirest-hueso-sunken/60">
          {/* Source pills */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            {sourceOptions.map((src) => {
              const on = selectedSource === src.id;
              const Icon = src.icon;
              return (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => setSelectedSource(src.id)}
                  className={`py-3 rounded-sr-md border flex items-center justify-center gap-2 transition-all ${on ? 'bg-servirest-terracota text-servirest-hueso border-servirest-terracota shadow-sr-glow scale-[1.02]' : 'bg-servirest-surface border-[rgba(42,40,38,0.12)] text-[rgba(42,40,38,0.6)] hover:border-[rgba(42,40,38,0.20)]'}`}
                >
                  <Icon size={13} />
                  <span className="font-black uppercase tracking-[0.14em] text-[8px]">{src.label}</span>
                </button>
              );
            })}
          </div>

          {/* Totals */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-[12px]">
              <span className="text-[rgba(42,40,38,0.6)] font-medium">Subtotal</span>
              <SrMono className="text-servirest-carbon font-bold">${subtotal.toFixed(2)}</SrMono>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-[rgba(42,40,38,0.6)] font-medium">IVA (16 %)</span>
              <SrMono className="text-servirest-carbon font-bold">${tax.toFixed(2)}</SrMono>
            </div>
          </div>

          <div
            className="flex justify-between items-baseline pt-4 mb-5"
            style={{ borderTop: '1px dashed rgba(42,40,38,0.20)' }}
          >
            <SrLabel className="text-[10px]">Total</SrLabel>
            <span className="font-black italic text-[30px] text-servirest-midnight tracking-[-0.03em] leading-none">
              ${total.toFixed(2)}
            </span>
          </div>

          <SrButton
            variant="primary"
            size="lg"
            fullWidth
            iconRight={<ArrowRight size={18} />}
            disabled={cart.length === 0}
            onClick={handleSendOrder}
          >
            Enviar a cocina
          </SrButton>
        </div>
      </div>

      {/* Mobile backdrop */}
      {isCartOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50"
          style={{ background: 'rgba(10,12,20,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setIsCartOpen(false)}
        />
      )}

      {/* SUCCESS MODAL */}
      <AnimatePresence>
        {showSuccessModal && (
          <SrModal open onClose={() => setShowSuccessModal(false)} maxWidth={460} closeOnBackdrop={false}>
            <div className="flex flex-col items-center text-center py-6">
              <motion.div
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="w-[104px] h-[104px] rounded-full bg-servirest-terracota shadow-sr-glow flex items-center justify-center mb-8"
              >
                <Check size={52} className="text-servirest-hueso" />
              </motion.div>
              <h2 className="m-0 mb-3 font-serif italic font-medium text-[34px] text-servirest-midnight tracking-[-0.02em] leading-tight">
                Orden enviada
              </h2>
              <p className="m-0 font-black uppercase tracking-[0.3em] text-[10px] text-[rgba(42,40,38,0.4)]">
                Cocina la recibió
              </p>
            </div>
          </SrModal>
        )}
      </AnimatePresence>

      {/* VARIANTS MODAL */}
      <AnimatePresence>
        {variantItem && (
          <SrModal
            open
            onClose={() => { setVariantItem(null); setSelectedVariants([]); }}
            maxWidth={520}
          >
            <SrModalHeader
              title={variantItem.name}
              kicker="Elige las variantes"
              onClose={() => { setVariantItem(null); setSelectedVariants([]); }}
            />
            <div className="flex flex-col gap-2.5 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
              {variantItem.variants?.map((v, i) => {
                const on = selectedVariants.some((sv) => sv.name === v.name);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      setSelectedVariants((p) => (on ? p.filter((x) => x.name !== v.name) : [...p, v]))
                    }
                    className="flex justify-between items-center p-[18px] rounded-sr-lg transition-colors"
                    style={{
                      border: `2px solid ${on ? '#C4633F' : 'rgba(42,40,38,0.12)'}`,
                      background: on ? 'rgba(196,99,63,0.08)' : '#FFFFFF',
                    }}
                  >
                    <span className="flex items-center gap-3.5">
                      <span
                        className="w-[22px] h-[22px] rounded-full flex items-center justify-center"
                        style={{
                          border: `2px solid ${on ? '#C4633F' : 'rgba(42,40,38,0.20)'}`,
                          background: on ? '#C4633F' : 'transparent',
                        }}
                      >
                        {on && <Check size={12} className="text-servirest-hueso" />}
                      </span>
                      <span
                        className="font-extrabold text-[15px]"
                        style={{ color: on ? '#C4633F' : '#1A1E2E' }}
                      >
                        {v.name}
                      </span>
                    </span>
                    <SrMono
                      className="font-extrabold"
                      style={{ color: on ? 'rgba(196,99,63,0.8)' : 'rgba(42,40,38,0.4)' }}
                    >
                      {v.price ? `+$${v.price}` : 'Incluido'}
                    </SrMono>
                  </button>
                );
              })}
            </div>
            <div className="mt-7">
              <SrButton
                variant="primary"
                size="lg"
                fullWidth
                iconRight={<Plus size={18} />}
                onClick={() => addToCart(variantItem, selectedVariants)}
              >
                Agregar a la orden
              </SrButton>
            </div>
          </SrModal>
        )}
      </AnimatePresence>

      {/* TABLE MODAL */}
      <AnimatePresence>
        {showTableModal && (
          <SrModal open onClose={() => setShowTableModal(false)} maxWidth={760}>
            <SrModalHeader
              title="Mesas"
              kicker="Asigna una mesa a la orden"
              onClose={() => setShowTableModal(false)}
            />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[56vh] overflow-y-auto custom-scrollbar pr-1">
              {TABLES.map((table) => {
                const sel = selectedTable?.id === table.id;
                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => { setSelectedTable(table); setShowTableModal(false); }}
                    className={`p-[26px_18px] rounded-sr-2xl border-2 flex flex-col items-center gap-3.5 transition-all ${sel ? 'border-servirest-terracota bg-[rgba(196,99,63,0.08)] text-servirest-terracota shadow-sr-glow' : 'border-[rgba(42,40,38,0.12)] bg-servirest-surface text-[rgba(42,40,38,0.4)] hover:border-[rgba(42,40,38,0.20)] hover:text-servirest-carbon'}`}
                  >
                    <span
                      className={`w-[52px] h-[52px] rounded-[15px] flex items-center justify-center transition-colors ${sel ? 'bg-servirest-terracota text-servirest-hueso' : 'bg-[rgba(42,40,38,0.05)]'}`}
                    >
                      <TableIcon size={22} />
                    </span>
                    <span className="font-serif italic font-medium text-[20px] leading-none">{table.name}</span>
                    <span className="font-extrabold uppercase tracking-[0.18em] text-[8px] opacity-50">
                      {table.seats} personas
                    </span>
                  </button>
                );
              })}
            </div>
          </SrModal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default POSScreen;
