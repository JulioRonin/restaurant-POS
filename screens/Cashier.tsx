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
import { motion, AnimatePresence } from 'framer-motion';
import { GlowCard } from '../components/ui/spotlight-card';
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
  DollarSign
} from 'lucide-react';

export const CashierScreen: React.FC = () => {
    const { orders, updateOrderStatus } = useOrders();
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
    const [newExpenseDate, setNewExpenseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [cashReceived, setCashReceived] = useState<string>('');
    const [isProcessingTerminal, setIsProcessingTerminal] = useState(false);
    const [terminalStep, setTerminalStep] = useState('');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showFinancialReport, setShowFinancialReport] = useState(false);
    const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
    const [cashCutToPrint, setCashCutToPrint] = useState<any>(null);
    const [dismissedBillRequests, setDismissedBillRequests] = useState<string[]>([]);

    const handlePrintTicket = async (order: Order) => {
        const enrichedOrder = { ...order, tableId: order.tableId || 'VENTA', waiterName: order.waiterName || authProfile?.name || 'ADMIN' };
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
        if (paymentMethod === PaymentMethod.CARD && settings.isTerminalEnabled) {
            setIsProcessingTerminal(true);
            await bluetoothTerminalService.simulateTransaction(total / splitCount, (step) => setTerminalStep(step));
            setIsProcessingTerminal(false);
        }
        const splitAmount = total / splitCount;
        const currentPaidSplits = (selectedOrder.paidSplits || 0) + 1;
        const isFullyPaid = currentPaidSplits >= splitCount;
        const updatedOrder: Order = {
            ...selectedOrder,
            status: isFullyPaid ? OrderStatus.COMPLETED : OrderStatus.PENDING,
            paymentStatus: isFullyPaid ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
            paymentMethod,
            receivedAmount: (selectedOrder.receivedAmount || 0) + splitAmount,
            paidSplits: currentPaidSplits,
            timestamp: new Date()
        };
        updateOrderStatus(selectedOrder.id, updatedOrder.status, updatedOrder);
        if ((paymentMethod === PaymentMethod.CASH || paymentMethod === PaymentMethod.MIXED) && settings.isCashDrawerEnabled) await printerService.openCashDrawer();
        await handlePrintTicket({ ...updatedOrder, total: splitAmount } as Order);
        setSuccessMessage(isFullyPaid ? "TRANSACTION_COMPLETE" : "PARTIAL_PAYMENT_LOGGED");
        setTimeout(() => { setSuccessMessage(null); if (isFullyPaid) setSelectedTableId(null); }, 3000);
        setIsPaymentModalOpen(false);
        setCashReceived('');
    };

    const selectedOrder = useMemo(() => orders.find(o => (o.id === selectedTableId || o.tableId === selectedTableId) && o.status !== 'COMPLETED'), [orders, selectedTableId]);
    const subtotal = selectedOrder?.total || 0;
    const total = subtotal + tipAmount;

    const filteredByDateOrders = useMemo(() => orders.filter(o => {
        const d = new Date(o.timestamp || Date.now());
        const localD = new Date(d); localD.setMinutes(localD.getMinutes() - localD.getTimezoneOffset());
        return localD.toISOString().split('T')[0] === selectedDate;
    }), [orders, selectedDate]);

    const salesMetrics = useMemo(() => {
        const _sales = filteredByDateOrders.filter(o => o.status === 'COMPLETED');
        const totalRevenue = _sales.reduce((sum, o) => sum + (o.total || 0), 0);
        const cashSales = _sales.filter(o => o.paymentMethod === PaymentMethod.CASH).reduce((sum, o) => sum + (o.total || 0), 0);
        const cardSales = _sales.filter(o => o.paymentMethod === PaymentMethod.CARD).reduce((sum, o) => sum + (o.total || 0), 0);
        return { totalRevenue, cashSales, cardSales };
    }, [filteredByDateOrders]);

    const activeRequests = orders.filter(o => o.status === OrderStatus.BILL_REQUESTED && !dismissedBillRequests.includes(o.id));

    return (
        <div className="h-full bg-solaris-black text-white flex flex-col overflow-hidden antialiased">
            <div id="print-area" className="hidden print:block absolute inset-0 bg-white text-black p-10 z-[5000]">
                {orderToPrint && <Ticket order={orderToPrint} settings={settings} />}
                {cashCutToPrint && <CashCutTicket {...cashCutToPrint} settings={settings} />}
            </div>

            <style>{`@media print { .no-print { display: none !important; } }`}</style>

            <AnimatePresence>
                {activeRequests.length > 0 && (
                    <motion.div initial={{ y: -100 }} animate={{ y: 0 }} exit={{ y: -100 }} className="fixed top-6 left-1/2 -translate-x-1/2 z-[500] w-full max-w-xl px-4 no-print">
                        <div 
                            onClick={() => { setSelectedTableId(activeRequests[0].tableId); setActiveTab('tables'); }}
                            className="bg-solaris-orange p-6 rounded-[28px] shadow-solaris-glow border border-white/20 flex items-center justify-between cursor-pointer group scale-100 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center animate-pulse"><Bell size={24} /></div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Bill Request Pipeline • Active Alert</p>
                                    <p className="text-xl font-black italic uppercase italic tracking-tighter text-white">
                                        NODE: {activeRequests.map(o => o.tableId).join(', ')}
                                    </p>
                                </div>
                            </div>
                            <X onClick={(e) => { e.stopPropagation(); setDismissedBillRequests(prev => [...prev, ...activeRequests.map(r => r.id)]); }} size={24} className="text-white hover:scale-110 transition-transform" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Navigation Panel */}
                <div className="w-1/3 border-r border-white/5 flex flex-col no-print bg-[#030303]/50">
                    <div className="p-8 space-y-8">
                        <div>
                           <h1 className="text-3xl font-black italic tracking-tighter uppercase mb-2">Terminal Ops</h1>
                           <p className="text-solaris-orange/40 font-bold text-[10px] uppercase tracking-[0.4em]">Transaction Settlement & Assets</p>
                        </div>
                        <div className="flex bg-white/[0.03] border border-white/5 p-1 rounded-2xl">
                             {[
                                { id: 'tables', icon: Wallet, label: 'Nodes' },
                                { id: 'delivery', icon: Truck, label: 'Grid' },
                                { id: 'expenses', icon: TrendingDown, label: 'Burden' },
                                { id: 'history', icon: History, label: 'Logs' }
                             ].map(tab => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-xl transition-all ${activeTab === tab.id ? 'bg-solaris-orange text-white shadow-solaris-glow' : 'text-white/20 hover:text-white'}`}>
                                    <tab.icon size={16} />
                                    <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
                                </button>
                             ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-4">
                        {activeTab === 'tables' && TABLES.map(table => {
                             const order = orders.find(o => o.tableId === table.id && o.status !== 'COMPLETED');
                             const isRequested = order?.status === OrderStatus.BILL_REQUESTED;
                             const isSelected = selectedTableId === table.id;
                             return (
                                <motion.div 
                                    key={table.id}
                                    onClick={() => order && setSelectedTableId(table.id)}
                                    className={`p-6 rounded-solaris border transition-all cursor-pointer group relative overflow-hidden ${isSelected ? 'bg-solaris-orange/10 border-solaris-orange shadow-solaris-glow' : order ? 'bg-white/[0.03] border-white/10 hover:border-white/20' : 'bg-transparent border-dashed border-white/5 opacity-30 cursor-default'}`}
                                >
                                    {isRequested && (
                                        <div className="absolute top-0 right-0 bg-solaris-orange text-white px-4 py-1.5 text-[9px] font-black tracking-widest uppercase animate-pulse shadow-lg italic">
                                            REQ_BILL_V2
                                        </div>
                                    )}
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-xl font-black italic uppercase tracking-tighter text-white">{table.name}</p>
                                            <p className="text-[8px] font-black uppercase text-solaris-orange/40 tracking-widest mt-1">{order ? `TX_ID: ${order.id.slice(0,6)}` : 'Node Idle'}</p>
                                        </div>
                                        {order && <p className="text-xl font-black italic text-solaris-orange tracking-tighter">${order.total.toFixed(0)}</p>}
                                    </div>
                                </motion.div>
                             );
                        })}
                        
                        {activeTab === 'delivery' && orders.filter(o => o.source && o.source !== OrderSource.DINE_IN && o.status !== 'COMPLETED').map(order => (
                             <GlowCard key={order.id} onClick={() => setSelectedTableId(order.id)} className={`border cursor-pointer transition-all ${selectedTableId === order.id ? 'border-solaris-orange border-2' : 'border-white/5'}`}>
                                 <div className="flex justify-between items-start">
                                     <div>
                                         <p className="text-[10px] font-black uppercase text-solaris-orange tracking-widest mb-1 italic">{order.source}</p>
                                         <p className="text-lg font-black italic uppercase tracking-tighter text-white leading-none">{order.tableId}</p>
                                     </div>
                                     <p className="text-xl font-black italic text-white tracking-tighter">${order.total.toFixed(0)}</p>
                                 </div>
                             </GlowCard>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col bg-[#030303] no-print relative">
                    {selectedOrder ? (
                        <div className="h-full flex flex-col p-8 lg:p-10 overflow-hidden">
                            <div className="flex-1 flex flex-col xl:flex-row gap-8 lg:gap-12 min-h-0 overflow-hidden">
                                {/* Details Column */}
                                <div className="flex-[4] flex flex-col gap-8 min-h-0">
                                    <GlowCard glowColor="orange" className="border border-white/5 bg-white/[0.01] !p-8 flex flex-col min-h-0">
                                        <div className="flex justify-between items-end mb-8 pb-6 border-b border-white/5 shrink-0">
                                            <div>
                                                <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Asset Summary</h2>
                                                <p className="text-[9px] font-black uppercase text-solaris-orange/40 tracking-[0.3em] mt-2">Node: {selectedOrder.tableId} • OP: {selectedOrder.waiterName}</p>
                                            </div>
                                            <div className="flex gap-3">
                                                <button onClick={() => printerService.openCashDrawer()} className="p-3 bg-white/[0.03] border border-white/5 rounded-xl text-white/20 hover:text-white hover:bg-white/[0.05] transition-all"><Zap size={20} /></button>
                                                <button onClick={() => handlePrintTicket(selectedOrder)} className="p-3 bg-white/[0.03] border border-white/5 rounded-xl text-white/20 hover:text-white hover:bg-white/[0.05] transition-all"><Printer size={20} /></button>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto no-scrollbar pr-2 space-y-4">
                                            {(selectedOrder.items || []).map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center group">
                                                    <div className="flex items-center gap-6">
                                                        <span className="w-10 h-10 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-[11px] font-black text-solaris-orange italic">{item.quantity}</span>
                                                        <span className="font-black italic text-white/80 uppercase tracking-tight text-base group-hover:text-white transition-colors">{item.name}</span>
                                                    </div>
                                                    <span className="text-base font-black italic text-white/60 tracking-tighter">${(item.price * item.quantity).toFixed(0)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </GlowCard>

                                    <div className="grid grid-cols-2 gap-8 shrink-0">
                                        <GlowCard className="bg-white/[0.01] border border-white/5 !p-8">
                                            <h3 className="text-[10px] font-black uppercase text-solaris-orange/40 tracking-widest mb-6 italic">Quantum Split</h3>
                                            <div className="flex flex-wrap gap-2 mb-6">
                                                {[1, 2, 3, 4].map(num => (
                                                    <button key={num} onClick={() => setSplitCount(num)} className={`w-12 h-12 rounded-xl font-black italic text-sm transition-all ${splitCount === num ? 'bg-solaris-orange text-white' : 'bg-white/[0.03] text-white/20 border border-white/5 hover:text-white'}`}>{num}</button>
                                                ))}
                                            </div>
                                            <p className="text-3xl font-black italic text-white tracking-tighter">${(total / splitCount).toFixed(2)}</p>
                                        </GlowCard>

                                        <GlowCard className="bg-white/[0.01] border border-white/5 !p-8">
                                            <h3 className="text-[10px] font-black uppercase text-solaris-orange/40 tracking-widest mb-6 italic">Operator Gratuity</h3>
                                            <div className="flex gap-2 mb-6">
                                                {[10, 15].map(pct => (
                                                    <button key={pct} onClick={() => setTipAmount(subtotal * (pct/100))} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${Math.abs(tipAmount - subtotal*(pct/100)) < 1 ? 'bg-white text-black' : 'bg-white/[0.03] text-white/20 border border-white/5'}`}>{pct}%</button>
                                                ))}
                                            </div>
                                            <p className="text-3xl font-black italic text-white tracking-tighter">${tipAmount.toFixed(2)}</p>
                                        </GlowCard>
                                    </div>
                                </div>

                                {/* Payout Column */}
                                <div className="flex-[3] flex flex-col gap-8 shrink-0">
                                    <GlowCard glowColor="orange" className="h-full border border-white/10 bg-white/[0.02] !p-10 rounded-[40px] shadow-2xl flex flex-col">
                                        <div className="flex flex-col gap-6 mb-auto">
                                            <div className="border-b border-white/5 pb-8">
                                                <p className="text-[10px] font-black uppercase text-solaris-orange/50 tracking-[0.4em] mb-3 italic">Aggregate Payload</p>
                                                <p className="text-7xl font-black italic tracking-tighter text-white uppercase italic leading-none">${total.toFixed(2)}</p>
                                            </div>
                                            
                                            <div className="space-y-4">
                                                <p className="text-[10px] font-black uppercase text-solaris-orange/40 tracking-widest italic px-2">Injection Method</p>
                                                <div className="space-y-4">
                                                    <button onClick={() => setPaymentMethod(PaymentMethod.CASH)} className={`w-full py-6 rounded-3xl flex items-center justify-center gap-4 transition-all border-2 ${paymentMethod === PaymentMethod.CASH ? 'bg-white text-black border-white shadow-xl' : 'bg-transparent border-white/5 text-white/20'}`}>
                                                        <Wallet size={20} /> <span className="text-[11px] font-black uppercase tracking-widest">Liquid Asset</span>
                                                    </button>
                                                    <button onClick={() => setPaymentMethod(PaymentMethod.CARD)} className={`w-full py-6 rounded-3xl flex items-center justify-center gap-4 transition-all border-2 ${paymentMethod === PaymentMethod.CARD ? 'bg-white text-black border-white shadow-xl' : 'bg-transparent border-white/5 text-white/20'}`}>
                                                        <CreditCard size={20} /> <span className="text-[11px] font-black uppercase tracking-widest">Spectral Card</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 mt-8">
                                            <button onClick={() => handlePrintTicket(selectedOrder)} className="w-full py-6 bg-white/[0.03] border border-white/10 text-white font-black italic uppercase tracking-[0.3em] text-lg rounded-[28px] hover:bg-white/[0.05] transition-all flex items-center justify-center gap-4">
                                                <Printer size={24} /> Print Bill
                                            </button>
                                            <button onClick={() => setIsPaymentModalOpen(true)} className="w-full py-10 bg-solaris-orange text-white rounded-[28px] font-black italic uppercase tracking-[0.4em] text-2xl shadow-solaris-glow hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-6">
                                                Settle Account <ArrowRight size={32} />
                                            </button>
                                        </div>
                                    </GlowCard>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 group">
                             <div className="relative">
                                <Zap size={140} className="text-white group-hover:scale-110 transition-transform duration-700" />
                                <div className="absolute inset-0 bg-solaris-orange blur-3xl opacity-20 group-hover:opacity-40 transition-opacity" />
                             </div>
                             <p className="text-[14px] font-black uppercase text-white tracking-[0.8em] mt-12 animate-pulse">Awaiting Node Selection</p>
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
                        <div className="w-full max-w-5xl bg-[#0d0d0e] border border-white/10 rounded-[40px] shadow-2xl overflow-hidden">
                            {/* Modal Header */}
                            <div className="flex justify-between items-center px-10 py-7 border-b border-white/5 bg-white/[0.01]">
                                <div>
                                    <h2 className="text-3xl font-black italic tracking-tighter uppercase text-white">Authorize Payout</h2>
                                    <p className="text-[10px] font-black uppercase text-solaris-orange/60 tracking-[0.4em] mt-1 italic">Table: {selectedOrder?.tableId} • Amount due: ${(total / splitCount).toFixed(2)}</p>
                                </div>
                                <button
                                    onClick={() => setIsPaymentModalOpen(false)}
                                    className="w-12 h-12 bg-white/[0.04] rounded-full flex items-center justify-center text-white/20 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    <X size={22} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] min-h-[420px]">
                                {/* Left — Cash Input */}
                                <div className="flex flex-col items-center justify-center p-12 border-r border-white/5">
                                    <p className="text-[10px] font-black uppercase text-white/20 tracking-[0.5em] mb-8 italic">Cash Received</p>
                                    <div className="relative w-full flex items-center justify-center">
                                        <span className="text-5xl font-black italic text-white/30 mr-3 leading-none">$</span>
                                        <input
                                            type="number"
                                            autoFocus
                                            value={cashReceived}
                                            onChange={e => setCashReceived(e.target.value)}
                                            placeholder="0.00"
                                            className="bg-transparent border-none text-7xl font-black italic tracking-tighter text-white outline-none placeholder:text-white/10 w-full text-left leading-none"
                                            style={{maxWidth: '280px'}}
                                        />
                                    </div>
                                    <div className="w-full h-px bg-white/10 mt-6 mb-10" />

                                    {/* Quick amount buttons */}
                                    <div className="grid grid-cols-3 gap-3 w-full">
                                        {[50, 100, 200, 500].map(amt => (
                                            <button
                                                key={amt}
                                                onClick={() => setCashReceived(amt.toString())}
                                                className="py-4 rounded-2xl bg-white/[0.03] border border-white/5 text-white/40 hover:text-white hover:bg-white/[0.08] font-black italic text-sm transition-all"
                                            >
                                                ${amt}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setCashReceived((total / splitCount).toFixed(2))}
                                            className="py-4 rounded-2xl bg-solaris-orange/10 border border-solaris-orange/20 text-solaris-orange hover:bg-solaris-orange/20 font-black italic text-[10px] uppercase tracking-widest transition-all col-span-2"
                                        >
                                            Exact Amount
                                        </button>
                                    </div>
                                </div>

                                {/* Right — Summary & Confirm */}
                                <div className="flex flex-col p-10 gap-6 bg-white/[0.01]">
                                    <div className="flex-1 space-y-4">
                                        <div className="bg-white/[0.03] rounded-2xl p-6 border border-white/5">
                                            <p className="text-[9px] font-black uppercase text-white/30 tracking-widest mb-2 italic">To Pay</p>
                                            <p className="text-4xl font-black italic text-white tracking-tighter leading-none">${(total / splitCount).toFixed(2)}</p>
                                        </div>

                                        <div className="bg-solaris-orange/5 rounded-2xl p-6 border border-solaris-orange/10">
                                            <p className="text-[9px] font-black uppercase text-solaris-orange/60 tracking-widest mb-2 italic">Change</p>
                                            <p className="text-4xl font-black italic text-solaris-orange tracking-tighter leading-none">
                                                ${Math.max(0, (parseFloat(cashReceived) || 0) - (total / splitCount)).toFixed(2)}
                                            </p>
                                        </div>

                                        <div className="space-y-3 pt-2">
                                            <p className="text-[9px] font-black uppercase text-white/20 tracking-widest italic">Payment Method</p>
                                            <button
                                                onClick={() => setPaymentMethod(PaymentMethod.CASH)}
                                                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 border-2 font-black italic uppercase text-[11px] tracking-widest transition-all ${paymentMethod === PaymentMethod.CASH ? 'bg-white text-black border-white' : 'bg-transparent border-white/5 text-white/30'}`}
                                            >
                                                <Wallet size={18} /> Liquid Asset
                                            </button>
                                            <button
                                                onClick={() => setPaymentMethod(PaymentMethod.CARD)}
                                                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 border-2 font-black italic uppercase text-[11px] tracking-widest transition-all ${paymentMethod === PaymentMethod.CARD ? 'bg-white text-black border-white' : 'bg-transparent border-white/5 text-white/30'}`}
                                            >
                                                <CreditCard size={18} /> Spectral Card
                                            </button>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleProcessPayment}
                                        className="w-full py-7 bg-solaris-orange text-white font-black italic uppercase tracking-[0.3em] text-lg rounded-2xl shadow-solaris-glow hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
                                    >
                                        <CheckCircle2 size={24} /> Confirm Transmission
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
