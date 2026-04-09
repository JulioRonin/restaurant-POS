import React, { useState, useMemo } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { useUser } from '../contexts/UserContext';
import { useSettings } from '../contexts/SettingsContext';
import { useMenu } from '../contexts/MenuContext';
import { 
  MenuItem, OrderItem, Order, OrderStatus, 
  OrderSource, PaymentMethod, PaymentStatus, Table 
} from '../types';
import { CATEGORIES, TABLES } from '../constants';
import { bluetoothTerminalService } from '../services/BluetoothTerminalService';
import { printerService } from '../services/PrinterService';

export const RemoteOrderScreen: React.FC = () => {
    // Contexts
    const { currentUser } = useUser();
    const { addOrder } = useOrders();
    const { settings } = useSettings();
    const { menuItems } = useMenu();

    // Mode State
    const [activeMode, setActiveMode] = useState<'DRIVE_THRU' | 'TABLES'>('DRIVE_THRU');
    const [selectedTable, setSelectedTable] = useState<Table | null>(null);
    const [showTableModal, setShowTableModal] = useState(false);

    // Menu State
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<OrderItem[]>([]);

    // Payment State
    const [isProcessing, setIsProcessing] = useState(false);
    const [terminalStep, setTerminalStep] = useState('');
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [lastOrderTotal, setLastOrderTotal] = useState(0);

    // Filtering logic
    const filteredItems = useMemo(() => {
        return menuItems.filter(item => {
            const matchesStatus = item.status === 'ACTIVE';
            const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesStatus && matchesCategory && matchesSearch;
        });
    }, [menuItems, activeCategory, searchQuery]);

    const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + (i.price * i.quantity), 0), [cart]);

    // Actions
    const addToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...item, quantity: 1, notes: '' }];
        });
    };

    const updateQuantity = (id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0));
    };

    const handlePayment = async (method: PaymentMethod) => {
        if (cart.length === 0) return;
        if (activeMode === 'TABLES' && !selectedTable) {
            setShowTableModal(true);
            return;
        }

        const total = cartTotal;
        setLastOrderTotal(total);

        // 1. Process terminal if card
        if (method === PaymentMethod.CARD && settings.isTerminalEnabled) {
            setIsProcessing(true);
            await bluetoothTerminalService.simulateTransaction(total, (step) => setTerminalStep(step));
            setIsProcessing(false);
        }

        // 2. Create Order
        const newOrder: Order = {
            id: `REM-${Date.now().toString().slice(-6)}`,
            tableId: activeMode === 'DRIVE_THRU' ? 'Drive-Thru' : (selectedTable?.name || 'Mesa'),
            items: [...cart],
            status: OrderStatus.COMPLETED,
            paymentStatus: PaymentStatus.PAID,
            paymentMethod: method,
            timestamp: new Date(),
            total: total,
            source: activeMode === 'DRIVE_THRU' ? OrderSource.DRIVE_THRU : OrderSource.DINE_IN,
            waiterName: currentUser?.name || 'Remoto'
        };

        // 3. Persist and Notify
        addOrder(newOrder);
        
        if (settings.isDirectPrintingEnabled) {
            await printerService.printOrder(newOrder, settings);
        }

        // 4. Reset
        setCart([]);
        setShowSuccessModal(true);
        setTimeout(() => setShowSuccessModal(false), 3000);
    };

    return (
        <div className="flex h-full bg-[#F8FAFC] font-sans overflow-hidden">
            
            {/* Left Section: Menu & Products */}
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
                
                {/* Mode Selector & Search */}
                <div className="flex justify-between items-center mb-8 gap-4">
                    <div className="flex p-1 bg-white rounded-2xl shadow-sm border border-gray-100 min-w-[300px]">
                        <button 
                            onClick={() => { setActiveMode('DRIVE_THRU'); setSelectedTable(null); }}
                            className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeMode === 'DRIVE_THRU' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <span className="material-icons-round text-lg">drive_eta</span>
                            Drive-Thru
                        </button>
                        <button 
                            onClick={() => setActiveMode('TABLES')}
                            className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeMode === 'TABLES' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <span className="material-icons-round text-lg">table_restaurant</span>
                            {selectedTable ? selectedTable.name : 'Mesas'}
                        </button>
                    </div>

                    <div className="flex-1 max-w-md relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-icons-round text-gray-400">search</span>
                        <input 
                            type="text" 
                            placeholder="Buscar producto..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-gray-100 rounded-2xl py-3 pl-12 pr-4 text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                    </div>
                </div>

                {/* Categories */}
                <div className="flex gap-3 overflow-x-auto pb-6 scrollbar-hide">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest border-2 transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white border-white text-gray-400 hover:border-gray-200'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredItems.map(item => (
                            <div 
                                key={item.id}
                                onClick={() => addToCart(item)}
                                className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden"
                            >
                                <div className="h-32 w-full mb-4 bg-gray-50 rounded-2xl overflow-hidden relative">
                                    <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="material-icons-round text-white text-4xl">add</span>
                                    </div>
                                </div>
                                <h3 className="font-black text-gray-900 text-sm leading-tight mb-2 uppercase line-clamp-2">{item.name}</h3>
                                <p className="text-primary font-black text-lg">${item.price.toFixed(2)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Section: Checkout Summary */}
            <div className="w-[450px] bg-white border-l border-gray-100 flex flex-col shadow-2xl relative z-20">
                <div className="p-8 border-b border-gray-50">
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase mb-1">Orden de Venta</h2>
                    <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">
                        {activeMode === 'DRIVE_THRU' ? 'Unidad de Drive-Thru' : (selectedTable ? `Mesa: ${selectedTable.name}` : 'Mesa no seleccionada')}
                    </p>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {cart.map(item => (
                        <div key={item.id} className="flex justify-between items-center group">
                            <div className="flex-1">
                                <h4 className="font-black text-gray-900 text-sm uppercase leading-tight mb-1">{item.name}</h4>
                                <p className="text-gray-400 font-bold text-xs">${item.price.toFixed(2)} c/u</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => updateQuantity(item.id, -1)}
                                    className="w-8 h-8 rounded-full bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center"
                                >
                                    <span className="material-icons-round text-sm">remove</span>
                                </button>
                                <span className="font-black text-lg text-gray-900 w-6 text-center">{item.quantity}</span>
                                <button 
                                    onClick={() => updateQuantity(item.id, 1)}
                                    className="w-8 h-8 rounded-full bg-gray-50 text-gray-400 hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-center"
                                >
                                    <span className="material-icons-round text-sm">add</span>
                                </button>
                            </div>
                            <div className="w-24 text-right">
                                <span className="font-black text-gray-900 text-sm">${(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        </div>
                    ))}

                    {cart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-50">
                            <span className="material-icons-round text-6xl mb-4">shopping_cart</span>
                            <p className="text-xs font-black uppercase tracking-widest text-center">La canasta esta vacía</p>
                        </div>
                    )}
                </div>

                {/* Payment & Totals */}
                <div className="p-8 bg-gray-50/50 border-t border-gray-50">
                    <div className="space-y-3 mb-8">
                        <div className="flex justify-between text-gray-400 font-bold text-xs uppercase tracking-widest">
                            <span>Subtotal</span>
                            <span>${cartTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-900 font-black text-2xl tracking-tight">
                            <span>TOTAL</span>
                            <span>${cartTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            disabled={cart.length === 0 || isProcessing}
                            onClick={() => handlePayment(PaymentMethod.CARD)}
                            className="flex flex-col items-center justify-center gap-2 p-6 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95 group"
                        >
                            <span className="material-icons-round text-3xl group-hover:scale-110 transition-transform">credit_card</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">Tarjeta</span>
                        </button>
                        <button 
                            disabled={cart.length === 0 || isProcessing}
                            onClick={() => setShowTransferModal(true)}
                            className="flex flex-col items-center justify-center gap-2 p-6 bg-purple-600 rounded-3xl text-white shadow-xl shadow-purple-200 hover:bg-purple-700 transition-all disabled:opacity-50 active:scale-95 group"
                        >
                            <span className="material-icons-round text-3xl group-hover:scale-110 transition-transform">account_balance</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">Transferencia</span>
                        </button>
                    </div>

                    <button 
                        disabled={cart.length === 0 || isProcessing}
                        onClick={() => handlePayment(PaymentMethod.CASH)}
                        className="w-full mt-4 py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-black transition-all disabled:opacity-50"
                    >
                        Pagar en Efectivo
                    </button>
                </div>
            </div>

            {/* Modals Section */}

            {/* Terminal Processing Modal */}
            {isProcessing && (
                <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-sm rounded-[40px] p-10 text-center shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="w-24 h-24 mb-8 mx-auto relative">
                            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="material-icons-round text-primary text-4xl">terminal</span>
                            </div>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tight">Procesando Pago</h3>
                        <p className="text-primary font-bold animate-pulse text-xs uppercase tracking-widest mb-10">{terminalStep}</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">No apagues la terminal</p>
                    </div>
                </div>
            )}

            {/* Transfer Modal */}
            {showTransferModal && (
                <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-xl flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-md rounded-[50px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
                        <div className="bg-purple-600 p-10 text-white text-center relative overflow-hidden">
                            <div className="relative z-10">
                                <p className="text-purple-100 font-black text-[10px] uppercase tracking-[0.3em] mb-2">Total a Transferir</p>
                                <h2 className="text-6xl font-black tracking-tighter">${cartTotal.toFixed(2)}</h2>
                            </div>
                            <span className="material-icons-round absolute -right-6 -bottom-6 text-[180px] text-white/5 rotate-12">account_balance</span>
                        </div>
                        
                        <div className="p-10 space-y-8">
                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Banco</p>
                                    <p className="font-black text-gray-900 text-lg uppercase">{settings.bankName || 'REVISAR SETTINGS'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Beneficiario</p>
                                    <p className="font-black text-gray-900 text-lg uppercase">{settings.bankBeneficiary || 'REVISAR SETTINGS'}</p>
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tarjeta / CLABE</p>
                                    <p className="font-black text-2xl text-purple-600 tracking-wider">
                                        {settings.bankCLABE || settings.bankAccount || '--- --- ---'}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(settings.bankCLABE || settings.bankAccount || '');
                                        alert('Copiado');
                                    }}
                                    className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-purple-100 text-purple-600 flex items-center justify-center hover:bg-purple-50 transition-all active:scale-95"
                                >
                                    <span className="material-icons-round">content_copy</span>
                                </button>
                            </div>

                            <a 
                                href={`https://wa.me/52${settings.bankWhatsapp}?text=Hola, envío mi comprobante de pago por $${cartTotal.toFixed(2)}`}
                                target="_blank" rel="noopener noreferrer"
                                className="w-full py-5 bg-[#25D366] text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-green-100 hover:scale-[1.02] active:scale-95 transition-all text-sm"
                            >
                                <span className="material-icons-round text-2xl">whatsapp</span>
                                Enviar Comprobante
                            </a>

                            <div className="flex gap-4">
                                <button 
                                    onClick={() => setShowTransferModal(false)}
                                    className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200"
                                >
                                    Regresar
                                </button>
                                <button 
                                    onClick={() => {
                                        handlePayment(PaymentMethod.TRANSFER);
                                        setShowTransferModal(false);
                                    }}
                                    className="flex-1 py-4 bg-purple-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-purple-700 shadow-lg shadow-purple-100"
                                >
                                    Confirmar Pago
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Table Selection Modal */}
            {showTableModal && (
                <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-2xl rounded-[50px] p-10 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Seleccionar Mesa</h2>
                                <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">Asigna esta orden remota a una mesa</p>
                            </div>
                            <button onClick={() => setShowTableModal(false)} className="w-12 h-12 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-4 h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                            {TABLES.map(table => (
                                <button
                                    key={table.id}
                                    onClick={() => {
                                        setSelectedTable(table);
                                        setShowTableModal(false);
                                        if (cart.length > 0) handlePayment(PaymentMethod.CARD); // Retry if triggered from pay
                                    }}
                                    className={`p-6 rounded-[35px] border-4 flex flex-col items-center gap-2 transition-all ${selectedTable?.id === table.id ? 'border-primary bg-primary/5 text-primary' : 'border-gray-50 hover:border-gray-100 bg-white text-gray-600'}`}
                                >
                                    <span className="material-icons-round text-3xl">table_restaurant</span>
                                    <span className="font-black text-xl">{table.name}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Sillas: {table.seats}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white p-12 rounded-[50px] shadow-2xl transform animate-in zoom-in-95 duration-300 flex flex-col items-center">
                        <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-green-100 animate-bounce">
                            <span className="material-icons-round text-5xl text-white">check</span>
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Cobro Exitoso</h2>
                        <p className="text-gray-400 font-bold mt-2 uppercase text-[10px] tracking-[0.3em]">Orden Finalizada por ${lastOrderTotal.toFixed(2)}</p>
                    </div>
                </div>
            )}

        </div>
    );
};
