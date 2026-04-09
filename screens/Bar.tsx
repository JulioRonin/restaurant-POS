import React, { useEffect, useState } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { Order, OrderStatus, OrderSource } from '../types';

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
            setIsLate(minutes >= 10); // Drinks should be faster than food (10 min)
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [timestamp]);

    return (
        <span className={`px-3 py-1 rounded-lg font-mono font-bold text-lg ${isLate ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-blue-100 text-blue-600'}`}>
            {elapsed}
        </span>
    );
};

const BarTicket: React.FC<{ order: Order; items: any[]; onComplete: (id: string) => void }> = ({ order, items, onComplete }) => {
    return (
        <div className="bg-white rounded-xl overflow-hidden border-l-4 border-blue-500 shadow-soft min-w-[300px] flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-4 flex justify-between items-center bg-gray-50 border-b border-gray-100 pt-6">
                <div>
                    <h3 className="font-bold text-xl text-gray-900">{order.tableId}</h3>
                    <span className="text-xs text-gray-500">#{order.id}</span>
                </div>
                <OrderTimer timestamp={order.timestamp} />
            </div>
            <div className="p-4 flex-1 overflow-y-auto max-h-[300px]">
                {items.map((item, idx) => (
                    <div key={`${item.id}-${idx}`} className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0 last:mb-0">
                        <div className="flex flex-col w-full">
                            <div className="flex gap-3 items-center">
                                <span className="font-bold text-lg text-blue-600 bg-blue-50 w-8 h-8 flex items-center justify-center rounded-lg">{item.quantity}</span>
                                <span className="text-gray-800 font-bold text-lg">{item.name}</span>
                            </div>
                            {item.notes && (
                                <p className="text-sm text-blue-600 mt-1 font-bold bg-blue-50 p-2 rounded-lg border border-blue-100 flex items-center gap-2">
                                    <span className="material-icons-round text-sm">info</span>
                                    {item.notes}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <button
                onClick={() => onComplete(order.id)}
                className="m-4 mt-2 py-4 bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/30 rounded-xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
                <span className="material-icons-round">local_bar</span>
                Bebidas Listas
            </button>
        </div>
    );
};

export const BarScreen: React.FC = () => {
    const { orders, updateOrderStatus } = useOrders();
    const pendingOrders = orders.filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.COOKING);

    // Filter only drinks
    const barOrders = pendingOrders.map(order => {
        const drinkItems = order.items.filter(item => 
            item.category.toLowerCase().includes('bebida') || 
            item.category.toLowerCase().includes('bar') ||
            item.category.toLowerCase().includes('vino') ||
            item.category.toLowerCase().includes('trago') ||
            item.category.toLowerCase().includes('cerveza')
        );
        return drinkItems.length > 0 ? { order, items: drinkItems } : null;
    }).filter((x): x is { order: Order; items: any[] } => x !== null);

    return (
        <div className="flex-1 bg-[#111827] text-gray-100 p-6 overflow-hidden flex flex-col h-full relative">
            <header className="flex justify-between items-center mb-6 bg-gray-800 p-4 rounded-2xl shadow-lg border border-gray-700">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                        <span className="material-icons-round text-3xl">local_bar</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Monitor de Bar</h1>
                        <p className="text-gray-400 text-sm">Despacho de Bebidas y Tragos</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="bg-gray-900 px-6 py-2 rounded-xl border border-gray-700 text-center">
                        <span className="block text-xs text-gray-400 font-bold uppercase tracking-wider">Pendientes</span>
                        <span className="font-bold text-xl text-blue-500">{barOrders.length}</span>
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 scrollbar-hide">
                <div className="flex gap-6 h-full min-w-max px-2">
                    {barOrders.length === 0 ? (
                        <div className="w-[calc(100vw-3rem)] flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-gray-700 rounded-3xl bg-gray-800/30 h-full">
                            <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mb-6">
                                <span className="material-icons-round text-6xl text-gray-500">local_bar</span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-300">Bar Despejado</h2>
                            <p className="font-medium mt-2">No hay bebidas por preparar ahora mismo.</p>
                        </div>
                    ) : (
                        barOrders.map(({ order, items }) => (
                            <BarTicket
                                key={order.id}
                                order={order}
                                items={items}
                                onComplete={() => {
                                  // For simplicity, we mark the whole order as READY if it only has drinks, 
                                  // or we'd need a sub-status per item.
                                  // For now, let's just trigger READY status for the order.
                                  updateOrderStatus(order.id, OrderStatus.READY);
                                }}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
