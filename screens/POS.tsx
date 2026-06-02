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
  Search,
  Plus,
  Printer,
  ShoppingCart,
  X,
  Minus,
  ChefHat,
  Table as TableIcon,
  ShoppingBag,
  Truck,
  ArrowRight,
  CheckCircle2,
  Trash2,
  SlidersHorizontal,
  Cpu,
  Rocket,
  Check,
} from 'lucide-react';
import {
  SrCard,
  SrButton,
  SrChip,
  SrInput,
  SrLabel,
  SrKicker,
  SrProgressRing,
  SrModal,
  SrModalHeader,
  SrArrowBadge,
} from '../components/ui/servirest';

/* -------------------------------------------------------------------------- */
/* PromoBanner — dismissible promo row at the top of "Línea de Órdenes"        */
/* -------------------------------------------------------------------------- */
const PromoBanner: React.FC<{ onDismiss: () => void }> = ({ onDismiss }) => (
  <motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    className="relative flex items-center gap-5 p-[18px_22px] rounded-sr-xl bg-servirest-surface shadow-sr-card overflow-hidden mb-6"
    style={{ border: '1px solid rgba(196,99,63,0.45)' }}
  >
    <div className="w-14 h-14 flex-shrink-0 rounded-sr-lg bg-servirest-midnight text-servirest-mostaza flex items-center justify-center">
      <Cpu size={26} />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="m-0 mb-1 font-extrabold text-base text-servirest-midnight tracking-tight">
        No te pierdas la nueva versión de ServiRest
      </h3>
      <p className="m-0 text-xs font-medium text-[rgba(42,40,38,0.6)]">
        Activa las nuevas funciones que sumamos para tu restaurante.
      </p>
    </div>
    <SrButton
      variant="primary"
      size="sm"
      icon={<Rocket size={14} />}
      className="flex-shrink-0 !rounded-[14px] !px-[22px] !py-[13px]"
    >
      Actualizar
    </SrButton>
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Cerrar"
      className="absolute top-3 right-3 w-[26px] h-[26px] rounded-full border border-[rgba(42,40,38,0.12)] bg-servirest-surface text-[rgba(42,40,38,0.4)] hover:text-servirest-carbon flex items-center justify-center transition-colors"
    >
      <X size={14} />
    </button>
  </motion.div>
);

/* -------------------------------------------------------------------------- */
/* OrderProgressCard — one card per active kitchen order                       */
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
  <SrCard
    hover
    className="p-5 cursor-pointer"
    onClick={onClick}
    role={onClick ? 'button' : undefined}
  >
    <div className="flex items-center justify-between mb-2.5">
      <span className="font-mono font-semibold text-xs text-servirest-terracota">{id}</span>
      <SrChip tone="neutral" size="xs">{tableName}</SrChip>
    </div>
    <div className="font-extrabold text-lg text-servirest-midnight tracking-tight mb-[18px] truncate">
      {customer}
    </div>
    <div className="flex items-center gap-3 pt-4 border-t border-[rgba(42,40,38,0.12)]">
      <SrProgressRing pct={pct} />
      <span className="font-extrabold text-xs text-servirest-midnight flex-1">En preparación</span>
      <span className="inline-flex items-center gap-2 font-bold text-[11px] text-[rgba(42,40,38,0.6)]">
        {items} platillos
        <SrArrowBadge />
      </span>
    </div>
  </SrCard>
);

/* -------------------------------------------------------------------------- */
/* DishCard — image + name + price-terracota + sub                             */
/* -------------------------------------------------------------------------- */
type DishCardProps = {
  item: MenuItem;
  onClick: () => void;
};
const DishCard: React.FC<DishCardProps> = ({ item, onClick }) => {
  const available = item.status === 'ACTIVE';
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-transparent border-none text-left p-0 transition-transform duration-200 ease-sr-out hover:-translate-y-1 disabled:cursor-default group"
      style={{ opacity: available ? 1 : 0.6 }}
      disabled={!available}
    >
      <div className="relative h-[150px] rounded-sr-lg overflow-hidden shadow-sr-card">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.07]"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-servirest-hueso to-servirest-hueso-sunken flex items-center justify-center">
            <ChefHat size={36} className="text-[rgba(42,40,38,0.2)]" />
          </div>
        )}
        {!available && (
          <span className="absolute top-2.5 left-2.5 font-black text-[8px] uppercase tracking-[0.1em] text-servirest-hueso bg-[rgba(225,85,75,0.92)] px-2 py-1 rounded-md">
            Agotado
          </span>
        )}
        <span className="absolute bottom-2.5 right-2.5 w-[34px] h-[34px] rounded-full bg-servirest-terracota text-servirest-hueso flex items-center justify-center opacity-0 translate-y-1.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 shadow-sr-glow">
          <Plus size={17} />
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2.5 mt-3 mx-0.5">
        <span className="font-extrabold text-[15px] text-servirest-midnight tracking-tight truncate">
          {item.name}
        </span>
        <span className="font-extrabold text-sm text-servirest-terracota flex-shrink-0 font-mono">
          ${item.price.toFixed(2)}
        </span>
      </div>
      <div className="text-[11px] text-[rgba(42,40,38,0.6)] mt-0.5 mx-0.5 font-medium truncate">
        {item.category}{item.variants && item.variants.length > 0 ? ' · variantes' : ''}
      </div>
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/* POSScreen — Línea de Órdenes                                                */
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
  const [showPromo, setShowPromo] = useState(true);
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

  /* Active kitchen orders → progress cards. Show up to 4 cooking / pending. */
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
      {/* Hidden print root */}
      <div className="hidden print:block absolute inset-0 z-[9999] bg-white">
        {kitchenOrderToPrint && <KitchenTicket order={kitchenOrderToPrint} settings={settings} />}
      </div>

      {/* MAIN COLUMN — Línea de Órdenes */}
      <div className="flex-1 min-w-0 overflow-y-auto custom-scrollbar p-6 md:p-8 lg:p-[34px_32px_40px]">
        <h1 className="font-serif font-medium text-[32px] tracking-[-0.02em] text-servirest-midnight m-0 mb-[22px] leading-none">
          Línea de Órdenes
        </h1>

        <AnimatePresence>
          {showPromo && <PromoBanner onDismiss={() => setShowPromo(false)} />}
        </AnimatePresence>

        {/* Order progress cards */}
        {activeKitchenOrders.length > 0 && (
          <div className="grid gap-4 mb-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {activeKitchenOrders.map((o) => (
              <OrderProgressCard key={o.id} {...o} />
            ))}
          </div>
        )}

        {/* Menu section header */}
        <div className="flex items-center justify-between flex-wrap gap-5 mt-[34px] mb-[18px]">
          <h2 className="font-serif font-medium text-[32px] tracking-[-0.02em] text-servirest-midnight m-0 leading-none">
            Menú
          </h2>
          <div className="flex items-center gap-3">
            <div className="w-[320px] max-w-full">
              <SrInput
                shape="pill"
                placeholder="Buscar platillo..."
                value={searchQuery}
                icon={<Search size={16} />}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {settings.isDirectPrintingEnabled && (
              <button
                type="button"
                className={`w-12 h-12 flex-shrink-0 rounded-full border flex items-center justify-center transition-all ${printerReady ? 'border-servirest-success/40 text-servirest-success' : 'border-servirest-danger/40 text-servirest-danger animate-pulse'}`}
                title={printerReady ? 'Impresora activa' : 'Impresora desconectada'}
              >
                <Printer size={18} />
              </button>
            )}
            <button
              type="button"
              className="w-12 h-12 flex-shrink-0 rounded-full border border-[rgba(42,40,38,0.20)] bg-servirest-surface text-[rgba(42,40,38,0.6)] hover:border-servirest-terracota hover:text-servirest-terracota flex items-center justify-center transition-colors"
              aria-label="Filtros"
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-[26px] overflow-x-auto sr-no-scrollbar border-b border-[rgba(42,40,38,0.12)] mb-[22px]">
          <button
            type="button"
            onClick={() => setActiveCategory('All')}
            className={`flex-shrink-0 bg-transparent border-none px-0.5 pt-3 pb-4 font-bold text-sm whitespace-nowrap transition-colors relative ${activeCategory === 'All' ? 'text-servirest-terracota font-extrabold' : 'text-[rgba(42,40,38,0.6)] hover:text-servirest-carbon'}`}
          >
            Todos
            {activeCategory === 'All' && (
              <span className="absolute left-0 right-0 -bottom-[1px] h-[3px] bg-servirest-terracota rounded-t" />
            )}
          </button>
          {dynamicCategories.map((cat) => {
            const on = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 bg-transparent border-none px-0.5 pt-3 pb-4 font-bold text-sm whitespace-nowrap transition-colors relative ${on ? 'text-servirest-terracota font-extrabold' : 'text-[rgba(42,40,38,0.6)] hover:text-servirest-carbon'}`}
              >
                {cat}
                {on && (
                  <span className="absolute left-0 right-0 -bottom-[1px] h-[3px] bg-servirest-terracota rounded-t" />
                )}
              </button>
            );
          })}
        </div>

        {/* Food grid */}
        <div
          className="grid gap-x-5 gap-y-[22px] pb-40 lg:pb-2"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}
        >
          {filteredItems.map((item) => (
            <DishCard
              key={item.id}
              item={item}
              onClick={() => (item.variants && item.variants.length > 0 ? setVariantItem(item) : addToCart(item))}
            />
          ))}
          {filteredItems.length === 0 && (
            <div className="col-span-full text-center py-20">
              <p className="sr-label">Sin platillos</p>
              <p className="font-bold text-[rgba(42,40,38,0.4)] mt-2">Ajusta tu búsqueda o categoría.</p>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE FLOATING CART TRIGGER */}
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

      {/* ORDER RAIL — current order */}
      <div
        className={`
          ${isCartOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0
          fixed lg:relative inset-y-0 right-0 z-[60] lg:z-10
          w-full xs:w-[400px] sm:w-[420px] lg:w-[348px] flex-shrink-0
          bg-servirest-surface border-l border-[rgba(42,40,38,0.12)]
          flex flex-col transition-transform duration-300 ease-sr-solaris
          shadow-[-30px_0_60px_rgba(0,0,0,0.06)]
        `}
      >
        <div className="px-[26px] pt-7 pb-[18px] flex items-start justify-between">
          <div>
            <h2 className="font-serif font-medium text-[26px] text-servirest-midnight tracking-[-0.02em] m-0 mb-1 leading-none">
              Orden Actual
            </h2>
            <div className="flex items-center gap-2.5 font-bold text-[11px] text-[rgba(42,40,38,0.6)]">
              <button
                type="button"
                onClick={() => setShowTableModal(true)}
                className={`font-black uppercase tracking-[0.16em] text-[10px] transition-colors ${selectedTable ? 'text-servirest-terracota' : 'text-[rgba(42,40,38,0.6)] hover:text-servirest-terracota'}`}
              >
                {selectedTable ? selectedTable.name : 'Asignar mesa'}
              </button>
              <span>·</span>
              <span>{activeEmployee?.name || 'Sistema'}</span>
            </div>
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

        <div className="flex-1 overflow-y-auto px-[26px] sr-no-scrollbar">
          {cart.length === 0 ? (
            <div className="text-center font-bold text-[11px] uppercase tracking-[0.16em] text-[rgba(42,40,38,0.4)] py-[50px] px-5 leading-relaxed">
              Agrega platillos del menú para iniciar la orden
            </div>
          ) : (
            cart.map((it, idx) => (
              <motion.div
                key={`${it.id}-${idx}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex items-start gap-3 py-3.5 border-b border-[rgba(42,40,38,0.12)] group"
              >
                <span className="w-[30px] h-[30px] flex-shrink-0 rounded-[9px] bg-[rgba(196,99,63,0.10)] text-servirest-terracota flex items-center justify-center font-black italic text-xs">
                  {it.quantity}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[13px] text-servirest-midnight leading-tight">
                    {it.name}
                  </div>
                  <div className="text-[10px] text-[rgba(42,40,38,0.4)] font-semibold mt-0.5">
                    {(it.selectedVariants || []).length > 0
                      ? it.selectedVariants!.map((v) => v.name).join(', ')
                      : 'Sin indicaciones'}
                  </div>
                  <input
                    type="text"
                    value={it.notes || ''}
                    placeholder="Nota para cocina…"
                    onChange={(e) =>
                      setCart((prev) => prev.map((p, i) => (i === idx ? { ...p, notes: e.target.value } : p)))
                    }
                    className="mt-2 w-full bg-[rgba(240,240,232,0.6)] border border-[rgba(42,40,38,0.12)] rounded-md px-2.5 py-1.5 text-[10px] font-medium italic text-[rgba(42,40,38,0.6)] placeholder:text-[rgba(42,40,38,0.2)] outline-none focus:border-servirest-terracota/40 transition-colors"
                  />
                  <div className="mt-2 flex justify-end gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => updateQuantity(idx, -1)}
                      className="w-7 h-7 rounded-md bg-[rgba(42,40,38,0.05)] text-[rgba(42,40,38,0.6)] hover:bg-[rgba(42,40,38,0.10)] flex items-center justify-center transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateQuantity(idx, 1)}
                      className="w-7 h-7 rounded-md bg-[rgba(42,40,38,0.05)] text-[rgba(42,40,38,0.6)] hover:bg-[rgba(42,40,38,0.10)] flex items-center justify-center transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCart((prev) => prev.filter((_, i) => i !== idx))}
                      className="w-7 h-7 rounded-md bg-[rgba(225,85,75,0.10)] text-servirest-danger/60 hover:text-servirest-danger flex items-center justify-center transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <span className="font-extrabold text-[13px] text-servirest-midnight font-mono ml-1">
                  ${lineTotal(it).toFixed(0)}
                </span>
              </motion.div>
            ))
          )}
        </div>

        <div className="px-[26px] py-[22px] border-t border-[rgba(42,40,38,0.12)] bg-servirest-hueso-sunken">
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
                  className={`py-3 rounded-sr-lg border flex items-center justify-center gap-2 transition-all ${on ? 'bg-servirest-terracota text-servirest-hueso border-servirest-terracota shadow-sr-glow scale-[1.02]' : 'bg-[rgba(42,40,38,0.03)] border-[rgba(42,40,38,0.12)] text-[rgba(42,40,38,0.6)] hover:bg-[rgba(42,40,38,0.05)]'}`}
                >
                  <Icon size={13} />
                  <span className="font-black uppercase tracking-[0.14em] text-[8px]">{src.label}</span>
                </button>
              );
            })}
          </div>

          {/* Totals */}
          <div className="flex justify-between text-xs mb-2.5">
            <span className="text-[rgba(42,40,38,0.6)] font-semibold">Subtotal</span>
            <span className="font-mono font-bold text-servirest-carbon">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs mb-3">
            <span className="text-[rgba(42,40,38,0.6)] font-semibold">IVA (16%)</span>
            <span className="font-mono font-bold text-servirest-carbon">${tax.toFixed(2)}</span>
          </div>
          <div
            className="flex justify-between items-baseline pt-3 mb-[18px]"
            style={{ borderTop: '1px dashed rgba(42,40,38,0.20)' }}
          >
            <span className="font-black uppercase tracking-[0.2em] text-[10px] text-[rgba(42,40,38,0.6)]">Total</span>
            <span className="font-black italic text-[28px] text-servirest-midnight tracking-[-0.03em]">
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
                <Check size={52} className="text-servirest-midnight" />
              </motion.div>
              <h2 className="m-0 mb-3.5 font-black italic uppercase tracking-[-0.02em] text-3xl text-servirest-midnight leading-[1.1]">
                ¡Pago procesado!
              </h2>
              <p className="m-0 font-black uppercase tracking-[0.3em] text-[10px] text-[rgba(42,40,38,0.4)]">
                Orden enviada a cocina
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
                    className="flex justify-between items-center p-[18px] rounded-[20px] transition-colors"
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
                    <span
                      className="font-extrabold"
                      style={{ color: on ? 'rgba(196,99,63,0.8)' : 'rgba(42,40,38,0.4)' }}
                    >
                      {v.price ? `+$${v.price}` : 'Incluido'}
                    </span>
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
                    <span className="font-black italic uppercase text-[20px] leading-none">{table.name}</span>
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
