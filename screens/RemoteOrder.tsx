import React, { useState, useMemo } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { useUser } from '../contexts/UserContext';
import { useSettings } from '../contexts/SettingsContext';
import { useMenu } from '../contexts/MenuContext';
import { MenuItem, OrderItem, Order, OrderStatus, OrderSource, PaymentMethod, PaymentStatus, Table } from '../types';
import { CATEGORIES, TABLES } from '../constants';
import { bluetoothTerminalService } from '../services/BluetoothTerminalService';
import { printerService } from '../services/PrinterService';
import { motion, AnimatePresence } from 'framer-motion';
import { GlowCard } from '../components/ui/spotlight-card';
import {
    Search, Smartphone, Table2, Plus, Minus, Trash2, X,
    CreditCard, Wallet, ArrowRight, CheckCircle2, Zap, Copy,
    ShoppingCart
} from 'lucide-react';

export const RemoteOrderScreen: React.FC = () => {
    const { currentUser } = useUser();
    const { addOrder } = useOrders();
    const { settings } = useSettings();
    const { menuItems } = useMenu();

    const [activeMode, setActiveMode] = useState<'DRIVE_THRU' | 'TABLES'>('DRIVE_THRU');
    const [selectedTable, setSelectedTable] = useState<Table | null>(null);
    const [showTableModal, setShowTableModal] = useState(false);
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<OrderItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [terminalStep, setTerminalStep] = useState('');
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [lastOrderTotal, setLastOrderTotal] = useState(0);

    const categories = useMemo(() => {
        const cats = Array.from(new Set(menuItems.map(i => i.category).filter(Boolean)));
        return ['All', ...cats];
    }, [menuItems]);

    const filteredItems = useMemo(() =>
        menuItems.filter(item => {
            const matchesStatus = item.status === 'ACTIVE';
            const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesStatus && matchesCategory && matchesSearch;
        }), [menuItems, activeCategory, searchQuery]);

    const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + (i.price * i.quantity), 0), [cart]);

    const addToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { ...item, quantity: 1, notes: '' }];
        });
    };

    const updateQuantity = (id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) { const nq = Math.max(0, item.quantity + delta); return { ...item, quantity: nq }; }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const handlePayment = async (method: PaymentMethod) => {
        if (cart.length === 0) return;
        if (activeMode === 'TABLES' && !selectedTable) { setShowTableModal(true); return; }
        const total = cartTotal;
        setLastOrderTotal(total);
        if (method === PaymentMethod.CARD && settings.isTerminalEnabled) {
            setIsProcessing(true);
            await bluetoothTerminalService.simulateTransaction(total, (step) => setTerminalStep(step));
            setIsProcessing(false);
        }
        const newOrder: Order = {
            id: `REM-${Date.now().toString().slice(-6)}`,
            tableId: activeMode === 'DRIVE_THRU' ? 'Drive-Thru' : (selectedTable?.name || 'Mesa'),
            items: [...cart],
            status: OrderStatus.COMPLETED,
            paymentStatus: PaymentStatus.PAID,
            paymentMethod: method,
            timestamp: new Date(),
            total,
            source: activeMode === 'DRIVE_THRU' ? OrderSource.DRIVE_THRU : OrderSource.DINE_IN,
            waiterName: currentUser?.name || 'Remoto'
        };
        addOrder(newOrder);
        if (settings.isDirectPrintingEnabled) await printerService.printOrder(newOrder, settings);
        setCart([]);
        setShowSuccessModal(true);
        setTimeout(() => setShowSuccessModal(false), 3000);
    };

    return (
        <div className="flex h-full bg-[#030303] text-white overflow-hidden antialiased">

            {/* ── LEFT: Menu Browser ── */}
            <div className="flex-1 flex flex-col overflow-hidden border-r border-white/5">
                {/* Header */}
                <header className="px-8 pt-8 pb-6 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-2xl bg-solaris-orange/10 border border-solaris-orange/20 flex items-center justify-center">
                            <Smartphone size={18} className="text-solaris-orange" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Remote Order</h1>
                            <p className="text-white/20 font-bold text-[9px] uppercase tracking-[0.4em]">Drive-Thru & Remote Dispatch</p>
                        </div>
                    </div>

                    {/* Mode toggle */}
                    <div className="flex gap-4 items-center flex-wrap">
                        <div className="bg-white/[0.03] border border-white/5 p-1 rounded-2xl flex">
                            <button
                                onClick={() => { setActiveMode('DRIVE_THRU'); setSelectedTable(null); }}
                                className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeMode === 'DRIVE_THRU' ? 'bg-solaris-orange text-white shadow-solaris-glow' : 'text-white/30 hover:text-white'}`}
                            >
                                <Smartphone size={14} /> Drive-Thru
                            </button>
                            <button
                                onClick={() => setActiveMode('TABLES')}
                                className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeMode === 'TABLES' ? 'bg-solaris-orange text-white shadow-solaris-glow' : 'text-white/30 hover:text-white'}`}
                            >
                                <Table2 size={14} /> {selectedTable ? selectedTable.name : 'Mesas'}
                            </button>
                        </div>

                        {/* Search */}
                        <div className="flex-1 min-w-[200px] relative">
                            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                            <input
                                type="text"
                                placeholder="Buscar producto..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm font-bold text-white outline-none focus:border-solaris-orange/40 placeholder:text-white/10 transition-all"
                            />
                        </div>
                    </div>
                </header>

                {/* Categories */}
                <div className="flex gap-3 overflow-x-auto no-scrollbar px-8 py-4 shrink-0 border-b border-white/5">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-5 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest whitespace-nowrap transition-all ${activeCategory === cat ? 'bg-solaris-orange text-white shadow-solaris-glow' : 'bg-white/[0.03] border border-white/5 text-white/30 hover:text-white hover:border-white/20'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-6">
                    {filteredItems.length === 0 ? (
                        <div className="h-full flex items-center justify-center opacity-10">
                            <p className="text-[12px] font-black uppercase tracking-[0.4em]">Sin productos</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => addToCart(item)}
                                    className="bg-white/[0.02] border border-white/5 p-4 rounded-[28px] text-left hover:border-solaris-orange/30 hover:bg-white/[0.04] hover:scale-[1.02] active:scale-95 transition-all group relative overflow-hidden"
                                >
                                    <div className="h-28 w-full mb-4 bg-white/[0.02] rounded-2xl overflow-hidden relative">
                                        {item.image
                                            ? <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                            : <div className="w-full h-full flex items-center justify-center"><Zap size={32} className="text-white/10" /></div>
                                        }
                                        <div className="absolute inset-0 bg-solaris-orange/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Plus size={32} className="text-white" />
                                        </div>
                                    </div>
                                    <h3 className="font-black italic text-white text-sm leading-tight mb-1 uppercase line-clamp-2">{item.name}</h3>
                                    <p className="text-solaris-orange font-black italic text-base">${item.price.toFixed(2)}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── RIGHT: Cart & Checkout ── */}
            <div className="w-[400px] min-w-[320px] bg-[#030303] flex flex-col border-l border-white/5 shadow-2xl">
                <div className="px-8 pt-8 pb-6 border-b border-white/5 shrink-0">
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Orden de Venta</h2>
                    <p className="text-white/20 font-bold text-[9px] uppercase tracking-widest mt-1">
                        {activeMode === 'DRIVE_THRU' ? 'Drive-Thru' : (selectedTable ? `Mesa: ${selectedTable.name}` : 'Sin mesa asignada')}
                    </p>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-3">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-10">
                            <ShoppingCart size={64} className="mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-center">Canasta vacía</p>
                        </div>
                    ) : cart.map(item => (
                        <div key={item.id} className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-white/10 transition-all">
                            <div className="flex-1 min-w-0">
                                <h4 className="font-black italic text-white text-sm uppercase leading-tight truncate">{item.name}</h4>
                                <p className="text-white/30 font-bold text-[10px] mt-0.5">${item.price.toFixed(2)} c/u</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => updateQuantity(item.id, -1)} className="w-7 h-7 rounded-lg bg-white/[0.04] text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-all flex items-center justify-center">
                                    <Minus size={12} />
                                </button>
                                <span className="font-black italic text-base text-white w-5 text-center">{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.id, 1)} className="w-7 h-7 rounded-lg bg-white/[0.04] text-white/40 hover:bg-solaris-orange/20 hover:text-solaris-orange transition-all flex items-center justify-center">
                                    <Plus size={12} />
                                </button>
                            </div>
                            <span className="font-black italic text-sm text-white w-16 text-right shrink-0">${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                    ))}
                </div>

                {/* Totals & Payment */}
                <div className="p-6 border-t border-white/5 shrink-0 space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-white/5">
                        <span className="text-white/30 font-bold text-[10px] uppercase tracking-widest">Subtotal</span>
                        <span className="text-white/30 font-bold text-sm">${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-white font-black italic text-xl uppercase">Total</span>
                        <span className="text-solaris-orange font-black italic text-2xl">${cartTotal.toFixed(2)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            disabled={cart.length === 0 || isProcessing}
                            onClick={() => handlePayment(PaymentMethod.CARD)}
                            className="flex flex-col items-center justify-center gap-2 py-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400 hover:bg-blue-500/20 transition-all disabled:opacity-30 active:scale-95 font-black text-[9px] uppercase tracking-widest"
                        >
                            <CreditCard size={22} /> Tarjeta
                        </button>
                        <button
                            disabled={cart.length === 0 || isProcessing}
                            onClick={() => setShowTransferModal(true)}
                            className="flex flex-col items-center justify-center gap-2 py-5 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400 hover:bg-purple-500/20 transition-all disabled:opacity-30 active:scale-95 font-black text-[9px] uppercase tracking-widest"
                        >
                            <ArrowRight size={22} /> Transferencia
                        </button>
                    </div>

                    <button
                        disabled={cart.length === 0 || isProcessing}
                        onClick={() => handlePayment(PaymentMethod.CASH)}
                        className="w-full py-4 bg-solaris-orange text-white rounded-2xl font-black italic uppercase text-[10px] tracking-widest shadow-solaris-glow hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                    >
                        <Wallet size={16} /> Pagar en Efectivo
                    </button>
                </div>
            </div>

            {/* ── MODALS ── */}

            {/* Terminal Processing */}
            <AnimatePresence>
                {isProcessing && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
                    >
                        <div className="bg-[#0d0d0e] border border-white/10 w-full max-w-sm rounded-[40px] p-10 text-center shadow-2xl">
                            <div className="w-20 h-20 mx-auto mb-8 relative">
                                <div className="absolute inset-0 border-4 border-solaris-orange/20 rounded-full" />
                                <div className="absolute inset-0 border-4 border-solaris-orange rounded-full border-t-transparent animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <CreditCard size={32} className="text-solaris-orange" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black italic uppercase text-white mb-2 tracking-tighter">Procesando Pago</h3>
                            <p className="text-solaris-orange font-bold animate-pulse text-[10px] uppercase tracking-widest mb-6">{terminalStep}</p>
                            <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest">No apagues la terminal</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Transfer Modal */}
            <AnimatePresence>
                {showTransferModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
                    >
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                            className="bg-[#0d0d0e] border border-white/10 w-full max-w-md rounded-[40px] overflow-hidden shadow-2xl"
                        >
                            <div className="bg-purple-500/10 border-b border-purple-500/20 p-10 text-center">
                                <p className="text-purple-400/60 font-black text-[9px] uppercase tracking-[0.4em] mb-2">Total a Transferir</p>
                                <h2 className="text-6xl font-black italic tracking-tighter text-white">${cartTotal.toFixed(2)}</h2>
                            </div>
                            <div className="p-10 space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Banco</p>
                                        <p className="font-black italic text-white uppercase">{settings.bankName || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">Beneficiario</p>
                                        <p className="font-black italic text-white uppercase">{settings.bankBeneficiary || '—'}</p>
                                    </div>
                                </div>
                                <div className="bg-white/[0.03] border border-white/5 p-5 rounded-2xl flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1">CLABE / Tarjeta</p>
                                        <p className="font-black italic text-purple-400 text-lg tracking-wider truncate">
                                            {settings.bankCLABE || settings.bankAccount || '— —'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(settings.bankCLABE || ''); }}
                                        className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center text-purple-400 hover:bg-purple-500/20 transition-all shrink-0"
                                    >
                                        <Copy size={16} />
                                    </button>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setShowTransferModal(false)}
                                        className="flex-1 py-4 bg-white/[0.03] border border-white/5 rounded-2xl text-white/40 font-black text-[10px] uppercase tracking-widest hover:text-white transition-all"
                                    >
                                        Regresar
                                    </button>
                                    <button
                                        onClick={() => { handlePayment(PaymentMethod.TRANSFER); setShowTransferModal(false); }}
                                        className="flex-1 py-4 bg-purple-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-purple-400 transition-all shadow-lg"
                                    >
                                        Confirmar
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Table Selection Modal */}
            <AnimatePresence>
                {showTableModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
                    >
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                            className="bg-[#0d0d0e] border border-white/10 w-full max-w-2xl rounded-[40px] p-10 shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h2 className="text-3xl font-black italic uppercase text-white tracking-tighter">Seleccionar Mesa</h2>
                                    <p className="text-white/20 font-bold text-[9px] uppercase tracking-widest mt-1">Asigna esta orden remota</p>
                                </div>
                                <button onClick={() => setShowTableModal(false)} className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center text-white/30 hover:text-white transition-all">
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-4 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                                {TABLES.map(table => (
                                    <button
                                        key={table.id}
                                        onClick={() => { setSelectedTable(table); setShowTableModal(false); }}
                                        className={`p-6 rounded-[28px] border-2 flex flex-col items-center gap-2 transition-all ${selectedTable?.id === table.id ? 'border-solaris-orange bg-solaris-orange/10 text-solaris-orange' : 'border-white/5 bg-white/[0.02] text-white/40 hover:border-white/20 hover:text-white'}`}
                                    >
                                        <Table2 size={28} />
                                        <span className="font-black italic text-lg">{table.name}</span>
                                        <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">{table.seats} sillas</span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Success Modal */}
            <AnimatePresence>
                {showSuccessModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-xl"
                    >
                        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="bg-[#0d0d0e] border border-white/10 p-16 rounded-[40px] shadow-2xl flex flex-col items-center">
                            <div className="w-24 h-24 bg-green-500/10 border-2 border-green-500 rounded-full flex items-center justify-center mb-6 shadow-2xl">
                                <CheckCircle2 size={48} className="text-green-400" />
                            </div>
                            <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">Cobro Exitoso</h2>
                            <p className="text-white/30 font-bold mt-3 uppercase text-[10px] tracking-[0.4em]">Orden por ${lastOrderTotal.toFixed(2)}</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
