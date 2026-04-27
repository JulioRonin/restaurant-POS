import React, { useState, useMemo } from 'react';
import { INVENTORY_CATEGORIES } from '../constants';
import { InventoryItem, CartItem, SupplierOrder, SupplyOrderStatus } from '../types';
import jsPDF from 'jspdf';
import { useInventory } from '../contexts/InventoryContext';
import { motion, AnimatePresence } from 'framer-motion';
import { GlowCard } from '../components/ui/spotlight-card';
import { 
  Package, 
  Truck, 
  ShoppingCart, 
  Plus, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  CheckCircle,
  FileText,
  Search,
  ArrowRight,
  ChevronRight,
  X
} from 'lucide-react';

export const InventoryScreen: React.FC = () => {
    const { inventory, orders, addInventoryItem, updateInventoryItem, deleteInventoryItem, createSupplierOrder, updateSupplierOrder } = useInventory();
    const [activeCategory, setActiveCategory] = useState('All');
    const [activeTab, setActiveTab] = useState<'stock' | 'orders'>('stock');

    // Cart & Ordering
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);

    // Editing
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Restock
    const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
    const [restockQty, setRestockQty] = useState<number>(0);

    const [publishToMenu, setPublishToMenu] = useState(false);
    const [menuPrice, setMenuPrice] = useState<number>(0);

    const filteredInventory = useMemo(() => {
        if (activeCategory === 'All') return inventory;
        return inventory.filter(item => item.category === activeCategory);
    }, [activeCategory, inventory]);

    const cartTotal = cart.reduce((acc, item) => acc + (item.costPerUnit * item.orderQuantity), 0);

    const handleSaveItem = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const itemData = {
            name: formData.get('name') as string,
            category: formData.get('category') as string,
            supplier: formData.get('supplier') as string,
            quantity: Number(formData.get('quantity')),
            unit: formData.get('unit') as string,
            costPerUnit: Number(formData.get('cost')),
            minStock: Number(formData.get('minStock')),
            maxStock: Number(formData.get('maxStock')),
            publicInMenu: publishToMenu,
            price: menuPrice,
            lastRestock: editingItem?.lastRestock || new Date().toISOString()
        };

        if (editingItem) {
            await updateInventoryItem(editingItem.id, itemData);
        } else {
            await addInventoryItem(itemData as Omit<InventoryItem, 'id'>);
        }
        setIsAddModalOpen(false);
        setEditingItem(null);
    };

    const addToCart = (item: InventoryItem, qty: number) => {
        const existing = cart.find(c => c.id === item.id);
        if (existing) {
            setCart(prev => prev.map(c => c.id === item.id ? { ...c, orderQuantity: c.orderQuantity + qty } : c));
        } else {
            setCart(prev => [...prev, { ...item, orderQuantity: qty }]);
        }
        setRestockItem(null);
        setIsCartOpen(true);
    };

    const handleCreateOrder = async () => {
        if (cart.length === 0) return;
        // Group by supplier — create one order per supplier
        const bySupplier: Record<string, CartItem[]> = {};
        for (const item of cart) {
            const key = item.supplier || 'Sin Proveedor';
            if (!bySupplier[key]) bySupplier[key] = [];
            bySupplier[key].push(item);
        }
        for (const [supplier, items] of Object.entries(bySupplier)) {
            await createSupplierOrder({
                supplier,
                date: new Date().toISOString(),
                status: SupplyOrderStatus.PENDING,
                items,
                totalCost: items.reduce((s, i) => s + i.costPerUnit * i.orderQuantity, 0)
            });
        }
        setCart([]);
        setIsCartOpen(false);
        setActiveTab('orders');
    };

    const handleUpdateStatus = async (orderId: string, status: SupplyOrderStatus) => {
        if (status === SupplyOrderStatus.RECEIVED) {
            const order = orders.find(o => o.id === orderId);
            if (order) {
                for (const orderItem of order.items) {
                    const invItem = inventory.find(i => i.id === orderItem.id);
                    if (invItem) {
                        await updateInventoryItem(invItem.id, {
                            quantity: invItem.quantity + orderItem.orderQuantity,
                            lastRestock: new Date().toISOString()
                        });
                    }
                }
            }
        }
        await updateSupplierOrder(orderId, { status });
    };

    const getStockStatus = (qty: number, max: number, min: number) => {
        const pct = (qty / (max || 100)) * 100;
        if (qty <= min) return { label: 'CRITICAL', color: 'text-red-500', bar: 'bg-red-500', pct };
        if (pct < 40) return { label: 'LOW', color: 'text-solaris-orange', bar: 'bg-[#F98359]', pct };
        return { label: 'STABLE', color: 'text-green-500', bar: 'bg-green-500', pct };
    };

    return (
        <div className="h-full bg-[#FAFAF3] text-[#1a1c14] p-6 md:p-10 overflow-y-auto antialiased">
            <div className="max-w-7xl mx-auto w-full">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                        <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-2">KOSO Logistics</h1>
                        <p className="text-gray-600 font-bold text-[10px] uppercase tracking-[0.4em]">Resource Flow & Inventory Architecture</p>
                    </motion.div>
                    
                    <div className="flex gap-4">
                        <div className="bg-white/[0.03] border border-white/5 p-1 rounded-2xl flex">
                            <button onClick={() => setActiveTab('stock')} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'stock' ? 'bg-white/[0.05] text-solaris-orange border border-solaris-orange/20' : 'text-gray-500'}`}>
                                <Package size={14} /> Stock Matrix
                            </button>
                            <button onClick={() => setActiveTab('orders')} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === 'orders' ? 'bg-white/[0.05] text-solaris-orange border border-solaris-orange/20' : 'text-gray-500'}`}>
                                <Truck size={14} /> Procurement
                            </button>
                        </div>

                        <button onClick={() => setIsCartOpen(true)} className="relative group bg-white/[0.03] border border-white/5 p-3 rounded-2xl hover:bg-white/[0.05] transition-all">
                             <ShoppingCart size={20} className="text-gray-400 group-hover:text-[#1a1c14]" />
                             {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-[#F98359] text-[#1a1c14] text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full shadow-solaris-glow">{cart.length}</span>}
                        </button>

                        <button 
                            onClick={() => { setEditingItem(null); setIsAddModalOpen(true); }}
                            className="bg-[#F98359] text-[#1a1c14] px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-solaris-glow hover:scale-105 transition-all"
                        >
                             <Plus size={16} /> Add Supply
                        </button>
                    </div>
                </header>

                {activeTab === 'stock' && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                             <div className="md:col-span-3 bg-white/[0.02] border border-white/5 p-2 rounded-2xl flex items-center gap-2 overflow-x-auto no-scrollbar">
                                {INVENTORY_CATEGORIES.map(cat => (
                                    <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-white/[0.05] text-solaris-orange border border-solaris-orange/20' : 'text-gray-500'}`}>
                                        {cat}
                                    </button>
                                ))}
                             </div>
                             <div className="bg-white/[0.02] border border-white/5 p-4 rounded-solaris flex items-center justify-between">
                                 <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-700">Stock Assets</p>
                                    <p className="text-2xl font-black italic text-solaris-orange">{inventory.length}</p>
                                 </div>
                                 <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} className="text-gray-800">
                                    <Package size={28} />
                                 </motion.div>
                             </div>
                        </div>

                        <div className="bg-white/[0.02] border border-white/5 rounded-solaris overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-white/5 text-gray-600 text-[9px] font-black uppercase tracking-[0.3em]">
                                        <th className="py-6 px-8">Asset Name / Category</th>
                                        <th className="py-6 px-4">Level Indicator</th>
                                        <th className="py-6 px-4 text-center">Unit Valuation</th>
                                        <th className="py-6 px-4">Supplier Origin</th>
                                        <th className="py-6 px-8 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {filteredInventory.map(item => {
                                        const status = getStockStatus(item.quantity, item.maxStock, item.minStock || 0);
                                        return (
                                            <tr key={item.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors group">
                                                <td className="py-6 px-8">
                                                    <div className="cursor-pointer" onClick={() => { setEditingItem(item); setIsAddModalOpen(true); }}>
                                                        <p className="font-bold text-[#1a1c14] group-hover:text-solaris-orange transition-colors uppercase italic">{item.name}</p>
                                                        <p className="text-[8px] font-black uppercase text-gray-700 tracking-widest">{item.category}</p>
                                                    </div>
                                                </td>
                                                <td className="py-6 px-4 min-w-[200px]">
                                                    <div className="flex justify-between items-end mb-2">
                                                        <p className="text-[10px] font-black italic text-[#1a1c14]">{item.quantity} <span className="text-[8px] font-normal not-italic text-gray-600">{item.unit}</span></p>
                                                        <p className={`text-[8px] font-black uppercase tracking-widest ${status.color}`}>{status.label}</p>
                                                    </div>
                                                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, status.pct)}%` }} className={`h-full ${status.bar} shadow-solaris-glow`}></motion.div>
                                                    </div>
                                                </td>
                                                <td className="py-6 px-4 text-center">
                                                    <span className="text-xs font-black italic text-[#1a1c14]">${item.costPerUnit.toFixed(2)}</span>
                                                </td>
                                                <td className="py-6 px-4">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase italic opacity-60">{item.supplier}</span>
                                                </td>
                                                <td className="py-6 px-8 text-right">
                                                    <div className="flex justify-end gap-3">
                                                        <button 
                                                            onClick={() => { setRestockItem(item); setRestockQty(Math.max(0, item.maxStock - item.quantity)); }}
                                                            className="px-4 py-2 bg-white/[0.03] border border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-[#1a1c14] hover:border-white/20 transition-all rounded-xl"
                                                        >
                                                            Restock
                                                        </button>
                                                        <button 
                                                            onClick={() => { setEditingItem(item); setIsAddModalOpen(true); }}
                                                            className="p-2 text-gray-700 hover:text-solaris-orange transition-colors"
                                                        >
                                                            <Edit3 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {activeTab === 'orders' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
                        {orders.map(order => (
                            <div key={order.id}>
                                <GlowCard glowColor="orange" className={`relative border !p-8 ${order.status === 'PENDING' ? 'border-solaris-orange/20' : 'border-white/5'}`}>
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-xl font-black italic text-[#1a1c14] uppercase tracking-tight mb-1">Order #{order.id.slice(0, 8)}</h3>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 italic">{new Date(order.date).toLocaleDateString()} • {order.supplier}</p>
                                        </div>
                                        <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-[0.3em] border ${order.status === 'RECEIVED' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-[#F98359]/10 text-solaris-orange border-solaris-orange/20'}`}>
                                            {order.status}
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-8">
                                        {order.items.map((item, i) => (
                                            <div key={i} className="flex justify-between items-center text-[10px]">
                                                <span className="font-bold text-gray-400">{item.orderQuantity}x <span className="text-[#1a1c14] uppercase italic">{item.name}</span></span>
                                                <span className="text-gray-700 font-mono">${(item.costPerUnit * item.orderQuantity).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex justify-between items-center pt-6 border-t border-white/[0.02]">
                                        <div>
                                            <p className="text-[8px] font-black uppercase text-gray-700 tracking-widest mb-1">Payload Total</p>
                                            <p className="text-2xl font-black italic text-[#1a1c14] tracking-tighter">${order.totalCost.toFixed(2)}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {order.status === 'ORDERED' && (
                                                <button 
                                                    onClick={() => handleUpdateStatus(order.id, SupplyOrderStatus.RECEIVED)}
                                                    className="bg-green-600 text-[#1a1c14] px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-900/20"
                                                >
                                                    Receive
                                                </button>
                                            )}
                                            {order.status === 'PENDING' && (
                                                <button 
                                                    onClick={() => handleUpdateStatus(order.id, SupplyOrderStatus.ORDERED)}
                                                    className="bg-[#F98359] text-[#1a1c14] px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-solaris-glow"
                                                >
                                                    Ship
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </GlowCard>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Layer */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white border border-white/10 rounded-solaris w-full max-w-lg overflow-hidden shadow-2xl">
                             <form onSubmit={handleSaveItem} className="p-10">
                                <div className="flex justify-between items-center mb-10">
                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-[#1a1c14]">Supply Registry</h2>
                                    <X onClick={() => setIsAddModalOpen(false)} className="text-gray-700 hover:text-[#1a1c14] cursor-pointer" size={24} />
                                </div>
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest px-1">Nombre del insumo</label>
                                        <input name="name" defaultValue={editingItem?.name} required className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-6 text-[#1a1c14] outline-none focus:border-solaris-orange/50 transition-all font-bold" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest px-1">Categoría</label>
                                            <select name="category" defaultValue={editingItem?.category || 'General'} className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-6 text-[#1a1c14] outline-none appearance-none font-bold">
                                                {INVENTORY_CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c} className="bg-white">{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest px-1">Proveedor</label>
                                            <input name="supplier" defaultValue={editingItem?.supplier} required placeholder="Nombre del proveedor" className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-6 text-[#1a1c14] outline-none font-bold" />
                                        </div>
                                    </div>
                                    {/* Unit type selector */}
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest px-1">Unidad de Medida</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {['PZ', 'gr', 'Bolsa'].map(u => (
                                                <label key={u} className="cursor-pointer">
                                                    <input type="radio" name="unit" value={u} defaultChecked={editingItem?.unit === u || (!editingItem && u === 'PZ')} className="sr-only peer" />
                                                    <div className="peer-checked:bg-[#F98359]/20 peer-checked:border-solaris-orange peer-checked:text-[#1a1c14] bg-white/[0.03] border border-white/5 rounded-2xl py-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-500 transition-all">{u}</div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest px-1">Mín. Crítico</label>
                                            <input name="minStock" type="number" defaultValue={editingItem?.minStock || 10} className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-4 text-[#1a1c14] text-center font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                             <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest px-1">Cap. Ideal</label>
                                             <input name="maxStock" type="number" defaultValue={editingItem?.maxStock || 100} className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-4 text-[#1a1c14] text-center font-bold" />
                                        </div>
                                        <div className="space-y-2">
                                             <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest px-1">Costo/Unidad</label>
                                             <input name="cost" type="number" step="0.01" defaultValue={editingItem?.costPerUnit} className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-4 text-[#1a1c14] text-center font-bold" />
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full bg-[#F98359] text-[#1a1c14] font-black uppercase tracking-[0.2em] py-5 rounded-2xl shadow-solaris-glow hover:bg-orange-600 transition-all text-[11px] mt-2">
                                        Guardar Cambios
                                    </button>
                                </div>
                             </form>
                        </motion.div>
                    </motion.div>
                )}

                {restockItem && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
                         <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white border border-white/10 rounded-solaris w-full max-w-sm overflow-hidden shadow-2xl">
                             <div className="p-8">
                                 <h3 className="text-xl font-black italic uppercase text-[#1a1c14] mb-2">Restock Payload</h3>
                                 <p className="text-[9px] font-black uppercase text-solaris-orange tracking-[0.3em] mb-10">{restockItem.name}</p>
                                 
                                 <div className="flex items-center gap-6 mb-10">
                                     <button onClick={() => setRestockQty(Math.max(0, restockQty - 1))} className="w-14 h-14 rounded-2xl border border-white/5 flex items-center justify-center text-xl hover:bg-white/5 transition-all">-</button>
                                     <input type="number" value={restockQty} onChange={e => setRestockQty(Number(e.target.value))} className="flex-1 bg-transparent border-b-2 border-white/10 outline-none text-4xl font-black italic text-center text-[#1a1c14]" />
                                     <button onClick={() => setRestockQty(restockQty + 1)} className="w-14 h-14 rounded-2xl border border-white/5 flex items-center justify-center text-xl hover:bg-white/5 transition-all">+</button>
                                 </div>

                                 <div className="flex gap-4">
                                     <button onClick={() => setRestockItem(null)} className="flex-1 py-4 text-[10px] font-black uppercase text-gray-700 tracking-widest hover:text-[#1a1c14] transition-colors">Abort</button>
                                     <button onClick={() => addToCart(restockItem, restockQty)} className="flex-1 py-4 bg-[#F98359] text-[#1a1c14] font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-solaris-glow">Add to Queue</button>
                                 </div>
                             </div>
                         </motion.div>
                    </motion.div>
                )}

                {isCartOpen && (
                    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="fixed inset-y-0 right-0 w-full md:w-[450px] bg-white border-l border-white/10 shadow-2xl z-50 flex flex-col">
                        <div className="p-10 border-b border-white/5 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black italic text-[#1a1c14] uppercase tracking-tight">Procurement Loop</h2>
                                <p className="text-[9px] font-black uppercase text-solaris-orange tracking-widest mt-1">{cart.length} Assets Enqueued</p>
                            </div>
                            <X onClick={() => setIsCartOpen(false)} className="text-gray-700 hover:text-[#1a1c14] cursor-pointer" size={24} />
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            {/* Group by supplier */}
                            {Object.entries(
                                cart.reduce((acc: Record<string, CartItem[]>, item) => {
                                    const key = item.supplier || 'Sin Proveedor';
                                    if (!acc[key]) acc[key] = [];
                                    acc[key].push(item);
                                    return acc;
                                }, {})
                            ).map(([supplier, items]) => (
                                <div key={supplier}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <Truck size={12} className="text-solaris-orange" />
                                        <span className="text-[9px] font-black uppercase text-solaris-orange tracking-widest">{supplier}</span>
                                        <span className="ml-auto text-[9px] font-black text-gray-600">${items.reduce((s, i) => s + i.costPerUnit * i.orderQuantity, 0).toFixed(2)}</span>
                                    </div>
                                    <div className="space-y-3 pl-4 border-l border-solaris-orange/20">
                                        {items.map(item => (
                                            <div key={item.id} className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
                                                <div>
                                                    <h4 className="font-bold text-[#1a1c14] uppercase italic text-sm">{item.name}</h4>
                                                    <p className="text-[8px] font-black uppercase text-gray-700 tracking-widest">{item.orderQuantity} {item.unit} · ${item.costPerUnit}/{item.unit}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-black text-solaris-orange italic">${(item.costPerUnit * item.orderQuantity).toFixed(2)}</p>
                                                    <button onClick={() => setCart(prev => prev.filter(c => c.id !== item.id))} className="text-[8px] font-black uppercase text-red-500/60 hover:text-red-500 transition-colors">Quitar</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-10 border-t border-white/5 bg-white/[0.01]">
                            <div className="flex justify-between items-center mb-10">
                                <span className="text-[9px] font-black uppercase text-gray-700 tracking-widest">Aggregate Cost</span>
                                <span className="text-3xl font-black italic text-[#1a1c14] tracking-tighter">${cartTotal.toFixed(2)}</span>
                            </div>
                            <button onClick={handleCreateOrder} disabled={cart.length === 0} className="w-full bg-[#F98359] text-[#1a1c14] font-black uppercase tracking-[0.2em] py-6 rounded-2xl shadow-solaris-glow disabled:opacity-30 flex items-center justify-center gap-3">
                                <ShoppingCart size={20} /> Authorize Procurement
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};