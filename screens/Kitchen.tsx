import React, { useEffect, useState, useRef } from 'react';
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
  Package
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
    const getSourceIcon = (source?: OrderSource) => {
        switch (source) {
            case OrderSource.UBER_EATS: return { icon: Truck, color: 'text-green-500', label: 'UBER_SYS' };
            case OrderSource.RAPPI: return { icon: Zap, color: 'text-solaris-orange', label: 'RAPPI_GRID' };
            default: return { icon: Utensils, color: 'text-gray-500', label: 'LOCAL_NODE' };
        }
    };

    const config = getSourceIcon(order.source);

    return (
        <GlowCard glowColor="orange" className="!p-0 border border-white/5 bg-white/[0.01] flex flex-col min-w-[320px] max-w-[320px] overflow-hidden group">
            <div className="p-6 bg-white/[0.03] border-b border-white/5 flex justify-between items-start">
                <div>
                   <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">{order.tableId}</h3>
                   <p className="text-[8px] font-black uppercase text-gray-700 tracking-widest mt-1">PKT: {order.id.slice(0, 8)}</p>
                </div>
                <OrderTimer timestamp={order.timestamp} />
            </div>

            <div className="p-6 flex-1 space-y-4">
                {order.items.map((item, idx) => (
                    <div key={idx} className="space-y-2">
                        <div className="flex justify-between items-center bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-4">
                                <span className="w-8 h-8 rounded-xl bg-solaris-orange/10 border border-solaris-orange/20 flex items-center justify-center font-black italic text-solaris-orange">{item.quantity}</span>
                                <span className="font-black italic text-white uppercase tracking-tight text-sm">{item.name}</span>
                            </div>
                        </div>
                        {item.notes && (
                            <div className="mx-2 p-3 rounded-xl bg-red-500/5 border border-red-500/10 flex items-center gap-3">
                                <AlertTriangle size={14} className="text-red-500" />
                                <span className="text-[10px] font-black uppercase text-red-500/80 tracking-widest leading-relaxed">{item.notes}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="p-6 bg-white/[0.01]">
                <button 
                   onClick={() => onComplete(order.id)}
                   className="w-full py-5 bg-white/[0.03] border border-white/10 text-white font-black italic uppercase tracking-[0.2em] rounded-2xl hover:bg-solaris-orange hover:text-white hover:border-solaris-orange transition-all active:scale-95 flex items-center justify-center gap-4 shadow-xl"
                >
                    <CheckCircle2 size={18} /> Deploy Asset
                </button>
            </div>
        </GlowCard>
    );
};

export const KitchenScreen: React.FC = () => {
    const { orders, updateOrderStatus } = useOrders();
    const [prevCount, setPrevCount] = useState(0);
    const [isSplit, setIsSplit] = useState(false);
    const [alert, setAlert] = useState(false);

    const pending = orders.filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.COOKING);
    const sorted = [...pending].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    useEffect(() => {
        if (pending.length > prevCount && prevCount !== 0) {
            playBeep(); setAlert(true); setTimeout(() => setAlert(false), 4000);
        }
        setPrevCount(pending.length);
    }, [pending.length, prevCount]);

    return (
        <div className="h-full bg-solaris-black text-white p-6 md:p-10 flex flex-col overflow-hidden antialiased relative">
            {/* New Order Alert */}
            <AnimatePresence>
                {alert && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
                        <div className="p-16 rounded-[4rem] bg-solaris-orange text-white shadow-solaris-glow border-[10px] border-white/20 flex flex-col items-center">
                            <Bell size={80} className="mb-6 animate-bounce" />
                            <h2 className="text-6xl font-black italic uppercase tracking-tighter">New Asset Inbound</h2>
                            <p className="text-[12px] font-black uppercase tracking-[0.5em] mt-2 opacity-60">Synchronizing Kitchen Cluster</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-12">
                <div>
                   <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-2">Production Cluster</h1>
                   <p className="text-gray-600 font-bold text-[10px] uppercase tracking-[0.4em]">Real-time Asset Manifest & Synthesis</p>
                </div>

                <div className="flex gap-6 items-center">
                    <div className="bg-white/[0.03] border border-white/5 p-1 rounded-2xl flex">
                        <button onClick={() => setIsSplit(false)} className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${!isSplit ? 'bg-white/[0.05] text-solaris-orange border border-solaris-orange/20' : 'text-gray-600'}`}>
                            <LayoutGrid size={14} /> Global Stream
                        </button>
                        <button onClick={() => setIsSplit(true)} className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${isSplit ? 'bg-white/[0.05] text-solaris-orange border border-solaris-orange/20' : 'text-gray-600'}`}>
                            <Columns2 size={14} /> Matrix View
                        </button>
                    </div>

                    <div className="flex gap-4">
                         <div className="bg-white/[0.03] border border-white/5 px-6 py-3 rounded-2xl">
                             <p className="text-[8px] font-black uppercase text-gray-700 tracking-widest mb-1">Queue Depth</p>
                             <p className="text-xl font-black italic text-solaris-orange leading-none">{pending.length}</p>
                         </div>
                         <div className="bg-white/[0.03] border border-white/5 px-6 py-3 rounded-2xl">
                              <p className="text-[8px] font-black uppercase text-gray-700 tracking-widest mb-1">Shift Yield</p>
                              <p className="text-xl font-black italic text-green-500 leading-none">{orders.filter(o => o.status === OrderStatus.READY).length}</p>
                         </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-x-auto no-scrollbar py-4">
                <div className={`h-full flex gap-8 ${isSplit ? 'flex-wrap' : 'min-w-max px-4'}`}>
                    {sorted.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-20 border-2 border-dashed border-white/5 rounded-solaris">
                            <Package size={80} className="mb-6" />
                            <p className="text-[12px] font-black uppercase tracking-[0.4em]">Manifest Clean</p>
                        </div>
                    ) : (
                        sorted.map(order => (
                            <Ticket 
                                key={order.id} 
                                order={order} 
                                onComplete={(id) => updateOrderStatus(id, OrderStatus.READY)} 
                            />
                        ))
                    )}
                </div>
            </main>
        </div>
    );
};