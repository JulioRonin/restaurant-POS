import React, { useState, useMemo } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { useExpenses } from '../contexts/ExpenseContext';
import { useTables } from '../contexts/TableContext';
import { Order, PaymentMethod, PaymentStatus, InvoiceDetails, ExpenseCategory, OrderStatus, OrderSource, OrderItem, OrderPayment } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { useUser } from '../contexts/UserContext';
import { Ticket } from '../components/Ticket';
import { CashCutTicket } from '../components/CashCutTicket';
import { FinancialReportModal } from '../components/FinancialReportModal';
import { printerService } from '../services/PrinterService';
import { bluetoothTerminalService } from '../services/BluetoothTerminalService';
import { motion, AnimatePresence } from 'framer-motion';
import { GlowCard } from '../components/ui/spotlight-card';
import { GlowButton } from '../components/ui/glow-button';
import { 
  CreditCard, 
  Wallet, 
  History, 
  Truck, 
  Zap, 
  X, 
  CheckCircle2, 
  Printer, 
  AlertTriangle, 
  Bell, 
  Calendar,
  Download,
  Plus,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Trash2
} from 'lucide-react';

/** Fecha de HOY en el calendario local (no UTC), como YYYY-MM-DD. */
const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Día local (YYYY-MM-DD) de una fecha guardada como ISO. */
const localDayOf = (value: any) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const CashierScreen: React.FC = () => {
    const { orders, updateOrderStatus, removeOrder } = useOrders();
    const { expenses, addExpense, deleteExpense } = useExpenses();
    const { tables: TABLES } = useTables();
    const { settings } = useSettings();
    const { authProfile } = useUser();

    const [activeTab, setActiveTab] = useState<'tables' | 'expenses' | 'history' | 'delivery'>('tables');
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
    const [tipAmount, setTipAmount] = useState<number>(0);
    const [splitCount, setSplitCount] = useState<number>(1);
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [invoiceData, setInvoiceData] = useState<InvoiceDetails>({ rfc: '', legalName: '', email: '', useCFDI: 'G03' });
    const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<ExpenseCategory | 'All'>('All');
    const [newExpenseDesc, setNewExpenseDesc] = useState('');
    const [newExpenseAmount, setNewExpenseAmount] = useState('');
    const [newExpenseCategory, setNewExpenseCategory] = useState<ExpenseCategory>('Insumos');
    // OJO: toISOString() da la fecha en UTC. En México (UTC-6) eso significa
    // que a partir de las 6 de la tarde "hoy" se convertía en MAÑANA: el
    // Historial abría en un día vacío y los gastos registrados por la noche
    // quedaban fechados al día siguiente (por eso no aparecían en el corte).
    // localToday() usa el calendario local, que es el que ve el operador.
    const [newExpenseDate, setNewExpenseDate] = useState<string>(localToday);
    const [selectedDate, setSelectedDate] = useState<string>(localToday);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [cashReceived, setCashReceived] = useState<string>('');
    // Cobro con VARIOS métodos en una sola cuenta (ej. $200 tarjeta + $150
    // efectivo). Mientras haya pagos parciales registrados, el cobro se cierra
    // con la suma de todos y paymentMethod = MIXED.
    const [partialPayments, setPartialPayments] = useState<OrderPayment[]>([]);
    const [partialAmount, setPartialAmount] = useState<string>('');
    const [isProcessingTerminal, setIsProcessingTerminal] = useState(false);
    const [terminalStep, setTerminalStep] = useState('');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showFinancialReport, setShowFinancialReport] = useState(false);
    const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
    const [cashCutToPrint, setCashCutToPrint] = useState<any>(null);
    const [dismissedBillRequests, setDismissedBillRequests] = useState<string[]>([]);

    const handlePrintTicket = async (order: Order) => {
        const tableName = TABLES.find(t => t.id === order.tableId)?.name || order.tableId;
        const enrichedOrder = { ...order, tableId: tableName || 'VENTA', waiterName: order.waiterName || authProfile?.name || 'ADMIN' };
        try {
            const success = await printerService.printOrder(enrichedOrder, settings);
            if (success) { setSuccessMessage('TICKET_SENT'); setTimeout(() => setSuccessMessage(null), 2000); return true; }
        } catch (err) {}
        setOrderToPrint(enrichedOrder);
        setTimeout(() => { window.print(); setOrderToPrint(null); }, 1000);
        return true;
    };

    const handleProcessPayment = async () => {
        if (!selectedOrder) return;

        const splitAmount = total / splitCount;

        // ── Cobro con varios métodos ────────────────────────────────────
        // Si hay pagos parciales capturados, esos mandan: la cuenta se cierra
        // con la suma de todos y el método queda como MIXED (o el único método
        // usado, si resultó ser uno solo).
        if (isMixedPayment) {
            if (mixedRemaining > 0.005) {
                alert(`Faltan $${mixedRemaining.toFixed(2)} por cubrir.`);
                return;
            }
            const usedMethods = Array.from(new Set(partialPayments.map(p => p.method)));
            const cashPortion = partialPayments
                .filter(p => p.method === PaymentMethod.CASH)
                .reduce((s, p) => s + p.amount, 0);

            const mixedOrder: Order = {
                ...selectedOrder,
                status: OrderStatus.COMPLETED,
                paymentStatus: PaymentStatus.PAID,
                paymentMethod: usedMethods.length === 1 ? usedMethods[0] : PaymentMethod.MIXED,
                payments: partialPayments,
                receivedAmount: cashPortion,
                changeAmount: Math.max(0, mixedPaid - total),
                paidSplits: splitCount,
                paidAt: new Date().toISOString(),
            } as Order;

            updateOrderStatus(selectedOrder.id, mixedOrder.status, mixedOrder);

            if (cashPortion > 0 && settings.isCashDrawerEnabled) {
                await printerService.openCashDrawer(settings);
            }
            await handlePrintTicket(mixedOrder);

            setSuccessMessage('TRANSACTION_COMPLETE');
            setTimeout(() => { setSuccessMessage(null); setSelectedTableId(null); }, 3000);
            setIsPaymentModalOpen(false);
            setCashReceived('');
            setPartialPayments([]);
            setPartialAmount('');
            return;
        }

        const actualCash = parseFloat(cashReceived) || splitAmount;

        // Prevent processing if cash received is less than amount due for this split
        if (paymentMethod === PaymentMethod.CASH && actualCash < splitAmount) {
            alert("El monto recibido no puede ser menor al total a pagar.");
            return;
        }

        if (paymentMethod === PaymentMethod.CARD && settings.isTerminalEnabled) {
            setIsProcessingTerminal(true);
            await bluetoothTerminalService.simulateTransaction(splitAmount, (step) => setTerminalStep(step));
            setIsProcessingTerminal(false);
        }

        const currentPaidSplits = (selectedOrder.paidSplits || 0) + 1;
        const isFullyPaid = currentPaidSplits >= splitCount;
        
        const updatedOrder: Order = {
            ...selectedOrder,
            status: isFullyPaid ? OrderStatus.COMPLETED : OrderStatus.PENDING,
            paymentStatus: isFullyPaid ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
            paymentMethod,
            receivedAmount: actualCash, // Store what was actually given
            changeAmount: paymentMethod === PaymentMethod.CASH ? actualCash - splitAmount : 0, 
            paidSplits: currentPaidSplits,
            // NO se toca `timestamp`: es la hora REAL en que se levantó la
            // orden. Antes se sobrescribía con new Date() en cada cobro (y en
            // cada pago parcial), así que una cuenta abierta ayer y cobrada hoy
            // se movía a las ventas de hoy, y el ticket imprimía la hora del
            // cobro en vez de la del pedido. La hora del cobro se guarda aparte.
            paidAt: new Date().toISOString()
        } as Order;

        updateOrderStatus(selectedOrder.id, updatedOrder.status, updatedOrder);
        
        if ((paymentMethod === PaymentMethod.CASH || paymentMethod === PaymentMethod.MIXED) && settings.isCashDrawerEnabled) {
            await printerService.openCashDrawer(settings);
        }

        // Print ticket with the breakdown for the CURRENT payment
        await handlePrintTicket({ ...updatedOrder, total: splitAmount } as Order);
        
        setSuccessMessage(isFullyPaid ? "TRANSACTION_COMPLETE" : "PARTIAL_PAYMENT_LOGGED");
        setTimeout(() => { 
            setSuccessMessage(null); 
            if (isFullyPaid) setSelectedTableId(null); 
        }, 3000);
        
        setIsPaymentModalOpen(false);
        setCashReceived('');
        setPartialPayments([]);
        setPartialAmount('');
    };

    // Órdenes abiertas agrupadas por mesa, en orden de llegada. Una misma mesa
    // puede tener varias cuentas simultáneas (típico con una mesa "To Go").
    const openOrdersByTable = useMemo(() => {
        const map = new Map<string, Order[]>();
        orders
            .filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED')
            .forEach(o => {
                if (!o.tableId) return;
                const list = map.get(o.tableId) || [];
                list.push(o);
                map.set(o.tableId, list);
            });
        map.forEach(list => list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
        return map;
    }, [orders]);

    // `selectedTableId` guarda el id de la ORDEN cuando hay varias cuentas en la
    // misma mesa (para cobrar exactamente esa), o el id de la mesa cuando solo
    // hay una. Se resuelven ambos casos.
    const selectedOrder = useMemo(() => orders.find(o => (o.id === selectedTableId || o.tableId === selectedTableId) && o.status !== 'COMPLETED'), [orders, selectedTableId]);
    const subtotal = selectedOrder?.total || 0;
    const total = subtotal + tipAmount;

    // Cobro con varios métodos: cuánto se lleva capturado y cuánto falta.
    const isMixedPayment = partialPayments.length > 0;
    const mixedPaid = partialPayments.reduce((s, p) => s + p.amount, 0);
    const mixedRemaining = Math.max(0, total - mixedPaid);

    const filteredByDateOrders = useMemo(() => orders.filter(o => {
        const d = new Date(o.timestamp || Date.now());
        const localD = new Date(d); localD.setMinutes(localD.getMinutes() - localD.getTimezoneOffset());
        return localD.toISOString().split('T')[0] === selectedDate;
    }), [orders, selectedDate]);

    // Gastos del día seleccionado (mismo criterio de día local que las ventas,
    // para que el corte cuadre). El filtro por categoría es opcional.
    const expensesForDate = useMemo(
        () => expenses.filter(e => localDayOf(e.date) === selectedDate),
        [expenses, selectedDate]
    );
    const visibleExpenses = useMemo(
        () => expensesForDate.filter(e => expenseCategoryFilter === 'All' || e.category === expenseCategoryFilter),
        [expensesForDate, expenseCategoryFilter]
    );
    const expensesTotal = useMemo(
        () => expensesForDate.reduce((s, e) => s + Number(e.amount || 0), 0),
        [expensesForDate]
    );
    // Desglose por categoría para el scoreboard, de mayor a menor.
    const expensesByCategory = useMemo(() => {
        const map: Record<string, number> = {};
        expensesForDate.forEach(e => {
            map[e.category] = (map[e.category] || 0) + Number(e.amount || 0);
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [expensesForDate]);

    const salesMetrics = useMemo(() => {
        const _sales = filteredByDateOrders.filter(o => o.status === 'COMPLETED');
        const totalRevenue = _sales.reduce((sum, o) => sum + (o.total || 0), 0);
        // Una cuenta cobrada con varios métodos aporta a CADA método la parte
        // que le tocó. Antes se clasificaba la venta completa por el
        // paymentMethod único, así que un cobro mixto no caía en ningún lado.
        const byMethod = (want: PaymentMethod) => _sales.reduce((sum, o) => {
            if (o.payments && o.payments.length > 0) {
                return sum + o.payments
                    .filter(p => p.method === want)
                    .reduce((s, p) => s + (p.amount || 0), 0);
            }
            return o.paymentMethod === want ? sum + (o.total || 0) : sum;
        }, 0);
        return { totalRevenue, cashSales: byMethod(PaymentMethod.CASH), cardSales: byMethod(PaymentMethod.CARD) };
    }, [filteredByDateOrders]);

    const activeRequests = orders.filter(o => o.status === OrderStatus.BILL_REQUESTED && !dismissedBillRequests.includes(o.id));

    return (
        <div className="h-full bg-[#FAF8F4] text-[#1a1c14] flex flex-col overflow-hidden antialiased">
            <div id="print-area" className="hidden print:block absolute inset-0 bg-white text-black p-10 z-[5000]">
                {orderToPrint && <Ticket order={orderToPrint} settings={settings} />}
                {cashCutToPrint && <CashCutTicket {...cashCutToPrint} settings={settings} />}
            </div>
            <style>{`@media print { .no-print { display: none !important; } }`}</style>

            {/* Bill Request Alert — integrated top banner, not fixed overlay */}
            <AnimatePresence>
                {activeRequests.length > 0 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="no-print shrink-0 overflow-hidden"
                    >
                        <div
                            onClick={() => { setSelectedTableId(activeRequests[0].tableId); setActiveTab('tables'); }}
                            className="bg-servirest-terracota px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-orange-500 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center animate-pulse shrink-0">
                                    <Bell size={18} />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#2A2826]/80">Cuenta solicitada por meseros</p>
                                    <p className="text-sm font-black italic uppercase tracking-tight text-[#1a1c14] leading-tight">
                                        Mesas: {activeRequests.map(o => o.tableId).join(', ')}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={e => { e.stopPropagation(); setDismissedBillRequests(prev => [...prev, ...activeRequests.map(r => r.id)]); }}
                                className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-all shrink-0"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex-1 flex overflow-hidden flex-col lg:flex-row relative">
                {/* Left Navigation Panel — Reduced width for more workspace */}
                <div className={`${selectedOrder ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 border-r border-[rgba(42,40,38,0.12)] flex-col no-print bg-servirest-hueso-sunken/50 shrink-0 h-full`}>
                    <div className="p-6 md:p-8 space-y-6 md:space-y-8">
                        <div>
                           <p className="font-black italic uppercase tracking-[0.3em] text-[10px] text-servirest-terracota mb-2">Cobros & caja</p>
                           <h1 className="font-serif italic font-medium text-[42px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0">Caja</h1>
                           <p className="text-[12px] text-[rgba(42,40,38,0.6)] font-medium mt-2 leading-relaxed">
                              Cobra cuentas, registra gastos y consulta tu historial del día.
                           </p>
                        </div>
                        <div className="flex bg-servirest-surface border border-[rgba(42,40,38,0.12)] p-1 rounded-sr-xl">
                             {[
                                { id: 'tables', icon: Wallet, label: 'Mesas' },
                                { id: 'delivery', icon: Truck, label: 'Delivery' },
                                { id: 'expenses', icon: TrendingDown, label: 'Gastos' },
                                { id: 'history', icon: History, label: 'Historial' }
                             ].map(tab => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-sr-md transition-all ${activeTab === tab.id ? 'bg-servirest-terracota text-servirest-hueso shadow-sr-glow' : 'text-[rgba(42,40,38,0.5)] hover:text-servirest-carbon'}`}>
                                    <tab.icon size={14} />
                                    <span className="text-[8px] font-black uppercase tracking-[0.16em]">{tab.label}</span>
                                </button>
                             ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-3 no-scrollbar">
                        {activeTab === 'tables' && TABLES.map(table => {
                             // Una mesa puede tener VARIAS cuentas abiertas a la vez — es lo
                             // normal cuando se usa una mesa tipo "To Go" como bandeja de
                             // pedidos para llevar. Antes se hacía orders.find(), que devolvía
                             // solo la primera y dejaba las demás imposibles de cobrar.
                             const tableOrders = openOrdersByTable.get(table.id) || [];
                             const isRequested = tableOrders.some(o => o.status === OrderStatus.BILL_REQUESTED);
                             const hasMany = tableOrders.length > 1;
                             const single = tableOrders.length === 1 ? tableOrders[0] : null;
                             const isSelected = !!single && selectedTableId === single.id;
                             const tableTotal = tableOrders.reduce((s, o) => s + (o.total || 0), 0);
                             return (
                                <motion.div
                                    key={table.id}
                                    onClick={() => single && setSelectedTableId(single.id)}
                                    className={`p-5 rounded-2xl border transition-all group relative overflow-hidden ${isSelected ? 'bg-servirest-terracota/10 border-servirest-terracota shadow-solaris-glow' : tableOrders.length ? `bg-servirest-surface border-[rgba(42,40,38,0.20)] ${single ? 'cursor-pointer hover:border-[rgba(42,40,38,0.20)]' : ''}` : 'bg-transparent border-dashed border-[rgba(42,40,38,0.12)] opacity-30 cursor-default'}`}
                                >
                                    {isRequested && (
                                        <div className="absolute top-0 right-0 bg-servirest-terracota text-[#1a1c14] px-3 py-1 text-[8px] font-black tracking-widest uppercase animate-pulse italic">
                                            POR COBRAR
                                        </div>
                                    )}
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-lg font-black italic uppercase tracking-tighter text-[#1a1c14]">{table.name}</p>
                                            <p className="text-[8px] font-black uppercase text-servirest-terracota/40 tracking-widest mt-0.5">
                                                {tableOrders.length === 0
                                                    ? 'Sin actividad'
                                                    : hasMany
                                                        ? `${tableOrders.length} cuentas abiertas`
                                                        : `Pedido ${single!.id.slice(0, 6)}`}
                                            </p>
                                        </div>
                                        {tableOrders.length > 0 && <p className="text-lg font-black italic text-servirest-terracota tracking-tighter">${tableTotal.toFixed(0)}</p>}
                                    </div>

                                    {/* Cuentas individuales: se listan para poder cobrar
                                        exactamente la que pide el cliente, sin depender del
                                        orden de llegada. */}
                                    {hasMany && (
                                        <div className="mt-4 pt-4 border-t border-dashed border-[rgba(42,40,38,0.15)] space-y-2">
                                            {tableOrders.map((o, idx) => {
                                                const picked = selectedTableId === o.id;
                                                return (
                                                    <button
                                                        key={o.id}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedTableId(o.id); }}
                                                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${picked ? 'bg-servirest-terracota text-servirest-hueso border-servirest-terracota shadow-solaris-glow' : 'bg-[rgba(42,40,38,0.03)] border-[rgba(42,40,38,0.12)] hover:border-servirest-terracota/50'}`}
                                                    >
                                                        <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center font-black italic text-[12px] ${picked ? 'bg-servirest-hueso/20 text-servirest-hueso' : 'bg-servirest-terracota/10 text-servirest-terracota'}`}>
                                                            {idx + 1}
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-[11px] font-black uppercase italic tracking-tight truncate ${picked ? 'text-servirest-hueso' : 'text-[#1a1c14]'}`}>
                                                                {o.customerName || `Pedido ${o.id.slice(0, 6)}`}
                                                            </p>
                                                            <p className={`text-[8px] font-black uppercase tracking-widest mt-0.5 ${picked ? 'text-servirest-hueso/70' : 'text-[#2A2826]/40'}`}>
                                                                {new Date(o.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                                                {o.dailyNumber !== undefined ? ` · #${o.dailyNumber}` : ''}
                                                                {` · ${(o.items || []).length} plat.`}
                                                                {o.status === OrderStatus.BILL_REQUESTED ? ' · PIDE CUENTA' : ''}
                                                            </p>
                                                        </div>
                                                        <span className={`font-black italic tracking-tighter shrink-0 ${picked ? 'text-servirest-hueso' : 'text-servirest-terracota'}`}>
                                                            ${o.total.toFixed(0)}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </motion.div>
                             );
                        })}

                        {activeTab === 'delivery' && orders
                            // Muestra todas las órdenes de delivery/pickup no cerradas.
                            // - Pagadas online (paymentStatus PAID): solo falta ENTREGAR → botón "Marcar entregado".
                            // - Pendientes de pago (efectivo/terminal): click para cobrar y cerrar.
                            .filter(o => o.source && o.source !== OrderSource.DINE_IN && o.status !== 'COMPLETED')
                            .map(order => {
                             const isPaidOnline = order.paymentStatus === PaymentStatus.PAID;
                             const custName = (order as any).customer_metadata?.customerName || (order as any).customerMetadata?.customerName;
                             return (
                             <div key={order.id} onClick={() => !isPaidOnline && setSelectedTableId(order.id)} className={`p-5 rounded-2xl border transition-all ${isPaidOnline ? 'border-servirest-success/30 bg-servirest-success/5' : selectedTableId === order.id ? 'border-servirest-terracota bg-servirest-terracota/10 cursor-pointer' : 'border-[rgba(42,40,38,0.12)] bg-servirest-surface hover:border-[rgba(42,40,38,0.20)] cursor-pointer'}`}>
                                 <div className="flex justify-between items-start">
                                     <div className="min-w-0">
                                         <p className="text-[10px] font-black uppercase text-servirest-terracota tracking-widest mb-1 italic">{order.source} {isPaidOnline && '· Pagado online'}</p>
                                         <p className="text-lg font-black italic uppercase tracking-tighter text-[#1a1c14] leading-none truncate">{custName || TABLES.find(t=>t.id===order.tableId)?.name || `#${(order.id||'').slice(0,6).toUpperCase()}`}</p>
                                         {(order.status === 'PENDING' || order.status === 'COOKING' || order.status === 'READY') && (
                                            <p className="text-[9px] font-bold uppercase tracking-wider mt-1 text-[rgba(42,40,38,0.5)]">
                                              {order.status === 'READY' ? '✓ Lista para entregar' : order.status === 'COOKING' ? 'En preparación' : 'Recibida'}
                                            </p>
                                         )}
                                     </div>
                                     <p className="text-xl font-black italic text-[#1a1c14] tracking-tighter">${order.total.toFixed(0)}</p>
                                 </div>
                                 {isPaidOnline && (
                                   <button
                                     onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, OrderStatus.COMPLETED, { ...order, status: OrderStatus.COMPLETED }); }}
                                     className="mt-3 w-full h-10 rounded-full bg-servirest-success text-white text-[10px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2"
                                   >
                                     Marcar entregado y cerrar
                                   </button>
                                 )}
                             </div>
                             );
                        })}

                        {activeTab === 'expenses' && (
                            <div className="space-y-4">
                                {/* Add expense form */}
                                <div className="bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-2xl p-5 space-y-3">
                                    <p className="text-[9px] font-black uppercase text-servirest-terracota/40 tracking-widest italic">Registrar gasto</p>
                                    <input value={newExpenseDesc} onChange={e => setNewExpenseDesc(e.target.value)} placeholder="Descripción del gasto…" className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-xl py-3 px-4 text-[#1a1c14] text-xs font-bold outline-none focus:border-servirest-terracota/40" />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value)} type="number" placeholder="$0.00" className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-xl py-3 px-4 text-[#1a1c14] text-xs font-bold outline-none focus:border-servirest-terracota/40" />
                                        <select value={newExpenseCategory} onChange={e => setNewExpenseCategory(e.target.value as any)} className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-xl py-3 px-4 text-[#1a1c14] text-xs font-bold outline-none focus:border-servirest-terracota/40 appearance-none">
                                            {['Insumos','Renta','Servicios','Nómina','Mantenimiento','Otros'].map(c => <option key={c} value={c} className="bg-[#FAF8F4]">{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[8px] font-black uppercase text-[#2A2826]/30 tracking-widest pl-1">Fecha del gasto</p>
                                        <input 
                                            type="date" 
                                            value={newExpenseDate} 
                                            onChange={e => setNewExpenseDate(e.target.value)} 
                                            className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-xl py-2 px-4 text-[#1a1c14] text-xs font-bold outline-none focus:border-servirest-terracota/40" 
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (!newExpenseDesc || !newExpenseAmount) return;
                                            // FIX: addExpense takes positional arguments, NOT an object
                                            addExpense(
                                                newExpenseDesc, 
                                                parseFloat(newExpenseAmount), 
                                                newExpenseCategory, 
                                                authProfile?.name || 'Admin', 
                                                newExpenseDate
                                            );
                                            setNewExpenseDesc(''); setNewExpenseAmount('');
                                        }}
                                        className="w-full py-3 bg-servirest-terracota text-[#1a1c14] font-black uppercase tracking-widest text-[9px] rounded-xl shadow-solaris-glow hover:scale-[1.02] transition-all"
                                    >
                                        + Add Expense
                                    </button>
                                </div>
                                {/* Filtro por día + categoría */}
                                <div className="bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-2xl p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[9px] font-black uppercase text-servirest-terracota/40 tracking-widest italic">Ver gastos del día</p>
                                        <button
                                            onClick={() => setSelectedDate(localToday())}
                                            className="text-[8px] font-black uppercase tracking-widest text-servirest-terracota/60 hover:text-servirest-terracota transition-colors"
                                        >
                                            Hoy
                                        </button>
                                    </div>
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={e => setSelectedDate(e.target.value)}
                                        className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-xl py-2 px-4 text-[#1a1c14] text-xs font-bold outline-none focus:border-servirest-terracota/40"
                                    />
                                    <div className="flex flex-wrap gap-1.5">
                                        {(['All','Insumos','Renta','Servicios','Nómina','Mantenimiento','Otros'] as const).map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setExpenseCategoryFilter(c as any)}
                                                className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${
                                                    expenseCategoryFilter === c
                                                        ? 'bg-servirest-terracota text-servirest-hueso border-servirest-terracota'
                                                        : 'bg-transparent text-[#2A2826]/40 border-[rgba(42,40,38,0.12)] hover:text-[#2A2826]/70'
                                                }`}
                                            >
                                                {c === 'All' ? 'Todas' : c}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-baseline justify-between pt-1 border-t border-[rgba(42,40,38,0.08)]">
                                        <span className="text-[9px] font-black uppercase text-[#2A2826]/30 tracking-widest">Total del día</span>
                                        <span className="text-lg font-black italic text-red-400">${expensesTotal.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Expense list */}
                                {visibleExpenses.length === 0 && (
                                    <div className="p-6 text-center border border-dashed border-[rgba(42,40,38,0.15)] rounded-2xl">
                                        <p className="text-[10px] font-black uppercase text-[#2A2826]/30 tracking-widest italic">Sin gastos este día</p>
                                    </div>
                                )}
                                {visibleExpenses.map(exp => (
                                    <div key={exp.id} className="flex justify-between items-center p-4 bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-xl group">
                                        <div>
                                            <p className="text-xs font-black italic text-[#2A2826]/80 uppercase tracking-tight">{exp.description}</p>
                                            <p className="text-[9px] font-black uppercase text-[#2A2826]/30 tracking-widest">{exp.category} · {localDayOf(exp.date)}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-black italic text-red-400 text-sm">${exp.amount.toFixed(2)}</span>
                                            <button onClick={() => deleteExpense(exp.id)} className="text-red-500/20 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"><X size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}


                        {activeTab === 'history' && (
                            <div className="space-y-6">
                                {/* Control Hub for Logs */}
                                <div className="bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-[32px] p-6 space-y-6">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-[#2A2826]/30 tracking-widest mb-3 italic">Temporal Range</p>
                                        <input
                                            type="date"
                                            value={selectedDate}
                                            onChange={e => setSelectedDate(e.target.value)}
                                            className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-2xl py-3 px-5 text-[#1a1c14] text-xs font-bold outline-none focus:border-servirest-terracota/40"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black uppercase text-[#2A2826]/30 tracking-widest italic">Data Export</p>
                                        <button
                                            onClick={async () => {
                                                const completedOrders = filteredByDateOrders.filter(o => o.status === 'COMPLETED');
                                                const totalRevenue = completedOrders.reduce((s, o) => s + (o.total || 0), 0);
                                                const cashSales = completedOrders.filter(o => o.paymentMethod === PaymentMethod.CASH).reduce((s, o) => s + (o.total || 0), 0);
                                                const cardSales = completedOrders.filter(o => o.paymentMethod === PaymentMethod.CARD).reduce((s, o) => s + (o.total || 0), 0);
                                                const totalExpensesDay = expensesTotal;
                                                const netRevenue = totalRevenue - totalExpensesDay;
                                                
                                                const cutData = {
                                                    date: selectedDate,
                                                    totalRevenue,
                                                    cashSales,
                                                    cardSales,
                                                    totalExpenses: totalExpensesDay,
                                                    netRevenue,
                                                    orderCount: completedOrders.length,
                                                    operatorName: authProfile?.name || 'Admin',
                                                    orders: completedOrders.map(o => ({ ...o, tableId: TABLES.find(t => t.id === o.tableId)?.name || o.tableId })),
                                                    metrics: { totalRevenue, cashSales, cardSales }
                                                };

                                                // Try direct thermal printing first
                                                let printed = false;
                                                if (printerService.isConnected() || (settings.connectedDeviceName && settings.connectedDeviceName !== 'None')) {
                                                    try { printed = await printerService.printCashCut(cutData, settings); } catch(e) {}
                                                }
                                                // Fallback to browser print
                                                if (!printed) {
                                                    setCashCutToPrint(cutData);
                                                    setTimeout(() => { window.print(); setCashCutToPrint(null); }, 500);
                                                } else {
                                                    setSuccessMessage('CASH_CUT_PRINTED'); setTimeout(() => setSuccessMessage(null), 2000);
                                                }
                                            }}
                                            className="w-full flex items-center justify-center gap-3 py-4 bg-servirest-surface border border-[rgba(42,40,38,0.20)] rounded-2xl text-[#2A2826]/60 hover:text-[#1a1c14] hover:border-[rgba(42,40,38,0.20)] transition-all font-black text-[10px] uppercase tracking-widest"
                                        >
                                            <Printer size={16} /> Reimprimir ticket
                                        </button>
                                        <button
                                            onClick={() => {
                                                const rows = [['ID', 'Manifest', 'Método', 'Total', 'Estado', 'Hora'], ...filteredByDateOrders.map(o => [o.id.slice(0, 8), '"' + (o.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ') + '"', o.paymentMethod || 'N/A', o.total.toFixed(2), o.status, new Date(o.timestamp).toLocaleTimeString('es-MX')])].map(r => r.join(',')).join('\n');
                                                const blob = new Blob([rows], { type: 'text/csv' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a'); a.href = url; a.download = `reporte-${selectedDate}.csv`; a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="w-full flex items-center justify-center gap-3 py-4 bg-servirest-terracota text-[#1a1c14] rounded-2xl shadow-solaris-glow hover:scale-[1.02] transition-all font-black text-[10px] uppercase tracking-widest"
                                        >
                                            <Download size={16} /> Exportar CSV
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4 bg-servirest-terracota/5 border border-servirest-terracota/10 rounded-2xl">
                                    <p className="text-[9px] font-black italic text-servirest-terracota uppercase tracking-widest text-center">Select history mode in main cluster for full metrics view</p>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col bg-[#F0F0E8] no-print relative">
                    {activeTab === 'history' ? (
                        <div className="h-full flex flex-col p-10 gap-10 overflow-hidden">
                            {/* Logs Panoramic View */}
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-5xl font-black italic tracking-tighter uppercase text-[#1a1c14]">Ventas del día</h2>
                                    <p className="text-[12px] font-black uppercase text-servirest-terracota/60 tracking-[0.5em] mt-3 italic">Hoy: {selectedDate} • sincronización al día</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="px-6 py-3 bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-2xl flex items-center gap-4">
                                        <div className={`w-3 h-3 rounded-full ${navigator.onLine ? 'bg-green-500 shadow-[0_0_10px_green]' : 'bg-red-500 animate-pulse'}`} />
                                        <span className="text-[10px] font-black uppercase text-[#2A2826]/55 tracking-widest">{navigator.onLine ? 'Conectado' : 'Sin conexión'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Métricas del día */}
                            <div className="grid grid-cols-4 gap-6 shrink-0">
                                {[
                                    { label: 'Ventas brutas', value: salesMetrics.totalRevenue, color: 'text-[#1a1c14]', icon: DollarSign, glow: 'orange' },
                                    { label: 'Efectivo', value: salesMetrics.cashSales, color: 'text-green-400', icon: Wallet, glow: 'green' },
                                    { label: 'Tarjeta', value: salesMetrics.cardSales, color: 'text-blue-400', icon: CreditCard, glow: 'blue' },
                                    { label: 'Neto (ventas - gastos)', value: salesMetrics.totalRevenue - expensesTotal, color: 'text-servirest-terracota', icon: TrendingUp, glow: 'orange' }
                                ].map((kpi, i) => (
                                    <GlowCard key={i} glowColor={kpi.glow as any} customSize className="w-full !p-8 bg-servirest-surface border-[rgba(42,40,38,0.12)] rounded-[32px]">
                                        <div className="flex items-center gap-4 mb-3 opacity-30">
                                            <kpi.icon size={16} />
                                            <p className="text-[9px] font-black uppercase tracking-widest">{kpi.label}</p>
                                        </div>
                                        <p className={`text-4xl font-black italic tracking-tighter ${kpi.color}`}>${kpi.value.toFixed(2)}</p>
                                    </GlowCard>
                                ))}
                            </div>

                            {/* Ventas detalladas */}
                            <div className="flex-1 flex flex-col min-h-0">
                                <GlowCard customSize glowColor="orange" className="w-full h-full !p-0 bg-servirest-surface border-[rgba(42,40,38,0.12)] rounded-[40px] flex flex-col overflow-hidden">
                                     <div className="px-10 py-6 border-b border-[rgba(42,40,38,0.12)] bg-servirest-surface flex justify-between items-center shrink-0">
                                        <p className="text-[10px] font-black uppercase text-[#2A2826]/45 tracking-widest italic font-mono">Ventas detalladas</p>
                                        <p className="text-[10px] font-black uppercase text-[#2A2826]/45 tracking-widest italic font-mono">Count: {filteredByDateOrders.length} Events</p>
                                     </div>
                                     <div className="flex-1 overflow-y-auto no-scrollbar p-10">
                                        <table className="w-full text-left border-separate border-spacing-y-4">
                                            <thead>
                                                <tr className="text-[9px] font-black uppercase text-servirest-terracota tracking-widest italic">
                                                    <th className="px-6 pb-2">Folio</th>
                                                    <th className="px-6 pb-2">Hora</th>
                                                    <th className="px-6 pb-2">Productos</th>
                                                    <th className="px-6 pb-2">Método</th>
                                                    <th className="px-6 pb-2">Estado</th>
                                                    <th className="px-6 pb-2 text-right">Monto</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredByDateOrders.map(order => (
                                                    <tr key={order.id} className="group hover:bg-servirest-surface transition-all">
                                                        <td className="px-6 py-5 bg-servirest-surface rounded-l-[24px] border-y border-l border-[rgba(42,40,38,0.12)] font-mono text-[11px] text-[#2A2826]/60">TX-{order.id.slice(0, 8).toUpperCase()}</td>
                                                        <td className="px-6 py-5 bg-servirest-surface border-y border-[rgba(42,40,38,0.12)] text-[11px] font-black italic text-[#2A2826]/55">
                                                            {new Date(order.timestamp).toLocaleTimeString('es-MX')}
                                                            {order.customerName && (
                                                                <span className="block text-[10px] font-black uppercase not-italic tracking-wider text-servirest-terracota mt-1">{order.customerName}</span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-5 bg-servirest-surface border-y border-[rgba(42,40,38,0.12)] text-[10px] font-black uppercase italic tracking-tight max-w-[250px]">
    <div className="flex flex-wrap gap-1">
        {(order.items || []).map((item, idx) => (
            <span key={idx} className="bg-servirest-terracota/5 text-servirest-terracota px-1.5 py-0.5 rounded-md border border-servirest-terracota/10 whitespace-nowrap">
                {item.quantity}x {item.name}
            </span>
        ))}
        {(!order.items || order.items.length === 0) && <span className="text-[#2A2826]/20">Sin platillos</span>}
    </div>
</td>
                                                        <td className="px-6 py-5 bg-servirest-surface border-y border-[rgba(42,40,38,0.12)]">
                                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${order.paymentMethod === PaymentMethod.CASH ? 'border-green-500/20 text-green-400 bg-green-500/5' : 'border-blue-500/20 text-blue-400 bg-blue-500/5'}`}>
                                                                {order.paymentMethod || 'PENDING'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-5 bg-servirest-surface border-y border-[rgba(42,40,38,0.12)]">
                                                            <span className={`text-[10px] font-black uppercase tracking-tighter ${order.status === 'COMPLETED' ? 'text-servirest-terracota' : 'text-[#2A2826]/30'}`}>
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-5 bg-servirest-surface rounded-r-[24px] border-y border-r border-[rgba(42,40,38,0.12)] text-right font-black italic text-xl">
                                                            <div className="flex items-center justify-end gap-3">
                                                                <span>${order.total.toFixed(2)}</span>
                                                                <button
                                                                    title="Eliminar esta venta"
                                                                    onClick={() => {
                                                                        const detalle = (order.items || []).length
                                                                            ? (order.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ')
                                                                            : 'sin platillos registrados';
                                                                        if (window.confirm(
                                                                            `¿Eliminar esta venta?\n\n` +
                                                                            `Folio: ${order.dailyNumber ?? order.id.slice(0, 8)}\n` +
                                                                            `Hora: ${new Date(order.timestamp).toLocaleTimeString('es-MX')}\n` +
                                                                            `Monto: $${order.total.toFixed(2)}\n` +
                                                                            `Contenido: ${detalle}\n\n` +
                                                                            `Se borra de este equipo y de la nube. No se puede deshacer.`
                                                                        )) {
                                                                            removeOrder(order.id);
                                                                        }
                                                                    }}
                                                                    className="text-red-500/20 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                     </div>
                                </GlowCard>
                            </div>
                        </div>
                    ) : selectedOrder ? (
                          <div className="h-full flex flex-col lg:flex-row p-4 md:p-8 gap-6 md:gap-8 overflow-y-auto no-scrollbar">

                            {/* ── CENTER CONSOLE: The Asset & Adjustment Hub ── */}
                            <div className="flex-[6] flex flex-col gap-4 md:gap-6 min-h-0 lg:overflow-visible pb-12 lg:pb-0">
                                <GlowCard glowColor="orange" customSize className="w-full h-auto lg:h-full border border-[rgba(42,40,38,0.20)] bg-servirest-surface !p-0 rounded-solaris lg:rounded-[40px] shadow-2xl flex flex-col">
                                    {/* Console Header: Title & Adjustments Unified */}
                                    <div className="px-6 md:px-10 py-6 md:py-8 border-b border-[rgba(42,40,38,0.12)] bg-servirest-surface shrink-0">
                                        <div className="flex justify-between items-start mb-6 md:mb-10">
                                            <div className="flex items-center gap-4">
                                                <button 
                                                    onClick={() => setSelectedTableId(null)}
                                                    className="lg:hidden p-3 bg-white/5 rounded-xl text-[#2A2826]/55 active:text-[#1a1c14] transition-all"
                                                >
                                                    <X size={20} />
                                                </button>
                                                <div>
                                                    <h2 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter text-[#1a1c14]">Acciones</h2>
                                                    <p className="text-[9px] md:text-[11px] font-black uppercase text-servirest-terracota/40 tracking-[0.4em] mt-1 md:mt-2">Mesa {selectedOrder.tableId}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 md:gap-3">
                                                <button onClick={() => printerService.openCashDrawer(settings)} className="p-3 md:p-4 bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-xl md:rounded-2xl text-[#2A2826]/55 hover:text-[#1a1c14] hover:bg-white/[0.08] transition-all"><Zap size={18} /></button>
                                                <button onClick={() => handlePrintTicket(selectedOrder)} className="p-3 md:p-4 bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-xl md:rounded-2xl text-[#2A2826]/55 hover:text-[#1a1c14] hover:bg-white/[0.08] transition-all"><Printer size={18} /></button>
                                            </div>
                                        </div>

                                        {/* Adjustment Layer: Split & Tip side-by-side */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                                            <div>
                                                <h3 className="text-[9px] md:text-[10px] font-black uppercase text-[#2A2826]/30 tracking-widest mb-3 md:mb-4 italic">Quantum Split</h3>
                                                <div className="flex gap-1.5 md:gap-2">
                                                    {[1, 2, 3, 4].map(num => (
                                                        <button key={num} onClick={() => setSplitCount(num)}
                                                            className={`flex-1 py-2 md:py-3 rounded-xl md:rounded-2xl font-black italic text-sm md:text-base transition-all ${splitCount === num ? 'bg-servirest-terracota text-[#1a1c14]' : 'bg-servirest-surface text-[#2A2826]/30 border border-[rgba(42,40,38,0.12)] hover:text-[#1a1c14]'}`}
                                                        >{num}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-[9px] md:text-[10px] font-black uppercase text-[#2A2826]/30 tracking-widest mb-3 md:mb-4 italic">Operator Gratuity</h3>
                                                <div className="flex gap-1.5 md:gap-2">
                                                    {[0, 10, 15, 20].map(pct => (
                                                        <button key={pct} onClick={() => setTipAmount(subtotal * (pct/100))}
                                                            className={`flex-1 py-2 md:py-3 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${Math.abs(tipAmount - subtotal*(pct/100)) < 1 ? 'bg-white text-black' : 'bg-servirest-surface text-[#2A2826]/30 border border-[rgba(42,40,38,0.12)]'}`}
                                                        >{pct}%</button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Console Body: The Manifest */}
                                    <div className="flex-1 overflow-y-auto no-scrollbar p-10 space-y-4">
                                        <p className="text-[10px] font-black uppercase text-servirest-terracota tracking-[0.5em] mb-6 italic">Verified Items Manifest</p>
                                        {(selectedOrder.items || []).map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center py-6 px-10 bg-white/[0.015] rounded-[32px] border border-[rgba(42,40,38,0.12)] group hover:border-servirest-terracota/20 hover:bg-servirest-surface transition-all">
                                                <div className="flex items-center gap-8 flex-1">
                                                    <span className="text-2xl font-black italic text-servirest-terracota/40 group-hover:text-servirest-terracota transition-colors min-w-[1.5em]">{item.quantity}</span>
                                                    <div className="w-px h-8 bg-white/10" />
                                                    <span className="font-black italic text-[#2A2826]/90 uppercase tracking-tight text-xl truncate pr-4">{item.name}</span>
                                                </div>
                                                <div className="flex items-end flex-col">
                                                    <p className="text-[9px] font-black uppercase text-[#2A2826]/10 tracking-[0.3em] mb-1">Asset Value</p>
                                                    <span className="text-2xl font-black italic text-[#2A2826]/55 tracking-tighter">${(item.price * item.quantity).toFixed(0)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Console Footer: Sub-metrics */}
                                    <div className="px-10 py-6 bg-servirest-surface border-t border-[rgba(42,40,38,0.12)] flex justify-between items-center shadow-inner">
                                        <div className="flex gap-12">
                                            <div>
                                                <p className="text-[9px] font-black uppercase text-[#2A2826]/30 tracking-widest mb-1">Subtotal Baseline</p>
                                                <p className="text-xl font-black italic text-[#2A2826]/70">${subtotal.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase text-[#2A2826]/30 tracking-widest mb-1">Tax / Adjustments</p>
                                                <p className="text-xl font-black italic text-[#2A2826]/70">$0.00</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black uppercase text-servirest-terracota/60 tracking-widest mb-1 italic">Per Person Asset Value</p>
                                            <p className="text-3xl font-black italic text-servirest-terracota">${(total / splitCount).toFixed(2)}</p>
                                        </div>
                                    </div>
                                </GlowCard>
                            </div>

                            {/* ── RIGHT COLUMN: The Settlement Panel ── */}
                            <div className="w-full lg:flex-[4] flex flex-col min-h-0 pb-24 md:pb-0">
                                <GlowCard glowColor="orange" customSize className="w-full h-auto lg:h-full border border-[rgba(42,40,38,0.20)] bg-servirest-surface !p-6 md:!p-10 rounded-[32px] md:rounded-[48px] shadow-solaris-glow flex flex-col">
                                    <div className="flex-1 flex flex-col min-h-0">
                                        {/* Payload Display */}
                                        <div className="mb-8 md:mb-12">
                                            <p className="text-[9px] md:text-[11px] font-black uppercase text-servirest-terracota/60 tracking-[0.4em] mb-2 md:mb-4 italic">Aggregate Payload</p>
                                            <p className="text-5xl md:text-8xl font-black italic tracking-tighter text-[#1a1c14] leading-none">${total.toFixed(2)}</p>
                                            {tipAmount > 0 && (
                                                <p className="text-[9px] md:text-[10px] font-black uppercase text-[#2A2826]/30 tracking-widest mt-4 md:mt-6 italic">Includes ${tipAmount.toFixed(2)} network gratuity</p>
                                            )}
                                        </div>

                                        <div className="flex-1 space-y-3 md:space-y-4">
                                            <p className="text-[9px] md:text-[10px] font-black uppercase text-[#2A2826]/30 tracking-widest italic mb-4 md:mb-6">Método de pago</p>
                                            <GlowButton 
                                                onClick={() => setPaymentMethod(PaymentMethod.CASH)}
                                                variant={paymentMethod === PaymentMethod.CASH ? 'primary' : 'secondary'}
                                                className="w-full py-6 md:py-8 rounded-[24px] md:rounded-[32px] flex items-center justify-center gap-4 md:gap-6 !text-[#2A2826]"
                                            >
                                                <Wallet size={20} className="md:w-7 md:h-7" /> <span className="text-[11px] md:text-sm font-black uppercase tracking-widest">Liquid Asset</span>
                                            </GlowButton>
                                            <GlowButton 
                                                onClick={() => setPaymentMethod(PaymentMethod.CARD)}
                                                variant={paymentMethod === PaymentMethod.CARD ? 'primary' : 'secondary'}
                                                className="w-full py-6 md:py-8 rounded-[24px] md:rounded-[32px] flex items-center justify-center gap-4 md:gap-6 !text-[#2A2826]"
                                            >
                                                <CreditCard size={20} className="md:w-7 md:h-7" /> <span className="text-[11px] md:text-sm font-black uppercase tracking-widest">Spectral Card</span>
                                            </GlowButton>
                                        </div>
                                    </div>

                                    {/* Action Vector */}
                                    <div className="space-y-4 pt-8 md:pt-10 border-t border-[rgba(42,40,38,0.12)]">
                                        <GlowButton
                                            onClick={() => { setPartialPayments([]); setPartialAmount(''); setIsPaymentModalOpen(true); }}
                                            className="w-full py-8 md:py-12 rounded-[28px] md:rounded-[40px] tracking-[0.2em] md:tracking-[0.4em] text-xl md:text-3xl flex items-center justify-center gap-4 md:gap-8 group !text-[#2A2826]"
                                        >
                                            Execute <ArrowRight size={24} className="md:w-10 md:h-10 group-hover:translate-x-2 transition-transform" />
                                        </GlowButton>
                                    </div>
                                </GlowCard>
                            </div>

                        </div>
                    ) : activeTab === 'expenses' ? (
                        <div className="h-full flex flex-col p-10 gap-8 overflow-y-auto custom-scrollbar">
                            <div>
                                <h2 className="text-5xl font-black italic tracking-tighter uppercase text-[#1a1c14]">Gastos del día</h2>
                                <p className="text-[12px] font-black uppercase text-servirest-terracota/60 tracking-[0.5em] mt-3 italic">{selectedDate} • {expensesForDate.length} movimiento{expensesForDate.length === 1 ? '' : 's'}</p>
                            </div>

                            {/* Scoreboard: total, ventas del día y peso sobre la venta */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
                                {[
                                    { label: 'Total gastado', value: expensesTotal, color: 'text-red-400', icon: TrendingDown, glow: 'red' as const },
                                    { label: 'Ventas del día', value: salesMetrics.totalRevenue, color: 'text-[#1a1c14]', icon: DollarSign, glow: 'orange' as const },
                                    { label: 'Neto (ventas - gastos)', value: salesMetrics.totalRevenue - expensesTotal, color: 'text-servirest-terracota', icon: TrendingUp, glow: 'green' as const },
                                ].map((kpi, i) => (
                                    <GlowCard key={i} glowColor={kpi.glow} customSize className="w-full !p-8 bg-servirest-surface border-[rgba(42,40,38,0.12)] rounded-[32px]">
                                        <div className="flex items-center gap-4 mb-3 opacity-30">
                                            <kpi.icon size={16} />
                                            <p className="text-[9px] font-black uppercase tracking-widest">{kpi.label}</p>
                                        </div>
                                        <p className={`text-4xl font-black italic tracking-tighter ${kpi.color}`}>${kpi.value.toFixed(2)}</p>
                                    </GlowCard>
                                ))}
                            </div>

                            {/* Desglose por categoría */}
                            <div className="flex-1 flex flex-col min-h-0">
                                <GlowCard customSize glowColor="orange" className="w-full h-full !p-0 bg-servirest-surface border-[rgba(42,40,38,0.12)] rounded-[40px] flex flex-col overflow-hidden">
                                    <div className="px-10 py-6 border-b border-[rgba(42,40,38,0.12)] flex justify-between items-center shrink-0">
                                        <p className="text-[10px] font-black uppercase text-[#2A2826]/45 tracking-widest italic font-mono">Desglose por categoría</p>
                                        <p className="text-[10px] font-black uppercase text-[#2A2826]/45 tracking-widest italic font-mono">
                                            {expensesTotal > 0 && salesMetrics.totalRevenue > 0
                                                ? `${((expensesTotal / salesMetrics.totalRevenue) * 100).toFixed(1)}% de la venta`
                                                : '—'}
                                        </p>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-4">
                                        {expensesByCategory.length === 0 && (
                                            <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-16">
                                                <TrendingDown size={40} className="text-[#2A2826]/15" />
                                                <p className="text-[11px] font-black uppercase text-[#2A2826]/30 tracking-widest italic">Sin gastos registrados este día</p>
                                                <p className="text-[10px] text-[#2A2826]/25 max-w-[320px]">Regístralos en el panel de la izquierda y aparecerán aquí y en el corte de caja.</p>
                                            </div>
                                        )}
                                        {expensesByCategory.map(([cat, amount]) => {
                                            const pct = expensesTotal > 0 ? (amount / expensesTotal) * 100 : 0;
                                            return (
                                                <div key={cat} className="space-y-2">
                                                    <div className="flex justify-between items-baseline">
                                                        <span className="text-[11px] font-black uppercase tracking-widest text-[#2A2826]/70 italic">{cat}</span>
                                                        <span className="text-lg font-black italic text-red-400">${amount.toFixed(2)}</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-[rgba(42,40,38,0.06)] rounded-full overflow-hidden">
                                                        <div className="h-full bg-servirest-terracota rounded-full transition-all" style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-[#2A2826]/30">{pct.toFixed(1)}% de los gastos</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </GlowCard>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 p-6 text-center">
                             <div className="relative">
                                <Zap size={80} className="md:w-[140px] md:h-[140px] text-[#1a1c14]" />
                                <div className="absolute inset-0 bg-servirest-terracota blur-3xl opacity-20" />
                             </div>
                             <p className="text-[10px] md:text-[14px] font-black uppercase text-[#1a1c14] tracking-[0.4em] md:tracking-[0.8em] mt-8 md:mt-12 animate-pulse font-mono">Awaiting Node Selection</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Modal — Full Redesign */}
            <AnimatePresence>
                {isPaymentModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[600] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-4"
                    >
                        <div className="w-full max-w-5xl bg-[#FAF8F4] border border-[rgba(42,40,38,0.20)] rounded-solaris md:rounded-[40px] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
                            {/* Modal Header */}
                            <div className="flex justify-between items-center px-6 md:px-10 py-5 md:py-7 border-b border-[rgba(42,40,38,0.12)] bg-servirest-surface shrink-0">
                                <div>
                                    <h2 className="text-xl md:text-3xl font-black italic tracking-tighter uppercase text-[#1a1c14]">Authorize Payout</h2>
                                    <p className="text-[8px] md:text-[10px] font-black uppercase text-servirest-terracota/60 tracking-[0.4em] mt-1 italic">
                                        {selectedOrder?.customerName ? `${selectedOrder.customerName} • ` : ''}
                                        {selectedOrder?.dailyNumber !== undefined ? `#${selectedOrder.dailyNumber} • ` : ''}
                                        Total: ${total.toFixed(2)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setIsPaymentModalOpen(false); setPartialPayments([]); setPartialAmount(''); }}
                                    className="w-10 h-10 md:w-12 md:h-12 bg-servirest-surface rounded-full flex items-center justify-center text-[#2A2826]/30 hover:text-[#1a1c14] hover:bg-white/10 transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] flex-1 overflow-y-auto custom-scrollbar">
                                {/* Left — Cash Input */}
                                <div className="flex flex-col items-center justify-center p-8 md:p-12 border-b xl:border-b-0 xl:border-r border-[rgba(42,40,38,0.12)]">
                                    <p className="text-[9px] md:text-[10px] font-black uppercase text-[#2A2826]/30 tracking-[0.5em] mb-6 md:mb-8 italic">Cash Received</p>
                                    <div className="relative w-full flex items-center justify-center">
                                        <span className="text-3xl md:text-5xl font-black italic text-[#2A2826]/45 mr-2 md:mr-3 leading-none">$</span>
                                        <input
                                            type="number"
                                            autoFocus
                                            value={cashReceived}
                                            onChange={e => setCashReceived(e.target.value)}
                                            placeholder="0.00"
                                            className="bg-transparent border-none text-5xl md:text-7xl font-black italic tracking-tighter text-[#1a1c14] outline-none placeholder:text-[#2A2826]/10 w-full text-left leading-none"
                                            style={{maxWidth: '220px'}}
                                        />
                                    </div>
                                    <div className="w-full h-px bg-white/10 mt-6 mb-8 md:mb-10" />

                                    {/* Quick amount buttons */}
                                    <div className="grid grid-cols-3 gap-2 md:gap-3 w-full max-w-sm">
                                        {[50, 100, 200, 500].map(amt => (
                                            <button
                                                key={amt}
                                                onClick={() => setCashReceived(amt.toString())}
                                                className="py-3 md:py-4 rounded-xl md:rounded-2xl bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[#2A2826]/55 hover:text-[#1a1c14] hover:bg-white/[0.08] font-black italic text-xs md:text-sm transition-all"
                                            >
                                                ${amt}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setCashReceived((total / splitCount).toFixed(2))}
                                            className="py-3 md:py-4 rounded-xl md:rounded-2xl bg-servirest-terracota/10 border border-servirest-terracota/20 text-servirest-terracota hover:bg-servirest-terracota/20 font-black italic text-[9px] md:text-[10px] uppercase tracking-widest transition-all col-span-2"
                                        >
                                            Exact Amount
                                        </button>
                                    </div>
                                </div>

                                {/* Right — Summary & Confirm */}
                                <div className="flex flex-col p-8 md:p-10 gap-6 bg-servirest-surface">
                                    <div className="flex-1 space-y-4">
                                        <div className="grid grid-cols-2 xl:grid-cols-1 gap-4">
                                            <div className="bg-servirest-surface rounded-xl md:rounded-2xl p-4 md:p-6 border border-[rgba(42,40,38,0.12)]">
                                                <p className="text-[8px] md:text-[9px] font-black uppercase text-[#2A2826]/45 tracking-widest mb-1 md:mb-2 italic">To Pay</p>
                                                <p className="text-2xl md:text-4xl font-black italic text-[#1a1c14] tracking-tighter leading-none">${(total / splitCount).toFixed(2)}</p>
                                            </div>

                                            <div className="bg-servirest-terracota/5 rounded-xl md:rounded-2xl p-4 md:p-6 border border-servirest-terracota/10">
                                                <p className="text-[8px] md:text-[9px] font-black uppercase text-servirest-terracota/60 tracking-widest mb-1 md:mb-2 italic">Change</p>
                                                <p className="text-2xl md:text-4xl font-black italic text-servirest-terracota tracking-tighter leading-none">
                                                    ${Math.max(0, (parseFloat(cashReceived) || 0) - (total / splitCount)).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 md:space-y-3 pt-2">
                                            <p className="text-[8px] md:text-[9px] font-black uppercase text-[#2A2826]/30 tracking-widest italic">Método de pago</p>
                                            <div className="grid grid-cols-2 xl:grid-cols-1 gap-2">
                                                <GlowButton
                                                    onClick={() => setPaymentMethod(PaymentMethod.CASH)}
                                                    variant={paymentMethod === PaymentMethod.CASH && !isMixedPayment ? 'primary' : 'secondary'}
                                                    className="w-full text-[10px] py-4 !text-[#2A2826]"
                                                >
                                                    <Wallet size={16} /> <span className="hidden xs:inline">Efectivo</span>
                                                </GlowButton>
                                                <GlowButton
                                                    onClick={() => setPaymentMethod(PaymentMethod.CARD)}
                                                    variant={paymentMethod === PaymentMethod.CARD && !isMixedPayment ? 'primary' : 'secondary'}
                                                    className="w-full text-[10px] py-4 !text-[#2A2826]"
                                                >
                                                    <CreditCard size={16} /> <span className="hidden xs:inline">Tarjeta</span>
                                                </GlowButton>
                                            </div>
                                        </div>

                                        {/* ── Pago con varios métodos ──────────────────────
                                            Para cuando el cliente paga una parte con tarjeta y
                                            otra en efectivo. Se van registrando los pagos hasta
                                            cubrir el total. */}
                                        <div className="pt-4 border-t border-dashed border-[rgba(42,40,38,0.15)] space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[8px] md:text-[9px] font-black uppercase text-[#2A2826]/30 tracking-widest italic">Dividir por método</p>
                                                {isMixedPayment && (
                                                    <button
                                                        onClick={() => { setPartialPayments([]); setPartialAmount(''); }}
                                                        className="text-[8px] font-black uppercase tracking-widest text-red-400 hover:text-red-500 transition-colors"
                                                    >
                                                        Limpiar
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={partialAmount}
                                                    onChange={e => setPartialAmount(e.target.value)}
                                                    placeholder={mixedRemaining > 0 ? mixedRemaining.toFixed(2) : '0.00'}
                                                    className="flex-1 min-w-0 bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-xl py-2.5 px-3 text-[#1a1c14] text-sm font-black italic outline-none focus:border-servirest-terracota/40"
                                                />
                                                <button
                                                    onClick={() => setPartialAmount(mixedRemaining.toFixed(2))}
                                                    className="shrink-0 px-3 rounded-xl bg-servirest-terracota/10 border border-servirest-terracota/20 text-servirest-terracota text-[8px] font-black uppercase tracking-widest hover:bg-servirest-terracota/20 transition-all"
                                                >
                                                    Resto
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { m: PaymentMethod.CASH, label: 'Efectivo' },
                                                    { m: PaymentMethod.CARD, label: 'Tarjeta' },
                                                    { m: PaymentMethod.TRANSFER, label: 'Transf.' },
                                                ].map(({ m, label }) => (
                                                    <button
                                                        key={m}
                                                        onClick={() => {
                                                            const amt = parseFloat(partialAmount) || 0;
                                                            if (amt <= 0) return;
                                                            setPartialPayments(prev => [...prev, { id: crypto.randomUUID(), method: m, amount: amt }]);
                                                            setPartialAmount('');
                                                        }}
                                                        className="py-2.5 rounded-xl bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-[#2A2826]/60 hover:text-[#1a1c14] hover:border-servirest-terracota/50 text-[8px] font-black uppercase tracking-widest transition-all"
                                                    >
                                                        + {label}
                                                    </button>
                                                ))}
                                            </div>

                                            {isMixedPayment && (
                                                <div className="space-y-1.5">
                                                    {partialPayments.map(p => (
                                                        <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[rgba(42,40,38,0.04)] border border-[rgba(42,40,38,0.10)]">
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-[#2A2826]/60">
                                                                {p.method === PaymentMethod.CASH ? 'Efectivo' : p.method === PaymentMethod.CARD ? 'Tarjeta' : 'Transferencia'}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-black italic text-sm text-[#1a1c14]">${p.amount.toFixed(2)}</span>
                                                                <button
                                                                    onClick={() => setPartialPayments(prev => prev.filter(x => x.id !== p.id))}
                                                                    className="text-[#2A2826]/25 hover:text-red-500 transition-colors"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg ${mixedRemaining > 0.005 ? 'bg-servirest-terracota/10 border border-servirest-terracota/20' : 'bg-green-500/10 border border-green-500/25'}`}>
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-[#2A2826]/55">
                                                            {mixedRemaining > 0.005 ? 'Falta' : 'Cubierto'}
                                                        </span>
                                                        <span className={`font-black italic text-base ${mixedRemaining > 0.005 ? 'text-servirest-terracota' : 'text-green-500'}`}>
                                                            {mixedRemaining > 0.005
                                                                ? `$${mixedRemaining.toFixed(2)}`
                                                                : mixedPaid > total + 0.005
                                                                    ? `Cambio $${(mixedPaid - total).toFixed(2)}`
                                                                    : '✓'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <GlowButton
                                        onClick={handleProcessPayment}
                                        disabled={isMixedPayment
                                            ? mixedRemaining > 0.005
                                            : paymentMethod === PaymentMethod.CASH && (parseFloat(cashReceived) || 0) < (total / splitCount)}
                                        className="w-full py-5 md:py-7 tracking-[0.2em] md:tracking-[0.3em] text-base md:text-lg mb-8 md:mb-0 !text-[#2A2826]"
                                    >
                                        <CheckCircle2 size={20} className="md:w-6 md:h-6" /> {isMixedPayment ? 'Cobrar mixto' : 'Confirmar cobro'}
                                    </GlowButton>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Success Notification Toast */}
            <AnimatePresence>
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-8 right-8 z-[800] no-print"
                    >
                        <div className="flex items-center gap-4 bg-[#FAF8F4] border border-green-500/30 px-8 py-5 rounded-[28px] shadow-2xl shadow-green-500/10">
                            <div className="w-10 h-10 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center">
                                <CheckCircle2 size={20} className="text-green-500" />
                            </div>
                            <span className="text-green-400 font-black italic text-xs uppercase tracking-widest">{successMessage}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
