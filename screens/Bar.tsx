import React, { useEffect, useState } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { Order, OrderStatus } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { GlowCard } from '../components/ui/spotlight-card';
import { Wine, Timer, CheckCircle2, AlertTriangle, Package, Bell } from 'lucide-react';

const playBeep = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.setValueAtTime(660, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start(); osc.stop(ctx.currentTime + 0.4);
    } catch (e) {}
};

const BarTimer: React.FC<{ timestamp: Date }> = ({ timestamp }) => {
    const [elapsed, setElapsed] = useState('');
    const [isLate, setIsLate] = useState(false);

    useEffect(() => {
        const update = () => {
            const diff = Date.now() - new Date(timestamp).getTime();
            const min = Math.floor(diff / 60000);
            const sec = Math.floor((diff % 60000) / 1000);
            setElapsed(`${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`);
            setIsLate(min >= 10);
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [timestamp]);

    return (
        <span className={`px-4 py-1.5 rounded-xl font-mono text-lg font-black italic tracking-tighter ${isLate ? 'bg-red-500 text-[#1a1c14] animate-pulse shadow-lg' : 'bg-servirest-mostaza/10 text-servirest-mostaza border border-servirest-mostaza/20'}`}>
            {elapsed}
        </span>
    );
};

const BarTicket: React.FC<{ order: Order; items: any[]; onComplete: (id: string) => void }> = ({ order, items, onComplete }) => {
    const isUUID = /^[0-9a-f]{8}-/i.test(order.tableId);
    const tableLabel = isUUID
        ? `Mesa #${order.id.slice(0, 6).toUpperCase()}`
        : order.tableId.length > 14
            ? `${order.tableId.slice(0, 12)}…`
            : order.tableId;

    return (
    <GlowCard glowColor="orange" className="!p-0 border border-[rgba(42,40,38,0.12)] bg-servirest-surface flex flex-col min-w-[320px] max-w-[360px] h-[550px] overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-servirest-surface border-b border-[rgba(42,40,38,0.12)] flex justify-between items-start gap-4">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <Wine size={12} className="text-servirest-mostaza shrink-0" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-servirest-mostaza/60">Bar Order</span>
                </div>
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-[#1a1c14] leading-tight">
                    {tableLabel}
                </h3>
                <p className="text-[9px] font-black uppercase text-[#2A2826]/30 tracking-widest mt-1 italic">
                    PKT: {order.id.slice(0, 8).toUpperCase()}
                </p>
            </div>
            <div className="shrink-0 pt-1">
                <BarTimer timestamp={order.timestamp} />
            </div>
        </div>

        {/* Items — scrollable area */}
        <div className="flex-1 p-4 space-y-2.5 overflow-y-auto no-scrollbar">
            {items.map((item, idx) => (
                <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-3 bg-servirest-surface p-3 rounded-2xl border border-[rgba(42,40,38,0.12)]">
                        <span className="w-8 h-8 rounded-xl bg-servirest-mostaza/10 border border-servirest-mostaza/20 flex items-center justify-center font-black italic text-servirest-mostaza text-sm shrink-0">
                            {item.quantity}
                        </span>
                        <span className="font-black italic text-[#1a1c14] uppercase tracking-tight text-sm">{item.name}</span>
                    </div>
                    {item.notes && (
                        <div className="mx-1 p-2.5 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center gap-2">
                            <AlertTriangle size={12} className="text-red-500 shrink-0" />
                            <span className="text-[10px] font-black uppercase text-red-400 tracking-widest">{item.notes}</span>
                        </div>
                    )}
                </div>
            ))}
        </div>

        {/* Complete button — locked at bottom */}
        <div className="p-4 border-t border-[rgba(42,40,38,0.12)] bg-servirest-surface">
            <button
                onClick={() => onComplete(order.id)}
                className="w-full py-4 bg-servirest-mostaza text-[#1a1c14] font-black italic uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-blue-500/20 hover:scale-[1.02] hover:bg-blue-400 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
                <Wine size={18} /> Bebidas Listas
            </button>
        </div>
    </GlowCard>
    );
};

export const BarScreen: React.FC = () => {
    const { orders, updateOrderStatus } = useOrders();
    const [prevCount, setPrevCount] = useState(0);
    const [alert, setAlert] = useState(false);

    const isDrink = (item: any) => 
        item.category?.toLowerCase().includes('bebida') ||
        item.category?.toLowerCase().includes('bar') ||
        item.category?.toLowerCase().includes('vino') ||
        item.category?.toLowerCase().includes('trago') ||
        item.category?.toLowerCase().includes('cerveza') ||
        item.category?.toLowerCase().includes('drink') ||
        item.category?.toLowerCase().includes('cocktail');

    const hasFood = (order: Order) => order.items.some(i => !isDrink(i));
    const hasDrinks = (order: Order) => order.items.some(i => isDrink(i));

    const pendingOrders = orders.filter(o =>
        !o.isBarReady &&
        hasDrinks(o) &&
        (o.status === OrderStatus.PENDING || o.status === OrderStatus.COOKING || o.status === OrderStatus.READY)
    );

    const barOrders = pendingOrders.map(order => {
        const drinkItems = order.items.filter(isDrink);
        return { order, items: drinkItems };
    });

    useEffect(() => {
        if (barOrders.length > prevCount && prevCount !== 0) {
            playBeep(); setAlert(true); setTimeout(() => setAlert(false), 4000);
        }
        setPrevCount(barOrders.length);
    }, [barOrders.length, prevCount]);

    const handleComplete = (id: string) => {
        const order = orders.find(o => o.id === id);
        if (!order) return;

        const isFullyReady = !hasFood(order) || order.isKitchenReady;
        
        updateOrderStatus(id, isFullyReady ? OrderStatus.READY : order.status, {
            ...order,
            isBarReady: true
        });
    };

    return (
        <div className="h-full bg-[#F0F0E8] text-[#1a1c14] flex flex-col overflow-hidden antialiased relative">
            {/* New Order Alert */}
            <AnimatePresence>
                {alert && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
                    >
                        <div className="p-16 rounded-[4rem] bg-servirest-mostaza text-[#1a1c14] shadow-2xl border-[10px] border-[rgba(42,40,38,0.20)] flex flex-col items-center">
                            <Bell size={80} className="mb-6 animate-bounce" />
                            <h2 className="text-6xl font-black italic uppercase tracking-tighter">Pedido de bar entrante</h2>
                            <p className="text-[12px] font-black uppercase tracking-[0.5em] mt-2 opacity-60">Nuevo pedido de bebidas</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 px-8 pt-8 pb-6 border-b border-[rgba(42,40,38,0.12)] shrink-0">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-servirest-mostaza/10 border border-servirest-mostaza/20 flex items-center justify-center">
                            <Wine size={20} className="text-servirest-mostaza" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Bar Station</h1>
                            <p className="text-[#2A2826]/30 font-bold text-[10px] uppercase tracking-[0.4em]">Drinks Dispatch Monitor</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="bg-servirest-surface border border-[rgba(42,40,38,0.12)] px-6 py-3 rounded-2xl text-center">
                        <p className="text-[8px] font-black uppercase text-[#2A2826]/30 tracking-widest">En Espera</p>
                        <p className="text-2xl font-black italic text-servirest-mostaza leading-none">{barOrders.length}</p>
                    </div>
                    <div className="bg-servirest-surface border border-[rgba(42,40,38,0.12)] px-6 py-3 rounded-2xl text-center">
                        <p className="text-[8px] font-black uppercase text-[#2A2826]/30 tracking-widest">Listos</p>
                        <p className="text-2xl font-black italic text-green-400 leading-none">
                            {orders.filter(o => o.status === OrderStatus.READY).length}
                        </p>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 overflow-x-auto no-scrollbar py-6 px-8">
                {barOrders.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-10 border-2 border-dashed border-[rgba(42,40,38,0.12)] rounded-[32px]">
                        <Wine size={80} className="mb-6" />
                        <p className="text-[12px] font-black uppercase tracking-[0.4em]">Bar Despejado</p>
                        <p className="text-[10px] font-black uppercase tracking-widest mt-2 opacity-60">No hay bebidas por preparar</p>
                    </div>
                ) : (
                    <div className="flex gap-6 min-w-max h-full">
                        {barOrders.map(({ order, items }) => (
                            <BarTicket
                                key={order.id}
                                order={order}
                                items={items}
                                onComplete={handleComplete}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};
