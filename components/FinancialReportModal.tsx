import React from 'react';
import { Order, Expense } from '../types';

interface FinancialReportProps {
    isOpen: boolean;
    onClose: () => void;
    orders: Order[];
    expenses: Expense[];
    periodLabel: string;
    categoryLabel: string;
    restaurantName: string;
}

export const FinancialReportModal: React.FC<FinancialReportProps> = ({ 
    isOpen, 
    onClose, 
    orders, 
    expenses, 
    periodLabel, 
    categoryLabel,
    restaurantName 
}) => {
    if (!isOpen) return null;

    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const taxIVA = totalSales * 0.16; // Standard MX Tax
    const subtotal = totalSales - taxIVA;
    const netFlow = totalSales - totalExpenses;
    const averageTicket = orders.length > 0 ? totalSales / orders.length : 0;

    const waiterStats = React.useMemo(() => {
        const stats: Record<string, number> = {};
        orders.forEach(o => {
            if (o.waiterName) stats[o.waiterName] = (stats[o.waiterName] || 0) + o.total;
        });
        return Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    }, [orders]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 print-container">
            {/* Backdrop - Manual backdrop instead of no-print on parent to avoid hiding everything in print */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm no-print" onClick={onClose} />
            
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 relative z-10 print:h-auto print:shadow-none print:rounded-none">
                {/* Header - Buttons */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                            <span className="material-icons-round">analytics</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 tracking-tight">Reporte Financiero</h2>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Vista Previa de Exportación</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={onClose} 
                            className="px-6 py-2.5 bg-white border border-gray-200 text-gray-400 font-bold rounded-xl hover:bg-gray-50 transition-all text-sm"
                        >
                            Cerrar
                        </button>
                        <button 
                            onClick={handlePrint}
                            className="px-8 py-2.5 bg-primary text-white font-black rounded-xl hover:bg-primary-dark transition-all flex items-center gap-2 shadow-lg shadow-primary/20 text-sm"
                        >
                            <span className="material-icons-round text-lg">picture_as_pdf</span>
                            Descargar Reporte PDF
                        </button>
                    </div>
                </div>

                {/* Report Content - This part is what will be printed */}
                <div id="financial-report" className="flex-1 overflow-y-auto p-12 bg-white print:p-0 print:overflow-visible print:block">
                    <div className="max-w-4xl mx-auto">
                        {/* Company Header */}
                        <div className="flex justify-between items-start mb-16 pb-8 border-b-2 border-gray-900">
                            <div>
                                <h1 className="text-5xl font-black text-gray-900 tracking-tighter uppercase mb-2">CULINEX POS</h1>
                                <p className="text-xs font-black text-primary tracking-[0.3em] uppercase">{restaurantName} — Reporte Ejecutivo</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Fecha Emisión</p>
                                <p className="text-sm font-black text-gray-900">{new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>
                        </div>

                        {/* Summary Section */}
                        <div className="grid grid-cols-2 gap-12 mb-16">
                            <div>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Información del Período</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between border-b border-gray-100 pb-2">
                                        <span className="text-sm font-bold text-gray-500">Rango:</span>
                                        <span className="text-sm font-black text-gray-900">{periodLabel}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-2">
                                        <span className="text-sm font-bold text-gray-500">Categoría:</span>
                                        <span className="text-sm font-black text-gray-900">{categoryLabel}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-gray-100 pb-2">
                                        <span className="text-sm font-bold text-gray-500">Total Transacciones:</span>
                                        <span className="text-sm font-black text-gray-900">{orders.length}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-900 text-white p-8 rounded-3xl relative overflow-hidden">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Estado de Utilidades</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <span className="text-xs font-bold opacity-60">Ingreso Bruto</span>
                                        <span className="text-2xl font-black">${totalSales.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-end border-t border-white/10 pt-4">
                                        <span className="text-xs font-bold opacity-60">Flujo Neto</span>
                                        <span className="text-2xl font-black text-green-400">${netFlow.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="absolute -right-4 -bottom-4 opacity-10">
                                    <span className="material-icons-round text-8xl">trending_up</span>
                                </div>
                            </div>
                        </div>

                        {/* Metrics Table */}
                        <div className="mb-16">
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Desglose Financiero (MXN)</h3>
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="text-left py-4 px-6 text-[10px] font-black text-gray-400 uppercase">Concepto</th>
                                        <th className="text-right py-4 px-6 text-[10px] font-black text-gray-400 uppercase">Monto Bruto</th>
                                        <th className="text-right py-4 px-6 text-[10px] font-black text-gray-400 uppercase">Impuestos (16%)</th>
                                        <th className="text-right py-4 px-6 text-[10px] font-black text-gray-400 uppercase">Monto Neto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-gray-100">
                                        <td className="py-5 px-6 font-bold text-gray-900">Ventas Totales</td>
                                        <td className="py-5 px-6 text-right font-bold">${totalSales.toLocaleString()}</td>
                                        <td className="py-5 px-6 text-right font-medium text-gray-400">${taxIVA.toLocaleString()}</td>
                                        <td className="py-5 px-6 text-right font-black text-primary">${subtotal.toLocaleString()}</td>
                                    </tr>
                                    <tr className="border-b border-gray-100">
                                        <td className="py-5 px-6 font-bold text-gray-900">Gastos (Caja Chica)</td>
                                        <td className="py-5 px-6 text-right font-bold">${totalExpenses.toLocaleString()}</td>
                                        <td className="py-5 px-6 text-right font-medium text-gray-400">$0.00</td>
                                        <td className="py-5 px-6 text-right font-black text-red-500">-${totalExpenses.toLocaleString()}</td>
                                    </tr>
                                    <tr className="bg-primary/5">
                                        <td className="py-6 px-6 font-black text-gray-900 text-lg">Balance Final</td>
                                        <td colSpan={2}></td>
                                        <td className="py-6 px-6 text-right font-black text-2xl text-primary">${netFlow.toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Performance Grid */}
                        <div className="grid grid-cols-2 gap-12">
                            <div>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Eficiencia de Staff</h3>
                                <div className="space-y-4">
                                    {waiterStats.map(([name, total], i) => (
                                        <div key={name} className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-400">{i + 1}</div>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-sm font-bold text-gray-700">{name}</span>
                                                    <span className="text-sm font-black text-gray-900">${total.toLocaleString()}</span>
                                                </div>
                                                <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                                                    <div className="bg-primary h-full" style={{ width: `${(total / (waiterStats[0]?.[1] || 1)) * 100}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Indicadores Operativos</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Ticket Promedio</p>
                                        <p className="text-xl font-black text-gray-900">${averageTicket.toFixed(2)}</p>
                                    </div>
                                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Volumen Pedidos</p>
                                        <p className="text-xl font-black text-gray-900">{orders.length}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-24 pt-8 border-t border-gray-100 text-center">
                            <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Culinex POS System — Finanzas Verificadas</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
