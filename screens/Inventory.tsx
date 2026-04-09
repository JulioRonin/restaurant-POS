import React, { useState, useMemo } from 'react';
import { INVENTORY_CATEGORIES } from '../constants';
import { InventoryItem, CartItem, SupplierOrder, SupplyOrderStatus } from '../types';
import jsPDF from 'jspdf';
import { useInventory } from '../contexts/InventoryContext';
import { useMenu } from '../contexts/MenuContext';

export const InventoryScreen: React.FC = () => {
    const { inventory, orders, loading, addInventoryItem, updateInventoryItem, deleteInventoryItem, createSupplierOrder, updateSupplierOrder } = useInventory();
    const { addItem, updateItem, menuItems } = useMenu();
    const [activeCategory, setActiveCategory] = useState('All');
    const [activeTab, setActiveTab] = useState<'stock' | 'orders'>('stock');

    // Cart & Ordering
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);

    // Editing
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);

    // Restock Popover State
    const [restockItem, setRestockItem] = useState<InventoryItem | null>(null);
    const [restockQty, setRestockQty] = useState<number>(0);

    const [publishToMenu, setPublishToMenu] = useState(false);
    const [menuPrice, setMenuPrice] = useState<number>(0);

    // --- Computed ---
    const filteredInventory = useMemo(() => {
        if (activeCategory === 'All') return inventory;
        return inventory.filter(item => item.category === activeCategory);
    }, [activeCategory, inventory]);

    const cartTotal = cart.reduce((acc, item) => acc + (item.costPerUnit * item.orderQuantity), 0);

    // --- Actions: Inventory ---
    const handleSaveItem = async (item: Partial<InventoryItem>) => {
        const fullItem = {
            ...item,
            publicInMenu: publishToMenu,
            price: menuPrice,
            lastRestock: editingItem?.lastRestock || new Date().toISOString()
        };

        if (editingItem) {
            await updateInventoryItem(editingItem.id, fullItem);
        } else {
            await addInventoryItem(fullItem as Omit<InventoryItem, 'id'>);
        }

        setIsEditModalOpen(false);
        setIsAddItemModalOpen(false);
        setEditingItem(null);
        setPublishToMenu(false);
        setMenuPrice(0);
    };

    const handleDeleteItem = async (id: string) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este artículo?')) {
            await deleteInventoryItem(id);
        }
    };

    // --- Actions: Cart ---
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

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(c => c.id !== id));
    };

    const updateCartQty = (id: string, qty: number) => {
        if (qty <= 0) {
            removeFromCart(id);
        } else {
            setCart(prev => prev.map(c => c.id === id ? { ...c, orderQuantity: qty } : c));
        }
    };

    const handleCreateOrder = async () => {
        if (cart.length === 0) return;
        await createSupplierOrder({
            supplier: 'Varios Proveedores',
            date: new Date().toISOString(),
            status: SupplyOrderStatus.PENDING,
            items: [...cart],
            totalCost: cartTotal
        });
        setCart([]);
        setIsCartOpen(false);
        setActiveTab('orders');
    };

    // --- Actions: Orders ---
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

    const handleExportOrder = (order: SupplierOrder) => {
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.text(`Purchase Order #${order.id}`, 20, 20);

        doc.setFontSize(12);
        doc.text(`Date: ${new Date(order.date).toLocaleDateString()}`, 20, 30);
        doc.text(`Supplier: ${order.supplier}`, 20, 36);
        doc.text(`Status: ${order.status}`, 20, 42);

        let y = 60;
        doc.setFontSize(10);
        doc.text("Item", 20, y);
        doc.text("Quantity", 100, y);
        doc.text("Cost", 140, y);
        doc.text("Total", 170, y);
        doc.line(20, y + 2, 190, y + 2);

        y += 10;

        order.items.forEach(item => {
            doc.text(item.name, 20, y);
            doc.text(`${item.orderQuantity} ${item.unit}`, 100, y);
            doc.text(`$${item.costPerUnit}`, 140, y);
            doc.text(`$${(item.costPerUnit * item.orderQuantity).toFixed(2)}`, 170, y);
            y += 8;
        });

        doc.line(20, y, 190, y);
        y += 10;
        doc.setFontSize(14);
        doc.text(`Total Cost: $${order.totalCost.toFixed(2)}`, 140, y);

        doc.save(`Order_${order.id}.pdf`);
    };

    // --- Helpers ---
    const getStockStatus = (qty: number, max: number, min: number) => {
        if (qty <= min) return { color: 'bg-red-500', text: 'text-red-600', label: 'Low Stock', bg: 'bg-red-50', width: '20%' };
        const percentage = (qty / max) * 100;
        if (percentage < 50) return { color: 'bg-yellow-500', text: 'text-yellow-600', label: 'Medium', bg: 'bg-yellow-50', width: `${percentage}%` };
        return { color: 'bg-green-500', text: 'text-green-600', label: 'In Stock', bg: 'bg-green-50', width: `${percentage}%` };
    };


    return (
        <div className="h-full bg-[#F3F4F6] text-gray-800 p-8 overflow-y-auto relative">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
                    <p className="text-gray-500 text-sm">Real-time Stock, Ordering & Procurement</p>
                </div>
                <div className="flex gap-3">
                    <div className="bg-white p-1 rounded-xl flex shadow-sm border border-gray-100 mr-4">
                        <button
                            onClick={() => setActiveTab('stock')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'stock' ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <span className="material-icons-round text-base">inventory_2</span>
                            Stocks
                        </button>
                        <button
                            onClick={() => setActiveTab('orders')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'orders' ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <span className="material-icons-round text-base">local_shipping</span>
                            Orders
                            {orders.some(o => o.status === 'PENDING') && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>}
                        </button>
                    </div>

                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors font-bold shadow-sm relative"
                    >
                        <span className="material-icons-round text-lg">shopping_cart</span>
                        Cart
                        {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">{cart.length}</span>}
                    </button>
                    <button
                        onClick={() => {
                            setEditingItem(null);
                            setIsAddItemModalOpen(true);
                        }}
                        className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-primary/30 transition-all font-bold"
                    >
                        <span className="material-icons-round text-lg">add</span>
                        Add Item
                    </button>
                </div>
            </div>

            {/* TAB: STOCK */}
            {activeTab === 'stock' && (
                <>
                    {/* Category Filters */}
                    <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                        {INVENTORY_CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeCategory === cat
                                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                        : 'bg-white text-gray-500 hover:text-primary shadow-sm'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Inventory Table */}
                    <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50">
                                <tr className="text-gray-500 text-xs uppercase tracking-wider">
                                    <th className="py-4 px-6 font-bold">Item Name</th>
                                    <th className="py-4 px-6 font-bold">Stock Level</th>
                                    <th className="py-4 px-6 font-bold">Reorder Point</th>
                                    <th className="py-4 px-6 font-bold">Unit Cost</th>
                                    <th className="py-4 px-6 font-bold">Supplier</th>
                                    <th className="py-4 px-6 font-bold text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredInventory.map(item => {
                                    const status = getStockStatus(item.quantity, item.maxStock, item.minStock || 0);

                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="py-4 px-6">
                                                <div className="flex flex-col cursor-pointer" onClick={() => { 
                                                    setEditingItem(item); 
                                                    setPublishToMenu(item.publicInMenu || false);
                                                    setMenuPrice(item.price || 0);
                                                    setIsEditModalOpen(true); 
                                                }}>
                                                    <span className="font-bold text-gray-900 hover:text-primary transition-colors">{item.name}</span>
                                                    <span className="text-xs text-gray-500">{item.category}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 min-w-[200px]">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-gray-900 font-bold">{item.quantity} {item.unit}</span>
                                                    <span className={`${status.text} font-bold`}>{status.label}</span>
                                                </div>
                                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${status.color}`}
                                                        style={{ width: status.width }}
                                                    ></div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-sm">
                                                <span className="text-red-500 font-bold flex items-center gap-1">
                                                    <span className="material-icons-round text-sm">arrow_downward</span>
                                                    {item.minStock} {item.unit}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-gray-900 font-medium">
                                                ${item.costPerUnit.toFixed(2)} <span className="text-gray-400 text-xs">/ {item.unit}</span>
                                            </td>
                                            <td className="py-4 px-6 text-gray-500 text-sm">
                                                {item.supplier}
                                            </td>
                                            <td className="py-4 px-6 text-right relative">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => { setEditingItem(item); setIsEditModalOpen(true); }}
                                                        className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
                                                    >
                                                        <span className="material-icons-round text-lg">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setRestockItem(item);
                                                            setRestockQty(Math.max(0, item.maxStock - item.quantity));
                                                        }}
                                                        className="text-primary border border-primary/20 hover:bg-primary hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                                                    >
                                                        Restock
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

            {/* TAB: ORDERS */}
            {activeTab === 'orders' && (
                <div className="grid grid-cols-1 gap-4">
                    {orders.length === 0 ? (
                        <div className="text-center py-20 text-gray-400 bg-white rounded-3xl">
                            <span className="material-icons-round text-6xl mb-4 text-gray-200">assignment</span>
                            <p>No active orders</p>
                            <button onClick={() => setActiveTab('stock')} className="text-primary font-bold mt-2">Go to Stock to create one</button>
                        </div>
                    ) : (
                        orders.map(order => (
                            <div key={order.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between gap-6">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-xl font-bold">Order #{order.id}</h3>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${order.status === 'RECEIVED' ? 'bg-green-100 text-green-600' :
                                                order.status === 'ORDERED' ? 'bg-blue-100 text-blue-600' :
                                                    order.status === 'CANCELLED' ? 'bg-red-100 text-red-600' :
                                                        'bg-yellow-100 text-yellow-600'
                                            }`}>
                                            {order.status}
                                        </span>
                                    </div>
                                    <p className="text-gray-500 text-sm mb-4">
                                        {new Date(order.date).toLocaleDateString()} • {order.items.length} Items • {order.supplier}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {order.items.slice(0, 5).map(item => (
                                            <span key={item.id} className="px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
                                                {item.orderQuantity}x {item.name}
                                            </span>
                                        ))}
                                        {order.items.length > 5 && <span className="text-xs text-gray-400 self-center">+{order.items.length - 5} more</span>}
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-2 min-w-[200px]">
                                    <span className="text-2xl font-bold text-gray-900">${order.totalCost.toFixed(2)}</span>

                                    <div className="flex gap-2 w-full mt-auto">
                                        {order.status === 'PENDING' && (
                                            <button
                                                onClick={() => handleUpdateStatus(order.id, SupplyOrderStatus.ORDERED)}
                                                className="flex-1 bg-primary text-white py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-blue-600"
                                            >
                                                Mark Ordered
                                            </button>
                                        )}
                                        {order.status === 'ORDERED' && (
                                            <button
                                                onClick={() => handleUpdateStatus(order.id, SupplyOrderStatus.RECEIVED)}
                                                className="flex-1 bg-green-500 text-white py-2 rounded-xl text-sm font-bold shadow-lg shadow-green-500/20 hover:bg-green-600"
                                            >
                                                Receive Stock
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleExportOrder(order)}
                                            className="px-3 py-2 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50"
                                            title="Export PDF"
                                        >
                                            <span className="material-icons-round">picture_as_pdf</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Quick Restock Popover (Simple implementation for now: Modal-like) */}
            {restockItem && (
                <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setRestockItem(null)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl scale-100 transition-transform" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-1">Restock {restockItem.name}</h3>
                        <p className="text-sm text-gray-500 mb-4">Current: {restockItem.quantity} {restockItem.unit} | Max: {restockItem.maxStock} {restockItem.unit}</p>

                        <div className="flex gap-4 items-center mb-6">
                            <button onClick={() => setRestockQty(Math.max(0, restockQty - 1))} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-lg hover:bg-gray-200">-</button>
                            <input
                                type="number"
                                value={restockQty}
                                onChange={e => setRestockQty(Number(e.target.value))}
                                className="flex-1 text-center text-2xl font-bold border-b-2 border-gray-100 focus:border-primary outline-none py-2"
                            />
                            <button onClick={() => setRestockQty(restockQty + 1)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-lg hover:bg-gray-200">+</button>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => setRestockItem(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl">Cancel</button>
                            <button
                                onClick={() => addToCart(restockItem, restockQty)}
                                className="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:bg-blue-600 shadow-lg shadow-primary/20"
                            >
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit / Add Item Modal */}
            {(isEditModalOpen || isAddItemModalOpen) && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">{editingItem ? 'Edit Item' : 'New Item'}</h2>
                            <button onClick={() => { 
                                setIsEditModalOpen(false); 
                                setIsAddItemModalOpen(false); 
                                setEditingItem(null);
                                setPublishToMenu(false);
                                setMenuPrice(0);
                            }} className="text-gray-400 hover:text-gray-600">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>


                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const newItem = {
                                id: editingItem?.id || '',
                                name: formData.get('name') as string,
                                category: formData.get('category') as string,
                                supplier: formData.get('supplier') as string,
                                quantity: Number(formData.get('quantity')),
                                unit: formData.get('unit') as string,
                                costPerUnit: Number(formData.get('cost')),
                                minStock: Number(formData.get('minStock')),
                                maxStock: Number(formData.get('maxStock')),
                                lastRestock: editingItem?.lastRestock || new Date().toISOString()
                            };
                            handleSaveItem(newItem as InventoryItem);
                        }} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                                <input name="name" defaultValue={editingItem?.name} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-primary font-bold" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                                    <select name="category" defaultValue={editingItem?.category || 'Abarrotes'} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-primary">
                                        {INVENTORY_CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Supplier</label>
                                    <input name="supplier" defaultValue={editingItem?.supplier} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-primary" />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stock</label>
                                    <input name="quantity" type="number" defaultValue={editingItem?.quantity || 0} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-primary" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Unit</label>
                                    <input name="unit" defaultValue={editingItem?.unit || 'kg'} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-primary" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cost</label>
                                    <input name="cost" type="number" step="0.01" defaultValue={editingItem?.costPerUnit || 0} required className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-primary" />
                                </div>
                            </div>

                            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 space-y-4">
                                <div className="grid grid-cols-2 gap-4 ">
                                    <div>
                                        <label className="block text-xs font-bold text-yellow-700 uppercase mb-1">Min (Low)</label>
                                        <input name="minStock" type="number" defaultValue={editingItem?.minStock || 10} required className="w-full bg-white border border-yellow-200 rounded-xl px-4 py-2 outline-none focus:border-yellow-500 text-yellow-800 font-bold" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-yellow-700 uppercase mb-1">Max (Full)</label>
                                        <input name="maxStock" type="number" defaultValue={editingItem?.maxStock || 100} required className="w-full bg-white border border-yellow-200 rounded-xl px-4 py-2 outline-none focus:border-yellow-500 text-yellow-800 font-bold" />
                                    </div>
                                </div>
                                
                                <div className="pt-2 border-t border-yellow-200/50">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                        <div className={`w-10 h-6 rounded-full transition-all relative ${publishToMenu ? 'bg-primary' : 'bg-gray-300'}`}>
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${publishToMenu ? 'left-5' : 'left-1'}`}></div>
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            className="hidden" 
                                            checked={publishToMenu} 
                                            onChange={(e) => setPublishToMenu(e.target.checked)} 
                                        />
                                        <span className="text-xs font-black text-gray-700 uppercase tracking-widest">Publicar en Menú</span>
                                    </label>

                                    {publishToMenu && (
                                        <div className="mt-4 animate-in slide-in-from-top-2">
                                            <label className="block text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Venta al Público (Precio)</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                                <input 
                                                    type="number" 
                                                    step="0.01"
                                                    value={menuPrice} 
                                                    onChange={(e) => setMenuPrice(Number(e.target.value))}
                                                    className="w-full bg-white border-2 border-primary/20 rounded-xl pl-8 pr-4 py-2 outline-none focus:border-primary font-black text-primary" 
                                                    required={publishToMenu}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-4 mt-6">
                                {editingItem && (
                                    <button type="button" onClick={() => handleDeleteItem(editingItem.id)} className="px-4 py-3 text-red-500 font-bold hover:bg-red-50 rounded-xl transition-colors">
                                        Delete
                                    </button>
                                )}
                                <button type="submit" className="flex-1 bg-primary text-white font-bold py-3 rounded-xl hover:bg-blue-600 shadow-lg shadow-primary/20">
                                    {editingItem ? 'Save Changes' : 'Create Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Cart Drawer */}
            <div className={`fixed inset-y-0 right-0 w-[400px] bg-white shadow-2xl transform transition-transform duration-300 z-40 flex flex-col ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Shopping Cart</h2>
                        <p className="text-sm text-gray-500">{cart.length} items to sort</p>
                    </div>
                    <button onClick={() => setIsCartOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <span className="material-icons-round">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {cart.length === 0 ? (
                        <div className="text-center py-20 opacity-50">
                            <span className="material-icons-round text-6xl mb-2">production_quantity_limits</span>
                            <p>Cart is empty</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="flex gap-4 items-center bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                <div className="flex-1">
                                    <h4 className="font-bold text-gray-800">{item.name}</h4>
                                    <p className="text-xs text-gray-500">${item.costPerUnit} / {item.unit}</p>
                                </div>
                                <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                                    <button onClick={() => updateCartQty(item.id, item.orderQuantity - 1)} className="w-6 h-6 flex items-center justify-center hover:bg-white rounded text-gray-600">-</button>
                                    <span className="text-sm font-bold w-6 text-center">{item.orderQuantity}</span>
                                    <button onClick={() => updateCartQty(item.id, item.orderQuantity + 1)} className="w-6 h-6 flex items-center justify-center hover:bg-white rounded text-gray-600">+</button>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-primary">${(item.costPerUnit * item.orderQuantity).toFixed(2)}</p>
                                    <button onClick={() => removeFromCart(item.id)} className="text-xs text-red-400 hover:text-red-600 underline">Remove</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-gray-500 font-bold">Total Estimated Cost</span>
                        <span className="text-2xl font-bold text-gray-900">${cartTotal.toFixed(2)}</span>
                    </div>
                    <button
                        onClick={handleCreateOrder}
                        disabled={cart.length === 0}
                        className="w-full bg-primary disabled:bg-gray-300 disabled:shadow-none text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-icons-round">shopping_bag</span>
                        Place Order
                    </button>
                </div>
            </div>
        </div>
    );
};