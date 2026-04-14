import React, { useEffect, useState } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { Order, OrderStatus, OrderSource } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { GlowCard } from '../components/ui/spotlight-card';
import {
  ChefHat,
  Timer,
  CheckCircle2,
  Truck,
  Utensils,
  AlertTriangle,
  LayoutGrid,
  Columns2,
  Bell,
  Zap,
  Package,
  UtensilsCrossed
} from 'lucide-react';

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
    } catch (e) { console.error("Audio play failed", e); }
};

const OrderTimer: React.FC<{ timestamp: Date }> = ({ timestamp }) => {
    const [elapsed, setElapsed] = useState('');
    const [isLate, setIsLate] = useState(false);

    useEffect(() => {
        const updateTimer = () => {
            const diff = Date.now() - new Date(timestamp).getTime();
            const min = Math.floor(diff / 60000);
            const sec = Math.floor((diff % 60000) / 1000);
            setElapsed(`${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`);
            setIsLate(min >= 15);
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [timestamp]);

    return (
        <span className={`px-4 py-1.5 rounded-xl font-mono text-lg font-black italic tracking-tighter ${isLate ? 'bg-red-500 text-white shadow-lg animate-pulse' : 'bg-solaris-orange/10 text-solaris-orange border border-solaris-orange/20'}`}>
            {elapsed}
        </span>
    );
};

const Ticket: React.FC<{ order: Order; onComplete: (id: string) => void }> = ({ order, onComplete }) => {
    const isDineIn = !order.source || order.source === OrderSource.DINE_IN;

    return (
        <GlowCard glowColor="orange" className="!p-0 border border-white/5 bg-white/[0.01] flex flex-col min-w-[380px] max-w-[420px] overflow-hidden group">
            {/* Header */}
            <div className="p-6 bg-white/[0.03] border-b border-white/5 flex justify-between items-start gap-4">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        {isDineIn
                            ? <Utensils size={12} className="text-solaris-orange shrink-0" />
                            : <Truck size={12} className="text-green-400 shrink-0" />
                        }
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isDineIn ? 'text-solaris-orange/60' : 'text-green-400/70'}`}>
                            {isDineIn ? 'Comedor' : (order.source || 'Delivery')}
                        </span>
                    </div>
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-tight break-all">
                        {order.tableId.length > 15 ? `${order.tableId.slice(0, 12)}...` : order.tableId}
                    </h3>
                    <p className="text-[9px] font-black uppercase text-white/20 tracking-widest mt-1 italic">PKT: {order.id.slice(0, 8)}</p>
                </div>
                <div className="shrink-0 pt-1">
                    <OrderTimer timestamp={order.timestamp} />
                </div>
            </div>

            {/* Items */}
            <div className="p-5 flex-1 space-y-3">
                {order.items.map((item, idx) => (
                    <div key={idx} className="space-y-1">
                        <div className="flex items-center gap-3 bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                            <span className="w-8 h-8 rounded-xl bg-solaris-orange/10 border border-solaris-orange/20 flex items-center justify-center font-black italic text-solaris-orange text-sm shrink-0">
                                {item.quantity}
                            </span>
                            <span className="font-black italic text-white uppercase tracking-tight text-sm">{item.name}</span>
                        </div>
                        {item.notes && (
                            <div className="mx-1 p-2.5 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center gap-2">
                                <AlertTriangle size={12} className="text-red-500 shrink-0" />
                                <span className="text-[10px] font-black uppercase text-red-400 tracking-widest leading-relaxed">{item.notes}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Complete button — always visible and prominent */}
            <div className="p-5 border-t border-white/5">
                <button
                    onClick={() => onComplete(order.id)}
                    className="w-full py-5 bg-solaris-orange text-white font-black italic uppercase tracking-[0.2em] rounded-2xl shadow-solaris-glow hover:scale-[1.02] hover:bg-orange-500 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <CheckCircle2 size={20} /> Pedido Listo
                </button>
            </div>
        </GlowCard>
    );
};

// Empty column placeholder
const EmptyColumn: React.FC<{ label: string }> = ({ label }) => (
    <div className="flex-1 flex flex-col items-center justify-center opacity-10 border-2 border-dashed border-white/5 rounded-[32px] min-h-[300px]">
        <Package size={48} className="mb-4" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em]">{label}</p>
    </div>
);

export const KitchenScreen: React.FC = () => {
    const { orders, updateOrderStatus } = useOrders();
    const [prevCount, setPrevCount] = useState(0);
    const [isSplit, setIsSplit] = useState(false);
    const [alert, setAlert] = useState(false);

    const pending = orders.filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.COOKING);
    const sorted = [...pending].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Split by source
    const dineInOrders = sorted.filter(o => !o.source || o.source === OrderSource.DINE_IN);
    const deliveryOrders = sorted.filter(o => o.source && o.source !== OrderSource.DINE_IN);

    useEffect(() => {
        if (pending.length > prevCount && prevCount !== 0) {
            playBeep(); setAlert(true); setTimeout(() => setAlert(false), 4000);
        }
        setPrevCount(pending.length);
    }, [pending.length, prevCount]);

    const handleComplete = (id: string) => updateOrderStatus(id, OrderStatus.READY);

    return (
        <div className="h-full bg-solaris-black text-white flex flex-col overflow-hidden antialiased relative">
            {/* New Order Alert */}
            <AnimatePresence>
                {alert && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
                    >
                        <div className="p-16 rounded-[4rem] bg-solaris-orange text-white shadow-solaris-glow border-[10px] border-white/20 flex flex-col items-center">
                            <Bell size={80} className="mb-6 animate-bounce" />
                            <h2 className="text-6xl font-black italic uppercase tracking-tighter">New Asset Inbound</h2>
                            <p className="text-[12px] font-black uppercase tracking-[0.5em] mt-2 opacity-60">Synchronizing Kitchen Cluster</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 px-8 pt-8 pb-6 border-b border-white/5 shrink-0">
                <div>
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-1">Production Cluster</h1>
                    <p className="text-white/20 font-bold text-[10px] uppercase tracking-[0.4em]">Real-time Asset Manifest & Synthesis</p>
                </div>

                <div className="flex gap-4 items-center">
                    {/* View toggle */}
                    <div className="bg-white/[0.03] border border-white/5 p-1 rounded-2xl flex">
                        <button
                            onClick={() => setIsSplit(false)}
                            className={`px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${!isSplit ? 'bg-solaris-orange text-white shadow-solaris-glow' : 'text-white/30 hover:text-white'}`}
                        >
                            <LayoutGrid size={14} /> Global Stream
                        </button>
                        <button
                            onClick={() => setIsSplit(true)}
                            className={`px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${isSplit ? 'bg-solaris-orange text-white shadow-solaris-glow' : 'text-white/30 hover:text-white'}`}
                        >
                            <Columns2 size={14} /> Matrix View
                        </button>
                    </div>

                    {/* Counters */}
                    <div className="flex gap-3">
                        <div className="bg-white/[0.03] border border-white/5 px-5 py-3 rounded-2xl text-center">
                            <p className="text-[8px] font-black uppercase text-white/20 tracking-widest">Queue</p>
                            <p className="text-xl font-black italic text-solaris-orange leading-none">{pending.length}</p>
                        </div>
                        <div className="bg-white/[0.03] border border-white/5 px-5 py-3 rounded-2xl text-center">
                            <p className="text-[8px] font-black uppercase text-white/20 tracking-widest">Listos</p>
                            <p className="text-xl font-black italic text-green-400 leading-none">{orders.filter(o => o.status === OrderStatus.READY).length}</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main content */}
            {isSplit ? (
                /* ── MATRIX VIEW: Dine-In | Delivery ── */
                <div className="flex-1 flex gap-0 overflow-hidden">
                    {/* Left: Dine-In */}
                    <div className="flex-1 flex flex-col border-r border-white/5 overflow-hidden">
                        <div className="flex items-center gap-3 px-8 py-4 bg-white/[0.02] border-b border-white/5 shrink-0">
                            <Utensils size={16} className="text-solaris-orange" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-solaris-orange">Comedor — {dineInOrders.length} pedidos</span>
                        </div>
                        <div className="flex-1 overflow-x-auto overflow-y-auto no-scrollbar p-6">
                            {dineInOrders.length === 0 ? (
                                <EmptyColumn label="Comedor vacío" />
                            ) : (
                                <div className="flex gap-6 min-w-max">
                                    {dineInOrders.map(order => (
                                        <Ticket key={order.id} order={order} onComplete={handleComplete} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Delivery / To-Go */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex items-center gap-3 px-8 py-4 bg-white/[0.02] border-b border-white/5 shrink-0">
                            <Truck size={16} className="text-green-400" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-green-400">Delivery / Para llevar — {deliveryOrders.length} pedidos</span>
                        </div>
                        <div className="flex-1 overflow-x-auto overflow-y-auto no-scrollbar p-6">
                            {deliveryOrders.length === 0 ? (
                                <EmptyColumn label="Sin pedidos delivery" />
                            ) : (
                                <div className="flex gap-6 min-w-max">
                                    {deliveryOrders.map(order => (
                                        <Ticket key={order.id} order={order} onComplete={handleComplete} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* ── GLOBAL STREAM: All orders in a row ── */
                <main className="flex-1 overflow-x-auto no-scrollbar py-6 px-8">
                    {sorted.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-10 border-2 border-dashed border-white/5 rounded-[32px]">
                            <Package size={80} className="mb-6" />
                            <p className="text-[12px] font-black uppercase tracking-[0.4em]">Manifest Clean</p>
                        </div>
                    ) : (
                        <div className="flex gap-6 min-w-max h-full">
                            {sorted.map(order => (
                                <Ticket key={order.id} order={order} onComplete={handleComplete} />
                            ))}
                        </div>
                    )}
                </main>
            )}
        </div>
    );
};