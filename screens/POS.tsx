import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MenuItem, OrderItem, Order, OrderStatus, Table, OrderSource } from '../types';
import { useOrders } from '../contexts/OrderContext';
import { useUser } from '../contexts/UserContext';
import { useSettings } from '../contexts/SettingsContext';
import { useMenu } from '../contexts/MenuContext';
import { useTables } from '../contexts/TableContext';
import { KitchenTicket } from '../components/KitchenTicket';
import { printerService } from '../services/PrinterService';
import { motion, AnimatePresence } from 'framer-motion';
import { GlowCard } from '../components/ui/spotlight-card';
import { 
  Search, 
  Plus, 
  Printer, 
  ShoppingCart, 
  X, 
  Minus, 
  ChefHat, 
  Table as TableIcon, 
  ShoppingBag, 
  Truck,
  Zap,
  CheckCircle2,
  Trash2,
  MoreVertical,
  QrCode
} from 'lucide-react';

export const POSScreen: React.FC = () => {
  const { activeEmployee, authProfile } = useUser();
  const { addOrder } = useOrders();
  const { tables: TABLES } = useTables();
  const { settings } = useSettings();
  const { menuItems, addItem } = useMenu();
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState('A la carte');
  const [kitchenOrderToPrint, setKitchenOrderToPrint] = useState<Order | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedSource, setSelectedSource] = useState<OrderSource>(OrderSource.DINE_IN);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [printerReady, setPrinterReady] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setPrinterReady(printerService.isConnected()), 2000);
    return () => clearInterval(interval);
  }, []);

  const dynamicCategories = useMemo(() => {
    const cats = new Set<string>();
    menuItems.forEach(item => { if (item.category) cats.add(item.category); });
    return Array.from(cats).sort();
  }, [menuItems]);

  const activeMenuItems = useMemo(() => menuItems.filter(item => item.status === 'ACTIVE'), [menuItems]);

  const filteredItems = useMemo(() => {
    return activeMenuItems.filter(item => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery, activeMenuItems]);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1, notes: '' }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) return { ...item, quantity: Math.max(1, item.quantity + delta) };
      return item;
    }));
  };

  const handleSendOrder = async () => {
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const newOrder: Order = {
        id: crypto.randomUUID(),
        tableId: selectedTable?.id || 'COUNTER',
        items: [...cart],
        status: OrderStatus.COOKING,
        timestamp: new Date(),
        total,
        waiterName: activeEmployee?.name || 'Sistema',
        source: selectedSource,
        businessId: authProfile?.businessId,
        locationId: authProfile?.locationId
    };

    try {
        await addOrder(newOrder);
        if (settings.isKitchenPrintingEnabled) {
          let printSuccess = false;
          if (settings.isDirectPrintingEnabled) {
            try {
                printSuccess = await printerService.printKitchenTicket(newOrder, settings);
            } catch (err) { printSuccess = false; }
          }
          if (!printSuccess) {
            document.body.classList.add('print-mode');
            setKitchenOrderToPrint(newOrder);
            setTimeout(() => { window.print(); setKitchenOrderToPrint(null); document.body.classList.remove('print-mode'); }, 1200);
          }
        }
        setCart([]);
        setShowSuccessModal(true);
        setTimeout(() => setShowSuccessModal(false), 2000);
    } catch (err) { alert('Error sending order.'); }
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="flex h-full w-full bg-[#030303] text-white overflow-hidden relative antialiased">
      {/* Hidden print root */}
      <div className="hidden print:block absolute inset-0 z-[9999] bg-white">
          {kitchenOrderToPrint && <KitchenTicket order={kitchenOrderToPrint} settings={settings} />}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-6 md:p-10 overflow-hidden relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col xl:flex-row gap-6 mb-10 items-stretch">
          <GlowCard glowColor="orange" className="xl:w-[350px] border border-white/5 bg-[#0a0a0b] flex flex-col justify-center rounded-solaris shadow-2xl">
            <div className="flex items-center gap-3 mb-2 opacity-40">
                <Zap size={14} className="text-solaris-orange" />
                <span className="text-[10px] font-black tracking-[0.3em] uppercase">{authProfile?.businessName || 'SOLARIS CORE'}</span>
            </div>
            <h2 className="text-3xl font-black italic tracking-tighter uppercase text-white mb-2 leading-none">Command Center</h2>
            <div className="flex items-center gap-2 text-[9px] font-black uppercase text-solaris-orange/60 tracking-widest italic">
                <div className="w-1.5 h-1.5 rounded-full bg-solaris-orange animate-pulse" />
                Synchronized Node Online
            </div>
          </GlowCard>

          <GlowCard className="flex-1 border border-white/5 bg-[#0a0a0b] !p-8 flex flex-col justify-between rounded-solaris shadow-2xl">
            <div className="flex flex-wrap justify-between items-center gap-6">
                <div className="flex bg-white/[0.03] border border-white/5 p-1 rounded-[24px]">
                    {['A la carte', 'Bebidas', 'Rappi/Uber'].map(menu => (
                        <button
                            key={menu}
                            onClick={() => setActiveMenu(menu)}
                            className={`px-5 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${activeMenu === menu ? 'bg-solaris-orange text-white shadow-solaris-glow' : 'text-white/30 hover:text-white hover:bg-white/5'}`}
                        >
                            {menu}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-8">
                    {activeEmployee && (
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-widest leading-none mb-2">Active Operator</p>
                                <p className="text-sm font-black text-white italic">{activeEmployee.name}</p>
                            </div>
                            <img src={activeEmployee.image} className="w-14 h-14 rounded-[20px] object-cover border border-white/10 shadow-lg" alt="" />
                        </div>
                    )}
                    {settings.isDirectPrintingEnabled && (
                        <button 
                            className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest border transition-all ${printerReady ? 'bg-green-500/10 text-green-500 border-green-500/20 shadow-green-900/10 shadow-lg' : 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse'}`}
                        >
                            <Printer size={16} /> {printerReady ? 'PRNT_READY' : 'PRNT_ERR'}
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-8 relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-solaris-orange transition-colors" size={20} />
                <input 
                    type="text" 
                    placeholder="Search biological or physical menu assets..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-16 pr-6 py-5 bg-white/[0.03] border border-white/5 rounded-[24px] text-white font-bold outline-none focus:border-solaris-orange/40 focus:bg-white/[0.05] shadow-inner transition-all text-sm placeholder:text-white/20"
                />
            </div>
          </GlowCard>
        </div>

        {/* Categories */}
        <div className="mb-10 flex gap-4 overflow-x-auto no-scrollbar pb-2">
            <button
                onClick={() => setActiveCategory('All')}
                className={`px-8 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === 'All' ? 'bg-solaris-orange text-white shadow-solaris-glow scale-105' : 'bg-white/[0.03] text-white/40 border border-white/5 hover:bg-white/5'}`}
            >
                Global
            </button>
            {dynamicCategories.map(cat => (
                <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-8 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-solaris-orange text-white shadow-solaris-glow scale-105' : 'bg-white/[0.03] text-white/40 border border-white/5 hover:bg-white/5'}`}
                >
                    {cat}
                </button>
            ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xxl:grid-cols-5 gap-8 pb-10">
                {filteredItems.map(item => (
                    <motion.div 
                        key={item.id} 
                        layout 
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => addToCart(item)}
                        className="cursor-pointer"
                    >
                        <GlowCard glowColor="orange" className="!p-0 border border-white/5 bg-[#0a0a0b] overflow-hidden group shadow-2xl rounded-solaris">
                           <div className="relative h-48 overflow-hidden">
                                <img src={item.image} className="w-full h-full object-cover filter contrast-125 transition-transform duration-700 group-hover:scale-110" alt="" />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-transparent to-transparent opacity-80" />
                                <div className="absolute bottom-5 left-5 right-5 flex justify-between items-end">
                                    <div>
                                        <h3 className="text-sm font-black uppercase italic text-white tracking-tighter leading-tight mb-1">{item.name}</h3>
                                        <p className="text-[9px] font-black uppercase text-white/40 tracking-widest">{item.category}</p>
                                    </div>
                                    <div className="bg-solaris-orange text-white p-2.5 rounded-xl shadow-solaris-glow group-hover:scale-110 transition-transform">
                                        <Plus size={18} />
                                    </div>
                                </div>
                                <div className="absolute top-5 right-5 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                                    <span className="text-xs font-black italic text-solaris-orange tracking-widest">${item.price.toFixed(0)}</span>
                                </div>
                           </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-[450px] bg-[#030303] border-l border-white/10 flex flex-col z-10 shadow-[-30px_0_60px_rgba(0,0,0,0.8)]">
        <div className="p-8 border-b border-white/5">
            <div 
                className="flex items-center justify-between cursor-pointer group p-6 bg-white/[0.02] rounded-solaris border border-white/5 hover:border-solaris-orange/20 transition-all shadow-xl"
                onClick={() => setShowTableModal(true)}
            >
                <div>
                   <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white group-hover:text-solaris-orange transition-colors">
                        {selectedTable ? selectedTable.name : 'Select Node'}
                   </h2>
                   <p className="text-[9px] font-black uppercase text-white/20 tracking-widest mt-2 overflow-hidden whitespace-nowrap">Protocol Stream 88-XN</p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/20 group-hover:text-solaris-orange transition-all shadow-inner">
                    <TableIcon size={28} />
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
            <AnimatePresence>
                {cart.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-white/5">
                        <ShoppingCart size={80} className="mb-8 opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-[0.5em] italic">Queue Empty</p>
                    </motion.div>
                ) : (
                    cart.map((item, idx) => (
                        <motion.div 
                            key={`${item.id}-${idx}`}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-[#0a0a0b] border border-white/5 p-6 rounded-solaris relative group overflow-hidden shadow-2xl"
                        >
                             <div className="flex justify-between items-start mb-5">
                                <div className="flex gap-4">
                                    <div className="w-12 h-12 rounded-[18px] bg-solaris-orange/10 border border-solaris-orange/20 flex items-center justify-center text-solaris-orange font-black italic text-lg shadow-inner">
                                        {item.quantity}
                                    </div>
                                    <div>
                                        <h4 className="font-black italic text-white uppercase tracking-tight text-sm mb-1 leading-tight">{item.name}</h4>
                                        <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Unit Val: ${item.price}</p>
                                    </div>
                                </div>
                                <span className="text-base font-black italic text-white tracking-widest">${(item.price * item.quantity).toFixed(0)}</span>
                             </div>

                             <input 
                                type="text"
                                placeholder="Add technical instruction..."
                                value={item.notes || ''}
                                onChange={(e) => {
                                    setCart(prev => prev.map(i => i.id === item.id ? { ...i, notes: e.target.value } : i));
                                }}
                                className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3 text-[10px] placeholder:text-white/10 text-white/60 font-medium focus:outline-none focus:border-solaris-orange/20 italic transition-all"
                             />

                             <div className="mt-8 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => updateQuantity(item.id, -1)} className="w-10 h-10 bg-white/5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"><Minus size={16} /></button>
                                <button onClick={() => updateQuantity(item.id, 1)} className="w-10 h-10 bg-white/5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"><Plus size={16} /></button>
                                <button onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))} className="w-10 h-10 bg-red-500/10 rounded-xl text-red-500/40 hover:text-red-500 hover:bg-red-500/20 transition-all flex items-center justify-center"><Trash2 size={16} /></button>
                             </div>
                        </motion.div>
                    ))
                )}
            </AnimatePresence>
        </div>

        <div className="p-8 bg-[#0a0a0b] border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
            <div className="grid grid-cols-2 gap-4 mb-10">
                {[
                    { id: OrderSource.TO_GO, icon: ShoppingBag, label: 'Carry out', color: 'bg-white/5 border-white/5 text-white/40' },
                    { id: OrderSource.RAPPI, icon: Truck, label: 'Grid/Rappi', color: 'bg-[#FF3C5C]/5 border-[#FF3C5C]/10 text-[#FF3C5C]/60' },
                    { id: OrderSource.UBER_EATS, icon: ChefHat, label: 'Uber System', color: 'bg-[#06C167]/5 border-[#06C167]/10 text-[#06C167]/60' },
                    { id: OrderSource.DINE_IN, icon: TableIcon, label: 'In-Node', color: 'bg-solaris-orange/10 border-solaris-orange/10 text-solaris-orange' }
                ].map(src => (
                    <button 
                        key={src.id}
                        onClick={() => setSelectedSource(src.id)}
                        className={`py-4 rounded-[22px] flex items-center justify-center gap-3 transition-all border ${selectedSource === src.id ? 'bg-solaris-orange text-white border-solaris-orange shadow-solaris-glow scale-[1.02]' : `${src.color} hover:bg-white/5`}`}
                    >
                        <src.icon size={18} />
                        <span className="text-[9px] font-black uppercase tracking-widest">{src.label}</span>
                    </button>
                ))}
            </div>

            <div className="flex justify-between items-end mb-10 px-2">
                <div>
                    <p className="text-[9px] font-black uppercase text-white/20 tracking-[0.4em] mb-2 font-black">Payload Valuation</p>
                    <p className="text-4xl font-black italic tracking-tighter text-white uppercase italic">${total.toFixed(2)}</p>
                </div>
                <div className="text-right">
                    <p className="text-[9px] font-black text-solaris-orange uppercase tracking-widest mb-1 shadow-solaris-glow underline underline-offset-4">Protocol Secured</p>
                    <p className="text-[10px] text-white/20 font-bold italic">Net Node Output</p>
                </div>
            </div>

            <button
                onClick={handleSendOrder}
                disabled={cart.length === 0}
                className="w-full py-6 bg-solaris-orange text-white font-black italic tracking-[0.2em] uppercase text-xl rounded-[28px] shadow-solaris-glow hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center gap-4"
            >
                Authorize Transmission <Zap size={28} />
            </button>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl">
                <div className="w-full max-w-md bg-[#0a0a0b] border border-white/10 rounded-[40px] p-16 flex flex-col items-center text-center shadow-2xl">
                    <motion.div animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }} transition={{ duration: 0.5 }} className="w-28 h-28 bg-solaris-orange rounded-full flex items-center justify-center mb-10 shadow-solaris-glow">
                        <CheckCircle2 size={56} className="text-white" />
                    </motion.div>
                    <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter mb-4">Transmission Successful</h2>
                    <p className="text-white/30 font-bold text-[11px] uppercase tracking-[0.3em] font-black">Kitchen Unit Acknowledged Packet</p>
                </GlowCard>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Table Modal */}
      <AnimatePresence>
        {showTableModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6">
                <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[#0a0a0b] border border-white/10 rounded-[40px] w-full max-w-3xl p-12 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-solaris-orange/50 to-transparent"></div>
                    <div className="flex justify-between items-center mb-12">
                        <div>
                            <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white font-black">Node Grid Matrix</h2>
                            <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.4em] mt-1 italic">Select Terminal Assignment</p>
                        </div>
                        <button onClick={() => setShowTableModal(false)} className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 text-white/30 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center"><X size={32} /></button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8 max-h-[60vh] overflow-y-auto no-scrollbar pr-4">
                        {TABLES.map(table => (
                            <button
                                key={table.id}
                                onClick={() => { setSelectedTable(table); setShowTableModal(false); }}
                                className={`p-10 rounded-solaris border-2 flex flex-col items-center gap-6 transition-all group ${selectedTable?.id === table.id ? 'border-solaris-orange bg-solaris-orange/10 text-solaris-orange shadow-solaris-glow scale-105' : 'border-white/5 text-white/20 hover:text-white hover:border-white/20 hover:bg-white/5'}`}
                            >
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${selectedTable?.id === table.id ? 'bg-solaris-orange text-white' : 'bg-white/5 text-white/20'}`}>
                                    <TableIcon size={40} />
                                </div>
                                <div className="text-center">
                                    <span className="font-black text-2xl italic uppercase font-black block leading-none mb-2">{table.name}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{table.seats} PERSONS</span>
                                </div>
                            </button>
                        ))}
                    </div>
                    <div className="mt-12 flex justify-center">
                        <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.5em] italic">Authorized Selection Only</p>
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
