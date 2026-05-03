import React, { useState, useMemo } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { useUser } from '../contexts/UserContext';
import { OrderStatus, TableStatus, OrderSource, MenuItem } from '../types';
import { useTables } from '../contexts/TableContext';
import { useMenu } from '../contexts/MenuContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Trash2,
  Edit3,
  CheckCircle2,
  X,
  Search,
  Save,
  Lock,
  ChevronRight,
  Package,
  BellRing
} from 'lucide-react';

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

    const myOrders = useMemo(() => {
        if (!activeEmployee) return [];
        return orders.filter(o => o.waiterName === activeEmployee.name && o.status !== OrderStatus.COMPLETED);
    }, [orders, activeEmployee]);

    const getElapsedTime = (timestamp: Date) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        return `${Math.floor(diff / 60000)}m`;
    };

    const handleOpenEdit = (order: any) => {
        setEditingOrder(order);
        setTempItems([...order.items]);
        setShowItemPicker(false);
        setPickerSearch('');
    };

    const finalizeSave = () => {
        if (!editingOrder) return;
        const newTotal = tempItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
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

        // Check if any new food or drink items were added
        const oldFoodCount = editingOrder.items.filter((i: any) => !isDrink(i)).reduce((acc: number, item: any) => acc + item.quantity, 0);
        const newFoodCount = tempItems.filter(i => !isDrink(i)).reduce((acc: number, item: any) => acc + item.quantity, 0);
        
        const oldDrinkCount = editingOrder.items.filter((i: any) => isDrink(i)).reduce((acc: number, item: any) => acc + item.quantity, 0);
        const newDrinkCount = tempItems.filter(i => isDrink(i)).reduce((acc: number, item: any) => acc + item.quantity, 0);

        if (newFoodCount > oldFoodCount) isKitchenReady = false;
        if (newDrinkCount > oldDrinkCount) isBarReady = false;

        // Revert to COOKING if new items were added and it needs prep again
        if (!isKitchenReady || !isBarReady) {
            newStatus = OrderStatus.COOKING;
        }
        
        updateOrderStatus(editingOrder.id, newStatus, { 
            ...editingOrder, 
            items: tempItems, 
            total: newTotal, 
            isKitchenReady, 
            isBarReady 
        });
        setEditingOrder(null);
        setPin('');
        setShowPinModal(false);
    };

    const handleCancelOrder = (id: string) => {
        if (window.confirm('¿Estás seguro de que deseas CANCELAR este pedido? Esta acción lo eliminará de la vista de mesas y de la caja.')) {
            removeOrder(id);
        }
    };

    return (
        <div className="h-full bg-[#FAFAF3] text-[#1a1c14] p-6 md:p-10 flex flex-col overflow-y-auto no-scrollbar antialiased">
            <header className="mb-10 flex justify-between items-start md:items-end flex-wrap gap-6 shrink-0">
                <div>
                    <h1 className="text-5xl font-black italic tracking-tighter uppercase mb-2 text-[#1a1c14]">Node Matrix Monitor</h1>
                    <p className="text-solaris-orange/40 font-black text-[11px] uppercase tracking-[0.5em] italic">Active Duty Node Monitoring • KOSO POS v1</p>
                </div>
                <div className="bg-white/[0.03] border border-white/5 px-8 py-5 rounded-2xl text-right">
                    <p className="text-[10px] font-black text-[#505530]/30 uppercase tracking-[0.3em] mb-1 italic">Active Clusters</p>
                    <p className="text-4xl font-black italic text-solaris-orange tracking-tighter leading-none">{myOrders.length}</p>
                </div>
            </header>

            {myOrders.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center opacity-20 border-2 border-dashed border-white/5 rounded-3xl py-32">
                    <Package size={80} className="mb-6 text-solaris-orange/20" />
                    <p className="text-[12px] font-black uppercase tracking-[0.4em] italic">Zero Assets Assigned</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pb-10">
                    {myOrders.map(order => {
                        const isRequested = order.status === OrderStatus.BILL_REQUESTED;
                        return (
                            <div
                                key={order.id}
                                className={`flex flex-col rounded-[28px] border relative overflow-hidden transition-all ${isRequested ? 'border-solaris-orange shadow-solaris-glow' : 'border-white/[0.07] bg-white/[0.015]'}`}
                            >
                                {isRequested && (
                                    <div className="absolute top-0 right-0 bg-solaris-orange text-[#1a1c14] px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.3em] animate-pulse rounded-bl-2xl z-10">
                                        PAYOUT_REQD
                                    </div>
                                )}
                                {!isRequested && order.status === OrderStatus.READY && (
                                    <div className="absolute top-0 right-0 bg-[#F98359] text-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] animate-bounce shadow-salmon-glow rounded-bl-2xl z-10 flex items-center gap-1.5">
                                        <BellRing size={14} className="animate-pulse" /> LISTA PARA SERVIR
                                    </div>
                                )}

                                {/* Header */}
                                <div className="px-6 pt-6 pb-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[8px] font-black text-solaris-orange/40 uppercase tracking-widest mb-1 italic">NODE_ID</p>
                                        <h3 className="text-base font-black italic tracking-tighter uppercase text-[#1a1c14] leading-tight font-mono truncate">
                                            {order.tableId.length > 16 ? `${order.tableId.slice(0, 10)}...${order.tableId.slice(-4)}` : order.tableId}
                                        </h3>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[8px] font-black text-solaris-orange/40 uppercase tracking-widest mb-1 italic">UPTIME</p>
                                        <p className="text-xs font-black italic text-[#1a1c14] flex items-center gap-1 justify-end">
                                            <Clock size={11} className="text-solaris-orange" /> {getElapsedTime(order.timestamp)}
                                        </p>
                                    </div>
                                </div>

                                {/* Items */}
                                <div className="px-6 py-4 overflow-y-auto no-scrollbar" style={{ maxHeight: '150px' }}>
                                    <div className="space-y-2">
                                        {order.items.map((item: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center text-[11px] py-1 border-b border-white/[0.03] last:border-0">
                                                <span className="text-[#1a1c14] font-black italic uppercase tracking-tight flex-1 truncate mr-2">
                                                    <span className="text-solaris-orange mr-1">{item.quantity}×</span>{item.name}
                                                </span>
                                                <span className="font-black italic text-[#505530]/65 shrink-0">${(item.price * item.quantity).toFixed(0)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Total */}
                                <div className="px-6 py-4 border-t border-white/5 flex justify-between items-center">
                                    <p className="text-[9px] font-black text-[#505530]/30 uppercase tracking-[0.3em] italic">Accumulated Yield</p>
                                    <p className="text-3xl font-black italic text-solaris-orange tracking-tighter leading-none">${order.total.toFixed(0)}</p>
                                </div>

                                {/* Actions */}
                                <div className="px-6 pb-6 flex gap-3">
                                    {!isRequested ? (
                                        <>
                                            <button
                                                onClick={() => handleCancelOrder(order.id)}
                                                className="w-11 h-11 bg-white/[0.03] border border-white/5 rounded-2xl flex items-center justify-center text-red-500/30 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-90"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenEdit(order)}
                                                className="w-11 h-11 bg-white/[0.03] border border-white/5 rounded-2xl flex items-center justify-center text-solaris-orange/30 hover:text-solaris-orange hover:bg-solaris-orange/10 transition-all active:scale-90"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={() => updateOrderStatus(order.id, OrderStatus.BILL_REQUESTED)}
                                                className="flex-1 py-3 bg-white text-black rounded-2xl font-black italic uppercase tracking-[0.15em] text-[10px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-solaris-orange hover:text-[#1a1c14]"
                                            >
                                                Settle Account <ChevronRight size={14} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleCancelOrder(order.id)}
                                                className="w-11 h-11 bg-white/[0.03] border border-white/5 rounded-2xl flex items-center justify-center text-red-500/30 hover:text-red-500 hover:bg-red-500/10 transition-all active:scale-90"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <div className="flex-1 py-3 bg-solaris-orange/10 border border-solaris-orange/20 text-solaris-orange font-black italic uppercase tracking-[0.3em] text-[9px] rounded-2xl flex items-center justify-center gap-2 animate-pulse">
                                                Awaiting Reception Hub...
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── MODIFY MANIFEST MODAL ── */}
            <AnimatePresence>
                {editingOrder && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[600] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4"
                    >
                        <div
                            className="w-full max-w-5xl bg-[#FAFAF3] border border-white/10 rounded-[40px] shadow-2xl flex flex-col"
                            style={{ maxHeight: '90vh' }}
                        >
                            {/* Header */}
                            <div className="flex justify-between items-center px-10 py-7 border-b border-white/5 bg-white/[0.01] shrink-0 rounded-t-[40px]">
                                <div>
                                    <h2 className="text-3xl font-black italic tracking-tighter uppercase text-[#1a1c14]">Modify Manifest</h2>
                                    <p className="text-[10px] font-black uppercase text-solaris-orange/50 tracking-[0.4em] mt-1 italic">
                                        Node: {editingOrder.tableId}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setEditingOrder(null)}
                                    className="w-12 h-12 bg-white/[0.04] rounded-full flex items-center justify-center text-[#505530]/30 hover:text-[#1a1c14] hover:bg-white/10 transition-all"
                                >
                                    <X size={22} />
                                </button>
                            </div>

                            {/* Body – responsive two column */}
                            <div className="flex-1 flex flex-col xl:flex-row overflow-hidden min-h-0">

                                {/* Left: item list */}
                                <div className="flex-1 flex flex-col overflow-hidden border-r border-white/5">
                                    {/* Toolbar */}
                                    <div className="flex justify-between items-center px-8 py-5 border-b border-white/5 shrink-0 bg-white/[0.01]">
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-solaris-orange tracking-[0.3em] italic">Active Packet Stream</p>
                                            <p className="text-[9px] text-[#505530]/30 font-mono mt-0.5">{tempItems.length} modules loaded</p>
                                        </div>
                                        <button
                                            onClick={() => { setShowItemPicker(v => !v); setPickerSearch(''); }}
                                            className="px-6 py-3 bg-solaris-orange rounded-xl text-[10px] font-black uppercase text-[#1a1c14] shadow-solaris-glow hover:scale-105 active:scale-95 transition-all"
                                        >
                                            {showItemPicker ? '✕ Close' : '+ Add Asset'}
                                        </button>
                                    </div>

                                    {/* Picker panel */}
                                    {showItemPicker && (
                                        <div className="px-8 py-5 border-b border-white/5 bg-white/[0.02] space-y-4 shrink-0">
                                            <div className="relative">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-solaris-orange/30" size={16} />
                                                <input
                                                    type="text"
                                                    placeholder="Search menu items..."
                                                    className="w-full pl-11 pr-5 py-3 bg-white/[0.04] border border-white/10 rounded-2xl outline-none font-black text-sm italic placeholder:text-[#505530]/10 focus:border-solaris-orange/40 transition-all text-[#1a1c14]"
                                                    value={pickerSearch}
                                                    onChange={e => setPickerSearch(e.target.value)}
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2" style={{ maxHeight: '160px', overflowY: 'auto' }}>
                                                {menuItems
                                                    .filter(i => i.name.toLowerCase().includes(pickerSearch.toLowerCase()))
                                                    .slice(0, 12)
                                                    .map(item => (
                                                        <button
                                                            key={item.id}
                                                            onClick={() => {
                                                                const existing = tempItems.find(ti => ti.id === item.id);
                                                                if (existing) {
                                                                    setTempItems(tempItems.map(ti => ti.id === item.id ? { ...ti, quantity: ti.quantity + 1 } : ti));
                                                                } else {
                                                                    setTempItems([...tempItems, { ...item, quantity: 1 }]);
                                                                }
                                                                setShowItemPicker(false);
                                                                setPickerSearch('');
                                                            }}
                                                            className="p-4 bg-white/[0.03] hover:bg-solaris-orange text-[#505530]/65 hover:text-[#1a1c14] rounded-2xl border border-white/5 transition-all text-left"
                                                        >
                                                            <p className="font-black italic uppercase text-sm leading-tight truncate">{item.name}</p>
                                                            <p className="text-[10px] opacity-50 mt-0.5">${item.price.toFixed(0)}</p>
                                                        </button>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Items list */}
                                    <div className="flex-1 overflow-y-auto no-scrollbar px-8 py-6 space-y-3">
                                        {tempItems.length === 0 ? (
                                            <div className="h-full flex items-center justify-center opacity-20 py-16">
                                                <p className="text-[11px] font-black uppercase tracking-widest italic text-center">No items — press Add Asset</p>
                                            </div>
                                        ) : tempItems.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-2xl px-6 py-5 hover:border-solaris-orange/20 transition-all"
                                            >
                                                <div className="min-w-0 flex-1 mr-4">
                                                    <p className="font-black italic text-[#1a1c14] uppercase tracking-tight leading-tight truncate">{item.name}</p>
                                                    <p className="text-[10px] text-solaris-orange/40 font-black italic mt-0.5">
                                                        ${item.price.toFixed(0)} × {item.quantity} = ${(item.price * item.quantity).toFixed(0)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3 bg-black/40 border border-white/5 px-3 py-2 rounded-2xl shrink-0">
                                                    <button
                                                        onClick={() => {
                                                            const n = [...tempItems];
                                                            n[idx].quantity = Math.max(0, n[idx].quantity - 1);
                                                            if (n[idx].quantity === 0) n.splice(idx, 1);
                                                            setTempItems(n);
                                                        }}
                                                        className="w-9 h-9 rounded-xl bg-white/[0.03] hover:bg-red-500/20 text-[#505530]/45 hover:text-red-500 transition-all flex items-center justify-center text-xl font-black"
                                                    >−</button>
                                                    <span className="min-w-[24px] text-center font-black italic text-xl text-[#1a1c14]">{item.quantity}</span>
                                                    <button
                                                        onClick={() => {
                                                            const n = [...tempItems];
                                                            n[idx].quantity += 1;
                                                            setTempItems(n);
                                                        }}
                                                        className="w-9 h-9 rounded-xl bg-white/[0.03] hover:bg-green-500/20 text-[#505530]/45 hover:text-green-500 transition-all flex items-center justify-center text-xl font-black"
                                                    >+</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Right: summary + save */}
                                <div className="xl:w-72 w-full shrink-0 flex flex-col p-8 gap-5 bg-white/[0.01]">
                                    <div className="flex-1 flex flex-col justify-center gap-5">
                                        <div className="bg-white/[0.03] rounded-2xl p-7 border border-white/5 text-center">
                                            <p className="text-[9px] font-black uppercase text-[#505530]/45 tracking-widest mb-3 italic">Calculated Flux</p>
                                            <p className="text-5xl font-black italic text-solaris-orange tracking-tighter leading-none">
                                                ${tempItems.reduce((s, i) => s + (i.price * i.quantity), 0).toFixed(0)}
                                            </p>
                                        </div>

                                        <div className="bg-white/[0.02] rounded-2xl p-5 border border-white/5 space-y-3">
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-[#505530]/45 font-black italic uppercase">Total Qty</span>
                                                <span className="text-[#1a1c14] font-black italic">{tempItems.reduce((a, i) => a + i.quantity, 0)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[11px]">
                                                <span className="text-[#505530]/45 font-black italic uppercase">Lines</span>
                                                <span className="text-[#1a1c14] font-black italic">{tempItems.length}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-[11px] border-t border-white/5 pt-3">
                                                <span className="text-solaris-orange font-black italic uppercase">Total</span>
                                                <span className="text-solaris-orange font-black italic">
                                                    ${tempItems.reduce((s, i) => s + (i.price * i.quantity), 0).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            const isRed = tempItems.length < editingOrder.items.length || tempItems.some((it: any) => {
                                                const o = editingOrder.items.find((oi: any) => oi.name === it.name);
                                                return o && it.quantity < (o.quantity || 1);
                                            });
                                            if (isRed) setShowPinModal(true); else finalizeSave();
                                        }}
                                        className="w-full py-6 bg-white text-black rounded-2xl font-black italic uppercase tracking-[0.3em] text-base shadow-2xl hover:bg-solaris-orange hover:text-[#1a1c14] transition-all active:scale-95 flex items-center justify-center gap-3"
                                    >
                                        <Save size={20} /> Commit Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── PIN MODAL ── */}
            <AnimatePresence>
                {showPinModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[700] flex items-center justify-center bg-black/98 backdrop-blur-3xl p-6"
                    >
                        <div className="w-full max-w-md bg-[#FAFAF3] border border-white/10 rounded-[40px] shadow-2xl p-12 text-center">
                            <div className="w-20 h-20 bg-solaris-orange/10 rounded-full flex items-center justify-center text-solaris-orange mx-auto mb-8 border border-solaris-orange/20">
                                <Lock size={36} />
                            </div>
                            <h3 className="text-3xl font-black italic tracking-tighter uppercase text-[#1a1c14] mb-2">Auth Code Required</h3>
                            <p className="text-[10px] font-black uppercase text-solaris-orange/40 tracking-[0.5em] mb-10 italic">Security Interlock Active</p>

                            <div className="flex justify-center gap-6 mb-10">
                                {[0, 1, 2, 3].map((_, i) => (
                                    <div key={i} className={`w-5 h-5 rounded-full transition-all duration-300 ${pin.length > i ? 'bg-solaris-orange scale-125' : 'bg-white/5 border border-white/10'}`} />
                                ))}
                            </div>

                            <div className="grid grid-cols-3 gap-4 mb-4">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => pin.length < 4 && setPin(pin + n)}
                                        className="w-full h-16 rounded-2xl bg-white/[0.03] hover:bg-white text-[#505530]/55 hover:text-black text-2xl font-black italic transition-all active:scale-90 border border-white/5"
                                    >{n}</button>
                                ))}
                            </div>
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <button onClick={() => setPin('')} className="text-[10px] font-black text-[#505530]/30 uppercase tracking-widest hover:text-red-500 transition-colors italic">Reset</button>
                                <button onClick={() => pin.length < 4 && setPin(pin + '0')} className="w-full h-16 rounded-2xl bg-white/[0.03] hover:bg-white text-[#505530]/55 hover:text-black text-2xl font-black italic transition-all active:scale-90 border border-white/5">0</button>
                                <button
                                    onClick={() => { if (pin === '0000') finalizeSave(); else { alert('ACCESS_DENIED'); setPin(''); } }}
                                    className="w-full h-16 rounded-2xl bg-solaris-orange text-[#1a1c14] flex items-center justify-center hover:scale-105 transition-all active:scale-95"
                                >
                                    <CheckCircle2 size={28} />
                                </button>
                            </div>
                            <button onClick={() => { setShowPinModal(false); setPin(''); }} className="text-[#505530]/10 hover:text-[#1a1c14] transition-colors uppercase font-black text-[10px] tracking-widest italic flex items-center justify-center gap-2 mx-auto">
                                <X size={14} /> Discard Protocol
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
