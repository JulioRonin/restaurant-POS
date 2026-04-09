import React, { useState, useMemo } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { useExpenses } from '../contexts/ExpenseContext';
import { useTables } from '../contexts/TableContext';
import { Order, PaymentMethod, PaymentStatus, InvoiceDetails, ExpenseCategory, OrderStatus, OrderSource } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { useUser } from '../contexts/UserContext';
import { Ticket } from '../components/Ticket';
import { CashCutTicket } from '../components/CashCutTicket';
import { FinancialReportModal } from '../components/FinancialReportModal';
import { printerService } from '../services/PrinterService';
import { bluetoothTerminalService } from '../services/BluetoothTerminalService';

export const CashierScreen: React.FC = () => {
    // Contexts
    const { orders, updateOrderStatus } = useOrders();
    const { expenses, addExpense, deleteExpense } = useExpenses();
    const { tables: TABLES } = useTables();

    // View State
    const [activeTab, setActiveTab] = useState<'tables' | 'expenses' | 'history' | 'delivery'>('tables');

    // POS / Tables State
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
    const [tipAmount, setTipAmount] = useState<number>(0);
    const [splitCount, setSplitCount] = useState<number>(1);
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [invoiceData, setInvoiceData] = useState<InvoiceDetails>({ rfc: '', legalName: '', email: '', useCFDI: 'G03' });

    // Expense State
    const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<ExpenseCategory | 'All'>('All');
    const [newExpenseDesc, setNewExpenseDesc] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    const [newExpenseCategory, setNewExpenseCategory] = useState<ExpenseCategory>('Insumos');

    // History / Sales Log State
    const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>('All');

    // Printing / Payment State
    const { settings } = useSettings();
    const { currentUser } = useUser();
    const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [cashReceived, setCashReceived] = useState<string>('');
    const [isProcessingTerminal, setIsProcessingTerminal] = useState(false);
    const [terminalStep, setTerminalStep] = useState('');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [showFinancialReport, setShowFinancialReport] = useState(false);
    const [cashCutToPrint, setCashCutToPrint] = useState<{
        orders: Order[],
        metrics: any,
        expenses: any[],
        totalExpenses: number
    } | null>(null);
    const [dismissedBillRequests, setDismissedBillRequests] = useState<string[]>([]);

    const handlePrintTicket = async (order: Order) => {
        // Enrich order with table info and current user if missing
        const enrichedOrder = {
            ...order,
            tableId: order.tableId || selectedTableId || 'VENTA',
            waiterName: order.waiterName || currentUser?.name || 'ADMIN'
        };

        if (settings.isDirectPrintingEnabled) {
            const success = await printerService.printOrder(enrichedOrder, settings);
            if (success) return; // Silent print worked!
        }
        
        // Fallback for Manual Print Dialog
        setOrderToPrint(enrichedOrder);
        setTimeout(() => {
            window.print();
            setOrderToPrint(null);
        }, 350);
    };

    const handlePrintCashCut = async () => {
        const data = {
            orders: completedOrders,
            metrics: salesMetrics,
            expenses: expenses,
            totalExpenses: totalExpenses
        };

        if (settings.isDirectPrintingEnabled) {
            const success = await printerService.printCashCut(data, settings);
            if (success) return;
        }

        // Fallback for Manual Print Dialog
        setCashCutToPrint(data);
        setTimeout(() => {
            window.print();
            setCashCutToPrint(null);
        }, 100);
    };

    const handleProcessPayment = async () => {
        if (!selectedOrder) return;
        
        // If it's a card payment and terminal is enabled, simulate the transaction
        if (paymentMethod === PaymentMethod.CARD && settings.isTerminalEnabled) {
            setIsProcessingTerminal(true);
            await bluetoothTerminalService.simulateTransaction(total / splitCount, (step) => {
                setTerminalStep(step);
            });
            setIsProcessingTerminal(false);
        }

        const splitAmount = total / splitCount;
        const currentPaidSplits = (selectedOrder.paidSplits || 0) + 1;
        const isFullyPaid = currentPaidSplits >= splitCount;

        const received = parseFloat(cashReceived) || splitAmount;
        const change = paymentMethod === PaymentMethod.CASH ? Math.max(0, received - splitAmount) : 0;

        const updatedOrder: Order = {
            ...selectedOrder,
            status: isFullyPaid ? OrderStatus.COMPLETED : OrderStatus.PENDING,
            paymentStatus: isFullyPaid ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
            paymentMethod: paymentMethod,
            receivedAmount: (selectedOrder.receivedAmount || 0) + splitAmount,
            changeAmount: change,
            paidSplits: currentPaidSplits,
            timestamp: new Date(),
            tableId: selectedOrder.tableId || selectedTableId || 'VENTA',
            waiterName: selectedOrder.waiterName || currentUser?.name || 'ADMIN'
        };

        updateOrderStatus(selectedOrder.id, updatedOrder.status, updatedOrder);
        
        // Open Cash Drawer if it's a cash or mixed payment AND enabled in settings
        if ((paymentMethod === PaymentMethod.CASH || paymentMethod === PaymentMethod.MIXED) && settings.isCashDrawerEnabled) {
            await printerService.openCashDrawer();
        }

        // Generate TICKET for this split
        const splitOrderTicket = { ...updatedOrder, total: splitAmount }; 
        await handlePrintTicket(splitOrderTicket as Order);

        if (!isFullyPaid) {
            setSuccessMessage(`Pago parcial registrado (${currentPaidSplits} de ${splitCount} partes).`);
            setTimeout(() => setSuccessMessage(null), 4000);
        } else {
            setSuccessMessage("Cuenta liquidada con éxito.");
            setTimeout(() => setSuccessMessage(null), 4000);
            setSelectedTableId(null);
            setSplitCount(1);
        }

        setIsPaymentModalOpen(false);
        setCashReceived('');
    };

    // --- POS Logic ---
    const activeOrders = useMemo(() => orders.filter(o => o.status !== 'COMPLETED'), [orders]);
    const selectedOrder = useMemo(() => orders.find(o => 
        (o.id === selectedTableId || o.tableId === selectedTableId || (selectedTableId === 'BARRA' && o.tableId === 'Barra')) && 
        o.status !== 'COMPLETED'
    ), [orders, selectedTableId]);

    const subtotal = selectedOrder?.total || 0;
    const total = subtotal + tipAmount;

    // --- Expense Logic ---
    const filteredExpenses = useMemo(() => {
        if (expenseCategoryFilter === 'All') return expenses;
        return expenses.filter(e => e.category === expenseCategoryFilter);
    }, [expenses, expenseCategoryFilter]);

    const handleAddExpense = () => {
        if (!newExpenseDesc || !newExpenseAmount) return;
        addExpense(newExpenseDesc, parseFloat(newExpenseAmount), newExpenseCategory, 'Cashier');
        setNewExpenseDesc('');
        setNewExpenseAmount('');
        setSuccessMessage('Gasto registrado con éxito');
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    const STARTING_BALANCE = 5000;
    const currentBalance = STARTING_BALANCE - (expenses.reduce((sum, e) => sum + e.amount, 0));

    // --- History / Cash Cut Logic ---
    const filteredByDateOrders = useMemo(() => {
        return orders.filter(o => new Date(o.timestamp).toISOString().split('T')[0] === selectedDate);
    }, [orders, selectedDate]);

    const filteredByDateExpenses = useMemo(() => {
        return expenses.filter(e => e.date === selectedDate);
    }, [expenses, selectedDate]);

    const completedOrdersCount = useMemo(() => filteredByDateOrders.filter(o => o.status === 'COMPLETED'), [filteredByDateOrders]);

    const salesMetrics = useMemo(() => {
        const _sales = filteredByDateOrders.filter(o => o.status === 'COMPLETED');
        const totalRevenue = _sales.reduce((sum, o) => sum + (o.total || 0), 0);
        const cashSales = _sales.filter(o => o.paymentMethod === PaymentMethod.CASH).reduce((sum, o) => sum + (o.total || 0), 0);
        const cardSales = _sales.filter(o => o.paymentMethod === PaymentMethod.CARD).reduce((sum, o) => sum + (o.total || 0), 0);
        const mixedSales = _sales.filter(o => o.paymentMethod === PaymentMethod.MIXED).reduce((sum, o) => sum + (o.total || 0), 0);
        
        // Delivery Sales Calculation
        const deliverySales = _sales.filter(o => o.source === OrderSource.UBER_EATS || o.source === OrderSource.RAPPI).reduce((sum, o) => sum + (o.total || 0), 0);

        const categoryBreakdown: Record<string, number> = {};
        _sales.forEach(order => {
            order.items.forEach(item => {
                const cat = item.category || 'Uncategorized';
                const amt = item.price * item.quantity;
                categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amt;
            });
        });

        return { totalRevenue, cashSales, cardSales, mixedSales, deliverySales, categoryBreakdown };
    }, [filteredByDateOrders]);

    const completedOrders = filteredByDateOrders.filter(o => o.status === 'COMPLETED');
    const totalExpenses = filteredByDateExpenses.reduce((sum, e) => sum + e.amount, 0);

    const filteredHistory = useMemo(() => {
        const _base = filteredByDateOrders.filter(o => o.status === 'COMPLETED');
        if (historyCategoryFilter === 'All') return _base;
        return _base.filter(o => o.items.some(i => i.category === historyCategoryFilter));
    }, [filteredByDateOrders, historyCategoryFilter]);

    const availableCategories = useMemo(() => {
        const cats = new Set<string>();
        completedOrders.forEach(o => o.items.forEach(i => cats.add(i.category)));
        return ['All', ...Array.from(cats)];
    }, [completedOrders]);

    return (
        <div className="flex h-full bg-gray-100 font-sans">
            {/* Ticket to print (hidden onscreen) */}
            <div className="hidden print:block absolute inset-0 z-[9999] bg-white">
                {orderToPrint && <Ticket order={orderToPrint} settings={settings} />}
                {cashCutToPrint && (
                    <CashCutTicket 
                        orders={cashCutToPrint.orders}
                        metrics={cashCutToPrint.metrics}
                        expenses={cashCutToPrint.expenses}
                        totalExpenses={cashCutToPrint.totalExpenses}
                        settings={settings}
                    />
                )}
            </div>

            <div className="flex flex-1 h-full print:hidden relative">
                {/* Bill Request Alerts */}
                {(() => {
                    const activeRequests = orders.filter(o => o.status === OrderStatus.BILL_REQUESTED && !dismissedBillRequests.includes(o.id));
                    if (activeRequests.length === 0) return null;

                    const handleBannerClick = () => {
                        const ids = activeRequests.map(o => o.id);
                        setDismissedBillRequests(prev => [...new Set([...prev, ...ids])]);
                        setActiveTab('tables');
                        
                        // Select the first one automatically
                        if (activeRequests[0].tableId) {
                            setSelectedTableId(activeRequests[0].tableId);
                        }
                    };

                    return (
                        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[500] animate-in slide-in-from-top-4 duration-500 w-full max-w-xl px-4">
                            <div 
                                onClick={handleBannerClick}
                                className="bg-amber-500 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center justify-between border-4 border-white cursor-pointer hover:bg-amber-600 transition-all group scale-100 hover:scale-[1.02] active:scale-95"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-icons-round text-3xl animate-bounce">notifications_active</span>
                                    <div>
                                        <p className="font-black text-xs uppercase tracking-widest leading-none">Solicitudes de Cuenta</p>
                                        <p className="font-bold text-sm opacity-90">
                                            {activeRequests.map(o => {
                                                const sourceName = o.source && o.source !== OrderSource.DINE_IN ? o.source : 'Mesa';
                                                return `${sourceName} ${o.tableId}`;
                                            }).join(', ')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black group-hover:bg-white/40 transition-colors">
                                        {activeRequests.length} MESAS
                                    </span>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation(); // Don't trigger the select-table logic
                                            const ids = activeRequests.map(o => o.id);
                                            setDismissedBillRequests(prev => [...new Set([...prev, ...ids])]);
                                        }}
                                        className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/40 transition-colors"
                                    >
                                        <span className="material-icons-round text-sm">close</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Global Notification Toast */}
                {successMessage && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[500] animate-in slide-in-from-top-4 duration-500">
                        <div className="bg-primary text-white px-8 py-4 rounded-2xl shadow-2xl shadow-primary/30 flex items-center gap-3 border border-white/20 backdrop-blur-md">
                            <span className="material-icons-round text-2xl">check_circle</span>
                            <p className="font-black text-sm uppercase tracking-widest">{successMessage}</p>
                        </div>
                    </div>
                )}

                {/* Left Panel: Navigation & Lists */}
                <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col no-print">
                    <div className="p-6 border-b border-gray-100">
                        <h1 className="text-2xl font-bold text-gray-800 mb-4">Caja / Facturación</h1>
                        <div className="flex p-1 bg-gray-100 rounded-xl">
                            {['tables', 'expenses', 'history', 'delivery'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all uppercase ${activeTab === tab ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {activeTab === 'tables' ? (
                            <>
                                {TABLES.map(table => {
                                    const order = orders.find(o => o.tableId === table.id && o.status !== 'COMPLETED');
                                    const isBillRequested = order?.status === OrderStatus.BILL_REQUESTED;
                                    
                                    // Highlight logic: if it requested a bill, keep it glowing until dismissed or paid
                                    const isHighlighted = isBillRequested && !dismissedBillRequests.includes(order?.id || '');

                                    const statusColor = isHighlighted ? 'bg-amber-50 border-amber-500 ring-4 ring-amber-500/20 shadow-lg shadow-amber-200/50' : 
                                                      isBillRequested ? 'bg-orange-50 border-orange-200' :
                                                      order ? 'bg-orange-100 border-orange-200' : 
                                                      'bg-gray-50 border-gray-100 opacity-60';
                                    
                                    return (
                                        <div
                                            key={table.id}
                                            onClick={() => order && setSelectedTableId(table.id)}
                                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden ${statusColor} ${selectedTableId === table.id ? 'ring-2 ring-primary border-primary' : ''} ${isHighlighted ? 'animate-pulse' : ''}`}
                                        >
                                            {isBillRequested && (
                                                <div className={`absolute top-0 right-0 ${isHighlighted ? 'bg-amber-500' : 'bg-orange-500'} text-white px-2 py-0.5 rounded-bl-lg text-[8px] font-black`}>
                                                    CUENTA
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-lg">{table.name}</span>
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{table.id}</span>
                                                </div>
                                                {order && <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold">${order.total.toFixed(2)}</span>}
                                            </div>
                                            <div className="text-xs text-gray-500">{order ? `${order.items.length} Items • Waiter: ${order.waiterName || 'N/A'}` : 'No Active Order'}</div>
                                        </div>
                                    );
                                })}

                                {/* Special Section for Barra / Direct Sales */}
                                {orders.some(o => (o.tableId === 'BARRA' || o.tableId === 'Barra') && o.status !== 'COMPLETED') && (
                                    <div className="mt-8 border-t pt-6">
                                        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Ventas Directas / Barra</h3>
                                        {orders.filter(o => (o.tableId === 'BARRA' || o.tableId === 'Barra') && o.status !== 'COMPLETED').map(order => (
                                            <div
                                                key={order.id}
                                                onClick={() => setSelectedTableId(order.tableId)}
                                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all bg-blue-50 border-blue-100 mb-2 ${selectedTableId === order.tableId ? 'ring-2 ring-primary border-primary' : ''}`}
                                            >
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-bold text-gray-700">Orden #{order.id}</span>
                                                    <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-bold">${order.total.toFixed(2)}</span>
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Barra / Mostrador</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : activeTab === 'delivery' ? (
                            <div className="space-y-3">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Órdenes de Aplicaciones / Delivery</h3>
                                {orders.filter(o => o.source && o.source !== OrderSource.DINE_IN && o.status !== 'COMPLETED').map(order => (
                                    <div
                                        key={order.id}
                                        onClick={() => setSelectedTableId(order.id)}
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                            order.source === OrderSource.RAPPI ? 'bg-pink-50 border-pink-100' :
                                            order.source === OrderSource.DIDI ? 'bg-orange-50 border-orange-100' :
                                            order.source === OrderSource.UBER_EATS ? 'bg-green-50 border-green-100' :
                                            'bg-blue-50 border-blue-100'
                                        } ${selectedTableId === order.id ? 'ring-2 ring-primary border-primary' : ''}`}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="flex flex-col">
                                                <span className="font-black text-gray-800 uppercase text-xs tracking-wider">{order.source}</span>
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Orden: {order.tableId}</span>
                                            </div>
                                            <span className="bg-white/60 px-2 py-1 rounded-full font-black text-xs shadow-sm">${order.total.toFixed(2)}</span>
                                        </div>
                                        <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-2">{order.items.length} Platillos • ID: {order.id.slice(-6)}</div>
                                    </div>
                                ))}
                                {orders.filter(o => o.source && o.source !== OrderSource.DINE_IN && o.status !== 'COMPLETED').length === 0 && (
                                    <div className="py-10 text-center text-gray-400 italic text-sm">No hay pedidos de delivery activos</div>
                                )}
                            </div>
                        ) : activeTab === 'expenses' ? (
                            <>
                                <div className="mb-4">
                                    <select className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary" value={expenseCategoryFilter} onChange={(e) => setExpenseCategoryFilter(e.target.value as any)}>
                                        <option value="All">All Categories</option>
                                        <option value="Insumos">Insumos</option>
                                        <option value="Mantenimiento">Mantenimiento</option>
                                        <option value="Nomina">Nomina</option>
                                        <option value="Servicios">Servicios</option>
                                        <option value="Otros">Otros</option>
                                    </select>
                                </div>
                                {filteredExpenses.map(expense => (
                                    <div key={expense.id} className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm flex justify-between items-center group">
                                        <div>
                                            <div className="font-bold text-gray-800">{expense.description}</div>
                                            <div className="text-xs text-gray-400">{expense.category} • {new Date(expense.date).toLocaleDateString()}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-red-500">-${expense.amount.toFixed(2)}</div>
                                            <button onClick={() => deleteExpense(expense.id)} className="text-xs text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
                                        </div>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <>
                                <div className="mb-4 text-xs font-bold text-gray-400 uppercase">Filter Log</div>
                                <select className="w-full mb-4 p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary" value={historyCategoryFilter} onChange={(e) => setHistoryCategoryFilter(e.target.value)}>
                                    {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                                <div className="space-y-3">
                                    {filteredHistory.map(order => (
                                        <div key={order.id} className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div><span className="font-bold text-gray-800">Order #{order.id}</span><div className="text-xs text-gray-400">{new Date(order.timestamp).toLocaleTimeString()} • Table {order.tableId}</div></div>
                                                <span className="font-bold text-green-600">${order.total.toFixed(2)}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-gray-100 text-gray-500 rounded">{order.paymentMethod}</span>
                                                <button onClick={() => handlePrintTicket(order)} className="text-[10px] font-bold uppercase px-2 py-0.5 bg-blue-50 text-blue-600 rounded flex items-center gap-1 hover:bg-blue-100 transition-colors"><span className="material-icons-round text-xs">print</span> Print</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Right Panel: Content */}
                <div className="flex-1 flex flex-col bg-gray-50 no-print">
                    {(activeTab === 'tables' || activeTab === 'delivery') ? (
                        selectedOrder ? (
                            <div className="h-full flex flex-col">
                                <div className="flex-1 p-8 overflow-y-auto">
                                    <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                                        <h2 className="text-xl font-bold mb-4 border-b pb-2">Order Summary</h2>
                                        {selectedOrder.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                                                <div><span className="font-bold bg-gray-100 px-2 py-0.5 rounded mr-2">{item.quantity}x</span><span>{item.name}</span></div>
                                                <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                                            </div>
                                        ))}
                                        <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-200 text-right">
                                            <div className="flex justify-between text-2xl font-bold text-gray-900 mt-2"><span>Total</span><span>${total.toFixed(2)}</span></div>
                                            <div className="flex justify-end gap-2 mt-2">
                                                {[0, 10, 15, 20].map(pct => (
                                                    <button key={pct} onClick={() => setTipAmount(subtotal * (pct / 100))} className={`px-2 py-1 rounded text-[10px] font-bold border ${Math.abs(tipAmount - subtotal * (pct / 100)) < 0.1 ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50'}`}>{pct}%</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
                                        <h2 className="text-lg font-bold mb-4 flex justify-between items-center"><span>Split Check</span>{splitCount > 1 && <span className="text-primary text-sm bg-primary/10 px-2 py-1 rounded-full">{splitCount} People</span>}</h2>
                                        <div className="flex items-center gap-4">
                                            <div className="flex bg-gray-100 rounded-lg p-1">
                                                {[1, 2, 3, 4, 5, 6, 8, 10].map(num => (
                                                    <button key={num} onClick={() => setSplitCount(num)} className={`w-10 h-10 rounded-md font-bold transition-all ${splitCount === num ? 'bg-white shadow text-primary' : 'text-gray-400 hover:text-gray-600'}`}>{num}</button>
                                                ))}
                                            </div>
                                            <div className="flex-1 text-right">
                                                <p className="text-xs text-gray-400 uppercase font-bold">
                                                    Partes: {(selectedOrder.paidSplits || 0)} de {splitCount} pagadas
                                                </p>
                                                <p className="text-2xl font-bold text-gray-900">${(total / splitCount).toFixed(2)} c/u</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl shadow-sm p-6">
                                        <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowInvoiceForm(!showInvoiceForm)}>
                                            <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800"><span className="material-icons-round text-gray-400">receipt_long</span>Facturación (RFC)</h2>
                                            <span className={`material-icons-round transition-transform ${showInvoiceForm ? 'rotate-180' : ''}`}>expand_more</span>
                                        </div>
                                        {showInvoiceForm && (
                                            <div className="mt-4 grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 fade-in">
                                                <input placeholder="RFC" className="p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-primary" value={invoiceData.rfc} onChange={e => setInvoiceData({ ...invoiceData, rfc: e.target.value })} />
                                                <input placeholder="Legal Name" className="p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-primary" value={invoiceData.legalName} onChange={e => setInvoiceData({ ...invoiceData, legalName: e.target.value })} />
                                                <input placeholder="Email" className="p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-primary" value={invoiceData.email} onChange={e => setInvoiceData({ ...invoiceData, email: e.target.value })} />
                                                <select className="p-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-primary" value={invoiceData.useCFDI} onChange={e => setInvoiceData({ ...invoiceData, useCFDI: e.target.value })}>
                                                    <option value="G03">Gastos en general</option>
                                                    <option value="P01">Por definir</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="p-6 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex gap-4">
                                    <button onClick={() => handlePrintTicket(selectedOrder)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-4 rounded-xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2"><span className="material-icons-round">print</span>Ticket Preview</button>
                                    <button onClick={() => setIsPaymentModalOpen(true)} className="flex-[2] bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-xl shadow-lg shadow-green-200 transition-all active:scale-95 flex items-center justify-center gap-3 font-bold"><span className="material-icons-round">payments</span>Pay ${(total / splitCount).toFixed(2)}</button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <span className="material-icons-round text-6xl mb-4">point_of_sale</span>
                                <p className="text-xl font-medium">Select a table to start</p>
                            </div>
                        )
                    ) : activeTab === 'expenses' ? (
                        <div className="h-full flex flex-col p-8">
                            <div className="flex gap-6 mb-8">
                                <div className="flex-1 bg-primary/5 p-6 rounded-2xl border border-primary/10 flex flex-col justify-center items-center text-primary">
                                    <span className="material-icons-round text-3xl mb-1 text-primary">account_balance_wallet</span>
                                    <span className="font-bold uppercase text-[10px] tracking-wider mb-1">Total Expenses Today</span>
                                    <span className="text-2xl font-black">${totalExpenses.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-soft p-8 max-w-2xl mx-auto w-full">
                                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                                    <span className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center material-icons-round">money_off</span>
                                    Record New Expense
                                </h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-2 uppercase">Description / Reason</label>
                                        <input type="text" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary transition-all font-medium" placeholder="e.g. Compra de limones de emergencia" value={newExpenseDesc} onChange={e => setNewExpenseDesc(e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div><label className="block text-sm font-bold text-gray-600 mb-2 uppercase">Amount ($)</label><input type="number" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary transition-all font-bold text-lg" placeholder="0.00" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value)} /></div>
                                        <div><label className="block text-sm font-bold text-gray-600 mb-2 uppercase">Category</label><select className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary transition-all appearance-none cursor-pointer" value={newExpenseCategory} onChange={e => setNewExpenseCategory(e.target.value as any)}><option value="Insumos">Insumos (Supplies)</option><option value="Mantenimiento">Mantenimiento</option><option value="Nomina">Nomina (Payroll)</option><option value="Servicios">Servicios (Utilities)</option><option value="Otros">Otros</option></select></div>
                                    </div>
                                    <button onClick={handleAddExpense} disabled={!newExpenseDesc || !newExpenseAmount} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4 font-bold text-lg"><span className="material-icons-round">publish</span>Record Expense</button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full bg-gray-50 flex flex-col p-8 overflow-y-auto print:p-0 print:bg-white relative">
                            <style>{`
                                @media print {
                                    .no-print { display: none !important; }
                                    .print-only { display: block !important; }
                                    body { background: white; }
                                    .print-container { width: 100%; height: 100%; overflow: visible; }
                                    nav, aside, .w-1\\/3 { display: none !important; } 
                                    .w-full { width: 100% !important; }
                                }
                            `}</style>
                            <div className="flex justify-between items-center mb-6 no-print">
                                <div className="flex flex-col">
                                    <h2 className="text-2xl font-bold text-gray-800">Corte de Caja (Cash Cut)</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-gray-400 font-bold uppercase">FECHA SELECCIONADA:</span>
                                        <input 
                                            type="date" 
                                            value={selectedDate} 
                                            onChange={(e) => setSelectedDate(e.target.value)}
                                            className="text-xs font-black text-primary bg-primary/5 border-none rounded px-2 py-0.5 focus:ring-0 cursor-pointer"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => setShowFinancialReport(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg hover:bg-blue-100 font-bold transition-all shadow-sm"><span className="material-icons-round">file_download</span>Descargar Reporte</button>
                                    <button onClick={handlePrintCashCut} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-bold transition-all shadow-sm"><span className="material-icons-round">print</span>Imprimir Ticket</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-5 gap-6 mb-8 print:grid-cols-3">
                                <div className="bg-white p-6 rounded-2xl shadow-soft border border-gray-100">
                                    <h3 className="text-gray-400 text-[10px] font-black uppercase mb-1 tracking-widest">Total Revenue</h3>
                                    <div className="text-3xl font-black text-gray-900">${salesMetrics.totalRevenue.toFixed(2)}</div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-soft border border-gray-100">
                                    <h3 className="text-gray-400 text-[10px] font-black uppercase mb-1 tracking-widest">Cash (Efectivo)</h3>
                                    <div className="text-3xl font-black text-green-600">${salesMetrics.cashSales.toFixed(2)}</div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-soft border border-gray-100">
                                    <h3 className="text-gray-400 text-[10px] font-black uppercase mb-1 tracking-widest">Card (Tarjeta)</h3>
                                    <div className="text-3xl font-black text-blue-600">${salesMetrics.cardSales.toFixed(2)}</div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-soft border border-gray-100">
                                    <h3 className="text-gray-400 text-[10px] font-black uppercase mb-1 tracking-widest">Delivery Apps</h3>
                                    <div className="text-3xl font-black text-amber-500">${salesMetrics.deliverySales.toFixed(2)}</div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl shadow-soft border border-gray-100">
                                    <h3 className="text-gray-400 text-[10px] font-black uppercase mb-1 tracking-widest">Total Expenses</h3>
                                    <div className="text-3xl font-black text-red-500">${totalExpenses.toFixed(2)}</div>
                                </div>
                            </div>

                            <div className="bg-white p-8 rounded-2xl shadow-soft border border-gray-100 flex-1">
                                <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">Detalle de Transacciones (Log)</h3>
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b-2 border-gray-100 text-gray-400 text-xs uppercase tracking-widest">
                                            <th className="pb-4 font-black">ID</th>
                                            <th className="pb-4 font-black">Time</th>
                                            <th className="pb-4 font-black">Table</th>
                                            <th className="pb-4 font-black">Method</th>
                                            <th className="pb-4 font-black text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 text-sm">
                                        {filteredHistory.map(order => (
                                            <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="py-4 font-bold">#{order.id.slice(-4)}</td>
                                                <td className="py-4 text-gray-500">{new Date(order.timestamp).toLocaleTimeString()}</td>
                                                <td className="py-4 font-medium text-gray-700">{order.tableId}</td>
                                                <td className="py-4 font-bold text-gray-500 uppercase text-[10px]"><span className="px-2 py-1 bg-gray-100 rounded-md">{order.paymentMethod}</span></td>
                                                <td className="py-4 font-black text-gray-900 text-right">${order.total.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <PaymentModal 
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                total={total / splitCount}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                cashReceived={cashReceived}
                setCashReceived={setCashReceived}
                onConfirm={handleProcessPayment}
                isProcessingTerminal={isProcessingTerminal}
                terminalStep={terminalStep}
                settings={settings}
            />

            {showFinancialReport && (
                <FinancialReportModal 
                    onClose={() => setShowFinancialReport(false)}
                    orders={completedOrders}
                    expenses={filteredByDateExpenses}
                />
            )}
        </div>
    );
};

const PaymentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    total: number;
    paymentMethod: PaymentMethod;
    setPaymentMethod: (m: PaymentMethod) => void;
    cashReceived: string;
    setCashReceived: (v: string) => void;
    onConfirm: () => void;
    isProcessingTerminal: boolean;
    terminalStep: string;
    settings: any;
}> = ({ isOpen, onClose, total, paymentMethod, setPaymentMethod, cashReceived, setCashReceived, onConfirm, isProcessingTerminal, terminalStep, settings }) => {
    if (!isOpen) return null;
    const change = Math.max(0, (parseFloat(cashReceived) || 0) - total);
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in transition-all">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 fill-mode-both relative">
                {/* Terminal Processing Overlay */}
                {isProcessingTerminal && (
                    <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
                        <div className="w-24 h-24 mb-6 relative">
                            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="material-icons-round text-primary text-4xl">bluetooth</span>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Procesando Pago</h3>
                        <p className="text-primary font-bold animate-pulse text-sm mb-8">{terminalStep}</p>
                        
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-primary h-full transition-all duration-1000 ease-out animate-[shimmer_2s_infinite]" style={{ width: '100%' }}></div>
                        </div>
                        
                        <p className="text-[10px] text-gray-400 mt-8 uppercase font-black tracking-widest flex items-center gap-2">
                            <span className="material-icons-round text-xs">lock</span> Transacción Encriptada (AES-256)
                        </p>
                    </div>
                )}
                <div className="bg-gray-50 px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                    <div><h3 className="text-2xl font-black text-gray-900 tracking-tight">Finalizar Pago</h3><p className="text-gray-500 text-sm font-medium">Seleccione el método</p></div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center hover:bg-gray-50 text-gray-400"><span className="material-icons-round">close</span></button>
                </div>
                <div className="p-8">
                    <div className="bg-blue-600 rounded-2xl p-6 text-white mb-8 shadow-inner relative overflow-hidden">
                        <div className="relative z-10"><p className="text-blue-100 font-bold uppercase tracking-wider text-xs mb-1">Total a Pagar</p><h2 className="text-4xl font-black">${total.toFixed(2)}</h2></div>
                        <span className="material-icons-round absolute -right-4 -bottom-4 text-8xl text-white/10 rotate-12">receipt</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-8">
                        {[
                            { id: PaymentMethod.CASH, label: 'Efectivo', icon: 'payments' },
                            { id: PaymentMethod.CARD, label: 'Terminal', icon: 'credit_card' },
                            { id: PaymentMethod.TRANSFER, label: 'Transf.', icon: 'account_balance' },
                        ].map(m => (
                            <button key={m.id} onClick={() => setPaymentMethod(m.id)} className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${paymentMethod === m.id ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-gray-400 hover:border-gray-200'}`}>
                                <span className="material-icons-round">{m.icon}</span>
                                <span className="text-[10px] font-black uppercase">{m.label}</span>
                            </button>
                        ))}
                    </div>
                    {paymentMethod === PaymentMethod.CASH && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Monto Recibido</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">$</span>
                                    <input type="number" autoFocus className="w-full pl-10 pr-4 py-5 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-primary focus:bg-white transition-all text-3xl font-black text-gray-900" placeholder="0.00" value={cashReceived} onChange={e => setCashReceived(e.target.value)} />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {[50, 100, 200, 500].map(val => (
                                    <button key={val} onClick={() => setCashReceived(val.toString())} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-black text-sm transition-all">+${val}</button>
                                ))}
                            </div>
                            <div className="p-5 bg-green-50 border-2 border-green-100 rounded-2xl flex justify-between items-center group">
                                <div><p className="text-green-600 text-[10px] font-black uppercase tracking-wider">Cambio a Entregar</p><h3 className="text-3xl font-black text-green-700">${change.toFixed(2)}</h3></div>
                                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center group-hover:scale-110 transition-transform"><span className="material-icons-round">account_balance_wallet</span></div>
                            </div>
                        </div>
                    )}

                    {paymentMethod === PaymentMethod.TRANSFER && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="p-6 bg-blue-50 border-2 border-blue-100 rounded-2xl relative overflow-hidden">
                                <div className="absolute -right-2 -top-2 opacity-10">
                                    <span className="material-icons-round text-6xl text-blue-600">account_balance</span>
                                </div>
                                
                                <div className="space-y-4 relative z-10">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Banco</p>
                                            <p className="font-bold text-gray-900">{settings.bankName || 'No configurado'}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Beneficiario</p>
                                            <p className="font-bold text-gray-900">{settings.bankBeneficiary || 'No configurado'}</p>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-blue-100">
                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Tarjeta / Cuenta / CLABE</p>
                                        <div className="flex items-center justify-between">
                                            <p className="text-lg font-black text-blue-700 tracking-wider">
                                                {settings.bankCLABE || settings.bankAccount || '--- --- ---'}
                                            </p>
                                            <button 
                                                onClick={() => {
                                                    navigator.clipboard.writeText(settings.bankCLABE || settings.bankAccount || '');
                                                    alert('Copiado al portapapeles');
                                                }}
                                                className="p-2 bg-white rounded-lg shadow-sm border border-blue-100 text-blue-600 hover:bg-blue-100 transition-colors"
                                            >
                                                <span className="material-icons-round text-sm">content_copy</span>
                                            </button>
                                        </div>
                                    </div>

                                    {settings.bankWhatsapp && (
                                        <div className="pt-3 border-t border-blue-100">
                                            <a 
                                                href={`https://wa.me/52${settings.bankWhatsapp}?text=Hola, envío mi comprobante de pago por $${total.toFixed(2)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full py-3 bg-[#25D366] text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-100 hover:scale-[1.02] active:scale-95 transition-all text-sm"
                                            >
                                                <span className="material-icons-round">whatsapp</span>
                                                Enviar Comprobante
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-8 bg-gray-50 border-t border-gray-100">
                    <button onClick={onConfirm} disabled={paymentMethod === PaymentMethod.CASH && (!cashReceived || parseFloat(cashReceived) < total)} className="w-full py-5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded-2xl font-black text-xl shadow-xl shadow-green-100 transition-all flex items-center justify-center gap-3 active:scale-95 font-black uppercase"><span className="material-icons-round">check_circle</span>Confirmar y Pagar</button>
                </div>
            </div>
        </div>
    );
};
