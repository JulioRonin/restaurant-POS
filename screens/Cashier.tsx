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
                                            className="w-full flex items-center justify-center gap-3 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-[#505530]/60 hover:text-[#1a1c14] hover:border-white/20 transition-all font-black text-[10px] uppercase tracking-widest"
                                        >
                                            <Printer size={16} /> Asset Hardcopy
                                        </button>
                                        <button
                                            onClick={() => {
                                                const rows = [['ID', 'Manifest', 'Method', 'Total', 'Status', 'Hora'], ...filteredByDateOrders.map(o => [o.id.slice(0, 8), '"' + (o.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ') + '"', o.paymentMethod || 'N/A', o.total.toFixed(2), o.status, new Date(o.timestamp).toLocaleTimeString('es-MX')])].map(r => r.join(',')).join('\n');
                                                const blob = new Blob([rows], { type: 'text/csv' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a'); a.href = url; a.download = `reporte-${selectedDate}.csv`; a.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className="w-full flex items-center justify-center gap-3 py-4 bg-solaris-orange text-[#1a1c14] rounded-2xl shadow-solaris-glow hover:scale-[1.02] transition-all font-black text-[10px] uppercase tracking-widest"
                                        >
                                            <Download size={16} /> Data Payload (CSV)
                                        </button>
                                    </div>
                                </div>
                                <div className="p-4 bg-solaris-orange/5 border border-solaris-orange/10 rounded-2xl">
                                    <p className="text-[9px] font-black italic text-solaris-orange uppercase tracking-widest text-center">Select history mode in main cluster for full metrics view</p>
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
                                    <h2 className="text-5xl font-black italic tracking-tighter uppercase text-[#1a1c14]">Network Sales Manifest</h2>
                                    <p className="text-[12px] font-black uppercase text-solaris-orange/60 tracking-[0.5em] mt-3 italic">Temporal Node: {selectedDate} • Sync Sequence Active</p>
                                </div>
                                <div className="flex gap-4">
                                    <div className="px-6 py-3 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center gap-4">
                                        <div className={`w-3 h-3 rounded-full ${navigator.onLine ? 'bg-green-500 shadow-[0_0_10px_green]' : 'bg-red-500 animate-pulse'}`} />
                                        <span className="text-[10px] font-black uppercase text-[#505530]/55 tracking-widest">{navigator.onLine ? 'Uplink Stable' : 'Offline Mode'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* KPI Metrics Matrix */}
                            <div className="grid grid-cols-4 gap-6 shrink-0">
                                {[
                                    { label: 'Aggregated Revenue', value: salesMetrics.totalRevenue, color: 'text-[#1a1c14]', icon: DollarSign, glow: 'orange' },
                                    { label: 'Liquid Assets (Cash)', value: salesMetrics.cashSales, color: 'text-green-400', icon: Wallet, glow: 'green' },
                                    { label: 'Spectral Assets (Card)', value: salesMetrics.cardSales, color: 'text-blue-400', icon: CreditCard, glow: 'blue' },
                                    { label: 'Net Synthesis', value: salesMetrics.totalRevenue - expenses.filter(e => e.date.startsWith(selectedDate)).reduce((s, e) => s + Number(e.amount || 0), 0), color: 'text-solaris-orange', icon: TrendingUp, glow: 'orange' }
                                ].map((kpi, i) => (
                                    <GlowCard key={i} glowColor={kpi.glow as any} customSize className="w-full !p-8 bg-white/[0.01] border-white/5 rounded-[32px]">
                                        <div className="flex items-center gap-4 mb-3 opacity-30">
                                            <kpi.icon size={16} />
                                            <p className="text-[9px] font-black uppercase tracking-widest">{kpi.label}</p>
                                        </div>
                                        <p className={`text-4xl font-black italic tracking-tighter ${kpi.color}`}>${kpi.value.toFixed(2)}</p>
                                    </GlowCard>
                                ))}
                            </div>

                            {/* Detailed Transaction Ledger */}
                            <div className="flex-1 flex flex-col min-h-0">
                                <GlowCard customSize glowColor="orange" className="w-full h-full !p-0 bg-white/[0.01] border-white/5 rounded-[40px] flex flex-col overflow-hidden">
                                     <div className="px-10 py-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center shrink-0">
                                        <p className="text-[10px] font-black uppercase text-[#505530]/45 tracking-widest italic font-mono">Detailed Transaction Ledger</p>
                                        <p className="text-[10px] font-black uppercase text-[#505530]/45 tracking-widest italic font-mono">Count: {filteredByDateOrders.length} Events</p>
                                     </div>
                                     <div className="flex-1 overflow-y-auto no-scrollbar p-10">
                                        <table className="w-full text-left border-separate border-spacing-y-4">
                                            <thead>
                                                <tr className="text-[9px] font-black uppercase text-solaris-orange tracking-widest italic">
                                                    <th className="px-6 pb-2">TX Sequence</th>
                                                    <th className="px-6 pb-2">Temporal Node</th>
                                                    <th className="px-6 pb-2">Asset Manifest</th>
                                                    <th className="px-6 pb-2">Method</th>
                                                    <th className="px-6 pb-2">Status</th>
                                                    <th className="px-6 pb-2 text-right">Value (USD)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredByDateOrders.map(order => (
                                                    <tr key={order.id} className="group hover:bg-white/[0.02] transition-all">
                                                        <td className="px-6 py-5 bg-white/[0.02] rounded-l-[24px] border-y border-l border-white/5 font-mono text-[11px] text-[#505530]/60">TX-{order.id.slice(0, 8).toUpperCase()}</td>
                                                        <td className="px-6 py-5 bg-white/[0.02] border-y border-white/5 text-[11px] font-black italic text-[#505530]/55">{new Date(order.timestamp).toLocaleTimeString('es-MX')}</td>
                                                        <td className="px-6 py-5 bg-white/[0.02] border-y border-white/5 text-[10px] font-black uppercase italic tracking-tight max-w-[250px]">
    <div className="flex flex-wrap gap-1">
        {(order.items || []).map((item, idx) => (
            <span key={idx} className="bg-solaris-orange/5 text-solaris-orange px-1.5 py-0.5 rounded-md border border-solaris-orange/10 whitespace-nowrap">
                {item.quantity}x {item.name}
            </span>
        ))}
        {(!order.items || order.items.length === 0) && <span className="text-[#505530]/20">Empty Node</span>}
    </div>
</td>
                                                        <td className="px-6 py-5 bg-white/[0.02] border-y border-white/5">
                                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${order.paymentMethod === PaymentMethod.CASH ? 'border-green-500/20 text-green-400 bg-green-500/5' : 'border-blue-500/20 text-blue-400 bg-blue-500/5'}`}>
                                                                {order.paymentMethod || 'PENDING'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-5 bg-white/[0.02] border-y border-white/5">
                                                            <span className={`text-[10px] font-black uppercase tracking-tighter ${order.status === 'COMPLETED' ? 'text-solaris-orange' : 'text-[#505530]/30'}`}>
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-5 bg-white/[0.02] rounded-r-[24px] border-y border-r border-white/5 text-right font-black italic text-xl">
                                                            ${order.total.toFixed(2)}
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
                                <GlowCard glowColor="orange" customSize className="w-full h-auto lg:h-full border border-white/10 bg-white/[0.01] !p-0 rounded-solaris lg:rounded-[40px] shadow-2xl flex flex-col">
                                    {/* Console Header: Title & Adjustments Unified */}
                                    <div className="px-6 md:px-10 py-6 md:py-8 border-b border-white/5 bg-white/[0.01] shrink-0">
                                        <div className="flex justify-between items-start mb-6 md:mb-10">
                                            <div className="flex items-center gap-4">
                                                <button 
                                                    onClick={() => setSelectedTableId(null)}
                                                    className="lg:hidden p-3 bg-white/5 rounded-xl text-[#505530]/55 active:text-[#1a1c14] transition-all"
                                                >
                                                    <X size={20} />
                                                </button>
                                                <div>
                                                    <h2 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter text-[#1a1c14]">Asset Console</h2>
                                                    <p className="text-[9px] md:text-[11px] font-black uppercase text-solaris-orange/40 tracking-[0.4em] mt-1 md:mt-2">Node: {selectedOrder.tableId} • Local TX Sequence</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 md:gap-3">
                                                <button onClick={() => printerService.openCashDrawer(settings)} className="p-3 md:p-4 bg-white/[0.03] border border-white/5 rounded-xl md:rounded-2xl text-[#505530]/55 hover:text-[#1a1c14] hover:bg-white/[0.08] transition-all"><Zap size={18} /></button>
                                                <button onClick={() => handlePrintTicket(selectedOrder)} className="p-3 md:p-4 bg-white/[0.03] border border-white/5 rounded-xl md:rounded-2xl text-[#505530]/55 hover:text-[#1a1c14] hover:bg-white/[0.08] transition-all"><Printer size={18} /></button>
                                            </div>
                                        </div>

                                        {/* Adjustment Layer: Split & Tip side-by-side */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                                            <div>
                                                <h3 className="text-[9px] md:text-[10px] font-black uppercase text-[#505530]/30 tracking-widest mb-3 md:mb-4 italic">Quantum Split</h3>
                                                <div className="flex gap-1.5 md:gap-2">
                                                    {[1, 2, 3, 4].map(num => (
                                                        <button key={num} onClick={() => setSplitCount(num)}
                                                            className={`flex-1 py-2 md:py-3 rounded-xl md:rounded-2xl font-black italic text-sm md:text-base transition-all ${splitCount === num ? 'bg-solaris-orange text-[#1a1c14]' : 'bg-white/[0.03] text-[#505530]/30 border border-white/5 hover:text-[#1a1c14]'}`}
                                                        >{num}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="text-[9px] md:text-[10px] font-black uppercase text-[#505530]/30 tracking-widest mb-3 md:mb-4 italic">Operator Gratuity</h3>
                                                <div className="flex gap-1.5 md:gap-2">
                                                    {[0, 10, 15, 20].map(pct => (
                                                        <button key={pct} onClick={() => setTipAmount(subtotal * (pct/100))}
                                                            className={`flex-1 py-2 md:py-3 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all ${Math.abs(tipAmount - subtotal*(pct/100)) < 1 ? 'bg-white text-black' : 'bg-white/[0.03] text-[#505530]/30 border border-white/5'}`}
                                                        >{pct}%</button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Console Body: The Manifest */}
                                    <div className="flex-1 overflow-y-auto no-scrollbar p-10 space-y-4">
                                        <p className="text-[10px] font-black uppercase text-solaris-orange tracking-[0.5em] mb-6 italic">Verified Items Manifest</p>
                                        {(selectedOrder.items || []).map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center py-6 px-10 bg-white/[0.015] rounded-[32px] border border-white/5 group hover:border-solaris-orange/20 hover:bg-white/[0.03] transition-all">
                                                <div className="flex items-center gap-8 flex-1">
                                                    <span className="text-2xl font-black italic text-solaris-orange/40 group-hover:text-solaris-orange transition-colors min-w-[1.5em]">{item.quantity}</span>
                                                    <div className="w-px h-8 bg-white/10" />
                                                    <span className="font-black italic text-[#505530]/90 uppercase tracking-tight text-xl truncate pr-4">{item.name}</span>
                                                </div>
                                                <div className="flex items-end flex-col">
                                                    <p className="text-[9px] font-black uppercase text-[#505530]/10 tracking-[0.3em] mb-1">Asset Value</p>
                                                    <span className="text-2xl font-black italic text-[#505530]/55 tracking-tighter">${(item.price * item.quantity).toFixed(0)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Console Footer: Sub-metrics */}
                                    <div className="px-10 py-6 bg-white/[0.01] border-t border-white/5 flex justify-between items-center shadow-inner">
                                        <div className="flex gap-12">
                                            <div>
                                                <p className="text-[9px] font-black uppercase text-[#505530]/30 tracking-widest mb-1">Subtotal Baseline</p>
                                                <p className="text-xl font-black italic text-[#505530]/70">${subtotal.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-black uppercase text-[#505530]/30 tracking-widest mb-1">Tax / Adjustments</p>
                                                <p className="text-xl font-black italic text-[#505530]/70">$0.00</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] font-black uppercase text-solaris-orange/60 tracking-widest mb-1 italic">Per Person Asset Value</p>
                                            <p className="text-3xl font-black italic text-solaris-orange">${(total / splitCount).toFixed(2)}</p>
                                        </div>
                                    </div>
                                </GlowCard>
                            </div>

                            {/* ── RIGHT COLUMN: The Settlement Panel ── */}
                            <div className="w-full lg:flex-[4] flex flex-col min-h-0 pb-24 md:pb-0">
                                <GlowCard glowColor="orange" customSize className="w-full h-auto lg:h-full border border-white/10 bg-white/[0.02] !p-6 md:!p-10 rounded-[32px] md:rounded-[48px] shadow-solaris-glow flex flex-col">
                                    <div className="flex-1 flex flex-col min-h-0">
                                        {/* Payload Display */}
                                        <div className="mb-8 md:mb-12">
                                            <p className="text-[9px] md:text-[11px] font-black uppercase text-solaris-orange/60 tracking-[0.4em] mb-2 md:mb-4 italic">Aggregate Payload</p>
                                            <p className="text-5xl md:text-8xl font-black italic tracking-tighter text-[#1a1c14] leading-none">${total.toFixed(2)}</p>
                                            {tipAmount > 0 && (
                                                <p className="text-[9px] md:text-[10px] font-black uppercase text-[#505530]/30 tracking-widest mt-4 md:mt-6 italic">Includes ${tipAmount.toFixed(2)} network gratuity</p>
                                            )}
                                        </div>

                                        <div className="flex-1 space-y-3 md:space-y-4">
                                            <p className="text-[9px] md:text-[10px] font-black uppercase text-[#505530]/30 tracking-widest italic mb-4 md:mb-6">Execution Method</p>
                                            <GlowButton 
                                                onClick={() => setPaymentMethod(PaymentMethod.CASH)}
                                                variant={paymentMethod === PaymentMethod.CASH ? 'primary' : 'secondary'}
                                                className="w-full py-6 md:py-8 rounded-[24px] md:rounded-[32px] flex items-center justify-center gap-4 md:gap-6 !text-[#505530]"
                                            >
                                                <Wallet size={20} className="md:w-7 md:h-7" /> <span className="text-[11px] md:text-sm font-black uppercase tracking-widest">Liquid Asset</span>
                                            </GlowButton>
                                            <GlowButton 
                                                onClick={() => setPaymentMethod(PaymentMethod.CARD)}
                                                variant={paymentMethod === PaymentMethod.CARD ? 'primary' : 'secondary'}
                                                className="w-full py-6 md:py-8 rounded-[24px] md:rounded-[32px] flex items-center justify-center gap-4 md:gap-6 !text-[#505530]"
                                            >
                                                <CreditCard size={20} className="md:w-7 md:h-7" /> <span className="text-[11px] md:text-sm font-black uppercase tracking-widest">Spectral Card</span>
                                            </GlowButton>
                                        </div>
                                    </div>

                                    {/* Action Vector */}
                                    <div className="space-y-4 pt-8 md:pt-10 border-t border-white/5">
                                        <GlowButton
                                            onClick={() => setIsPaymentModalOpen(true)}
                                            className="w-full py-8 md:py-12 rounded-[28px] md:rounded-[40px] tracking-[0.2em] md:tracking-[0.4em] text-xl md:text-3xl flex items-center justify-center gap-4 md:gap-8 group !text-[#505530]"
                                        >
                                            Execute <ArrowRight size={24} className="md:w-10 md:h-10 group-hover:translate-x-2 transition-transform" />
                                        </GlowButton>
                                    </div>
                                </GlowCard>
                            </div>

                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 p-6 text-center">
                             <div className="relative">
                                <Zap size={80} className="md:w-[140px] md:h-[140px] text-[#1a1c14]" />
                                <div className="absolute inset-0 bg-solaris-orange blur-3xl opacity-20" />
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
                        <div className="w-full max-w-5xl bg-[#FAFAF3] border border-white/10 rounded-solaris md:rounded-[40px] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
                            {/* Modal Header */}
                            <div className="flex justify-between items-center px-6 md:px-10 py-5 md:py-7 border-b border-white/5 bg-white/[0.01] shrink-0">
                                <div>
                                    <h2 className="text-xl md:text-3xl font-black italic tracking-tighter uppercase text-[#1a1c14]">Authorize Payout</h2>
                                    <p className="text-[8px] md:text-[10px] font-black uppercase text-solaris-orange/60 tracking-[0.4em] mt-1 italic">Table: {selectedOrder?.tableId} • Amount due: ${(total / splitCount).toFixed(2)}</p>
                                </div>
                                <button
                                    onClick={() => setIsPaymentModalOpen(false)}
                                    className="w-10 h-10 md:w-12 md:h-12 bg-white/[0.04] rounded-full flex items-center justify-center text-[#505530]/30 hover:text-[#1a1c14] hover:bg-white/10 transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] flex-1 overflow-y-auto custom-scrollbar">
                                {/* Left — Cash Input */}
                                <div className="flex flex-col items-center justify-center p-8 md:p-12 border-b xl:border-b-0 xl:border-r border-white/5">
                                    <p className="text-[9px] md:text-[10px] font-black uppercase text-[#505530]/30 tracking-[0.5em] mb-6 md:mb-8 italic">Cash Received</p>
                                    <div className="relative w-full flex items-center justify-center">
                                        <span className="text-3xl md:text-5xl font-black italic text-[#505530]/45 mr-2 md:mr-3 leading-none">$</span>
                                        <input
                                            type="number"
                                            autoFocus
                                            value={cashReceived}
                                            onChange={e => setCashReceived(e.target.value)}
                                            placeholder="0.00"
                                            className="bg-transparent border-none text-5xl md:text-7xl font-black italic tracking-tighter text-[#1a1c14] outline-none placeholder:text-[#505530]/10 w-full text-left leading-none"
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
                                                className="py-3 md:py-4 rounded-xl md:rounded-2xl bg-white/[0.03] border border-white/5 text-[#505530]/55 hover:text-[#1a1c14] hover:bg-white/[0.08] font-black italic text-xs md:text-sm transition-all"
                                            >
                                                ${amt}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setCashReceived((total / splitCount).toFixed(2))}
                                            className="py-3 md:py-4 rounded-xl md:rounded-2xl bg-solaris-orange/10 border border-solaris-orange/20 text-solaris-orange hover:bg-solaris-orange/20 font-black italic text-[9px] md:text-[10px] uppercase tracking-widest transition-all col-span-2"
                                        >
                                            Exact Amount
                                        </button>
                                    </div>
                                </div>

                                {/* Right — Summary & Confirm */}
                                <div className="flex flex-col p-8 md:p-10 gap-6 bg-white/[0.01]">
                                    <div className="flex-1 space-y-4">
                                        <div className="grid grid-cols-2 xl:grid-cols-1 gap-4">
                                            <div className="bg-white/[0.03] rounded-xl md:rounded-2xl p-4 md:p-6 border border-white/5">
                                                <p className="text-[8px] md:text-[9px] font-black uppercase text-[#505530]/45 tracking-widest mb-1 md:mb-2 italic">To Pay</p>
                                                <p className="text-2xl md:text-4xl font-black italic text-[#1a1c14] tracking-tighter leading-none">${(total / splitCount).toFixed(2)}</p>
                                            </div>

                                            <div className="bg-solaris-orange/5 rounded-xl md:rounded-2xl p-4 md:p-6 border border-solaris-orange/10">
                                                <p className="text-[8px] md:text-[9px] font-black uppercase text-solaris-orange/60 tracking-widest mb-1 md:mb-2 italic">Change</p>
                                                <p className="text-2xl md:text-4xl font-black italic text-solaris-orange tracking-tighter leading-none">
                                                    ${Math.max(0, (parseFloat(cashReceived) || 0) - (total / splitCount)).toFixed(2)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 md:space-y-3 pt-2">
                                            <p className="text-[8px] md:text-[9px] font-black uppercase text-[#505530]/30 tracking-widest italic">Payment Method</p>
                                            <div className="grid grid-cols-2 xl:grid-cols-1 gap-2">
                                                <GlowButton
                                                    onClick={() => setPaymentMethod(PaymentMethod.CASH)}
                                                    variant={paymentMethod === PaymentMethod.CASH ? 'primary' : 'secondary'}
                                                    className="w-full text-[10px] py-4 !text-[#505530]"
                                                >
                                                    <Wallet size={16} /> <span className="hidden xs:inline">Liquid Asset</span>
                                                </GlowButton>
                                                <GlowButton
                                                    onClick={() => setPaymentMethod(PaymentMethod.CARD)}
                                                    variant={paymentMethod === PaymentMethod.CARD ? 'primary' : 'secondary'}
                                                    className="w-full text-[10px] py-4 !text-[#505530]"
                                                >
                                                    <CreditCard size={16} /> <span className="hidden xs:inline">Spectral Card</span>
                                                </GlowButton>
                                            </div>
                                        </div>
                                    </div>

                                    <GlowButton
                                        onClick={handleProcessPayment}
                                        disabled={paymentMethod === PaymentMethod.CASH && (parseFloat(cashReceived) || 0) < (total / splitCount)}
                                        className="w-full py-5 md:py-7 tracking-[0.2em] md:tracking-[0.3em] text-base md:text-lg mb-8 md:mb-0 !text-[#505530]"
                                    >
                                        <CheckCircle2 size={20} className="md:w-6 md:h-6" /> Confirm Transmission
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
                        <div className="flex items-center gap-4 bg-[#FAFAF3] border border-green-500/30 px-8 py-5 rounded-[28px] shadow-2xl shadow-green-500/10">
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
