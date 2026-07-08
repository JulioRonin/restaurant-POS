import React, { useEffect, useState } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { Order, OrderStatus, OrderSource } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Utensils, Truck, AlertTriangle, Bell, Package,
  CheckCircle2, ChefHat,
} from 'lucide-react';
import {
  SrCard, SrButton, SrChip, SrLabel, SrKicker, SrEmptyState, SrTabs,
} from '../components/ui/servirest';

type KitchenView = 'todos' | 'comedor' | 'delivery';

/* -------------------------------------------------------------------------- */
/* Audio notification when new orders arrive                                   */
/* -------------------------------------------------------------------------- */
const playBeep = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
  } catch (e) { console.error('Audio play failed', e); }
};

/* -------------------------------------------------------------------------- */
/* OrderTimer — visible from 6ft away. Big mono digits, red+animate when late. */
/* -------------------------------------------------------------------------- */
const OrderTimer: React.FC<{ timestamp: Date }> = ({ timestamp }) => {
  const [elapsed, setElapsed] = useState({ min: 0, sec: 0 });
  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(timestamp).getTime();
      setElapsed({ min: Math.floor(diff / 60000), sec: Math.floor((diff % 60000) / 1000) });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  const total = elapsed.min;
  const tone =
    total >= 25 ? 'bg-servirest-danger text-servirest-hueso animate-pulse'
    : total >= 15 ? 'bg-servirest-mostaza text-servirest-midnight'
    : 'bg-[rgba(196,99,63,0.10)] text-servirest-terracota';
  const subtle = total >= 25 ? 'Tarde' : total >= 15 ? 'Apura' : 'A tiempo';

  return (
    <div className={`px-3 py-2 rounded-sr-md ${tone} flex flex-col items-center`}>
      <span className="font-mono font-extrabold text-[20px] leading-none tracking-tight">
        {String(elapsed.min).padStart(2, '0')}:{String(elapsed.sec).padStart(2, '0')}
      </span>
      <span className="text-[8px] font-black uppercase tracking-[0.2em] mt-1 opacity-80">{subtle}</span>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Ticket — single order card. Built for 6ft scanability.                       */
/* -------------------------------------------------------------------------- */
const Ticket: React.FC<{ order: Order; onComplete: (id: string) => void; onStart?: (id: string) => void }> = ({ order, onComplete, onStart }) => {
  const isDineIn = !order.source || order.source === OrderSource.DINE_IN;
  const isUUID = /^[0-9a-f]{8}-/i.test(order.tableId);
  const tableLabel = isUUID
    ? `#${order.id.slice(0, 6).toUpperCase()}`
    : order.tableId.length > 16
    ? `${order.tableId.slice(0, 14)}…`
    : order.tableId;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="w-[340px] flex-shrink-0"
    >
      <SrCard variant="solaris" className="flex flex-col h-[560px] overflow-hidden">
        {/* Source banner — thin ribbon */}
        <div className={`px-4 py-2 flex items-center gap-2 ${isDineIn ? 'bg-servirest-midnight text-servirest-mostaza' : 'bg-servirest-success text-servirest-hueso'}`}>
          {isDineIn ? <Utensils size={12} /> : <Truck size={12} />}
          <span className="font-black italic uppercase tracking-[0.18em] text-[9px]">
            {isDineIn ? 'Comedor' : (order.source || 'Delivery')}
          </span>
        </div>

        {/* Hero row: table label + timer */}
        <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-[rgba(42,40,38,0.08)]">
          <div className="min-w-0 flex-1">
            <SrLabel className="block mb-1">Mesa</SrLabel>
            <div className="font-serif italic font-medium text-[34px] text-servirest-midnight tracking-[-0.02em] leading-none truncate">
              {tableLabel}
            </div>
            <div className="font-mono text-[10px] text-[rgba(42,40,38,0.4)] mt-1">
              #{(order.id || '').slice(0, 8).toUpperCase()}
            </div>
          </div>
          <OrderTimer timestamp={order.timestamp} />
        </div>

        {/* Items list — quantity badge LARGE for scanability */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {order.items.map((item, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center gap-3 p-3 bg-servirest-hueso-sunken/40 rounded-sr-md">
                <span className="w-10 h-10 rounded-sr-sm bg-servirest-terracota text-servirest-hueso flex items-center justify-center font-black italic text-[18px] shrink-0">
                  {item.quantity}
                </span>
                <span className="font-extrabold text-[14px] text-servirest-midnight tracking-tight leading-tight">
                  {item.name}
                </span>
              </div>
              {item.notes && (
                <div className="ml-2 px-3 py-2 rounded-sr-sm bg-[rgba(225,85,75,0.06)] border-l-2 border-servirest-danger flex items-start gap-2">
                  <AlertTriangle size={12} className="text-servirest-danger shrink-0 mt-0.5" />
                  <span className="text-[11px] font-bold text-servirest-danger leading-snug">{item.notes}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTAs — comenzar preparación + pedido listo */}
        <div className="p-3 border-t border-[rgba(42,40,38,0.08)] bg-servirest-hueso-sunken/30 space-y-2">
          {order.status === OrderStatus.PENDING && onStart && (
            <SrButton
              variant="outline"
              size="md"
              fullWidth
              icon={<ChefHat size={16} />}
              onClick={() => onStart(order.id)}
            >
              Comenzar preparación
            </SrButton>
          )}
          {order.status === OrderStatus.COOKING && (
            <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-servirest-terracota">
              <ChefHat size={12} /> En preparación
            </div>
          )}
          <SrButton
            variant="primary"
            size="lg"
            fullWidth
            icon={<CheckCircle2 size={18} />}
            onClick={() => onComplete(order.id)}
          >
            Pedido listo
          </SrButton>
        </div>
      </SrCard>
    </motion.div>
  );
};

/* -------------------------------------------------------------------------- */
/* KitchenScreen — editorial header + tabs + scrollable ticket row              */
/* -------------------------------------------------------------------------- */
export const KitchenScreen: React.FC = () => {
  const { orders, updateOrderStatus } = useOrders();
  const [prevCount, setPrevCount] = useState(0);
  const [alert, setAlert] = useState(false);
  const [view, setView] = useState<KitchenView>('todos');

  const isDrink = (item: any) =>
    item.category?.toLowerCase().includes('bebida') ||
    item.category?.toLowerCase().includes('bar') ||
    item.category?.toLowerCase().includes('vino') ||
    item.category?.toLowerCase().includes('trago') ||
    item.category?.toLowerCase().includes('cerveza') ||
    item.category?.toLowerCase().includes('drink') ||
    item.category?.toLowerCase().includes('cocktail');

  const hasFood = (order: Order) => order.items.some((i) => !isDrink(i));
  const hasDrinks = (order: Order) => order.items.some((i) => isDrink(i));

  const pending = orders.filter(
    (o) =>
      !o.isKitchenReady &&
      hasFood(o) &&
      (o.status === OrderStatus.PENDING || o.status === OrderStatus.COOKING || o.status === OrderStatus.READY)
  );
  const sorted = [...pending].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const dineInOrders = sorted.filter((o) => !o.source || o.source === OrderSource.DINE_IN);
  const deliveryOrders = sorted.filter((o) => o.source && o.source !== OrderSource.DINE_IN);

  const visibleOrders =
    view === 'comedor' ? dineInOrders : view === 'delivery' ? deliveryOrders : sorted;

  useEffect(() => {
    if (pending.length > prevCount && prevCount !== 0) {
      playBeep();
      setAlert(true);
      setTimeout(() => setAlert(false), 4000);
    }
    setPrevCount(pending.length);
  }, [pending.length, prevCount]);

  const handleComplete = (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    const isFullyReady = !hasDrinks(order) || order.isBarReady;
    updateOrderStatus(id, isFullyReady ? OrderStatus.READY : order.status, {
      ...order, isKitchenReady: true,
    });
  };

  // Marca la orden "en preparación" (COOKING). Se refleja en el roadmap del
  // cliente del canal digital (paso "En preparación").
  const handleStart = (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    updateOrderStatus(id, OrderStatus.COOKING, { ...order });
  };

  const readyCount = orders.filter((o) => o.status === OrderStatus.READY).length;

  const TABS = [
    { id: 'todos' as KitchenView,    label: 'Todos',    count: sorted.length },
    { id: 'comedor' as KitchenView,  label: 'Comedor',  count: dineInOrders.length },
    { id: 'delivery' as KitchenView, label: 'Delivery', count: deliveryOrders.length },
  ] as const;

  return (
    <div className="h-full w-full bg-servirest-hueso text-servirest-carbon flex flex-col overflow-hidden antialiased relative">
      {/* New-order overlay */}
      <AnimatePresence>
        {alert && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center"
          >
            <div className="p-14 rounded-sr-2xl bg-servirest-terracota text-servirest-hueso shadow-sr-glow border-[6px] border-servirest-mostaza/40 flex flex-col items-center">
              <Bell size={64} className="mb-5 animate-bounce" />
              <div className="font-serif italic font-medium text-[60px] tracking-[-0.02em] leading-none mb-2">
                Pedido nuevo
              </div>
              <SrLabel className="text-servirest-hueso/80 text-[11px]">Cocina sincronizada</SrLabel>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <div className="px-[38px] pt-10 pb-6 shrink-0">
        <div className="flex justify-between items-start flex-wrap gap-6 mb-7">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <SrKicker className="block mb-2">Estación de cocina</SrKicker>
            <h1 className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0">
              Cocina
            </h1>
            <p className="text-[14px] text-[rgba(42,40,38,0.6)] font-medium mt-2 max-w-[480px] leading-relaxed">
              Pedidos por preparar, en orden de llegada. El tiempo arriba a la derecha te avisa cuál apurar.
            </p>
          </motion.div>

          <div className="flex gap-3 flex-wrap">
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Por preparar</SrLabel>
              <div className="font-black italic text-[32px] text-servirest-terracota tracking-[-0.03em] leading-none">
                {sorted.length}
              </div>
            </SrCard>
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Listos</SrLabel>
              <div className="font-black italic text-[32px] text-servirest-success tracking-[-0.03em] leading-none">
                {readyCount}
              </div>
            </SrCard>
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Hora</SrLabel>
              <div className="font-mono font-bold text-[20px] text-servirest-midnight tracking-tight leading-none">
                {new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </div>
            </SrCard>
          </div>
        </div>

        <SrTabs<KitchenView> tabs={TABS} active={view} onChange={setView} />
      </div>

      {/* TICKET ROW (horizontal scroll) */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar px-[38px] pb-10">
        {visibleOrders.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <SrCard variant="solaris" className="p-12 max-w-md">
              <SrEmptyState
                icon={<ChefHat size={28} />}
                title="Cocina al día"
                description={
                  view === 'comedor' ? 'No hay pedidos del comedor por preparar. Buen ritmo.'
                  : view === 'delivery' ? 'No hay pedidos de delivery por ahora.'
                  : 'No hay pedidos por preparar. Listos para el siguiente.'
                }
              />
            </SrCard>
          </div>
        ) : (
          <div className="flex gap-5 min-w-max h-full pt-1">
            <AnimatePresence mode="popLayout">
              {visibleOrders.map((order) => (
                <Ticket key={order.id} order={order} onComplete={handleComplete} onStart={handleStart} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default KitchenScreen;
