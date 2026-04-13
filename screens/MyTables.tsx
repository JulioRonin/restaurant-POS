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

    const handleOpenEdit = (order: any) => { setEditingOrder(order); setTempItems([...order.items]); };

    const finalizeSave = () => {
        if (!editingOrder) return;
        const newTotal = tempItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        updateOrderStatus(editingOrder.id, editingOrder.status, { ...editingOrder, items: tempItems, total: newTotal });
        setEditingOrder(null); setPin(''); setShowPinModal(false);
    };

    const handleCancelOrder = (id: string) => {
        if (window.confirm('¿Confirmar CANCELACIÓN total del nodo? Esta acción purgará los registros activos.')) {
            removeOrder(id);
        }
    };

    return (
        <div className="h-full bg-solaris-black text-white p-6 md:p-10 flex flex-col overflow-y-auto no-scrollbar antialiased">
            <header className="mb-14 flex justify-between items-start md:items-end flex-wrap gap-6">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                    <h1 className="text-5xl font-black italic tracking-tighter uppercase mb-2 text-white">Node Matrix Monitor</h1>
                    <p className="text-solaris-orange/40 font-black text-[11px] uppercase tracking-[0.5em] italic">Active Duty Node Monitoring • Solaris OS v4</p>
                </motion.div>
                <div className="bg-white/[0.03] border border-white/5 px-10 py-6 rounded-solaris text-right shadow-2xl">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-2 italic">Active Clusters</p>
                    <p className="text-4xl font-black italic text-solaris-orange tracking-tighter leading-none shadow-solaris-glow">{myOrders.length}</p>
                </div>
            </header>

            {myOrders.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center opacity-20 border-2 border-dashed border-white/5 rounded-solaris py-32">
                    <Package size={80} className="mb-6 text-solaris-orange/20" />
                    <p className="text-[12px] font-black uppercase tracking-[0.4em] italic">Zero Assets Assigned</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 pb-20">
                    {myOrders.map(order => {
                        const isRequested = order.status === OrderStatus.BILL_REQUESTED;
                        return (
                            <GlowCard key={order.id} glowColor="orange" className={`!p-0 border relative transition-all group ${isRequested ? 'border-solaris-orange shadow-solaris-glow scale-[1.02]' : 'border-white/5'}`}>
                                {isRequested && (
                                    <div className="absolute top-0 right-0 bg-solaris-orange text-white px-6 py-2 text-[9px] font-black uppercase tracking-[0.3em] animate-pulse rounded-bl-2xl">
                                        PAYOUT_REQD
                                    </div>
                                )}
                                <div className="p-10 border-b border-white/5 bg-white/[0.02] flex justify-between items-start gap-4">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[9px] font-black text-solaris-orange/40 uppercase tracking-widest mb-2 italic">NODE_ID</p>
                                        <h3 className="text-2xl font-black italic tracking-tighter uppercase text-white leading-tight break-all">{order.tableId}</h3>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[9px] font-black text-solaris-orange/40 uppercase tracking-widest mb-2 italic">UPTIME</p>
                                        <p className="text-sm font-black italic text-white flex items-center gap-2 justify-end uppercase"><Clock size={14} className="text-solaris-orange" /> {getElapsedTime(order.timestamp)}</p>
                                    </div>
                                </div>

                                <div className="p-10 flex-1 space-y-8">
                                    <div className="bg-white/[0.01] rounded-[24px] p-6 border border-white/5 space-y-3 max-h-[180px] overflow-y-auto no-scrollbar">
                                        {order.items.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center text-[12px] border-b border-white/[0.02] pb-2 last:border-0 last:pb-0">
                                                <span className="text-white font-black italic uppercase tracking-tight"><span className="text-solaris-orange mr-2">{item.quantity}</span> {item.name}</span>
                                                <span className="font-black italic text-solaris-orange/60 tracking-tighter">${(item.price * item.quantity).toFixed(0)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between items-end px-2">
                                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-1 italic">Accumulated Yield</p>
                                        <p className="text-4xl font-black italic text-solaris-orange tracking-tighter leading-none">${order.total.toFixed(0)}</p>
                                    </div>
                                </div>

                                <div className="p-10 pt-0 flex gap-4">
                                     {!isRequested ? (
                                        <>
                                            <button onClick={() => handleCancelOrder(order.id)} className="w-16 h-16 bg-white/[0.03] border border-white/5 rounded-[20px] flex items-center justify-center text-red-500/40 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20 transition-all active:scale-90" title="Cancelar Nodo">
                                                <Trash2 size={22} />
                                            </button>
                                            <button onClick={() => handleOpenEdit(order)} className="w-16 h-16 bg-white/[0.03] border border-white/5 rounded-[20px] flex items-center justify-center text-solaris-orange/40 hover:text-solaris-orange hover:bg-solaris-orange/10 hover:border-solaris-orange/20 transition-all active:scale-90">
                                                <Edit3 size={22} />
                                            </button>
                                            <button onClick={() => updateOrderStatus(order.id, OrderStatus.BILL_REQUESTED)} className="flex-1 py-5 bg-white text-black rounded-[20px] font-black italic uppercase tracking-[0.2em] text-[11px] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4 hover:bg-solaris-orange hover:text-white group">
                                                 Settle Account <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        </>
                                     ) : (
                                        <div className="w-full py-6 bg-solaris-orange/10 border border-solaris-orange/20 text-solaris-orange font-black italic uppercase tracking-[0.4em] text-[11px] rounded-[20px] flex items-center justify-center gap-4 animate-pulse">
                                            Awaiting Reception Hub...
                                        </div>
                                     )}
                                </div>
                            </GlowCard>
                        );
                    })}
                </div>
            )}

            {/* Edit Asset Modal Solaris Overhaul */}
            <AnimatePresence>
                {editingOrder && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[600] flex items-center justify-center bg-[#030303]/95 backdrop-blur-3xl p-6">
                        <GlowCard glowColor="orange" className="w-full max-w-[700px] border border-white/10 !p-0 bg-[#0a0a0b] overflow-hidden flex flex-col max-h-[92vh] shadow-[0_0_100px_rgba(0,0,0,1)]">
                            <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                                <div>
                                    <h2 className="text-4xl font-black italic tracking-tighter uppercase text-white">Modify Manifest</h2>
                                    <p className="text-[10px] font-black uppercase text-solaris-orange/40 tracking-[0.3em] mt-2 italic px-1">Node Identification: {editingOrder.tableId}</p>
                                </div>
                                <button onClick={() => setEditingOrder(null)} className="w-12 h-12 bg-white/[0.03] rounded-full flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10 transition-all">
                                    <X size={28} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar">
                                <div className="flex justify-between items-center bg-solaris-orange/5 p-4 rounded-2xl border border-solaris-orange/10">
                                    <span className="text-[11px] font-black uppercase text-solaris-orange tracking-[0.3em] italic">Active Packet Stream</span>
                                    <button onClick={() => setShowItemPicker(true)} className="px-8 py-3 bg-solaris-orange rounded-xl text-[10px] font-black uppercase text-white shadow-solaris-glow hover:scale-105 active:scale-95 transition-all">+ Add Asset</button>
                                </div>

                                <div className="space-y-4">
                                    {tempItems.map((item, idx) => (
                                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} key={idx} className="bg-white/[0.02] border border-white/5 rounded-[28px] p-6 lg:p-8 flex items-center justify-between group hover:border-solaris-orange/20 transition-all">
                                            <div>
                                                <p className="text-lg font-black italic text-white uppercase tracking-tight leading-none mb-2">{item.name}</p>
                                                <p className="text-[11px] text-solaris-orange/40 font-black italic uppercase tracking-widest">${item.price.toFixed(0)} per unit</p>
                                            </div>
                                            <div className="flex items-center gap-8 bg-black/40 border border-white/5 p-3 rounded-2xl">
                                                 <button onClick={() => {
                                                     const n = [...tempItems]; n[idx].quantity = Math.max(0, n[idx].quantity - 1);
                                                     if (n[idx].quantity === 0) n.splice(idx, 1); setTempItems(n);
                                                 }} className="w-12 h-12 rounded-xl bg-white/[0.03] hover:bg-red-500/20 text-white/20 hover:text-red-500 transition-all flex items-center justify-center text-xl font-black shadow-lg">-</button>
                                                 <span className="min-w-[20px] text-center font-black italic text-2xl text-white">{item.quantity}</span>
                                                 <button onClick={() => {
                                                     const n = [...tempItems]; n[idx].quantity += 1; setTempItems(n);
                                                 }} className="w-12 h-12 rounded-xl bg-white/[0.03] hover:bg-green-500/20 text-white/20 hover:text-green-500 transition-all flex items-center justify-center text-xl font-black shadow-lg">+</button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                {showItemPicker && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="pt-4 space-y-6">
                                        <div className="relative">
                                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-solaris-orange/20" size={24} />
                                            <input type="text" placeholder="Probe Bio-Assets..." className="w-full pl-16 pr-6 py-6 bg-white/[0.03] border border-white/10 rounded-[28px] outline-none font-black text-lg italic tracking-tight placeholder:text-white/5 focus:border-solaris-orange/40 transition-all" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} autoFocus />
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto no-scrollbar pr-2">
                                            {menuItems.filter(i => i.name.toLowerCase().includes(pickerSearch.toLowerCase())).slice(0, 8).map(item => (
                                                <button key={item.id} onClick={() => {
                                                    const existing = tempItems.find(ti => ti.id === item.id);
                                                    if (existing) { setTempItems(tempItems.map(ti => ti.id === item.id ? { ...ti, quantity: ti.quantity+1 } : ti)); }
                                                    else { setTempItems([...tempItems, { ...item, quantity: 1 }]); }
                                                    setShowItemPicker(false); setPickerSearch('');
                                                }} className="p-6 bg-white/[0.02] hover:bg-solaris-orange text-white/40 hover:text-white rounded-[24px] border border-white/5 transition-all text-left flex justify-between items-center group">
                                                    <span className="font-black italic uppercase text-lg group-hover:tracking-widest transition-all">{item.name}</span>
                                                    <span className="font-black italic opacity-40 group-hover:opacity-100 text-xl">${item.price.toFixed(0)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            <div className="p-10 bg-white/[0.03] border-t border-white/10 space-y-8">
                                <div className="flex justify-between items-end px-4">
                                    <p className="text-[12px] font-black uppercase text-white/20 tracking-[0.4em] italic mb-1">Calculated Flux</p>
                                    <p className="text-5xl font-black italic text-solaris-orange tracking-tighter leading-none shadow-solaris-glow">
                                        ${tempItems.reduce((s, i) => s + (i.price * i.quantity), 0).toFixed(0)}
                                    </p>
                                </div>
                                <button onClick={() => {
                                    const isRed = tempItems.length < editingOrder.items.length || tempItems.some((it, i) => { const o = editingOrder.items.find((oi:any)=>oi.name===it.name); return o && it.quantity < (oi.quantity || 1); });
                                    if(isRed) setShowPinModal(true); else finalizeSave();
                                }} className="w-full py-8 bg-white text-black rounded-[30px] font-black italic uppercase tracking-[0.4em] text-xl shadow-2xl hover:bg-solaris-orange hover:text-white transition-all active:scale-95">
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
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[700] flex items-center justify-center bg-[#030303]/98 backdrop-blur-3xl p-6">
                         <GlowCard glowColor="orange" className="w-full max-w-md border border-white/10 !p-16 text-center bg-[#0a0a0b] shadow-[0_0_150px_rgba(249,115,22,0.15)]">
                            <div className="w-24 h-24 bg-solaris-orange/10 rounded-full flex items-center justify-center text-solaris-orange mx-auto mb-10 border border-solaris-orange/20 shadow-solaris-glow">
                                <Lock size={40} />
                            </div>
                            <h3 className="text-3xl font-black italic tracking-tighter uppercase text-white mb-2">Auth Code Required</h3>
                            <p className="text-[11px] font-black uppercase text-solaris-orange/40 tracking-[0.5em] mb-14 italic">Security Interlock Active</p>
                            
                            <div className="space-y-16">
                                <div className="flex justify-center gap-8">
                                    {[0, 1, 2, 3].map((_, i) => (
                                        <div key={i} className={`w-5 h-5 rounded-full transition-all duration-500 ${pin.length > i ? 'bg-solaris-orange shadow-[0_0_20px_#f97316] scale-125' : 'bg-white/5 border border-white/10'}`}></div>
                                    ))}
                                </div>
                                
                                <div className="grid grid-cols-3 gap-6">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                        <button key={n} onClick={() => pin.length < 4 && setPin(pin + n)} className="w-full h-20 rounded-[24px] bg-white/[0.03] hover:bg-white text-white/40 hover:text-black text-3xl font-black italic transition-all active:scale-90 shadow-xl border border-white/5">{n}</button>
                                    ))}
                                    <button onClick={() => setPin('')} className="text-[11px] font-black text-white/20 uppercase tracking-[0.2em] hover:text-red-500 transition-colors italic">Reset</button>
                                    <button onClick={() => pin.length < 4 && setPin(pin + '0')} className="w-full h-20 rounded-[24px] bg-white/[0.03] hover:bg-white text-white/40 hover:text-black text-3xl font-black italic transition-all active:scale-90 shadow-xl border border-white/5">0</button>
                                    <button onClick={() => { if(pin === '0000') finalizeSave(); else { alert('ACCESS_DENIED'); setPin(''); } }} className="w-full h-20 rounded-[24px] bg-solaris-orange text-white flex items-center justify-center hover:scale-105 transition-all shadow-solaris-glow active:scale-95"><CheckCircle2 size={32} /></button>
                                </div>
                                <button onClick={() => { setShowPinModal(false); setPin(''); }} className="mt-12 text-white/10 hover:text-white transition-colors uppercase font-black text-[10px] tracking-widest italic flex items-center justify-center gap-2 mx-auto">
                                   <X size={16} /> Discard Protocol
                                </button>
                            </div>
                        </GlowCard>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
