import React, { useState, useMemo } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { useUser } from '../contexts/UserContext';
import { OrderStatus, MenuItem } from '../types';
import { useTables } from '../contexts/TableContext';
import { useMenu } from '../contexts/MenuContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Trash2, Edit3, CheckCircle2, X, Search, Save, Lock,
  ArrowRight, Package, BellRing, ChefHat, Receipt, Minus, Plus,
} from 'lucide-react';
import {
  SrCard, SrButton, SrChip, SrInput, SrLabel, SrKicker, SrMono,
  SrModal, SrModalHeader, SrEmptyState, SrTabs, SrProgressRing,
} from '../components/ui/servirest';

type StatusGroup = 'todos' | 'preparando' | 'listos' | 'por_cobrar';

export const MyTablesScreen: React.FC = () => {
  const { orders, updateOrderStatus, removeOrder } = useOrders();
  const { activeEmployee } = useUser();
  const { tables: TABLES } = useTables();
  const { menuItems } = useMenu();
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [tempItems, setTempItems] = useState<any[]>([]);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusGroup>('todos');

  const myOrders = useMemo(() => {
    if (!activeEmployee) return [];
    return orders.filter((o) => o.waiterName === activeEmployee.name && o.status !== OrderStatus.COMPLETED);
  }, [orders, activeEmployee]);

  const groupedCounts = useMemo(() => ({
    todos: myOrders.length,
    preparando: myOrders.filter((o) => o.status === OrderStatus.COOKING || o.status === OrderStatus.PENDING).length,
    listos: myOrders.filter((o) => o.status === OrderStatus.READY).length,
    por_cobrar: myOrders.filter((o) => o.status === OrderStatus.BILL_REQUESTED).length,
  }), [myOrders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'todos') return myOrders;
    if (statusFilter === 'preparando') return myOrders.filter((o) => o.status === OrderStatus.COOKING || o.status === OrderStatus.PENDING);
    if (statusFilter === 'listos') return myOrders.filter((o) => o.status === OrderStatus.READY);
    if (statusFilter === 'por_cobrar') return myOrders.filter((o) => o.status === OrderStatus.BILL_REQUESTED);
    return myOrders;
  }, [myOrders, statusFilter]);

  const totalAccumulated = useMemo(
    () => myOrders.reduce((sum, o) => sum + (o.total || 0), 0),
    [myOrders]
  );

  const getElapsedMinutes = (timestamp: Date | string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    return Math.floor(diff / 60000);
  };

  const getOrderPrepPct = (order: any) => {
    if (!order.items || order.items.length === 0) return 0;
    const ready = order.items.filter((i: any) => i.status === 'READY' || i.status === 'SERVED').length;
    return Math.round((ready / order.items.length) * 100);
  };

  const handleOpenEdit = (order: any) => {
    setEditingOrder(order);
    setTempItems([...order.items]);
    setShowItemPicker(false);
    setPickerSearch('');
  };

  const finalizeSave = () => {
    if (!editingOrder) return;
    const newTotal = tempItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    let newStatus = editingOrder.status;
    let isKitchenReady = editingOrder.isKitchenReady;
    let isBarReady = editingOrder.isBarReady;

    const isDrink = (item: any) =>
      item.category?.toLowerCase().includes('bebida') ||
      item.category?.toLowerCase().includes('bar') ||
      item.category?.toLowerCase().includes('vino') ||
      item.category?.toLowerCase().includes('trago') ||
      item.category?.toLowerCase().includes('cerveza') ||
      item.category?.toLowerCase().includes('drink') ||
      item.category?.toLowerCase().includes('cocktail');

    const oldFoodCount = editingOrder.items.filter((i: any) => !isDrink(i)).reduce((a: number, x: any) => a + x.quantity, 0);
    const newFoodCount = tempItems.filter((i) => !isDrink(i)).reduce((a, x) => a + x.quantity, 0);
    const oldDrinkCount = editingOrder.items.filter((i: any) => isDrink(i)).reduce((a: number, x: any) => a + x.quantity, 0);
    const newDrinkCount = tempItems.filter((i) => isDrink(i)).reduce((a, x) => a + x.quantity, 0);

    if (newFoodCount > oldFoodCount) isKitchenReady = false;
    if (newDrinkCount > oldDrinkCount) isBarReady = false;
    if (!isKitchenReady || !isBarReady) newStatus = OrderStatus.COOKING;

    updateOrderStatus(editingOrder.id, newStatus, {
      ...editingOrder, items: tempItems, total: newTotal, isKitchenReady, isBarReady,
    });
    setEditingOrder(null);
    setPin('');
    setShowPinModal(false);
  };

  const handleCancelOrder = (id: string) => {
    if (window.confirm('¿Cancelar este pedido? Se elimina de mesas y caja.')) removeOrder(id);
  };

  const tableName = (id: string) => TABLES.find((t) => t.id === id)?.name || id;

  const STATUS_TABS = [
    { id: 'todos' as StatusGroup,      label: 'Todos',          count: groupedCounts.todos },
    { id: 'preparando' as StatusGroup, label: 'En preparación', count: groupedCounts.preparando },
    { id: 'listos' as StatusGroup,     label: 'Listos',         count: groupedCounts.listos },
    { id: 'por_cobrar' as StatusGroup, label: 'Por cobrar',     count: groupedCounts.por_cobrar },
  ] as const;

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-servirest-hueso text-servirest-carbon antialiased">
      <div className="px-[38px] py-10 max-w-[1480px] mx-auto pb-32 lg:pb-12">
        {/* ─── HEADER ────────────────────────────────────────────────── */}
        <div className="flex justify-between items-start flex-wrap gap-6 mb-12">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <SrKicker className="block mb-2">Tu turno</SrKicker>
            <h1 className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0">
              Mesas activas
            </h1>
            <p className="text-[14px] text-[rgba(42,40,38,0.6)] font-medium mt-2 max-w-[480px] leading-relaxed">
              {activeEmployee?.name ? `${activeEmployee.name} — ` : ''}aquí están los pedidos que tienes en piso ahora mismo.
            </p>
          </motion.div>

          {/* Mini-stats rail */}
          <div className="flex gap-3 flex-wrap">
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Activos</SrLabel>
              <div className="font-black italic text-[32px] text-servirest-midnight tracking-[-0.03em] leading-none">
                {myOrders.length}
              </div>
            </SrCard>
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Por cobrar</SrLabel>
              <div className="font-black italic text-[32px] text-servirest-terracota tracking-[-0.03em] leading-none">
                {groupedCounts.por_cobrar}
              </div>
            </SrCard>
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Acumulado</SrLabel>
              <SrMono className="text-[20px] text-servirest-midnight font-extrabold tracking-tight">
                ${totalAccumulated.toFixed(0)}
              </SrMono>
            </SrCard>
          </div>
        </div>

        {/* ─── STATUS FILTER TABS ───────────────────────────────────── */}
        <div className="mb-8">
          <SrTabs<StatusGroup> tabs={STATUS_TABS} active={statusFilter} onChange={setStatusFilter} />
        </div>

        {/* ─── ORDER CARDS GRID ─────────────────────────────────────── */}
        {filteredOrders.length === 0 ? (
          <SrCard variant="solaris" className="p-12">
            <SrEmptyState
              icon={<Package size={28} />}
              title={statusFilter === 'todos' ? 'Sin pedidos por ahora' : 'Sin pedidos en este filtro'}
              description={
                statusFilter === 'todos'
                  ? 'Cuando la host te asigne mesa o tomes un pedido nuevo, aparecerá aquí.'
                  : 'Cambia de filtro para ver el resto de tus mesas.'
              }
            />
          </SrCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <AnimatePresence mode="popLayout">
              {filteredOrders.map((order, idx) => {
                const isRequested = order.status === OrderStatus.BILL_REQUESTED;
                const isReady = order.status === OrderStatus.READY;
                const isCooking = order.status === OrderStatus.COOKING || order.status === OrderStatus.PENDING;
                const elapsed = getElapsedMinutes(order.timestamp);
                const isLate = elapsed > 25 && (isCooking || isReady);
                const pct = getOrderPrepPct(order);

                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.3, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <SrCard
                      hover
                      className={`overflow-hidden relative ${isRequested ? 'border-2 border-servirest-terracota/60 shadow-sr-glow' : isReady ? 'border-2 border-servirest-success/40' : ''}`}
                    >
                      {/* Status banner — small ribbon at top */}
                      {isRequested && (
                        <div className="px-5 py-2 bg-servirest-terracota text-servirest-hueso flex items-center gap-2">
                          <Receipt size={12} />
                          <span className="font-black italic uppercase tracking-[0.2em] text-[9px]">Por cobrar</span>
                        </div>
                      )}
                      {isReady && !isRequested && (
                        <div className="px-5 py-2 bg-servirest-success text-servirest-hueso flex items-center gap-2">
                          <BellRing size={12} />
                          <span className="font-black italic uppercase tracking-[0.2em] text-[9px]">Lista para servir</span>
                        </div>
                      )}
                      {isLate && !isRequested && !isReady && (
                        <div className="px-5 py-2 bg-servirest-mostaza text-servirest-midnight flex items-center gap-2">
                          <Clock size={12} />
                          <span className="font-black italic uppercase tracking-[0.2em] text-[9px]">Tarda {elapsed} min — verifica</span>
                        </div>
                      )}

                      {/* Card head: table + customer + elapsed */}
                      <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <SrLabel className="block mb-1.5">Mesa</SrLabel>
                          <div className="font-serif italic font-medium text-[26px] text-servirest-midnight tracking-[-0.02em] leading-none mb-1 truncate">
                            {tableName(order.tableId)}
                          </div>
                          <SrMono className="text-[11px] text-[rgba(42,40,38,0.5)]">
                            #{(order.id || '').slice(0, 8).toUpperCase()}
                          </SrMono>
                        </div>
                        <div className="text-right shrink-0">
                          {isCooking && pct > 0 ? (
                            <SrProgressRing pct={pct} size={48} stroke={4} />
                          ) : (
                            <SrChip tone={isReady ? 'success' : isRequested ? 'terracota' : 'neutral'}>
                              <Clock size={10} className="mr-1.5" />
                              {elapsed}m
                            </SrChip>
                          )}
                        </div>
                      </div>

                      {/* Items list — compact */}
                      <div className="px-6 pb-4 max-h-[180px] overflow-y-auto custom-scrollbar">
                        <div className="space-y-1">
                          {order.items.map((item: any, i: number) => (
                            <div
                              key={i}
                              className="flex justify-between items-center text-[12px] py-1.5 border-b border-[rgba(42,40,38,0.06)] last:border-0"
                            >
                              <span className="flex-1 truncate font-medium text-servirest-carbon mr-2">
                                <span className="font-mono font-bold text-servirest-terracota mr-2">{item.quantity}×</span>
                                {item.name}
                              </span>
                              <SrMono className="text-[11px] text-[rgba(42,40,38,0.6)] shrink-0">
                                ${(item.price * item.quantity).toFixed(0)}
                              </SrMono>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Total */}
                      <div className="px-6 py-4 border-t border-[rgba(42,40,38,0.08)] bg-servirest-hueso-sunken/40 flex items-baseline justify-between">
                        <SrLabel>Total</SrLabel>
                        <div className="font-black italic text-[28px] text-servirest-midnight tracking-[-0.03em] leading-none">
                          ${order.total.toFixed(0)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="px-6 py-4 flex gap-2.5 border-t border-[rgba(42,40,38,0.08)]">
                        {!isRequested ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCancelOrder(order.id)}
                              title="Cancelar pedido"
                              className="w-11 h-11 rounded-sr-md bg-[rgba(225,85,75,0.06)] text-servirest-danger/60 hover:text-servirest-danger hover:bg-[rgba(225,85,75,0.10)] flex items-center justify-center transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(order)}
                              title="Modificar pedido"
                              className="w-11 h-11 rounded-sr-md bg-[rgba(42,40,38,0.05)] text-[rgba(42,40,38,0.6)] hover:text-servirest-terracota hover:bg-[rgba(196,99,63,0.08)] flex items-center justify-center transition-colors"
                            >
                              <Edit3 size={14} />
                            </button>
                            <SrButton
                              variant={isReady ? 'primary' : 'midnight'}
                              size="sm"
                              className="flex-1"
                              iconRight={<ArrowRight size={12} />}
                              onClick={() => updateOrderStatus(order.id, OrderStatus.BILL_REQUESTED)}
                            >
                              Cobrar cuenta
                            </SrButton>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCancelOrder(order.id)}
                              title="Cancelar pedido"
                              className="w-11 h-11 rounded-sr-md bg-[rgba(225,85,75,0.06)] text-servirest-danger/60 hover:text-servirest-danger hover:bg-[rgba(225,85,75,0.10)] flex items-center justify-center transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                            <div className="flex-1 py-3 rounded-sr-md bg-[rgba(196,99,63,0.08)] border border-servirest-terracota/30 text-servirest-terracota font-black italic uppercase tracking-[0.18em] text-[9px] flex items-center justify-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-servirest-terracota animate-pulse" />
                              Esperando caja
                            </div>
                          </>
                        )}
                      </div>
                    </SrCard>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ─── MODIFY ORDER MODAL ───────────────────────────────────── */}
      <AnimatePresence>
        {editingOrder && (
          <SrModal open onClose={() => setEditingOrder(null)} maxWidth={960}>
            <SrModalHeader
              title="Modificar pedido"
              kicker={`Mesa ${tableName(editingOrder.tableId)} · ${editingOrder.items.length} platillos`}
              onClose={() => setEditingOrder(null)}
            />

            <div className="flex flex-col lg:flex-row gap-6 max-h-[70vh]">
              {/* LEFT — items list */}
              <div className="flex-1 flex flex-col min-w-0 min-h-0">
                <div className="flex items-center justify-between mb-4">
                  <SrLabel>Pedido actual ({tempItems.length} líneas)</SrLabel>
                  <SrButton
                    variant={showItemPicker ? 'outline' : 'primary'}
                    size="sm"
                    icon={showItemPicker ? <X size={12} /> : <Plus size={12} />}
                    onClick={() => { setShowItemPicker((v) => !v); setPickerSearch(''); }}
                  >
                    {showItemPicker ? 'Cerrar' : 'Agregar platillo'}
                  </SrButton>
                </div>

                {showItemPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-4 bg-servirest-hueso-sunken/40 rounded-sr-lg border border-[rgba(42,40,38,0.08)]"
                  >
                    <div className="mb-3">
                      <SrInput
                        shape="pill"
                        placeholder="Buscar platillo…"
                        icon={<Search size={14} />}
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                      {menuItems
                        .filter((i) => i.name.toLowerCase().includes(pickerSearch.toLowerCase()))
                        .slice(0, 12)
                        .map((item: MenuItem) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              const existing = tempItems.find((ti) => ti.id === item.id);
                              if (existing) {
                                setTempItems(tempItems.map((ti) => ti.id === item.id ? { ...ti, quantity: ti.quantity + 1 } : ti));
                              } else {
                                setTempItems([...tempItems, { ...item, quantity: 1 }]);
                              }
                              setShowItemPicker(false);
                              setPickerSearch('');
                            }}
                            className="text-left p-3 bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-sr-md hover:border-servirest-terracota/40 hover:bg-[rgba(196,99,63,0.04)] transition-colors"
                          >
                            <div className="font-extrabold text-[12px] text-servirest-midnight tracking-tight truncate">{item.name}</div>
                            <SrMono className="text-[10px] text-servirest-terracota">${item.price.toFixed(0)}</SrMono>
                          </button>
                        ))}
                    </div>
                  </motion.div>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                  {tempItems.length === 0 ? (
                    <SrEmptyState
                      icon={<Package size={24} />}
                      title="Sin platillos en el pedido"
                      description="Toca Agregar platillo para empezar."
                    />
                  ) : (
                    tempItems.map((item, idx) => (
                      <SrCard key={`${item.id}-${idx}`} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-[13px] text-servirest-midnight tracking-tight truncate">{item.name}</div>
                          <SrMono className="text-[10px] text-[rgba(42,40,38,0.6)]">
                            ${item.price.toFixed(0)} × {item.quantity} = ${(item.price * item.quantity).toFixed(0)}
                          </SrMono>
                        </div>
                        <div className="flex items-center gap-1 bg-servirest-hueso-sunken/60 rounded-sr-md p-1">
                          <button
                            type="button"
                            onClick={() => {
                              const n = [...tempItems];
                              n[idx].quantity = Math.max(0, n[idx].quantity - 1);
                              if (n[idx].quantity === 0) n.splice(idx, 1);
                              setTempItems(n);
                            }}
                            className="w-8 h-8 rounded-sr-sm hover:bg-[rgba(225,85,75,0.10)] text-[rgba(42,40,38,0.6)] hover:text-servirest-danger flex items-center justify-center transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="min-w-[24px] text-center font-black italic text-[14px] text-servirest-midnight">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const n = [...tempItems];
                              n[idx].quantity += 1;
                              setTempItems(n);
                            }}
                            className="w-8 h-8 rounded-sr-sm hover:bg-[rgba(34,160,107,0.10)] text-[rgba(42,40,38,0.6)] hover:text-servirest-success flex items-center justify-center transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </SrCard>
                    ))
                  )}
                </div>
              </div>

              {/* RIGHT — summary */}
              <div className="lg:w-[280px] shrink-0 flex flex-col gap-4">
                <SrCard variant="solaris" className="p-6">
                  <SrKicker className="block mb-1.5">Resumen</SrKicker>
                  <SrLabel className="block mb-3">Nuevo total</SrLabel>
                  <div className="font-black italic text-[48px] text-servirest-midnight tracking-[-0.03em] leading-none mb-1">
                    ${tempItems.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(0)}
                  </div>
                  <SrMono className="text-[10px] text-[rgba(42,40,38,0.4)]">MXN</SrMono>
                </SrCard>

                <SrCard className="p-5 space-y-3">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[rgba(42,40,38,0.6)] font-medium">Platillos</span>
                    <SrMono className="text-servirest-midnight">{tempItems.reduce((a, i) => a + i.quantity, 0)}</SrMono>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[rgba(42,40,38,0.6)] font-medium">Líneas</span>
                    <SrMono className="text-servirest-midnight">{tempItems.length}</SrMono>
                  </div>
                  <div className="flex justify-between text-[12px] pt-3 border-t border-[rgba(42,40,38,0.08)]">
                    <SrLabel className="text-servirest-terracota">Total exacto</SrLabel>
                    <SrMono className="text-servirest-terracota font-extrabold">
                      ${tempItems.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}
                    </SrMono>
                  </div>
                </SrCard>

                <SrButton
                  variant="primary"
                  size="lg"
                  fullWidth
                  iconRight={<Save size={16} />}
                  onClick={() => {
                    const isReduce =
                      tempItems.length < editingOrder.items.length ||
                      tempItems.some((it: any) => {
                        const o = editingOrder.items.find((oi: any) => oi.name === it.name);
                        return o && it.quantity < (o.quantity || 1);
                      });
                    if (isReduce) setShowPinModal(true);
                    else finalizeSave();
                  }}
                >
                  Guardar cambios
                </SrButton>
              </div>
            </div>
          </SrModal>
        )}
      </AnimatePresence>

      {/* ─── PIN CONFIRMATION MODAL ───────────────────────────────── */}
      <AnimatePresence>
        {showPinModal && (
          <SrModal open onClose={() => { setShowPinModal(false); setPin(''); }} maxWidth={420}>
            <div className="text-center py-2">
              <div className="w-16 h-16 rounded-full bg-[rgba(196,99,63,0.10)] text-servirest-terracota flex items-center justify-center mx-auto mb-6 border border-servirest-terracota/30">
                <Lock size={28} />
              </div>
              <h3 className="font-serif italic font-medium text-[28px] text-servirest-midnight tracking-[-0.02em] m-0 mb-2 leading-tight">
                PIN del manager
              </h3>
              <p className="text-[13px] text-[rgba(42,40,38,0.6)] font-medium leading-relaxed m-0 mb-8 max-w-[280px] mx-auto">
                Reducir o quitar platillos requiere autorización. Pide el PIN al encargado.
              </p>

              <div className="flex justify-center gap-3 mb-8">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 ${pin.length > i ? 'bg-servirest-terracota border-servirest-terracota scale-110' : 'bg-transparent border-[rgba(42,40,38,0.20)]'}`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => pin.length < 4 && setPin(pin + n)}
                    className="h-14 rounded-sr-lg bg-servirest-hueso-sunken text-servirest-midnight font-black italic text-[22px] hover:bg-servirest-surface hover:shadow-sr-card active:scale-95 transition-all border border-[rgba(42,40,38,0.08)]"
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setPin('')}
                  className="h-14 rounded-sr-lg text-[10px] font-black uppercase tracking-[0.16em] text-[rgba(42,40,38,0.6)] hover:text-servirest-danger transition-colors"
                >
                  Borrar
                </button>
                <button
                  type="button"
                  onClick={() => pin.length < 4 && setPin(pin + '0')}
                  className="h-14 rounded-sr-lg bg-servirest-hueso-sunken text-servirest-midnight font-black italic text-[22px] hover:bg-servirest-surface hover:shadow-sr-card active:scale-95 transition-all border border-[rgba(42,40,38,0.08)]"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pin === '0000') finalizeSave();
                    else { alert('PIN incorrecto'); setPin(''); }
                  }}
                  className="h-14 rounded-sr-lg bg-servirest-terracota text-servirest-hueso shadow-sr-glow flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                >
                  <CheckCircle2 size={22} />
                </button>
              </div>
            </div>
          </SrModal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyTablesScreen;
