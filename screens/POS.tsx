import React, { useState, useMemo } from 'react';
import { CATEGORIES, TABLES } from '../constants';
import { MenuItem, OrderItem, Order, OrderStatus, Table } from '../types';
import { useOrders } from '../contexts/OrderContext';
import { useUser } from '../contexts/UserContext';
import { useSettings } from '../contexts/SettingsContext';
import { useMenu } from '../contexts/MenuContext';
import { KitchenTicket } from '../components/KitchenTicket';
import { printerService } from '../services/PrinterService';

export const POSScreen: React.FC = () => {
  const { currentUser } = useUser();
  const { addOrder } = useOrders();
  const { settings } = useSettings();
  const { menuItems, addItem } = useMenu();
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState('A la carte');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [kitchenOrderToPrint, setKitchenOrderToPrint] = useState<Order | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(TABLES.find(t => t.id === 'T5') || TABLES[0]);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', price: '', category: 'Snacks' });

  // Filter only ACTIVE items for POS
  const activeMenuItems = useMemo(() => {
    return menuItems.filter(item => item.status === 'ACTIVE');
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    return activeMenuItems.filter(item => {
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Menu Filtering Logic
      let matchesMenu = true;
      if (activeMenu === 'Bodeguita') {
        matchesMenu = item.name.toLowerCase().includes('bodeguita');
      } else if (activeMenu === 'General') {
        matchesMenu = !item.name.toLowerCase().includes('bodeguita');
      }

      return matchesCategory && matchesSearch && matchesMenu;
    });
  }, [activeCategory, searchQuery, activeMenuItems, activeMenu]);

  const addToCart = (item: MenuItem) => {
    if (item.inventoryLevel === 0) return;

    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1, notes: '' }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      removeFromCart(itemToDelete);
      setItemToDelete(null);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const updateNote = (id: string, note: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, notes: note };
      }
      return item;
    }));
  };

  const handleSendOrder = () => {
    if (cart.length === 0) return;

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = total * 0.16;
    const finalTotal = total + tax;

    const newOrder: Order = {
      id: Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
      tableId: selectedTable ? selectedTable.id : 'BARRA',
      items: [...cart],
      status: OrderStatus.PENDING,
      timestamp: new Date(),
      total: finalTotal,
      waiterName: 'Maria G.'
    };

    addOrder(newOrder);
    
    // Auto Kitchen Printing
    if (settings.isKitchenPrintingEnabled) {
      if (settings.isDirectPrintingEnabled) {
        printerService.printKitchenTicket(newOrder, settings);
      } else {
        // Fallback to Browser Print
        setKitchenOrderToPrint(newOrder);
        setTimeout(() => {
          window.print();
          setKitchenOrderToPrint(null);
        }, 100);
      }
    }

    setCart([]);
    setShowSuccessModal(true);
    setTimeout(() => setShowSuccessModal(false), 2000);
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = total * 0.16; // 16% IVA standard in MX
  const subtotal = total;
  const finalTotal = subtotal + tax;

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Aguachiles': return 'bg-pastel-mint text-pastel-mintText';
      case 'Ceviches': return 'bg-pastel-blue text-pastel-blueText';
      case 'Cocteles': return 'bg-pastel-peach text-pastel-peachText';
      case 'Tostadas': return 'bg-pastel-yellow text-pastel-yellowText';
      case 'Bebidas': return 'bg-pastel-lavender text-pastel-lavenderText';
      case 'Snacks': return 'bg-pastel-pink text-pastel-pinkText';
      case 'Caldos': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || !newItem.price) return;

    addItem({
      name: newItem.name,
      price: parseFloat(newItem.price),
      category: newItem.category,
      image: `https://picsum.photos/seed/${Date.now()}/200`,
      inventoryLevel: 4,
      status: 'ACTIVE'
    });

    setNewItem({ name: '', price: '', category: 'Snacks' });
    setShowAddMenuModal(false);
  };

  return (
    <div className="flex h-full w-full bg-[#F3F4F6] text-gray-800 overflow-hidden relative">
      {/* Hidden Kitchen Ticket for Test Printing */}
      <div className="hidden print:block absolute inset-0 z-[9999] bg-white">
          {kitchenOrderToPrint && <KitchenTicket order={kitchenOrderToPrint} settings={settings} />}
      </div>

      {/* "Menus" Sidebar Column */}
      <div className="w-64 flex flex-col p-4 bg-white border-r border-gray-200 shadow-sm relative z-20 no-print">
        <div className="mb-8 px-2">
          <div className="bg-gradient-to-br from-primary to-primary-700 text-white p-4 rounded-2xl shadow-lg shadow-primary/20 transform transition-transform hover:scale-[1.02]">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-icons-round text-white/80">restaurant_menu</span>
              <span className="text-[10px] uppercase tracking-widest font-bold text-white/60">Restaurante</span>
            </div>
            <h2 className="text-xl font-black leading-tight">
              {settings.name}
            </h2>
          </div>
        </div>

        <div className="mb-4 flex justify-between items-center px-2">
          <span className="font-bold text-lg">Menús</span>
          <button
            onClick={() => setShowAddMenuModal(true)}
            className="text-gray-400 hover:text-primary"
          >
            <span className="material-icons-round">add</span>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {['General', 'Bodeguita', 'Bebidas', 'Para Llevar', 'Rappi/Uber'].map(menu => (
            <button
              key={menu}
              onClick={() => setActiveMenu(menu)}
              className={`p-4 rounded-xl text-left transition-all relative overflow-hidden group ${activeMenu === menu ? 'bg-white shadow-soft' : 'hover:bg-white/50'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${activeMenu === menu ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-500 group-hover:bg-white'
                  }`}>
                  {menu.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <span className={`font-bold text-sm ${activeMenu === menu ? 'text-gray-900' : 'text-gray-500'}`}>{menu}</span>
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${activeMenu === menu ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    {activeMenu === menu ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-auto">
          <p className="text-xs text-gray-400 font-bold mb-2">Developed by Ronin Studio</p>
          <div className="flex gap-2 text-[10px] text-gray-400">
            <a href="https://www.instagram.com/roninstudioprojects/" target="_blank" rel="noopener noreferrer" className="hover:text-pink-600 transition-colors flex items-center gap-1">
              <span className="material-icons-round text-sm">photo_camera</span>
              @roninstudioprojects
            </a>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden bg-[#F3F4F6]">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">

          <div>
            <h1 className="text-2xl font-bold">{activeMenu}</h1>
            <p className="text-gray-400 text-sm">Platillos Disponibles</p>
          </div>
          <div className="flex items-center gap-4">
            {currentUser && (
              <div className="bg-white rounded-full px-2 py-1 flex items-center shadow-md border border-gray-100">
                <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden mr-2">
                  <img src={currentUser.image} alt={currentUser.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-900 block">{currentUser.name}</span>
                  <span className="text-[10px] text-gray-500 block uppercase tracking-wider">{currentUser.role}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Categories (Horizontal pills) */}
        <div className="mb-6">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.filter(c => c !== 'All').map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat === activeCategory ? 'All' : cat)}
                className={`px-6 py-3 rounded-full whitespace-nowrap font-bold transition-all transform hover:scale-105 shadow-sm border ${activeCategory === cat
                  ? 'bg-primary text-white border-primary shadow-primary/30'
                  : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Items Grid (Bottom Half) */}
        <div className="flex-1 overflow-y-auto pb-20 pr-2 scrollbar-thin scrollbar-thumb-gray-200">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className={`bg-white rounded-2xl shadow-card flex flex-col relative group transition-all hover:shadow-xl border border-transparent hover:border-primary/20 cursor-pointer overflow-hidden ${item.inventoryLevel === 0 ? 'opacity-60 grayscale' : ''}`}
                onClick={() => addToCart(item)}
              >
                {/* Product Image */}
                <div className="h-32 w-full overflow-hidden relative">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

                  {/* Add Button Overlay */}
                  <button className="absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-white text-primary shadow-lg transform translate-y-10 group-hover:translate-y-0 transition-transform duration-300">
                    <span className="material-icons-round text-sm">add</span>
                  </button>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-gray-800 text-sm leading-tight line-clamp-2">{item.name}</h3>
                  </div>
                  <p className="text-lg font-bold text-primary mt-auto">${item.price.toFixed(2)}</p>

                  {/* Inventory Indicator */}
                  <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between items-center text-[10px] text-gray-400">
                    <span className="uppercase tracking-wider font-semibold">Stock</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.inventoryLevel > 1 ? 'bg-green-500' : item.inventoryLevel === 1 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                      <span className="font-medium">{Math.floor(Math.random() * 20) + 1}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Sidebar (Right Panel) */}
      <div className="w-[400px] bg-white h-full shadow-2xl flex flex-col z-10">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div
            className="cursor-pointer hover:bg-gray-50 rounded-lg p-2 -ml-2 transition-colors"
            onClick={() => setShowTableModal(true)}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">{selectedTable ? selectedTable.name : 'Seleccionar Mesa'}</h2>
              <span className="material-icons-round text-gray-400 text-sm">expand_more</span>
            </div>
            <span className="text-sm text-gray-400">Maria G.</span>
          </div>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"><span className="material-icons-round">qr_code</span></button>
            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"><span className="material-icons-round">print</span></button>
            <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"><span className="material-icons-round">more_vert</span></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-300">
              <span className="material-icons-round text-6xl mb-4">receipt_long</span>
              <p>La orden esta vacia</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {cart.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="group">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-start gap-3">
                      <span className="font-bold text-gray-400 w-4 pt-1">{item.quantity}</span>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{item.name}</h4>
                        {/* Display Actual Note */}
                        {item.notes && (
                          <div className="mt-1 bg-yellow-50 text-[10px] text-yellow-800 p-1 rounded font-bold border border-yellow-100">
                             {item.notes.toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-gray-900 text-sm">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>

                  {/* Note Input */}
                  <div className="ml-7 mt-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Nota</label>
                    <input
                      type="text"
                      value={item.notes || ''}
                      onChange={(e) => updateNote(item.id, e.target.value)}
                      placeholder="Instrucciones especiales..."
                      className="w-full text-xs text-gray-600 placeholder-gray-300 border-none bg-transparent p-0 focus:ring-0"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => updateQuantity(item.id, -1)} className="text-gray-400 hover:text-primary px-2"><span className="material-icons-round text-sm">remove</span></button>
                    <button onClick={() => updateQuantity(item.id, 1)} className="text-gray-400 hover:text-primary px-2"><span className="material-icons-round text-sm">add</span></button>
                    <button onClick={() => setItemToDelete(item.id)} className="text-red-300 hover:text-red-500 px-2"><span className="material-icons-round text-sm">delete</span></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100">
          <div className="flex gap-2 mb-4">
            <button className="flex-1 py-2 rounded-lg border border-primary text-primary text-xs font-bold flex items-center justify-center gap-1 hover:bg-primary/5">
              <span className="material-icons-round text-sm">local_offer</span> Descuento
            </button>
            <button className="flex-1 py-2 rounded-lg border border-primary text-primary text-xs font-bold flex items-center justify-center gap-1 hover:bg-primary/5">
              <span className="material-icons-round text-sm">grid_view</span> Propina
            </button>
          </div>

          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm text-gray-500">
              <span>IVA 16%</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Total</span>
              <span>${finalTotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleSendOrder}
            className="w-full py-4 bg-primary text-white rounded-xl shadow-lg shadow-primary/30 font-bold text-lg hover:bg-blue-600 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={cart.length === 0}
          >
            Enviar Orden
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-80 transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <span className="material-icons-round text-3xl text-red-500">lock</span>
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">Manager Access</h3>
              <p className="text-gray-500 text-sm mb-4">
                Enter PIN to authorize cancellation (0000)
              </p>

              <div className="w-full mb-6">
                <input
                  type="password"
                  maxLength={4}
                  className="w-full text-center text-3xl font-bold tracking-[1em] py-3 rounded-xl border border-gray-200 focus:border-red-500 outline-none transition-all"
                  placeholder="••••"
                  autoFocus
                  onKeyDown={(e) => {
                    const target = e.target as HTMLInputElement;
                    if (e.key === 'Enter') {
                      if (target.value === '0000') {
                        confirmDelete();
                      } else {
                        // Simple shake or visual error could be added here
                        target.value = '';
                        target.classList.add('border-red-500', 'bg-red-50');
                        setTimeout(() => target.classList.remove('border-red-500', 'bg-red-50'), 500);
                      }
                    }
                  }}
                  onChange={(e) => {
                    // Auto-submit if 4 digits
                    if (e.target.value.length === 4) {
                      if (e.target.value === '0000') {
                        confirmDelete();
                      } else {
                        e.target.value = '';
                        // Optional: Add toast or error state
                      }
                    }
                  }}
                />
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setItemToDelete(null)}
                  className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-2xl shadow-2xl transform scale-100 animate-in zoom-in-95 duration-200 flex flex-col items-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
              <span className="material-icons-round text-4xl text-green-500">check</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Orden Enviada</h2>
            <p className="text-gray-500 mt-2">La orden se ha enviado a cocina.</p>
          </div>
        </div>
      )}

      {/* Table Selection Modal */}
      {showTableModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-[600px] transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Seleccionar Mesa</h2>
              <button onClick={() => setShowTableModal(false)} className="text-gray-400 hover:text-gray-600">
                <span className="material-icons-round">close</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {TABLES.map(table => (
                <button
                  key={table.id}
                  onClick={() => {
                    setSelectedTable(table);
                    setShowTableModal(false);
                  }}
                  className={`p-6 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${selectedTable?.id === table.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-gray-100 hover:border-primary/50 hover:bg-gray-50 text-gray-600'
                    }`}
                >
                  <span className="material-icons-round text-3xl">table_restaurant</span>
                  <span className="font-bold text-lg">{table.name}</span>
                  <span className="text-xs opacity-70">{table.seats} Personas</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Menu Item Modal */}
      {showAddMenuModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-2xl shadow-2xl w-[500px] transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Agregar Platillo</h2>
              <button onClick={() => setShowAddMenuModal(false)} className="text-gray-400 hover:text-gray-600">
                <span className="material-icons-round">close</span>
              </button>
            </div>

            <form onSubmit={handleAddMenuItem} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nombre del Platillo</label>
                <input
                  type="text"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  placeholder="Ej. Ceviche Especial"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Precio</label>
                <input
                  type="number"
                  step="0.01"
                  value={newItem.price}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Categoría</label>
                <select
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                >
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddMenuModal(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-blue-600 shadow-lg shadow-primary/30 transition-all active:scale-95"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};