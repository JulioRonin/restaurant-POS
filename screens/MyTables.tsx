import React, { useState, useMemo } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { useUser } from '../contexts/UserContext';
import { OrderStatus, TableStatus, OrderSource, MenuItem } from '../types';
import { useTables } from '../contexts/TableContext';
import { useMenu } from '../contexts/MenuContext';

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

    // Filter current waiter active orders
    const myOrders = useMemo(() => {
        if (!activeEmployee) return [];
        return orders.filter(o => 
            o.waiterName === activeEmployee.name && 
            o.status !== OrderStatus.COMPLETED
        );
    }, [orders, activeEmployee]);

    const handleRequestBill = (orderId: string) => {
        updateOrderStatus(orderId, OrderStatus.BILL_REQUESTED);
    };

    const getElapsedTime = (timestamp: Date) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        const mins = Math.floor(diff / 60000);
        return `${mins} min`;
    };

    const handleOpenEdit = (order: any) => {
        setEditingOrder(order);
        setTempItems([...order.items]);
    };

    const updateTempQuantity = (index: number, delta: number) => {
        const newItems = [...tempItems];
        const newQty = Math.max(0, newItems[index].quantity + delta);
        if (newQty === 0) {
            newItems.splice(index, 1);
        } else {
            newItems[index].quantity = newQty;
        }
        setTempItems(newItems);
    };

    const handleSaveChanges = () => {
        if (!editingOrder) return;

        // Check if anything was removed or reduction in quantity
        const isReduction = tempItems.length < editingOrder.items.length || 
            tempItems.some((item, idx) => {
                const original = editingOrder.items.find((oi: any) => oi.name === item.name);
                return original && item.quantity < original.quantity;
            });

        if (isReduction) {
            setShowPinModal(true);
        } else {
            finalizeSave();
        }
    };

    const finalizeSave = () => {
        if (!editingOrder) return;
        const newTotal = tempItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const updatedOrder = { ...editingOrder, items: tempItems, total: newTotal };
        updateOrderStatus(editingOrder.id, editingOrder.status, updatedOrder);
        setEditingOrder(null);
        setPin('');
        setShowPinModal(false);
    };

    const handlePinSubmit = () => {
        if (pin === '0000') {
            finalizeSave();
        } else {
            alert('PIN Incorrecto');
            setPin('');
        }
    };

    return (
        <div className="flex-1 bg-[#F3F4F6] text-gray-800 p-8 overflow-y-auto h-full">
            <header className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <span className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center material-icons-round shadow-lg shadow-primary/30">person_pin_circle</span>
                        Mis Mesas
                    </h1>
                    <p className="text-gray-500 font-medium mt-1">Supervisa tus órdenes activas y solicita el cierre de cuentas.</p>
                </div>
                <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-gray-100 text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Mesas Atendiendo</p>
                    <p className="text-2xl font-black text-primary leading-none">{myOrders.length}</p>
                </div>
            </header>

            {myOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-gray-400 border-2 border-dashed border-gray-200 rounded-[2.5rem] bg-white/50">
                    <span className="material-icons-round text-6xl mb-4 opacity-20">table_restaurant</span>
                    <p className="font-bold text-lg">No tienes mesas activas</p>
                    <p className="text-sm">Ve al Punto de Venta para abrir una nueva orden.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myOrders.map(order => {
                        const table = TABLES.find(t => t.id === order.tableId);
                        const isBillRequested = order.status === OrderStatus.BILL_REQUESTED;

                        return (
                            <div key={order.id} className={`bg-white rounded-[2rem] shadow-soft border-2 transition-all p-6 relative overflow-hidden flex flex-col ${isBillRequested ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-transparent'}`}>
                                {isBillRequested && (
                                    <div className="absolute top-0 right-0 bg-blue-500 text-white px-4 py-1.5 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                                        <span className="material-icons-round text-xs">notifications_active</span>
                                        CUENTA SOLICITADA
                                    </div>
                                )}

                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">MESA</span>
                                            {order.source && order.source !== OrderSource.DINE_IN && (
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black text-white uppercase tracking-widest ${
                                                    order.source === OrderSource.RAPPI ? 'bg-[#FF3C5C]' :
                                                    order.source === OrderSource.DIDI ? 'bg-[#FF7D00]' :
                                                    order.source === OrderSource.UBER_EATS ? 'bg-[#06C167]' :
                                                    'bg-primary'
                                                }`}>
                                                    {order.source.replace('_', ' ')}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-3xl font-black text-gray-900">{order.tableId}</h3>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <div className="flex gap-2 mb-2">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm('¿Eliminar esta orden por completo?')) {
                                                        removeOrder(order.id);
                                                    }
                                                }}
                                                className="p-2 bg-red-100 text-red-600 rounded-xl shadow-sm border border-red-200 hover:bg-red-600 hover:text-white transition-all active:scale-95"
                                                title="Eliminar Orden"
                                            >
                                                <span className="material-icons-round text-sm">delete</span>
                                            </button>
                                        </div>
                                        <span className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-1">TIEMPO</span>
                                        <span className="font-bold text-gray-600 flex items-center gap-1 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                                            <span className="material-icons-round text-sm">schedule</span>
                                            {getElapsedTime(order.timestamp)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-4 mb-8">
                                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">CONCEPTO</p>
                                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                            {order.items.map((item, i) => (
                                                <div key={i} className="flex justify-between text-sm">
                                                    <span className="text-gray-600"><span className="font-black text-primary mr-1">{item.quantity}x</span> {item.name}</span>
                                                    <span className="font-bold text-gray-900">${(item.price * item.quantity).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center px-2">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Total Acumulado</span>
                                        <span className="text-2xl font-black text-primary">${order.total.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    {!isBillRequested ? (
                                        <>
                                            <button 
                                                onClick={() => handleOpenEdit(order)}
                                                className="w-14 h-14 bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                                                title="Modificar Orden"
                                            >
                                                <span className="material-icons-round text-2xl">edit</span>
                                            </button>
                                            <button 
                                                onClick={() => handleRequestBill(order.id)}
                                                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                <span className="material-icons-round text-lg">payments</span>
                                                SOLICITAR CUENTA
                                            </button>
                                        </>
                                    ) : (
                                        <div className="flex-1 py-4 bg-gray-100 text-blue-500 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 border-2 border-blue-500/20">
                                            <span className="material-icons-round text-lg -translate-y-0.5">hourglass_top</span>
                                            ESPERANDO COBRO
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit Order Modal */}
            {editingOrder && (
                <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in transition-all">
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                                    <span className="material-icons-round text-primary">edit_note</span>
                                    Modificar Comanda
                                </h2>
                                <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Mesa: {editingOrder.tableId}</p>
                            </div>
                            <button onClick={() => setEditingOrder(null)} className="w-12 h-12 rounded-full hover:bg-white text-gray-400 transition-all active:scale-90 flex items-center justify-center">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Productos en la Cuenta</span>
                                <button 
                                    onClick={() => setShowItemPicker(true)}
                                    className="px-4 py-1.5 bg-green-50 text-green-600 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-green-100 transition-all flex items-center gap-1"
                                >
                                    <span className="material-icons-round text-xs">add_circle</span>
                                    Agregar Producto
                                </button>
                            </div>

                            {tempItems.map((item, idx) => (
                                <div key={idx} className="bg-gray-50 rounded-3xl p-5 border border-gray-100 flex items-center justify-between group hover:border-primary/30 transition-all">
                                    <div className="flex flex-col">
                                        <span className="font-black text-gray-900 leading-tight">{item.name}</span>
                                        <span className="text-xs font-bold text-gray-400">${item.price.toFixed(2)} c/u</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
                                            <button 
                                                onClick={() => updateTempQuantity(idx, -1)}
                                                className="w-10 h-10 rounded-xl hover:bg-red-50 text-red-400 hover:text-red-500 transition-all flex items-center justify-center"
                                            >
                                                <span className="material-icons-round">{item.quantity === 1 ? 'delete' : 'remove'}</span>
                                            </button>
                                            <span className="w-10 text-center font-black text-lg text-gray-800">{item.quantity}</span>
                                            <button 
                                                onClick={() => updateTempQuantity(idx, 1)}
                                                className="w-10 h-10 rounded-xl hover:bg-green-50 text-green-400 hover:text-green-500 transition-all flex items-center justify-center"
                                            >
                                                <span className="material-icons-round">add</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {tempItems.length === 0 && (
                                <div className="py-20 text-center text-gray-400 italic">No hay productos en la comanda</div>
                            )}
                        </div>

                        {showItemPicker && (
                            <div className="p-8 pt-0 border-t border-gray-100 bg-gray-50/50">
                                <div className="relative mb-4 mt-8">
                                    <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                                    <input 
                                        type="text" 
                                        placeholder="Buscar para agregar..." 
                                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl outline-none focus:border-primary font-bold text-sm"
                                        value={pickerSearch}
                                        onChange={(e) => setPickerSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                    {menuItems
                                        .filter(i => i.status === 'ACTIVE' && i.name.toLowerCase().includes(pickerSearch.toLowerCase()))
                                        .slice(0, 10)
                                        .map(item => (
                                            <button 
                                                key={item.id}
                                                onClick={() => {
                                                    const existing = tempItems.find(ti => ti.id === item.id);
                                                    if (existing) {
                                                        const newItems = tempItems.map(ti => ti.id === item.id ? { ...ti, quantity: ti.quantity + 1 } : ti);
                                                        setTempItems(newItems);
                                                    } else {
                                                        setTempItems([...tempItems, { ...item, quantity: 1, notes: '' }]);
                                                    }
                                                    setShowItemPicker(false);
                                                    setPickerSearch('');
                                                }}
                                                className="flex justify-between items-center p-4 bg-white hover:bg-primary hover:text-white rounded-2xl border border-gray-100 transition-all group"
                                            >
                                                <span className="font-bold text-sm tracking-tight">{item.name}</span>
                                                <span className="font-black">${item.price.toFixed(2)}</span>
                                            </button>
                                        ))}
                                </div>
                                <button onClick={() => setShowItemPicker(false)} className="w-full mt-4 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors">Cancelar Búsqueda</button>
                            </div>
                        )}

                        <div className="p-8 bg-white border-t border-gray-100 space-y-4">
                            <div className="flex justify-between items-center px-2">
                                <span className="text-sm font-black text-gray-400 uppercase tracking-widest leading-none">Nuevo Total</span>
                                <span className="text-3xl font-black text-primary leading-none">
                                    ${tempItems.reduce((s, i) => s + (i.price * i.quantity), 0).toFixed(2)}
                                </span>
                            </div>
                            <button 
                                onClick={handleSaveChanges}
                                className="w-full py-5 bg-primary text-white rounded-3xl font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-primary/30 hover:bg-primary-dark transition-all active:scale-95 flex items-center justify-center gap-3"
                            >
                                <span className="material-icons-round text-xl">save</span>
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PIN Authorization Modal */}
            {showPinModal && (
                <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in transition-all">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 text-center animate-in zoom-in-95 fill-mode-both">
                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mx-auto mb-6">
                            <span className="material-icons-round text-4xl">lock</span>
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight uppercase tracking-widest">Autorización Requerida</h3>
                        <p className="text-gray-500 font-medium text-sm mb-8 leading-relaxed">Solo un gerente puede autorizar cancelaciones o reducciones en la comanda.</p>
                        
                        <div className="space-y-6">
                            <div className="flex justify-center gap-4">
                                {[1, 2, 3, 4].map((_, i) => (
                                    <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${pin.length > i ? 'bg-primary border-primary scale-125' : 'border-gray-200'}`}></div>
                                ))}
                            </div>
                            
                            <div className="grid grid-cols-3 gap-3">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                                    <button 
                                        key={n} 
                                        onClick={() => pin.length < 4 && setPin(pin + n)}
                                        className="w-full h-16 rounded-2xl border-2 border-gray-50 bg-gray-50/50 hover:bg-white hover:border-primary/30 text-2xl font-black text-gray-700 transition-all active:scale-90"
                                    >
                                        {n}
                                    </button>
                                ))}
                                <button onClick={() => setPin('')} className="w-full h-16 rounded-2xl text-xs font-black text-gray-400 uppercase tracking-widest hover:text-red-500 transition-all">Borrar</button>
                                <button onClick={() => pin.length < 4 && setPin(pin + '0')} className="w-full h-16 rounded-2xl border-2 border-gray-50 bg-gray-50/50 hover:bg-white hover:border-primary/30 text-2xl font-black text-gray-700 transition-all active:scale-90">0</button>
                                <button onClick={handlePinSubmit} className="w-full h-16 rounded-2xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-all active:scale-90 shadow-lg shadow-primary/20">
                                    <span className="material-icons-round">check</span>
                                </button>
                            </div>
                            
                            <button onClick={() => { setShowPinModal(false); setPin(''); }} className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] hover:text-gray-600 transition-colors">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

