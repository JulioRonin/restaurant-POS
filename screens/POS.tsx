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
          // Always attempt direct printing if a device is configured
          if (printerService.isConnected() || (settings.connectedDeviceName && settings.connectedDeviceName !== 'None')) {
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

  const [isCartOpen, setIsCartOpen] = useState(false);

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-[#F0F0E8] text-[#1a1c14] relative antialiased">
      {/* Hidden print root */}
      <div className="hidden print:block absolute inset-0 z-[9999] bg-white">
          {kitchenOrderToPrint && <KitchenTicket order={kitchenOrderToPrint} settings={settings} />}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-3 md:p-6 overflow-hidden relative z-10 w-full min-h-0">
        
        {/* Compact Header Section */}
        <div className="flex flex-col lg:flex-row gap-3 mb-3 items-center">
          <div className="flex items-center justify-between w-full lg:w-auto lg:min-w-[200px] bg-white border border-white/5 rounded-2xl p-2.5 px-4 shadow-xl">
            <div>
              <div className="flex items-center gap-1.5 opacity-60 mb-0.5">
                  <Zap size={8} className="text-solaris-orange" />
                  <span className="text-[7px] font-black tracking-[0.2em] uppercase">{authProfile?.businessName || 'KOSO POS'}</span>
              </div>
              <h2 className="text-lg font-black italic tracking-tighter uppercase text-[#1a1c14] leading-none">Command Center</h2>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5 text-[6px] font-black uppercase text-solaris-orange/80 tracking-widest italic">
                  <div className="w-1 h-1 rounded-full bg-solaris-orange animate-pulse" />
                  Online
              </div>
            </div>
          </div>

          <div className="flex-1 w-full flex flex-col sm:flex-row items-center gap-3 bg-white border border-white/5 rounded-2xl p-2 px-3 shadow-xl">
            <div className="flex bg-white/[0.03] border border-white/5 p-0.5 rounded-lg w-full sm:w-auto">
                {['A la carte', 'Bebidas', 'Rappi/Uber'].map(menu => (
                    <button
                        key={menu}
                        onClick={() => setActiveMenu(menu)}
                        className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-[7px] font-black uppercase tracking-widest transition-all ${activeMenu === menu ? 'bg-solaris-orange text-[#1a1c14] shadow-solaris-glow' : 'text-[#505530]/45 hover:text-[#1a1c14] hover:bg-white/5'}`}
                    >
                        {menu}
                    </button>
                ))}
            </div>

            <div className="flex-1 w-full relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#505530]/45 group-focus-within:text-solaris-orange transition-colors" size={12} />
                <input 
                    type="text" 
                    placeholder="Buscar platillo..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-[#F0F0E8] border border-[#505530]/15 rounded-lg text-[#505530] font-bold outline-none focus:border-[#F98359]/60 transition-all text-[10px] placeholder:text-[#505530]/30 h-[32px]"
                />
            </div>

            <div className="flex items-center gap-3 shrink-0">
                {settings.isDirectPrintingEnabled && (
                    <button 
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[6px] font-black uppercase tracking-widest border transition-all h-[32px] ${printerReady ? 'bg-green-500/10 text-green-500 border-green-500/20 shadow-green-900/10' : 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse'}`}
                    >
                        <Printer size={10} /> {printerReady ? 'ON' : 'ERR'}
                    </button>
                )}
                {activeEmployee && (
                    <div className="flex items-center gap-2">
                        <div className="text-right hidden sm:block">
                            <p className="text-[6px] font-black text-[#505530]/45 uppercase tracking-widest leading-none mb-0.5">Op</p>
                            <p className="text-[9px] font-black text-[#1a1c14] italic leading-none">{activeEmployee.name}</p>
                        </div>
                        <img src={activeEmployee.image} className="w-8 h-8 rounded-lg object-cover border border-white/10 shadow-lg" alt="" />
                    </div>
                )}
            </div>
          </div>
        </div>

        {/* Categories (Responsive scrolling) */}
        <div className="mb-3 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <button
                onClick={() => setActiveCategory('All')}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${activeCategory === 'All' ? 'bg-[#505530] text-[#505530] shadow-olive-glow scale-105' : 'bg-white text-[#505530]/60 border border-[#505530]/15 hover:bg-[#505530]/10'}`}
            >
                Global
            </button>
            {dynamicCategories.map(cat => (
                <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-[#505530] text-[#505530] shadow-olive-glow scale-105' : 'bg-white text-[#505530]/60 border border-[#505530]/15 hover:bg-[#505530]/10'}`}
                >
                    {cat}
                </button>
            ))}
        </div>

        {/* Grid Responsive Columns */}
        <div
            className="flex-1 min-h-0"
            style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
        >
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3 pb-40 lg:pb-6">
                {filteredItems.map(item => (
                    <motion.div 
                        key={item.id} 
                        layout 
                        whileHover={{ y: -2, scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => addToCart(item)}
                        className="cursor-pointer"
                    >
                        <div className="bg-white border border-[#505530]/12 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-[#F98359]/40 transition-all group">
                           <div className="relative h-24 sm:h-28 overflow-hidden">
                                <img src={item.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="" />
                                <div className="absolute top-1.5 right-1.5 bg-[#505530]/90 backdrop-blur-sm px-2 py-0.5 rounded-md">
                                    <span className="text-[9px] font-black text-[#505530] tracking-wider">${item.price.toFixed(0)}</span>
                                </div>
                                <div className="absolute bottom-1.5 right-1.5 bg-[#F98359] text-[#505530] p-1 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-all">
                                    <Plus size={10} />
                                </div>
                           </div>
                           <div className="p-2">
                               <h3 className="text-[9px] font-black uppercase text-[#505530] tracking-tight leading-tight truncate">{item.name}</h3>
                               <p className="text-[7px] font-bold text-[#505530]/40 uppercase tracking-widest truncate mt-0.5">{item.category}</p>
                           </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>

        {/* Floating Cart Button (Mobile Only) */}
        <div className="lg:hidden fixed z-[90]" style={{ bottom: '100px', right: '20px' }}>
            <button 
                onClick={() => setIsCartOpen(!isCartOpen)}
                className="w-14 h-14 bg-solaris-orange text-[#1a1c14] rounded-full flex items-center justify-center shadow-solaris-glow relative"
            >
                <ShoppingCart size={24} />
                {cartItemCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-white text-solaris-orange w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] shadow-lg border-2 border-solaris-orange">
                        {cartItemCount}
                    </span>
                )}
            </button>
        </div>
      </div>

      {/* Cart Sidebar (Responsive: Visible on large, Sidebar on mobile) */}
      <div className={`
        ${isCartOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0
        fixed lg:relative inset-y-0 right-0 w-full xs:w-[380px] sm:w-[420px] lg:w-[450px] 
        bg-[#F0F0E8] border-l border-white/10 flex flex-col z-[60] lg:z-10 
        shadow-[-30px_0_60px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-in-out
      `}>
        {/* Mobile Header for Cart */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-[#1a1c14]">Order Queue</h3>
            <button onClick={() => setIsCartOpen(false)} className="p-2 text-[#505530]/55 hover:text-[#1a1c14]">
                <X size={24} />
            </button>
        </div>

        <div className="p-4 md:p-8 border-b border-white/5">
            <div 
                className="flex items-center justify-between cursor-pointer group p-4 md:p-6 bg-white/[0.02] rounded-solaris border border-white/5 hover:border-solaris-orange/20 transition-all shadow-xl"
                onClick={() => setShowTableModal(true)}
            >
                <div className="flex-1 min-w-0 pr-4">
                   <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-[#1a1c14] group-hover:text-solaris-orange transition-colors truncate">
                        {selectedTable ? selectedTable.name : 'Select Node'}
                   </h2>
                   <p className="text-[8px] font-black uppercase text-[#505530]/30 tracking-widest mt-1">Terminal Secure Protocol</p>
                </div>
                <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-[#505530]/30 group-hover:text-solaris-orange transition-all shadow-inner shrink-0">
                    <TableIcon size={20} className="md:w-7 md:h-7" />
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6 custom-scrollbar">
            <AnimatePresence>
                {cart.length === 0 ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-[#505530]/5">
                        <ShoppingCart size={60} className="mb-6 opacity-20" />
                        <p className="text-[9px] font-black uppercase tracking-[0.5em] italic">Queue Empty</p>
                    </motion.div>
                ) : (
                    cart.map((item, idx) => (
                        <motion.div 
                            key={`${item.id}-${idx}`}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-white border border-white/5 p-4 md:p-6 rounded-solaris relative group overflow-hidden shadow-2xl"
                        >
                             <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-solaris-orange/10 border border-solaris-orange/20 flex items-center justify-center text-solaris-orange font-black italic text-base shadow-inner">
                                        {item.quantity}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-black italic text-[#1a1c14] uppercase tracking-tight text-[13px] mb-0.5 leading-tight">{item.name}</h4>
                                        <p className="text-[8px] font-black text-[#505530]/45 uppercase tracking-widest">Val: ${item.price}</p>
                                    </div>
                                </div>
                                <span className="text-sm font-black italic text-[#1a1c14] tracking-widest">${(item.price * item.quantity).toFixed(0)}</span>
                             </div>

                             <input 
                                type="text"
                                placeholder="Add instruction..."
                                value={item.notes || ''}
                                onChange={(e) => {
                                    setCart(prev => prev.map(i => i.id === item.id ? { ...i, notes: e.target.value } : i));
                                }}
                                className="w-full bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 text-[9px] placeholder:text-[#505530]/10 text-[#505530]/60 font-medium focus:outline-none focus:border-solaris-orange/20 italic transition-all"
                             />

                             <div className="mt-4 flex justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 bg-white/5 rounded-lg text-[#505530]/55 hover:text-[#1a1c14] hover:bg-white/10 transition-all flex items-center justify-center"><Minus size={14} /></button>
                                <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 bg-white/5 rounded-lg text-[#505530]/55 hover:text-[#1a1c14] hover:bg-white/10 transition-all flex items-center justify-center"><Plus size={14} /></button>
                                <button onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))} className="w-8 h-8 bg-red-500/10 rounded-lg text-red-500/40 hover:text-red-500 hover:bg-red-500/20 transition-all flex items-center justify-center"><Trash2 size={14} /></button>
                             </div>
                        </motion.div>
                    ))
                )}
            </AnimatePresence>
        </div>

        <div className="p-4 md:p-8 bg-white border-t border-white/10 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
            <div className="grid grid-cols-2 gap-2 md:gap-4 mb-6 md:mb-10">
                {[
                    { id: OrderSource.TO_GO, icon: ShoppingBag, label: 'Carry out', color: 'bg-white/5 border-white/5 text-[#505530]/55' },
                    { id: OrderSource.RAPPI, icon: Truck, label: 'Grid/Rappi', color: 'bg-[#FF3C5C]/5 border-[#FF3C5C]/10 text-[#FF3C5C]/60' },
                    { id: OrderSource.UBER_EATS, icon: ChefHat, label: 'Uber Sys', color: 'bg-[#06C167]/5 border-[#06C167]/10 text-[#06C167]/60' },
                    { id: OrderSource.DINE_IN, icon: TableIcon, label: 'In-Node', color: 'bg-solaris-orange/10 border-solaris-orange/10 text-solaris-orange' }
                ].map(src => (
                    <button 
                        key={src.id}
                        onClick={() => setSelectedSource(src.id)}
                        className={`py-3 md:py-4 rounded-xl md:rounded-[22px] flex items-center justify-center gap-2 md:gap-3 transition-all border ${selectedSource === src.id ? 'bg-solaris-orange text-[#1a1c14] border-solaris-orange shadow-solaris-glow scale-[1.02]' : `${src.color} hover:bg-white/5`}`}
                    >
                        <src.icon size={14} className="md:w-4 md:h-4" />
                        <span className="text-[8px] font-black uppercase tracking-widest">{src.label}</span>
                    </button>
                ))}
            </div>

            <div className="flex justify-between items-end mb-6 md:mb-10 px-2">
                <div>
                    <p className="text-[8px] font-black uppercase text-[#505530]/30 tracking-[0.4em] mb-1">Payload Value</p>
                    <p className="text-2xl md:text-4xl font-black italic tracking-tighter text-[#1a1c14] uppercase italic">${total.toFixed(2)}</p>
                </div>
                <div className="text-right hidden sm:block">
                    <p className="text-[8px] font-black text-solaris-orange uppercase tracking-widest mb-1 shadow-solaris-glow">Protocol Secured</p>
                    <p className="text-[9px] text-[#505530]/30 font-bold italic">Node Output</p>
                </div>
            </div>

            <button
                onClick={handleSendOrder}
                disabled={cart.length === 0}
                className="w-full py-4 md:py-6 bg-solaris-orange text-[#1a1c14] font-black italic tracking-[0.2em] uppercase text-lg md:text-xl rounded-2xl md:rounded-[28px] shadow-solaris-glow hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 flex items-center justify-center gap-3 md:gap-4"
            >
                Authorize <Zap size={20} className="md:w-7 md:h-7" />
            </button>
        </div>
      </div>

      {/* Table Selection Modal Overlay */}
      {isCartOpen && <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setIsCartOpen(false)} />}

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl">
                <div className="w-full max-w-sm sm:max-w-md bg-white border border-white/10 rounded-[32px] sm:rounded-[40px] p-10 sm:p-16 flex flex-col items-center text-center shadow-2xl mx-4">
                    <motion.div animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }} transition={{ duration: 0.5 }} className="w-20 h-20 sm:w-28 sm:h-28 bg-solaris-orange rounded-full flex items-center justify-center mb-6 sm:mb-10 shadow-solaris-glow">
                        <CheckCircle2 size={40} className="text-[#1a1c14] sm:w-14 sm:h-14" />
                    </motion.div>
                    <h2 className="text-2xl sm:text-4xl font-black italic text-[#1a1c14] uppercase tracking-tighter mb-4 leading-tight">Transmission Successful</h2>
                    <p className="text-[#505530]/45 font-bold text-[9px] sm:text-[11px] uppercase tracking-[0.3em]">Kitchen Unit Acknowledged Packet</p>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Table Modal */}
      <AnimatePresence>
        {showTableModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 sm:p-6">
                <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white border border-white/10 rounded-[32px] sm:rounded-[40px] w-full max-w-3xl p-6 sm:p-12 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-solaris-orange/50 to-transparent"></div>
                    <div className="flex justify-between items-center mb-8 sm:mb-12">
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-[#1a1c14]">Node Grid Matrix</h2>
                            <p className="text-[9px] text-[#505530]/30 font-black uppercase tracking-[0.4em] mt-1 italic">Select Terminal Assignment</p>
                        </div>
                        <button onClick={() => setShowTableModal(false)} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/5 border border-white/10 text-[#505530]/45 hover:text-[#1a1c14] hover:bg-white/10 transition-all flex items-center justify-center"><X size={24} /></button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-8 max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
                        {TABLES.map(table => (
                            <button
                                key={table.id}
                                onClick={() => { setSelectedTable(table); setShowTableModal(false); }}
                                className={`p-4 sm:p-10 rounded-solaris border-2 flex flex-col items-center gap-3 sm:gap-6 transition-all group ${selectedTable?.id === table.id ? 'border-solaris-orange bg-solaris-orange/10 text-solaris-orange shadow-solaris-glow scale-[1.02]' : 'border-white/5 text-[#505530]/30 hover:text-[#1a1c14] hover:border-white/20 hover:bg-white/5'}`}
                            >
                                <div className={`w-10 h-10 sm:w-16 sm:h-16 rounded-xl flex items-center justify-center transition-all ${selectedTable?.id === table.id ? 'bg-solaris-orange text-[#1a1c14]' : 'bg-white/5 text-[#505530]/30'}`}>
                                    <TableIcon size={24} className="sm:w-10 sm:h-10" />
                                </div>
                                <div className="text-center min-w-0 w-full">
                                    <span className="font-black text-lg sm:text-2xl italic uppercase block leading-none mb-1 sm:mb-2 truncate">{table.name}</span>
                                    <span className="text-[8px] sm:text-[10px] font-bold uppercase tracking-widest opacity-40">{table.seats} PERSONS</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
