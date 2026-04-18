import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Order, Expense } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

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
    const { settings } = useSettings();
    if (!isOpen) return null;

    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const taxIVA = 0; // Impuestos omitidos por solicitud
    const subtotal = totalSales;
    const netFlow = totalSales - totalExpenses;
    const averageTicket = orders.length > 0 ? totalSales / orders.length : 0;

    const waiterStats = useMemo(() => {
        const stats: Record<string, number> = {};
        orders.forEach(o => {
            if (o.waiterName) stats[o.waiterName] = (stats[o.waiterName] || 0) + o.total;
        });
        return Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 5);
    }, [orders]);

    const cashTotal = orders.filter(o => o.paymentMethod === 'CASH' && (!o.source || o.source === 'DINE_IN' || o.source === 'TO_GO' || o.source === 'PICKUP' || o.source === 'DRIVE_THRU')).reduce((sum, o) => sum + o.total, 0);
    const cardTotal = orders.filter(o => o.paymentMethod === 'CARD' && (!o.source || o.source === 'DINE_IN' || o.source === 'TO_GO' || o.source === 'PICKUP' || o.source === 'DRIVE_THRU')).reduce((sum, o) => sum + o.total, 0);
    const transferTotal = orders.filter(o => o.paymentMethod === 'TRANSFER' && (!o.source || o.source === 'DINE_IN' || o.source === 'TO_GO' || o.source === 'PICKUP' || o.source === 'DRIVE_THRU')).reduce((sum, o) => sum + o.total, 0);
    
    const uberTotal = orders.filter(o => o.source === 'UBER_EATS').reduce((sum, o) => sum + o.total, 0);
    const didiTotal = orders.filter(o => o.source === 'DIDI').reduce((sum, o) => sum + o.total, 0);
    const rappiTotal = orders.filter(o => o.source === 'RAPPI').reduce((sum, o) => sum + o.total, 0);

    const cashflowData = useMemo(() => [
        { name: 'Efectivo Neto', amount: cashTotal - totalExpenses, date: 'Disponible', fill: '#10B981', note: 'En Caja (Tras Gastos)' },
        { name: 'Gastos Pagados', amount: totalExpenses, date: 'Liquidado', fill: '#EF4444', note: 'Salida de Caja' },
        { name: 'Tarjetas', amount: cardTotal, date: 'Día Siguiente', fill: '#6366F1', note: 'Ingreso Bancario' },
        { name: 'Transferencias', amount: transferTotal, date: 'Al Instante', fill: '#3B82F6', note: 'Ingreso Bancario' },
        { name: 'Uber Eats', amount: uberTotal, date: settings.uberPayoutDay || 'Lunes', fill: '#059669', note: 'Paga Aplicación' },
        { name: 'DiDi Food', amount: didiTotal, date: settings.didiPayoutDay || 'Martes', fill: '#F97316', note: 'Paga Aplicación' },
        { name: 'Rappi', amount: rappiTotal, date: 'Personalizado', fill: '#EAB308', note: settings.rappiPayoutNotes || 'Al sumar monto' },
    ].filter(item => Math.abs(item.amount) > 0), [cashTotal, cardTotal, transferTotal, uberTotal, didiTotal, rappiTotal, totalExpenses, settings]);

    const handlePrint = () => {
        window.print();
    };

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 print-manifest-container print:relative print:block print:h-auto print:inset-auto print:p-0">
            <style>{`
                @media print {
                    body { background: white !important; }
                    #root { display: none !important; }
                    .no-print { display: none !important; }
                    .print-manifest-container { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; height: auto !important; padding: 0 !important; margin: 0 !important; display: block !important; }
                    .printable-content { width: 100% !important; margin: 0 !important; padding: 0 !important; }
                }
            `}</style>
            {/* Backdrop - Manual backdrop instead of no-print on parent to avoid hiding everything in print */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm no-print" onClick={onClose} />
            
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 relative z-10 print:h-auto print:shadow-none print:rounded-none print:overflow-visible print:block print:max-w-none">
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
                <div id="financial-report" className="flex-1 overflow-y-auto p-12 bg-white print:p-0 print:overflow-visible print:block printable-content">
                    {/* Page 1: Executive Summary */}
                    <div className="max-w-4xl mx-auto print:max-w-none print:w-full">
                        <div className="flex justify-between items-start mb-12">
                            <div>
                                <h1 className="text-4xl font-black text-gray-900 tracking-tighter mb-2">{restaurantName.toUpperCase()}</h1>
                                <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-[10px]">Reporte Ejecutivo de Caja y Operaciones</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-gray-900">{periodLabel}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Generado: {new Date().toLocaleString()}</p>
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
                                        <td className="py-5 px-6 text-right font-medium text-amber-500">Delivery: ${orders.filter(o => o.source === 'UBER_EATS' || o.source === 'RAPPI').reduce((sum, o) => sum + (o.total || 0), 0).toLocaleString()}</td>
                                        <td className="py-5 px-6 text-right font-black text-primary">${totalSales.toLocaleString()}</td>
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

                        {/* Expenses Detail Section */}
                        {expenses.length > 0 && (
                           <div className="mb-16 print:break-inside-avoid">
                               <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Detalle de Gastos Operativos</h3>
                               <table className="w-full border-collapse border border-gray-100 rounded-2xl overflow-hidden">
                                   <thead>
                                       <tr className="bg-gray-50 border-b border-gray-100">
                                           <th className="text-left py-3 px-6 text-[9px] font-black text-gray-400 uppercase">Concepto / Descripción</th>
                                           <th className="text-left py-3 px-6 text-[9px] font-black text-gray-400 uppercase">Categoría</th>
                                           <th className="text-right py-3 px-6 text-[9px] font-black text-gray-400 uppercase">Monto Total</th>
                                       </tr>
                                   </thead>
                                   <tbody>
                                       {expenses.map((exp, idx) => (
                                           <tr key={exp.id || idx} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                               <td className="py-4 px-6 text-sm font-bold text-gray-800">{exp.description}</td>
                                               <td className="py-4 px-6">
                                                   <span className="text-[10px] font-black uppercase px-2 py-1 bg-gray-100 text-gray-500 rounded-md">
                                                       {exp.category}
                                                   </span>
                                               </td>
                                               <td className="py-4 px-6 text-right font-black text-red-500 text-sm">
                                                   -${exp.amount.toLocaleString()}
                                               </td>
                                           </tr>
                                       ))}
                                       <tr className="bg-red-50/30">
                                           <td colSpan={2} className="py-4 px-6 text-right text-[10px] font-black text-gray-400 uppercase">Total Gastos en Período</td>
                                           <td className="py-4 px-6 text-right font-black text-red-600 text-lg">
                                               -${totalExpenses.toLocaleString()}
                                           </td>
                                       </tr>
                                   </tbody>
                               </table>
                           </div>
                        )}

                        {/* Cashflow Map (Recharts) */}
                        <div className="mb-16 print:break-inside-avoid shadow-sm border border-gray-100 rounded-3xl p-8 bg-white">
                            <div className="flex justify-between items-end mb-8">
                                <div>
                                    <h3 className="text-[12px] font-black text-gray-800 uppercase tracking-[0.2em] mb-1">Flujo de Efectivo Proyectado</h3>
                                    <p className="text-sm font-bold text-gray-400">Distribución de ingresos por canales y días de compensación</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Proyectado</p>
                                    <p className="text-xl font-black text-gray-900">${cashflowData.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={cashflowData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 700 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 700 }} tickFormatter={(val) => `$${val}`} />
                                        <Tooltip 
                                            cursor={{ fill: '#F3F4F6' }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const data = payload[0].payload;
                                                    return (
                                                        <div className="bg-white p-4 shadow-xl rounded-2xl border border-gray-100">
                                                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{data.name}</p>
                                                            <p className="text-lg font-black text-gray-900 mb-2">${data.amount.toLocaleString()}</p>
                                                            <p className="text-xs font-bold text-primary flex items-center gap-1">
                                                                <span className="material-icons-round text-sm">event</span>
                                                                Día/Nota: {data.date}
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={60}>
                                            {cashflowData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-6 flex flex-wrap gap-4 pt-6 border-t border-gray-100">
                                {cashflowData.map(item => (
                                    <div key={item.name} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }}></div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-gray-800">{item.name}</p>
                                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider scale-90 origin-left">{item.date}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
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
                            <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">Solaris POS System — Finanzas Verificadas</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
