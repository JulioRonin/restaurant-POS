import React, { useEffect, useState, useRef } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { Order, OrderStatus, OrderSource } from '../types';

// Simple beep sound as base64 to avoid external dependencies
// Shortened placeholder for demo purposes
const BEEP_SOUND = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU';

// Better approach: Web Audio API oscillator for a beep
const playBeep = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        gain.gain.setValueAtTime(0.1, ctx.currentTime);

        osc.start();
        osc.stop(ctx.currentTime + 0.5); // 0.5 seconds beep
    } catch (e) {
        console.error("Audio play failed", e);
    }
};

const OrderTimer: React.FC<{ timestamp: Date }> = ({ timestamp }) => {
    const [elapsed, setElapsed] = useState('');
    const [isLate, setIsLate] = useState(false);

    useEffect(() => {
        const updateTimer = () => {
            const now = new Date();
            const diff = now.getTime() - new Date(timestamp).getTime();

            const totalSeconds = Math.floor(diff / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;

            const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            setElapsed(formatted);
            setIsLate(minutes >= 15);
        };

        updateTimer(); // Initial
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [timestamp]);

    return (
        <span className={`px-3 py-1 rounded-lg font-mono font-bold text-lg ${isLate ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-green-100 text-green-600'}`}>
            {elapsed}
        </span>
    );
};

interface TicketProps {
    order: Order;
    onComplete: (id: string) => void;
}

const Ticket: React.FC<TicketProps> = ({ order, onComplete }) => {
    const startTime = new Date(order.timestamp).getTime();
    const isLateInitial = (Date.now() - startTime) > 15 * 60 * 1000;

    // Source Badge Logic
    const getSourceConfig = (source?: OrderSource) => {
        switch (source) {
            case OrderSource.UBER_EATS: return { color: 'bg-green-500', icon: 'directions_bike', label: 'Uber Eats' };
            case OrderSource.RAPPI: return { color: 'bg-orange-500', icon: 'delivery_dining', label: 'Rappi' };
            case OrderSource.PICKUP: return { color: 'bg-blue-500', icon: 'local_mall', label: 'Pickup' };
            default: return { color: 'bg-gray-100 text-gray-500', icon: 'restaurant', label: 'Dine-In' }; // Dine-in default
        }
    };

    const sourceConfig = getSourceConfig(order.source || OrderSource.DINE_IN);
    const isApp = order.source && order.source !== OrderSource.DINE_IN;

    return (
        <div className={`bg-white rounded-xl overflow-hidden border-l-4 shadow-soft min-w-[300px] flex flex-col animate-in slide-in-from-right duration-500 ${isLateInitial ? 'border-red-500' : 'border-green-500'} relative`}>
            {/* Source Badge */}
            {isApp && (
                <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-white text-xs font-bold flex items-center gap-1 ${sourceConfig.color}`}>
                    <span className="material-icons-round text-xs">{sourceConfig.icon}</span>
                    {sourceConfig.label}
                </div>
            )}

            <div className="p-4 flex justify-between items-center bg-gray-50 border-b border-gray-100 pt-6">
                <div>
                    <h3 className="font-bold text-xl text-gray-900">{order.tableId}</h3>
                    <span className="text-xs text-gray-500">#{order.id}</span>
                </div>
                <OrderTimer timestamp={order.timestamp} />
            </div>
            <div className="p-4 flex-1 overflow-y-auto max-h-[300px]">
                {order.items.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0 last:mb-0">
                        <div className="flex flex-col w-full">
                            <div className="flex justify-between w-full">
                                <div className="flex gap-3 items-center">
                                    <span className="font-bold text-lg text-primary bg-primary/10 w-8 h-8 flex items-center justify-center rounded-lg">{item.quantity}</span>
                                    <span className="text-gray-800 font-bold text-lg">{item.name}</span>
                                </div>
                            </div>
                            {item.notes && (
                                <p className="text-sm text-orange-600 mt-1 font-bold bg-orange-50 p-2 rounded-lg border border-orange-100 flex items-center gap-2">
                                    <span className="material-icons-round text-sm">warning</span>
                                    {item.notes}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <button
                onClick={() => onComplete(order.id)}
                className="m-4 mt-2 py-4 bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30 rounded-xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
                <span className="material-icons-round">check_circle</span>
                Marcar Completado
            </button>
        </div>
    );
};

export const KitchenScreen: React.FC = () => {
    const { orders, updateOrderStatus, addOrder } = useOrders();
    const [prevOrderCount, setPrevOrderCount] = useState(0);
    const [isSplitView, setIsSplitView] = useState(false); // New state for split view
    const [showNewOrderAlert, setShowNewOrderAlert] = useState(false);

    const pendingOrders = orders.filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.COOKING);
    const completedCount = orders.filter(o => o.status === OrderStatus.COMPLETED).length;

    // Filter Logic
    const dineInOrders = pendingOrders.filter(o => !o.source || o.source === OrderSource.DINE_IN);
    const appOrders = pendingOrders.filter(o => o.source && o.source !== OrderSource.DINE_IN);

    // Sound Alarm Effect
    useEffect(() => {
        if (pendingOrders.length > prevOrderCount && prevOrderCount !== 0) {
            playBeep();
            setShowNewOrderAlert(true);
            setTimeout(() => setShowNewOrderAlert(false), 5000);
        }
        setPrevOrderCount(pendingOrders.length);
    }, [pendingOrders.length, prevOrderCount]);

    // Initial load sync
    useEffect(() => {
        setPrevOrderCount(pendingOrders.length);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sortOrders = (list: Order[]) => [...list].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const sortedDineIn = sortOrders(dineInOrders);
    const sortedApps = sortOrders(appOrders);
    const sortedAll = sortOrders(pendingOrders);

    return (
        <div className="flex-1 bg-[#1F2937] text-gray-100 p-6 overflow-hidden flex flex-col h-full relative">
            {/* New Order Animation Overlay */}
            {showNewOrderAlert && (
                <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden">
                    <div className="bg-green-500/20 absolute inset-0 animate-pulse"></div>
                    <div className="animate-slide-motorcycle absolute right-0 flex flex-col items-center">
                        <span className="material-icons-round text-9xl text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.8)]">two_wheeler</span>
                        <div className="bg-green-500 text-white font-black text-2xl px-6 py-2 rounded-full shadow-lg transform -skew-x-12 border-4 border-white">
                            NEW ORDER!
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slide-motorcycle {
                    0% { transform: translateX(-120vw) scale(0.5) rotate(5deg); opacity: 0; }
                    20% { transform: translateX(-50vw) scale(1.2) rotate(-5deg); opacity: 1; }
                    40% { transform: translateX(-40vw) scale(1) rotate(5deg); }
                    100% { transform: translateX(20vw) scale(1); opacity: 0; }
                }
                .animate-slide-motorcycle {
                    animation: slide-motorcycle 4s ease-in-out forwards;
                }
            `}</style>

            <header className="flex justify-between items-center mb-6 bg-[#374151] p-4 rounded-2xl shadow-lg border border-gray-700 z-10 relative">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
                        <span className="material-icons-round text-3xl">restaurant</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Pantalla de Cocina</h1>
                        <p className="text-gray-400 text-sm">Cola de Pedidos en Tiempo Real</p>
                    </div>
                </div>

                {/* Control Center */}
                <div className="flex gap-4 items-center">
                    {/* Toggle Split View */}
                    <div className="bg-[#1F2937] p-1 rounded-xl border border-gray-700 flex">
                        <button
                            onClick={() => setIsSplitView(false)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${!isSplitView ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            <span className="material-icons-round text-sm">view_agenda</span>
                            Unified
                        </button>
                        <button
                            onClick={() => setIsSplitView(true)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${isSplitView ? 'bg-primary text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            <span className="material-icons-round text-sm">vertical_split</span>
                            Split View
                        </button>
                    </div>

                    <div className="h-8 w-[1px] bg-gray-600 mx-2"></div>

                    <div className="bg-[#1F2937] px-6 py-2 rounded-xl border border-gray-700 text-center">
                        <span className="block text-xs text-gray-400 font-bold uppercase tracking-wider">Completados</span>
                        <span className="font-bold text-xl text-green-500">{completedCount}</span>
                    </div>
                    <div className="bg-[#1F2937] px-6 py-2 rounded-xl border border-gray-700 text-center">
                        <span className="block text-xs text-gray-400 font-bold uppercase tracking-wider">Pendientes</span>
                        <span className="font-bold text-xl text-primary animate-pulse">{pendingOrders.length}</span>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {isSplitView ? (
                    <div className="flex h-full gap-6">
                        {/* Dine-In Column */}
                        <div className="flex-1 flex flex-col bg-[#374151]/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                            <div className="p-4 bg-gray-700/50 border-b border-gray-600 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                    <span className="material-icons-round">restaurant</span> Dine-In
                                </h3>
                                <span className="bg-gray-600 text-white text-xs px-2 py-1 rounded-full">{sortedDineIn.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {sortedDineIn.length === 0 ? (
                                    <div className="text-center text-gray-500 mt-20">No Dine-In orders</div>
                                ) : (
                                    sortedDineIn.map(order => <Ticket key={order.id} order={order} onComplete={(id) => updateOrderStatus(id, OrderStatus.READY)} />)
                                )}
                            </div>
                        </div>

                        {/* Apps Column */}
                        <div className="flex-1 flex flex-col bg-[#374151]/30 rounded-2xl border border-gray-700/50 overflow-hidden">
                            <div className="p-4 bg-gray-700/50 border-b border-gray-600 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                    <span className="material-icons-round">delivery_dining</span> Apps & Delivery
                                </h3>
                                <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-1 rounded-full">{sortedApps.length}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {sortedApps.length === 0 ? (
                                    <div className="text-center text-gray-500 mt-20">No App orders</div>
                                ) : (
                                    sortedApps.map(order => <Ticket key={order.id} order={order} onComplete={(id) => updateOrderStatus(id, OrderStatus.READY)} />)
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    // Unified Horizontal Scroll View (Original)
                    <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide h-full">
                        <div className="flex gap-6 h-full min-w-max px-2">
                            {sortedAll.length === 0 ? (
                                <div className="w-[calc(100vw-3rem)] flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-700 rounded-3xl bg-[#374151]/30 h-full">
                                    <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mb-6">
                                        <span className="material-icons-round text-6xl text-gray-500">check</span>
                                    </div>
                                    <h2 className="text-2xl font-bold text-gray-300">Todo en orden</h2>
                                    <p className="font-medium mt-2">No hay ordenes pendientes por preparar.</p>
                                </div>
                            ) : (
                                sortedAll.map(order => (
                                    <Ticket
                                        key={order.id}
                                        order={order}
                                        onComplete={(id) => updateOrderStatus(id, OrderStatus.READY)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};