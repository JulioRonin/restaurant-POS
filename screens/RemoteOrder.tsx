import React, { useState, useMemo } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { useUser } from '../contexts/UserContext';
import { useSettings } from '../contexts/SettingsContext';
import { useMenu } from '../contexts/MenuContext';
import {
  MenuItem, OrderItem, Order, OrderStatus, OrderSource,
  PaymentMethod, PaymentStatus, Table,
} from '../types';
import { TABLES } from '../constants';
import { bluetoothTerminalService } from '../services/BluetoothTerminalService';
import { printerService } from '../services/PrinterService';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Smartphone, Table2, Plus, Minus, X,
  CreditCard, Wallet, ArrowRight, CheckCircle2, ShoppingCart, Copy,
  ShoppingBag, Package,
} from 'lucide-react';
import {
  SrCard, SrButton, SrChip, SrInput, SrLabel, SrKicker, SrMono,
  SrModal, SrModalHeader, SrEmptyState, SrTabs,
} from '../components/ui/servirest';

type RemoteMode = 'DRIVE_THRU' | 'COUNTER' | 'TO_GO';

const MODE_META: Record<RemoteMode, { label: string; source: OrderSource; icon: React.ReactNode; tableLabel: string }> = {
  DRIVE_THRU: { label: 'Drive-thru', source: OrderSource.DRIVE_THRU, icon: <Smartphone size={14} />, tableLabel: 'Drive-thru' },
  COUNTER:    { label: 'Mostrador',  source: OrderSource.DINE_IN,    icon: <Table2 size={14} />,    tableLabel: 'Mostrador' },
  TO_GO:      { label: 'Para llevar', source: OrderSource.TO_GO,     icon: <ShoppingBag size={14} />, tableLabel: 'Para llevar' },
};

export const RemoteOrderScreen: React.FC = () => {
  // ── Contexts (intact) ────────────────────────────────────────────────────
  const { currentUser } = useUser();
  const { addOrder, orders } = useOrders();
  const { settings } = useSettings();
  const { menuItems } = useMenu();

  // ── State ────────────────────────────────────────────────────────────────
  const [activeMode, setActiveMode] = useState<RemoteMode>('DRIVE_THRU');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [showTableModal, setShowTableModal] = useState(false);
  const [activeCategory, setActiveCategory] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [terminalStep, setTerminalStep] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastOrderTotal, setLastOrderTotal] = useState(0);

  // ── Derived ──────────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = Array.from(new Set(menuItems.map((i) => i.category).filter(Boolean)));
    return ['todos', ...cats];
  }, [menuItems]);

  const filteredItems = useMemo(
    () =>
      menuItems.filter((item) => {
        const matchesStatus = item.status === 'ACTIVE';
        const matchesCategory = activeCategory === 'todos' || item.category === activeCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesCategory && matchesSearch;
      }),
    [menuItems, activeCategory, searchQuery]
  );

  const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + i.price * i.quantity, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, i) => sum + i.quantity, 0), [cart]);

  // Shift stats — remote orders only
  const shiftStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const remoteOrders = orders.filter(
      (o) =>
        new Date(o.timestamp) >= today &&
        (o.source === OrderSource.DRIVE_THRU || o.source === OrderSource.TO_GO || o.source === OrderSource.PICKUP)
    );
    const total = remoteOrders.length;
    const avg = total === 0 ? 0 : remoteOrders.reduce((s, o) => s + (o.total || 0), 0) / total;
    const pending = orders.filter(
      (o) =>
        (o.source === OrderSource.DRIVE_THRU || o.source === OrderSource.TO_GO) &&
        (o.status === OrderStatus.PENDING || o.status === OrderStatus.COOKING)
    ).length;
    return { total, avg, pending };
  }, [orders]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { ...item, quantity: 1, notes: '' }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nq = Math.max(0, item.quantity + delta);
            return { ...item, quantity: nq };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const clearCart = () => setCart([]);

  const handlePayment = async (method: PaymentMethod) => {
    if (cart.length === 0) return;
    if (activeMode === 'COUNTER' && !selectedTable) {
      setShowTableModal(true);
      return;
    }
    const total = cartTotal;
    setLastOrderTotal(total);

    if (method === PaymentMethod.CARD && settings.isTerminalEnabled) {
      setIsProcessing(true);
      await bluetoothTerminalService.simulateTransaction(total, (step) => setTerminalStep(step));
      setIsProcessing(false);
    }

    const meta = MODE_META[activeMode];
    const newOrder: Order = {
      id: `REM-${Date.now().toString().slice(-6)}`,
      tableId: activeMode === 'COUNTER' ? (selectedTable?.name || meta.tableLabel) : meta.tableLabel,
      items: [...cart],
      status: OrderStatus.COMPLETED,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: method,
      timestamp: new Date(),
      total,
      source: meta.source,
      waiterName: currentUser?.name || 'Remoto',
    };

    addOrder(newOrder);
    if (printerService.isConnected() || (settings.connectedDeviceName && settings.connectedDeviceName !== 'None')) {
      await printerService.printOrder(newOrder, settings);
    }
    setCart([]);
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 3000);
  };

  const MODE_TABS = (Object.keys(MODE_META) as RemoteMode[]).map((m) => ({
    id: m,
    label: MODE_META[m].label,
  }));

  const CAT_TABS = categories.map((c) => ({
    id: c,
    label: c === 'todos' ? 'Todos' : c,
    count: c === 'todos'
      ? menuItems.filter((i) => i.status === 'ACTIVE').length
      : menuItems.filter((i) => i.status === 'ACTIVE' && i.category === c).length,
  }));

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-servirest-hueso text-servirest-carbon overflow-hidden antialiased">
      {/* ─── LEFT: Menu Browser ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-[rgba(42,40,38,0.12)] min-w-0">
        {/* HEADER */}
        <div className="px-[38px] pt-10 pb-6 shrink-0 border-b border-[rgba(42,40,38,0.08)]">
          <div className="flex justify-between items-start flex-wrap gap-6 mb-7">
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <SrKicker className="block mb-2">Drive-thru y mostrador</SrKicker>
              <h1 className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0">
                Orden rápida
              </h1>
              <p className="text-[14px] text-[rgba(42,40,38,0.6)] font-medium mt-2 max-w-[480px] leading-relaxed">
                Para cuando el cliente espera. Arma la cuenta, cobra y manda a cocina sin trámites.
              </p>
            </motion.div>

            {/* Mini-stats rail */}
            <div className="flex gap-3 flex-wrap">
              <SrCard className="px-5 py-4">
                <SrLabel className="block mb-1.5">Órdenes del turno</SrLabel>
                <div className="font-black italic text-[32px] text-servirest-midnight tracking-[-0.03em] leading-none">
                  {shiftStats.total}
                </div>
              </SrCard>
              <SrCard className="px-5 py-4">
                <SrLabel className="block mb-1.5">Ticket promedio</SrLabel>
                <SrMono className="text-[24px] text-servirest-terracota font-extrabold tracking-tight">
                  ${shiftStats.avg.toFixed(0)}
                </SrMono>
              </SrCard>
              <SrCard className="px-5 py-4">
                <SrLabel className="block mb-1.5">Pendientes</SrLabel>
                <div className="font-black italic text-[32px] text-servirest-mostaza tracking-[-0.03em] leading-none">
                  {shiftStats.pending}
                </div>
              </SrCard>
            </div>
          </div>

          {/* Mode + Search row */}
          <div className="flex gap-4 items-end flex-wrap">
            <div className="flex-1 min-w-[280px]">
              <SrTabs<RemoteMode>
                tabs={MODE_TABS as readonly { id: RemoteMode; label: string }[]}
                active={activeMode}
                onChange={(m) => {
                  setActiveMode(m);
                  if (m !== 'COUNTER') setSelectedTable(null);
                }}
              />
            </div>
            <div className="w-full md:w-[300px]">
              <SrInput
                shape="pill"
                placeholder="Buscar platillo…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search size={14} />}
              />
            </div>
          </div>

          {activeMode === 'COUNTER' && (
            <div className="mt-4 flex items-center gap-3">
              <SrLabel>Mesa asignada</SrLabel>
              {selectedTable ? (
                <SrChip tone="terracota">
                  <Table2 size={10} className="mr-1.5" />
                  {selectedTable.name}
                </SrChip>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTableModal(true)}
                  className="text-[12px] font-extrabold text-servirest-terracota hover:underline"
                >
                  Elegir mesa →
                </button>
              )}
            </div>
          )}
        </div>

        {/* CATEGORY TABS */}
        <div className="px-[38px] pt-4 shrink-0">
          <SrTabs<string> tabs={CAT_TABS} active={activeCategory} onChange={setActiveCategory} />
        </div>

        {/* PRODUCT GRID */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-[38px] py-6">
          {filteredItems.length === 0 ? (
            <SrCard variant="solaris" className="p-12">
              <SrEmptyState
                icon={<Package size={28} />}
                title="Sin platillos a la vista"
                description={
                  searchQuery
                    ? 'Nada coincide con esa búsqueda. Prueba con otra palabra.'
                    : 'No hay platillos activos en esta categoría. Revisa el menú.'
                }
              />
            </SrCard>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item, idx) => (
                <motion.button
                  key={item.id}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.02 }}
                  onClick={() => addToCart(item)}
                  className="text-left group focus:outline-none"
                >
                  <SrCard hover className="overflow-hidden p-3">
                    <div className="h-28 w-full mb-3 bg-servirest-hueso-sunken rounded-sr-lg overflow-hidden relative">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[rgba(42,40,38,0.2)]">
                          <Package size={28} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-servirest-terracota/0 group-hover:bg-servirest-terracota/15 transition-colors flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity w-10 h-10 rounded-full bg-servirest-terracota text-servirest-hueso flex items-center justify-center shadow-sr-glow">
                          <Plus size={18} />
                        </span>
                      </div>
                    </div>
                    <h3 className="font-extrabold text-[13px] text-servirest-midnight leading-tight mb-1 line-clamp-2 tracking-tight">
                      {item.name}
                    </h3>
                    <SrMono className="text-[14px] font-extrabold text-servirest-terracota">
                      ${item.price.toFixed(2)}
                    </SrMono>
                  </SrCard>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── RIGHT: Cart & Checkout ─────────────────────────────────── */}
      <div className="w-[420px] min-w-[340px] bg-servirest-hueso-sunken/30 flex flex-col shrink-0">
        <div className="px-7 pt-10 pb-5 shrink-0 border-b border-[rgba(42,40,38,0.08)]">
          <SrKicker className="block mb-2">
            {MODE_META[activeMode].label}
            {activeMode === 'COUNTER' && selectedTable ? ` · ${selectedTable.name}` : ''}
          </SrKicker>
          <h2 className="font-serif italic font-medium text-[34px] text-servirest-midnight tracking-[-0.02em] leading-none m-0">
            Cuenta
          </h2>
          <div className="mt-3 flex items-center gap-3">
            <SrChip tone="terracota">
              <ShoppingCart size={10} className="mr-1.5" />
              {cartCount} {cartCount === 1 ? 'platillo' : 'platillos'}
            </SrChip>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[rgba(42,40,38,0.5)] hover:text-servirest-danger transition-colors"
              >
                Vaciar
              </button>
            )}
          </div>
        </div>

        {/* CART ITEMS */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-2.5">
          {cart.length === 0 ? (
            <SrEmptyState
              icon={<ShoppingCart size={24} />}
              title="Cuenta en blanco"
              description="Toca un platillo del menú para empezar a armar la orden."
            />
          ) : (
            cart.map((item, idx) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, delay: idx * 0.02 }}
              >
                <SrCard className="p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-extrabold text-[13px] text-servirest-midnight leading-tight truncate tracking-tight">
                        {item.name}
                      </h4>
                      <SrMono className="text-[11px] text-[rgba(42,40,38,0.5)] mt-0.5 block">
                        ${item.price.toFixed(2)} c/u
                      </SrMono>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-7 h-7 rounded-sr-sm bg-servirest-hueso-sunken text-[rgba(42,40,38,0.6)] hover:text-servirest-danger hover:bg-[rgba(225,85,75,0.08)] transition-colors flex items-center justify-center"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="font-mono font-extrabold text-[14px] text-servirest-midnight w-5 text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-7 h-7 rounded-sr-sm bg-servirest-hueso-sunken text-[rgba(42,40,38,0.6)] hover:text-servirest-terracota hover:bg-[rgba(196,99,63,0.08)] transition-colors flex items-center justify-center"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <SrMono className="font-extrabold text-[13px] text-servirest-midnight w-16 text-right shrink-0">
                      ${(item.price * item.quantity).toFixed(2)}
                    </SrMono>
                  </div>
                </SrCard>
              </motion.div>
            ))
          )}
        </div>

        {/* TOTALS + PAYMENT */}
        <div className="p-5 border-t border-[rgba(42,40,38,0.12)] shrink-0 space-y-4 bg-servirest-surface">
          <div className="flex justify-between items-center">
            <SrLabel>Subtotal</SrLabel>
            <SrMono className="text-[13px] text-[rgba(42,40,38,0.6)] font-extrabold">
              ${cartTotal.toFixed(2)}
            </SrMono>
          </div>
          <div className="flex justify-between items-baseline pt-3 border-t border-[rgba(42,40,38,0.08)]">
            <span className="font-serif italic font-medium text-[18px] text-servirest-midnight tracking-[-0.02em]">
              Total
            </span>
            <div className="font-black italic text-[34px] text-servirest-terracota tracking-[-0.03em] leading-none">
              ${cartTotal.toFixed(2)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <SrButton
              variant="outline"
              size="md"
              icon={<CreditCard size={14} />}
              disabled={cart.length === 0 || isProcessing}
              onClick={() => handlePayment(PaymentMethod.CARD)}
            >
              Tarjeta
            </SrButton>
            <SrButton
              variant="outline"
              size="md"
              icon={<ArrowRight size={14} />}
              disabled={cart.length === 0 || isProcessing}
              onClick={() => setShowTransferModal(true)}
            >
              Transfer
            </SrButton>
          </div>

          <SrButton
            variant="primary"
            size="lg"
            fullWidth
            icon={<Wallet size={18} />}
            disabled={cart.length === 0 || isProcessing}
            onClick={() => handlePayment(PaymentMethod.CASH)}
          >
            Cobrar y enviar
          </SrButton>
        </div>
      </div>

      {/* ─── MODALS ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {/* TERMINAL PROCESSING */}
        {isProcessing && (
          <SrModal open onClose={() => {}} maxWidth={420} closeOnBackdrop={false}>
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-20 h-20 mb-7 relative">
                <div className="absolute inset-0 border-[3px] border-[rgba(196,99,63,0.18)] rounded-full" />
                <div className="absolute inset-0 border-[3px] border-servirest-terracota rounded-full border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <CreditCard size={28} className="text-servirest-terracota" />
                </div>
              </div>
              <h2 className="font-serif italic font-medium text-[28px] text-servirest-midnight tracking-[-0.02em] leading-tight m-0 mb-2">
                Procesando pago
              </h2>
              <p className="text-[12px] text-servirest-terracota font-black italic uppercase tracking-[0.2em] mb-5 animate-pulse">
                {terminalStep}
              </p>
              <SrLabel>No apagues la terminal</SrLabel>
            </div>
          </SrModal>
        )}

        {/* TRANSFER MODAL */}
        {showTransferModal && (
          <SrModal open onClose={() => setShowTransferModal(false)} maxWidth={460}>
            <SrModalHeader
              title="Transferencia"
              kicker="Comparte estos datos al cliente"
              onClose={() => setShowTransferModal(false)}
            />
            <SrCard className="p-7 mb-6 bg-servirest-hueso-sunken/40">
              <SrLabel className="block mb-2">Total a transferir</SrLabel>
              <div className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-none">
                ${cartTotal.toFixed(2)}
              </div>
            </SrCard>
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <SrLabel className="block mb-1.5">Banco</SrLabel>
                  <div className="font-extrabold text-[14px] text-servirest-midnight">{settings.bankName || '—'}</div>
                </div>
                <div>
                  <SrLabel className="block mb-1.5">Beneficiario</SrLabel>
                  <div className="font-extrabold text-[14px] text-servirest-midnight">{settings.bankBeneficiary || '—'}</div>
                </div>
              </div>
              <SrCard className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <SrLabel className="block mb-1.5">CLABE / Tarjeta</SrLabel>
                  <SrMono className="text-[16px] text-servirest-terracota font-extrabold tracking-wider truncate block">
                    {settings.bankCLABE || settings.bankAccount || '— —'}
                  </SrMono>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(settings.bankCLABE || settings.bankAccount || '')}
                  className="w-10 h-10 rounded-sr-md bg-[rgba(196,99,63,0.08)] border border-servirest-terracota/30 text-servirest-terracota hover:bg-[rgba(196,99,63,0.14)] transition-colors flex items-center justify-center shrink-0"
                  aria-label="Copiar"
                >
                  <Copy size={14} />
                </button>
              </SrCard>
            </div>
            <div className="flex gap-3">
              <SrButton variant="outline" size="md" fullWidth onClick={() => setShowTransferModal(false)}>
                Regresar
              </SrButton>
              <SrButton
                variant="primary"
                size="md"
                fullWidth
                onClick={() => {
                  handlePayment(PaymentMethod.TRANSFER);
                  setShowTransferModal(false);
                }}
              >
                Confirmar
              </SrButton>
            </div>
          </SrModal>
        )}

        {/* TABLE MODAL */}
        {showTableModal && (
          <SrModal open onClose={() => setShowTableModal(false)} maxWidth={720}>
            <SrModalHeader
              title="Elige una mesa"
              kicker="Para asignar la orden al mostrador"
              onClose={() => setShowTableModal(false)}
            />
            {TABLES.length === 0 ? (
              <SrEmptyState
                icon={<Table2 size={28} />}
                title="No hay mesas registradas"
                description="Crea mesas desde la pantalla del Salón para poder asignar órdenes desde mostrador."
              />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[56vh] overflow-y-auto custom-scrollbar pr-1">
                {TABLES.map((table) => {
                  const sel = selectedTable?.id === table.id;
                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => {
                        setSelectedTable(table);
                        setShowTableModal(false);
                      }}
                      className={`p-5 rounded-sr-xl border-2 flex flex-col items-center gap-2.5 transition-all ${
                        sel
                          ? 'border-servirest-terracota bg-[rgba(196,99,63,0.08)] text-servirest-terracota shadow-sr-glow'
                          : 'border-[rgba(42,40,38,0.12)] bg-servirest-surface text-[rgba(42,40,38,0.6)] hover:border-[rgba(42,40,38,0.24)] hover:text-servirest-carbon'
                      }`}
                    >
                      <span
                        className={`w-12 h-12 rounded-sr-md flex items-center justify-center ${
                          sel ? 'bg-servirest-terracota text-servirest-hueso' : 'bg-[rgba(42,40,38,0.05)]'
                        }`}
                      >
                        <Table2 size={22} />
                      </span>
                      <span className="font-serif italic font-medium text-[18px] leading-none">{table.name}</span>
                      <SrLabel>{table.seats} personas</SrLabel>
                    </button>
                  );
                })}
              </div>
            )}
          </SrModal>
        )}

        {/* SUCCESS MODAL */}
        {showSuccessModal && (
          <SrModal open onClose={() => setShowSuccessModal(false)} maxWidth={460} closeOnBackdrop={false}>
            <div className="flex flex-col items-center text-center py-6">
              <motion.div
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="w-[104px] h-[104px] rounded-full bg-servirest-terracota shadow-sr-glow flex items-center justify-center mb-7"
              >
                <CheckCircle2 size={52} className="text-servirest-hueso" />
              </motion.div>
              <h2 className="font-serif italic font-medium text-[34px] text-servirest-midnight tracking-[-0.02em] leading-tight m-0 mb-3">
                Cobro listo
              </h2>
              <SrMono className="text-[18px] text-servirest-terracota font-extrabold mb-1 block">
                ${lastOrderTotal.toFixed(2)}
              </SrMono>
              <SrLabel>{MODE_META[activeMode].label} · mandado a cocina</SrLabel>
            </div>
          </SrModal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RemoteOrderScreen;
