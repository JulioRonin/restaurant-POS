import React, { useEffect, useState, useRef } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { Order, OrderStatus } from '../types';

// Simple beep sound as base64 to avoid external dependencies
const BEEP_SOUND = 'data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'; // Shortened placeholder, will use a real simple beep if possible, or just a console log if sound fails, but logic is key.
// Actually, let's use a real short beep base64.
const REAL_BEEP = 'data:audio/mp3;base64,SUQzBAAAAAABAFhUWFhU/////wAAAAAAAAAAAAAAAAAAAAAA//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq'; // This is just a placeholder. I will use a standard browser API or a simple clean implementation.

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
    // Determine visual state based on time elapsed logic handled inside Timer, 
    // but the card itself can just be standard color.
    // We can also check initial time for card border.
    const startTime = new Date(order.timestamp).getTime();
    const isLateInitial = (Date.now() - startTime) > 15 * 60 * 1000;

    return (
        <div className={`bg-white rounded-xl overflow-hidden border-l-4 shadow-soft min-w-[300px] flex flex-col animate-in slide-in-from-right duration-500 ${isLateInitial ? 'border-red-500' : 'border-green-500'}`}>
            <div className="p-4 flex justify-between items-center bg-gray-50 border-b border-gray-100">
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
    const { orders, updateOrderStatus } = useOrders();
    const [prevOrderCount, setPrevOrderCount] = useState(0);

    const pendingOrders = orders.filter(o => o.status !== OrderStatus.COMPLETED && o.status !== OrderStatus.SERVED);
    const completedCount = orders.filter(o => o.status === OrderStatus.COMPLETED).length;

    // Sound Alarm Effect
    useEffect(() => {
        if (pendingOrders.length > prevOrderCount && prevOrderCount !== 0) {
            playBeep();
        }
        setPrevOrderCount(pendingOrders.length);
    }, [pendingOrders.length, prevOrderCount]);

    // Initial load sync
    useEffect(() => {
        setPrevOrderCount(pendingOrders.length);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sort by oldest first
    const sortedOrders = [...pendingOrders].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return (
        <div className="flex-1 bg-[#1F2937] text-gray-100 p-6 overflow-hidden flex flex-col h-full">
            <header className="flex justify-between items-center mb-6 bg-[#374151] p-4 rounded-2xl shadow-lg border border-gray-700">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30">
                        <span className="material-icons-round text-3xl">restaurant</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Pantalla de Cocina</h1>
                        <p className="text-gray-400 text-sm">Cola de Pedidos en Tiempo Real</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="bg-[#1F2937] px-6 py-3 rounded-xl border border-gray-700 text-center">
                        <span className="block text-xs text-gray-400 font-bold uppercase tracking-wider">Completados</span>
                        <span className="font-bold text-2xl text-green-500">{completedCount}</span>
                    </div>
                    <div className="bg-[#1F2937] px-6 py-3 rounded-xl border border-gray-700 text-center">
                        <span className="block text-xs text-gray-400 font-bold uppercase tracking-wider">Pendientes</span>
                        <span className="font-bold text-2xl text-primary animate-pulse">{pendingOrders.length}</span>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide">
                <div className="flex gap-6 h-full min-w-max px-2">
                    {sortedOrders.length === 0 ? (
                        <div className="w-[calc(100vw-3rem)] flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-700 rounded-3xl bg-[#374151]/30">
                            <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mb-6">
                                <span className="material-icons-round text-6xl text-gray-500">check</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-300">Todo en orden</h2>
                            <p className="font-medium mt-2">No hay ordenes pendientes por preparar.</p>
                        </div>
                    ) : (
                        sortedOrders.map(order => (
                            <Ticket
                                key={order.id}
                                order={order}
                                onComplete={(id) => updateOrderStatus(id, OrderStatus.COMPLETED)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};