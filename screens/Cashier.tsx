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
                        <div className="h-full flex flex-col p-8 lg:p-12 overflow-y-auto custom-scrollbar">
                            <div className="flex-1 space-y-12 pb-12">
                                <GlowCard glowColor="orange" className="border border-white/5 bg-white/[0.01] !p-12">
                                    <div className="flex justify-between items-end mb-12 pb-8 border-b border-white/5">
                                        <div>
                                            <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">Asset Summary</h2>
                                            <p className="text-[10px] font-black uppercase text-solaris-orange/40 tracking-[0.3em] mt-3">Node: {selectedOrder.tableId} • OP: {selectedOrder.waiterName}</p>
                                        </div>
                                        <div className="flex gap-4">
                                             <button onClick={() => printerService.openCashDrawer()} className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl text-white/20 hover:text-white hover:bg-white/[0.05] transition-all"><Zap size={22} /></button>
                                             <button onClick={() => handlePrintTicket(selectedOrder)} className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl text-white/20 hover:text-white hover:bg-white/[0.05] transition-all"><Printer size={22} /></button>
                                        </div>
                                    </div>
                                    <div className="space-y-8">
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

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                                    <GlowCard className="bg-white/[0.01] border border-white/5 !p-10">
                                        <h3 className="text-[11px] font-black uppercase text-solaris-orange/40 tracking-widest mb-8 px-2 italic">Quantum Split Protocol</h3>
                                        <div className="flex flex-wrap gap-3 mb-10">
                                            {[1, 2, 3, 4, 5, 6].map(num => (
                                                <button key={num} onClick={() => setSplitCount(num)} className={`w-14 h-14 rounded-2xl font-black italic text-base transition-all ${splitCount === num ? 'bg-solaris-orange text-white shadow-solaris-glow scale-110' : 'bg-white/[0.03] text-white/20 border border-white/5 hover:text-white'}`}>{num}</button>
                                            ))}
                                        </div>
                                        <p className="text-[9px] font-black uppercase text-solaris-orange/40 tracking-[0.3em] mb-2 italic">Per Packet Value</p>
                                        <p className="text-4xl font-black italic text-white tracking-tighter">${(total / splitCount).toFixed(2)}</p>
                                    </GlowCard>

                                    <GlowCard className="bg-white/[0.01] border border-white/5 !p-10">
                                        <h3 className="text-[11px] font-black uppercase text-solaris-orange/40 tracking-widest mb-8 px-2 italic">Operator Gratuity</h3>
                                        <div className="flex gap-3 mb-10">
                                            {[10, 15, 20].map(pct => (
                                                <button key={pct} onClick={() => setTipAmount(subtotal * (pct/100))} className={`flex-1 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${Math.abs(tipAmount - subtotal*(pct/100)) < 1 ? 'bg-white text-black' : 'bg-white/[0.03] text-white/20 border border-white/5'}`}>{pct}%</button>
                                            ))}
                                        </div>
                                        <p className="text-[9px] font-black uppercase text-solaris-orange/40 tracking-[0.3em] mb-2 italic">Gratuity Asset</p>
                                        <p className="text-4xl font-black italic text-white tracking-tighter">${tipAmount.toFixed(2)}</p>
                                    </GlowCard>
                                </div>
                            </div>

                            <div className="sticky bottom-0 bg-[#030303] pt-6 flex gap-6 mt-auto">
                                <GlowCard glowColor="orange" className="flex-1 border border-white/10 bg-white/[0.02] !p-10 rounded-[40px] shadow-2xl">
                                     <div className="flex justify-between items-end mb-10">
                                        <div>
                                            <p className="text-[11px] font-black uppercase text-solaris-orange/50 tracking-[0.4em] mb-3 italic">Aggregate Payload</p>
                                            <p className="text-6xl font-black italic tracking-tighter text-white uppercase italic">${total.toFixed(2)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.3em] mb-2">Encrypted Chain</p>
                                            <p className="text-[11px] text-white/20 font-bold italic">Verification COMPLETE_88</p>
                                        </div>
                                     </div>
                                     <div className="grid grid-cols-2 gap-6 mb-8">
                                         <button onClick={() => setPaymentMethod(PaymentMethod.CASH)} className={`py-6 rounded-3xl flex items-center justify-center gap-4 transition-all border-2 ${paymentMethod === PaymentMethod.CASH ? 'bg-white text-black border-white shadow-xl scale-[1.02]' : 'bg-transparent border-white/5 text-white/20'}`}>
                                            <Wallet size={20} /> <span className="text-[11px] font-black uppercase tracking-widest">Liquid Asset</span>
                                         </button>
                                         <button onClick={() => setPaymentMethod(PaymentMethod.CARD)} className={`py-6 rounded-3xl flex items-center justify-center gap-4 transition-all border-2 ${paymentMethod === PaymentMethod.CARD ? 'bg-white text-black border-white shadow-xl scale-[1.02]' : 'bg-transparent border-white/5 text-white/20'}`}>
                                            <CreditCard size={20} /> <span className="text-[11px] font-black uppercase tracking-widest">Spectral Card</span>
                                         </button>
                                     </div>
                                     <div className="flex gap-4">
                                         <button onClick={() => handlePrintTicket(selectedOrder)} className="flex-1 py-8 bg-white/[0.03] border border-white/10 text-white font-black italic uppercase tracking-[0.3em] text-lg rounded-[28px] hover:bg-white/[0.05] transition-all flex items-center justify-center gap-4">
                                             <Printer size={24} /> Print Bill
                                         </button>
                                         <button onClick={() => setIsPaymentModalOpen(true)} className="flex-[2] py-8 bg-solaris-orange text-white rounded-[28px] font-black italic uppercase tracking-[0.4em] text-2xl shadow-solaris-glow hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-6">
                                             Settle Account <ArrowRight size={32} />
                                         </button>
                                     </div>
                                </GlowCard>
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

            {/* Payment Modal Redesign */}
            <AnimatePresence>
                {isPaymentModalOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[600] flex items-center justify-center bg-black/95 backdrop-blur-3xl p-6">
                        <GlowCard glowColor="orange" className="w-full max-w-2xl border border-white/10 !p-16 text-center bg-[#0a0a0b] relative rounded-[48px] shadow-2xl">
                            <X onClick={() => setIsPaymentModalOpen(false)} className="absolute top-12 right-12 text-white/10 hover:text-white cursor-pointer transition-colors" size={32} />
                            
                            <h2 className="text-5xl font-black italic tracking-tighter uppercase text-white mb-3">Authorize Payout</h2>
                            <p className="text-[11px] font-black uppercase text-solaris-orange tracking-[0.6em] mb-16 italic">Protocol Execution Layer • Manual Override</p>
                            
                            <div className="space-y-16">
                                <div className="space-y-6">
                                    <p className="text-[11px] font-black uppercase text-solaris-orange/40 tracking-widest text-center italic">Inbound Asset Value Injection</p>
                                    <input 
                                        type="number" 
                                        autoFocus
                                        value={cashReceived}
                                        onChange={e => setCashReceived(e.target.value)}
                                        placeholder={(total/splitCount).toString()}
                                        className="w-full bg-transparent border-none text-8xl font-black italic tracking-tighter text-white text-center outline-none placeholder:text-white/5"
                                    />
                                    <div className="h-px bg-white/5 w-full shadow-lg" />
                                </div>

                                <div className="grid grid-cols-2 gap-8 text-left">
                                    <div className="bg-white/[0.02] p-8 rounded-[32px] border border-white/5 shadow-inner">
                                        <p className="text-[10px] font-black uppercase text-solaris-orange/40 tracking-widest mb-2 italic">Target Payout</p>
                                        <p className="text-3xl font-black italic text-white">${(total/splitCount).toFixed(2)}</p>
                                    </div>
                                    <div className="bg-white/[0.02] p-8 rounded-[32px] border border-white/5 shadow-inner">
                                        <p className="text-[10px] font-black uppercase text-solaris-orange/40 tracking-widest mb-2 italic">Return Payload</p>
                                        <p className="text-3xl font-black italic text-solaris-orange animate-pulse">${Math.max(0, (parseFloat(cashReceived)||0) - (total/splitCount)).toFixed(2)}</p>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleProcessPayment}
                                    className="w-full py-10 bg-solaris-orange text-white font-black italic uppercase tracking-[0.4em] text-2xl rounded-[32px] shadow-solaris-glow hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-6"
                                >
                                    Confirm Transmission <CheckCircle2 size={32} />
                                </button>
                            </div>
                        </GlowCard>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
