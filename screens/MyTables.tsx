import React, { useState, useMemo } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { useUser } from '../contexts/UserContext';
import { OrderStatus, TableStatus, OrderSource, MenuItem } from '../types';
import { useTables } from '../contexts/TableContext';
import { useMenu } from '../contexts/MenuContext';
import { motion, AnimatePresence } from 'framer-motion';
import { GlowCard } from '../components/ui/spotlight-card';
import { 
  Users, 
  Clock, 
  Trash2, 
  Edit3, 
  DollarSign, 
  CheckCircle2, 
  X, 
  Plus, 
  Search, 
  Save, 
  Lock,
  ChevronRight,
  Package
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

    const handleOpenEdit = (order: any) => { { setEditingOrder(order); setTempItems([...order.items]); } };

    const finalizeSave = () => {
        if (!editingOrder) return;
        const newTotal = tempItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        updateOrderStatus(editingOrder.id, editingOrder.status, { ...editingOrder, items: tempItems, total: newTotal });
        setEditingOrder(null); setPin(''); setShowPinModal(false);
    };

    return (
        <div className="h-full bg-solaris-black text-white p-6 md:p-10 flex flex-col overflow-y-auto no-scrollbar antialiased">
            <header className="mb-12 flex justify-between items-end">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-2">Personnel Pipeline</h1>
                    <p className="text-gray-600 font-bold text-[10px] uppercase tracking-[0.4em]">Active Duty Node Monitoring</p>
                </motion.div>
                <div className="bg-white/[0.03] border border-white/5 px-8 py-4 rounded-solaris text-right">
                    <p className="text-[9px] font-black text-gray-700 uppercase tracking-widest mb-1">Active Clusters</p>
                    <p className="text-3xl font-black italic text-solaris-orange tracking-tighter leading-none">{myOrders.length}</p>
                </div>
            </header>

            {myOrders.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center opacity-20 border-2 border-dashed border-white/5 rounded-solaris py-32">
                    <Package size={80} className="mb-6" />
                    <p className="text-[12px] font-black uppercase tracking-[0.4em]">Zero Assets Assigned</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10">
                    {myOrders.map(order => {
                        const isRequested = order.status === OrderStatus.BILL_REQUESTED;
                        return (
                            <GlowCard key={order.id} glowColor="orange" className={`!p-0 border relative transition-all group ${isRequested ? 'border-solaris-orange shadow-solaris-glow' : 'border-white/5'}`}>
                                {isRequested && (
                                    <div className="absolute top-0 right-0 bg-solaris-orange text-white px-4 py-1.5 text-[8px] font-black uppercase tracking-widest animate-pulse">
                                        PAYOUT_REQD
                                    </div>
                                )}
                                <div className="p-8 border-b border-white/5 bg-white/[0.03] flex justify-between items-start">
                                    <div>
                                        <p className="text-[8px] font-black text-gray-700 uppercase tracking-widest mb-1">NODE_ID</p>
                                        <h3 className="text-3xl font-black italic tracking-tighter uppercase text-white leading-none">{order.tableId}</h3>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-gray-700 uppercase tracking-widest mb-1">UPTIME</p>
                                        <p className="text-sm font-black italic text-white/60 flex items-center gap-2 justify-end uppercase"><Clock size={12} /> {getElapsedTime(order.timestamp)}</p>
                                    </div>
                                </div>

                                <div className="p-8 flex-1 space-y-6">
                                    <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5 space-y-2 max-h-[160px] overflow-y-auto no-scrollbar">
                                        {order.items.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center text-[11px]">
                                                <span className="text-white/40 font-black italic uppercase tracking-tight"><span className="text-solaris-orange mr-1">{item.quantity}</span> {item.name}</span>
                                                <span className="font-black italic text-white/60 tracking-tighter">${(item.price * item.quantity).toFixed(0)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between items-end px-2">
                                        <p className="text-[9px] font-black text-gray-800 uppercase tracking-widest mb-1">Accumulated Yield</p>
                                        <p className="text-3xl font-black italic text-solaris-orange tracking-tighter leading-none">${order.total.toFixed(0)}</p>
                                    </div>
                                </div>

                                <div className="p-8 pt-0 flex gap-4">
                                     {!isRequested ? (
                                        <>
                                            <button onClick={() => handleOpenEdit(order)} className="w-14 h-14 bg-white/[0.03] border border-white/10 rounded-2xl flex items-center justify-center text-gray-700 hover:text-white hover:border-white transition-all"><Edit3 size={20} /></button>
                                            <button onClick={() => updateOrderStatus(order.id, OrderStatus.BILL_REQUESTED)} className="flex-1 py-4 bg-white text-black rounded-2xl font-black italic uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3">
                                                 Settle Account <ChevronRight size={16} />
                                            </button>
                                        </>
                                     ) : (
                                        <div className="w-full py-4 bg-solaris-orange/10 border border-solaris-orange/20 text-solaris-orange font-black italic uppercase tracking-widest text-[10px] rounded-2xl flex items-center justify-center gap-3 italic">
                                            Awaiting Reception Hub...
                                        </div>
                                     )}
                                </div>
                            </GlowCard>
                        );
                    })}
                </div>
            )}

            {/* Edit Asset Modal */}
            <AnimatePresence>
                {editingOrder && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[600] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-6">
                        <GlowCard glowColor="orange" className="w-full max-w-xl border border-white/10 !p-0 bg-[#0a0a0b] overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                                <div>
                                    <h2 className="text-3xl font-black italic tracking-tighter uppercase text-white">Modify Manifest</h2>
                                    <p className="text-[9px] font-black uppercase text-gray-700 tracking-widest mt-1">Node: {editingOrder.tableId}</p>
                                </div>
                                <X onClick={() => setEditingOrder(null)} size={32} className="text-gray-800 hover:text-white cursor-pointer transition-colors" />
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-gray-700 tracking-widest">Active Packet Stream</span>
                                    <button onClick={() => setShowItemPicker(true)} className="px-6 py-2 bg-solaris-orange rounded-full text-[9px] font-black uppercase text-white shadow-solaris-glow">+ Add Asset</button>
                                </div>

                                {tempItems.map((item, idx) => (
                                    <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-3xl p-6 flex items-center justify-between group">
                                        <div>
                                            <p className="font-black italic text-white uppercase tracking-tight">{item.name}</p>
                                            <p className="text-[10px] text-gray-800 font-black italic mt-1">${item.price.toFixed(0)} per unit</p>
                                        </div>
                                        <div className="flex items-center gap-6 bg-white/[0.02] border border-white/5 p-2 rounded-2xl">
                                             <button onClick={() => {
                                                 const n = [...tempItems]; n[idx].quantity = Math.max(0, n[idx].quantity - 1);
                                                 if (n[idx].quantity === 0) n.splice(idx, 1); setTempItems(n);
                                             }} className="w-10 h-10 rounded-xl bg-white/[0.03] hover:bg-red-500/20 text-gray-700 hover:text-red-500 transition-all flex items-center justify-center font-black">-</button>
                                             <span className="w-6 text-center font-black italic text-lg text-white">{item.quantity}</span>
                                             <button onClick={() => {
                                                 const n = [...tempItems]; n[idx].quantity += 1; setTempItems(n);
                                             }} className="w-10 h-10 rounded-xl bg-white/[0.03] hover:bg-green-500/20 text-gray-700 hover:text-green-500 transition-all flex items-center justify-center font-black">+</button>
                                        </div>
                                    </div>
                                ))}

                                {showItemPicker && (
                                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="pt-4 space-y-4">
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-800" size={18} />
                                            <input type="text" placeholder="Search Assets..." className="w-full pl-12 pr-4 py-4 bg-white/[0.03] border border-white/10 rounded-2xl outline-none font-black text-sm italic italic tracking-tight" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} autoFocus />
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto no-scrollbar">
                                            {menuItems.filter(i => i.name.toLowerCase().includes(pickerSearch.toLowerCase())).slice(0, 5).map(item => (
                                                <button key={item.id} onClick={() => {
                                                    const existing = tempItems.find(ti => ti.id === item.id);
                                                    if (existing) { setTempItems(tempItems.map(ti => ti.id === item.id ? { ...ti, quantity: ti.quantity+1 } : ti)); }
                                                    else { setTempItems([...tempItems, { ...item, quantity: 1 }]); }
                                                    setShowItemPicker(false); setPickerSearch('');
                                                }} className="p-4 bg-white/[0.02] hover:bg-solaris-orange hover:text-white rounded-2xl border border-white/5 transition-all text-left flex justify-between items-center group">
                                                    <span className="font-black italic uppercase text-sm">{item.name}</span>
                                                    <span className="font-black italic opacity-40">${item.price.toFixed(0)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            <div className="p-8 bg-white/[0.03] border-t border-white/10 space-y-6">
                                <div className="flex justify-between items-end">
                                    <p className="text-[10px] font-black uppercase text-gray-800 tracking-widest">Calculated Flux</p>
                                    <p className="text-4xl font-black italic text-solaris-orange tracking-tighter leading-none">
                                        ${tempItems.reduce((s, i) => s + (i.price * i.quantity), 0).toFixed(0)}
                                    </p>
                                </div>
                                <button onClick={() => {
                                    const isRed = tempItems.length < editingOrder.items.length || tempItems.some((it, i) => { const o = editingOrder.items.find((oi:any)=>oi.name===it.name); return o && it.quantity < o.quantity; });
                                    if(isRed) setShowPinModal(true); else finalizeSave();
                                }} className="w-full py-6 bg-white text-black rounded-solaris font-black italic uppercase tracking-[0.3em] text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                    Commit Changes
                                </button>
                            </div>
                        </GlowCard>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PIN Solaris Overhaul */}
            <AnimatePresence>
                {showPinModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[700] flex items-center justify-center bg-black/95 backdrop-blur-3xl animate-in fade-in transition-all">
                         <GlowCard glowColor="orange" className="w-full max-w-sm border border-white/10 !p-12 text-center bg-[#0a0a0b]">
                            <div className="w-20 h-20 bg-solaris-orange/10 rounded-full flex items-center justify-center text-solaris-orange mx-auto mb-8 border border-solaris-orange/20">
                                <Lock size={32} />
                            </div>
                            <h3 className="text-2xl font-black italic tracking-tighter uppercase text-white mb-2">Auth Code Required</h3>
                            <p className="text-[10px] font-black uppercase text-gray-800 tracking-[0.3em] mb-12">Security Interlock Active</p>
                            
                            <div className="space-y-12">
                                <div className="flex justify-center gap-6">
                                    {[0, 1, 2, 3].map((_, i) => (
                                        <div key={i} className={`w-4 h-4 rounded-full transition-all duration-500 ${pin.length > i ? 'bg-solaris-orange shadow-[0_0_15px_#f97316]' : 'bg-gray-900 border border-white/5'}`}></div>
                                    ))}
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                        <button key={n} onClick={() => pin.length < 4 && setPin(pin + n)} className="w-full h-16 rounded-2xl bg-white/[0.03] hover:bg-white text-gray-600 hover:text-black text-2xl font-black italic transition-all active:scale-90">{n}</button>
                                    ))}
                                    <button onClick={() => setPin('')} className="text-[10px] font-black text-gray-800 uppercase tracking-widest hover:text-red-500 transition-colors">Clear</button>
                                    <button onClick={() => pin.length < 4 && setPin(pin + '0')} className="w-full h-16 rounded-2xl bg-white/[0.03] hover:bg-white text-gray-600 hover:text-black text-2xl font-black italic transition-all active:scale-90">0</button>
                                    <button onClick={() => { if(pin === '0000') finalizeSave(); else { alert('ACCESS_DENIED'); setPin(''); } }} className="w-full h-16 rounded-2xl bg-solaris-orange text-white flex items-center justify-center hover:scale-105 transition-all shadow-solaris-glow"><CheckCircle2 size={24} /></button>
                                </div>
                                <X onClick={() => { setShowPinModal(false); setPin(''); }} className="mt-8 mx-auto text-gray-800 hover:text-white cursor-pointer" size={24} />
                            </div>
                        </GlowCard>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
