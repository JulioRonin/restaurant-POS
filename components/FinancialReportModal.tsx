import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Order, Expense } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { FileText, TrendingUp, Calendar, X, ChevronUp } from 'lucide-react';
import { SrButton, SrLabel, SrKicker, SrMono } from './ui/servirest';

interface FinancialReportProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  expenses: Expense[];
  periodLabel: string;
  categoryLabel: string;
  restaurantName: string;
}

/* Brand chart palette — only Sobremesa Lúcida + semantic tokens. */
const CHART_PALETTE = {
  cashNet:    '#22A06B', // success — efectivo neto
  expenses:   '#E1554B', // danger — gastos
  card:       '#C4633F', // terracota — tarjeta
  transfer:   '#A14C2D', // terracota-dark — transferencia
  uber:       '#C9A24A', // mostaza — uber
  didi:       '#2A2F42', // midnight-card — didi
  rappi:      '#1A1E2E', // midnight — rappi
};

export const FinancialReportModal: React.FC<FinancialReportProps> = ({
  isOpen, onClose, orders, expenses, periodLabel, categoryLabel, restaurantName,
}) => {
  const { settings } = useSettings();
  if (!isOpen) return null;

  const totalSales = orders.reduce((sum, o) => sum + o.total, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netFlow = totalSales - totalExpenses;
  const averageTicket = orders.length > 0 ? totalSales / orders.length : 0;

  const waiterStats = useMemo(() => {
    const stats: Record<string, number> = {};
    orders.forEach((o) => { if (o.waiterName) stats[o.waiterName] = (stats[o.waiterName] || 0) + o.total; });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [orders]);

  const counterSources = ['DINE_IN', 'TO_GO', 'PICKUP', 'DRIVE_THRU'];
  const cashTotal     = orders.filter((o) => o.paymentMethod === 'CASH'     && (!o.source || counterSources.includes(o.source))).reduce((s, o) => s + o.total, 0);
  const cardTotal     = orders.filter((o) => o.paymentMethod === 'CARD'     && (!o.source || counterSources.includes(o.source))).reduce((s, o) => s + o.total, 0);
  const transferTotal = orders.filter((o) => o.paymentMethod === 'TRANSFER' && (!o.source || counterSources.includes(o.source))).reduce((s, o) => s + o.total, 0);

  const uberTotal  = orders.filter((o) => o.source === 'UBER_EATS').reduce((s, o) => s + o.total, 0);
  const didiTotal  = orders.filter((o) => o.source === 'DIDI').reduce((s, o) => s + o.total, 0);
  const rappiTotal = orders.filter((o) => o.source === 'RAPPI').reduce((s, o) => s + o.total, 0);

  const cashflowData = useMemo(() => ([
    { name: 'Efectivo neto',  amount: cashTotal - totalExpenses, date: 'Disponible',                            fill: CHART_PALETTE.cashNet,   note: 'En caja (tras gastos)' },
    { name: 'Gastos',         amount: totalExpenses,             date: 'Liquidado',                             fill: CHART_PALETTE.expenses,  note: 'Salida de caja' },
    { name: 'Tarjeta',        amount: cardTotal,                 date: 'Día siguiente',                         fill: CHART_PALETTE.card,      note: 'Ingreso bancario' },
    { name: 'Transferencia',  amount: transferTotal,             date: 'Al instante',                           fill: CHART_PALETTE.transfer,  note: 'Ingreso bancario' },
    { name: 'Uber Eats',      amount: uberTotal,                 date: settings.uberPayoutDay || 'Lunes',       fill: CHART_PALETTE.uber,      note: 'Paga aplicación' },
    { name: 'DiDi Food',      amount: didiTotal,                 date: settings.didiPayoutDay || 'Martes',      fill: CHART_PALETTE.didi,      note: 'Paga aplicación' },
    { name: 'Rappi',          amount: rappiTotal,                date: 'Personalizado',                         fill: CHART_PALETTE.rappi,     note: settings.rappiPayoutNotes || 'Al sumar monto' },
  ]).filter((it) => Math.abs(it.amount) > 0), [cashTotal, cardTotal, transferTotal, uberTotal, didiTotal, rappiTotal, totalExpenses, settings]);

  const handlePrint = () => window.print();

  return createPortal(
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

      <div className="absolute inset-0 bg-[rgba(10,12,20,0.6)] backdrop-blur-md no-print" onClick={onClose} />

      <div className="bg-servirest-surface rounded-sr-2xl shadow-sr-modal w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden relative z-10 print:h-auto print:shadow-none print:rounded-none print:overflow-visible print:block print:max-w-none">
        {/* HEADER (no-print) */}
        <div className="px-8 py-6 border-b border-[rgba(42,40,38,0.08)] flex justify-between items-center bg-servirest-hueso-sunken/40 no-print">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-sr-md bg-servirest-midnight text-servirest-mostaza flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <SrKicker className="block mb-0.5">Vista previa de exportación</SrKicker>
              <h2 className="sr-h-brutal text-[20px] m-0">Reporte ejecutivo</h2>
            </div>
          </div>
          <div className="flex gap-2.5">
            <SrButton variant="outline" size="md" icon={<X size={14} />} onClick={onClose}>
              Cerrar
            </SrButton>
            <SrButton variant="primary" size="md" icon={<FileText size={14} />} onClick={handlePrint}>
              Descargar PDF
            </SrButton>
          </div>
        </div>

        {/* REPORT BODY */}
        <div id="financial-report" className="flex-1 overflow-y-auto custom-scrollbar p-12 bg-servirest-surface print:p-0 print:overflow-visible print:block printable-content">
          <div className="max-w-4xl mx-auto print:max-w-none print:w-full">
            {/* Title bar — editorial */}
            <div className="flex justify-between items-start mb-12 pb-8 border-b border-[rgba(42,40,38,0.12)]">
              <div>
                <SrKicker className="block mb-2">Reporte ejecutivo · Caja & operación</SrKicker>
                <h1 className="font-serif italic font-medium text-[48px] text-servirest-midnight tracking-[-0.02em] leading-[1.05] m-0">
                  {restaurantName}
                </h1>
              </div>
              <div className="text-right">
                <SrMono className="block text-servirest-midnight font-extrabold">{periodLabel}</SrMono>
                <span className="text-[10px] text-[rgba(42,40,38,0.4)] font-bold uppercase tracking-[0.2em] mt-1 block">
                  Generado {new Date().toLocaleString('es-MX')}
                </span>
              </div>
            </div>

            {/* Summary — period info + utility card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
              <div>
                <SrLabel className="block mb-4">Información del período</SrLabel>
                <div className="space-y-3">
                  {[
                    ['Rango', periodLabel],
                    ['Categoría', categoryLabel],
                    ['Total transacciones', String(orders.length)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-[rgba(42,40,38,0.08)] pb-2">
                      <span className="text-[13px] font-medium text-[rgba(42,40,38,0.6)]">{k}</span>
                      <span className="text-[13px] font-extrabold text-servirest-midnight">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-servirest-midnight text-servirest-hueso p-8 rounded-sr-2xl relative overflow-hidden">
                <SrLabel className="block mb-6" style={{ color: 'rgba(250,248,244,0.55)' }}>
                  Estado de utilidades
                </SrLabel>
                <div className="space-y-5">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-bold opacity-60">Ingreso bruto</span>
                    <span className="font-black italic text-[28px] tracking-[-0.02em]">${totalSales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-end border-t border-white/10 pt-5">
                    <span className="text-xs font-bold opacity-60">Flujo neto</span>
                    <span className="font-black italic text-[28px] tracking-[-0.02em] text-servirest-mostaza">
                      ${netFlow.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="absolute -right-6 -bottom-6 opacity-[0.07] pointer-events-none">
                  <TrendingUp size={140} />
                </div>
              </div>
            </div>

            {/* Financial breakdown */}
            <div className="mb-16">
              <SrLabel className="block mb-6">Desglose financiero (MXN)</SrLabel>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-servirest-hueso-sunken">
                    <th className="text-left py-4 px-6 text-[10px] font-black text-[rgba(42,40,38,0.6)] uppercase tracking-[0.18em]">Concepto</th>
                    <th className="text-right py-4 px-6 text-[10px] font-black text-[rgba(42,40,38,0.6)] uppercase tracking-[0.18em]">Bruto</th>
                    <th className="text-right py-4 px-6 text-[10px] font-black text-[rgba(42,40,38,0.6)] uppercase tracking-[0.18em]">Delivery</th>
                    <th className="text-right py-4 px-6 text-[10px] font-black text-[rgba(42,40,38,0.6)] uppercase tracking-[0.18em]">Neto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[rgba(42,40,38,0.08)]">
                    <td className="py-5 px-6 font-extrabold text-servirest-midnight">Ventas totales</td>
                    <td className="py-5 px-6 text-right"><SrMono>${totalSales.toLocaleString()}</SrMono></td>
                    <td className="py-5 px-6 text-right">
                      <SrMono className="text-servirest-mostaza">
                        ${orders.filter((o) => o.source === 'UBER_EATS' || o.source === 'RAPPI').reduce((s, o) => s + (o.total || 0), 0).toLocaleString()}
                      </SrMono>
                    </td>
                    <td className="py-5 px-6 text-right">
                      <SrMono className="text-servirest-terracota text-[16px]">${totalSales.toLocaleString()}</SrMono>
                    </td>
                  </tr>
                  <tr className="border-b border-[rgba(42,40,38,0.08)]">
                    <td className="py-5 px-6 font-extrabold text-servirest-midnight">Gastos operativos</td>
                    <td className="py-5 px-6 text-right"><SrMono>${totalExpenses.toLocaleString()}</SrMono></td>
                    <td className="py-5 px-6 text-right text-[rgba(42,40,38,0.4)]"><SrMono>—</SrMono></td>
                    <td className="py-5 px-6 text-right"><SrMono className="text-servirest-danger">−${totalExpenses.toLocaleString()}</SrMono></td>
                  </tr>
                  <tr className="bg-[rgba(196,99,63,0.06)]">
                    <td className="py-6 px-6 font-black italic text-servirest-midnight text-[16px]">Balance final</td>
                    <td colSpan={2}></td>
                    <td className="py-6 px-6 text-right">
                      <span className="font-black italic text-[28px] text-servirest-terracota tracking-[-0.03em]">
                        ${netFlow.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Expenses detail */}
            {expenses.length > 0 && (
              <div className="mb-16 print:break-inside-avoid">
                <SrLabel className="block mb-6">Detalle de gastos</SrLabel>
                <table className="w-full border-collapse border border-[rgba(42,40,38,0.08)] rounded-sr-lg overflow-hidden">
                  <thead>
                    <tr className="bg-servirest-hueso-sunken border-b border-[rgba(42,40,38,0.08)]">
                      <th className="text-left py-3 px-6 text-[10px] font-black text-[rgba(42,40,38,0.6)] uppercase tracking-[0.18em]">Concepto</th>
                      <th className="text-left py-3 px-6 text-[10px] font-black text-[rgba(42,40,38,0.6)] uppercase tracking-[0.18em]">Categoría</th>
                      <th className="text-right py-3 px-6 text-[10px] font-black text-[rgba(42,40,38,0.6)] uppercase tracking-[0.18em]">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp, idx) => (
                      <tr key={exp.id || idx} className="border-b border-[rgba(42,40,38,0.05)] hover:bg-servirest-hueso-sunken/40 transition-colors">
                        <td className="py-4 px-6 text-sm font-extrabold text-servirest-midnight">{exp.description}</td>
                        <td className="py-4 px-6">
                          <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-[rgba(42,40,38,0.05)] text-[rgba(42,40,38,0.6)] rounded-md tracking-[0.12em]">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <SrMono className="text-servirest-danger">−${exp.amount.toLocaleString()}</SrMono>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[rgba(225,85,75,0.04)]">
                      <td colSpan={2} className="py-4 px-6 text-right text-[10px] font-black text-[rgba(42,40,38,0.6)] uppercase tracking-[0.2em]">Total gastos del período</td>
                      <td className="py-4 px-6 text-right">
                        <span className="font-black italic text-[18px] text-servirest-danger">−${totalExpenses.toLocaleString()}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Cashflow chart */}
            <div className="mb-16 print:break-inside-avoid border border-[rgba(42,40,38,0.08)] rounded-sr-2xl p-8 bg-servirest-surface shadow-sr-card">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <SrKicker className="block mb-1">Tesorería</SrKicker>
                  <h3 className="sr-h-brutal text-[19px] m-0">Flujo de efectivo por canal</h3>
                  <p className="text-[13px] text-[rgba(42,40,38,0.6)] font-medium mt-1.5">Distribución por método y días de compensación</p>
                </div>
                <div className="text-right">
                  <SrLabel className="block mb-1">Total proyectado</SrLabel>
                  <span className="font-black italic text-[26px] text-servirest-midnight tracking-[-0.02em]">
                    ${cashflowData.reduce((acc, c) => acc + c.amount, 0).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashflowData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(42,40,38,0.08)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#2A2826', fontSize: 11, fontWeight: 700, opacity: 0.6 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#2A2826', fontSize: 11, fontWeight: 700, opacity: 0.6 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      cursor={{ fill: 'rgba(196,99,63,0.05)' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload as any;
                          return (
                            <div className="sr-card p-4 max-w-[220px]">
                              <SrLabel className="block mb-1">{data.name}</SrLabel>
                              <SrMono className="block text-base text-servirest-midnight font-extrabold mb-2">
                                ${Number(data.amount).toLocaleString()}
                              </SrMono>
                              <p className="text-[11px] font-bold text-servirest-terracota flex items-center gap-1.5">
                                <Calendar size={11} /> {data.date}
                              </p>
                              <p className="text-[10px] text-[rgba(42,40,38,0.6)] font-medium mt-1">{data.note}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {cashflowData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 flex flex-wrap gap-4 pt-6 border-t border-[rgba(42,40,38,0.08)]">
                {cashflowData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-servirest-midnight">{item.name}</p>
                      <p className="text-[9px] font-bold text-[rgba(42,40,38,0.4)] uppercase tracking-[0.1em]">{item.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance — staff + KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <SrLabel className="block mb-6">Top meseros por ventas</SrLabel>
                <div className="space-y-4">
                  {waiterStats.map(([name, total], i) => (
                    <div key={name} className="flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-sr-md bg-servirest-hueso-sunken flex items-center justify-center font-black italic text-[14px] text-servirest-terracota">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-extrabold text-servirest-midnight">{name}</span>
                          <SrMono className="text-servirest-midnight font-bold">${total.toLocaleString()}</SrMono>
                        </div>
                        <div className="w-full bg-[rgba(42,40,38,0.08)] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-servirest-terracota h-full transition-all duration-700"
                            style={{ width: `${(total / (waiterStats[0]?.[1] || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {waiterStats.length === 0 && (
                    <p className="text-[12px] text-[rgba(42,40,38,0.4)] font-medium italic">Sin datos suficientes para este período.</p>
                  )}
                </div>
              </div>

              <div>
                <SrLabel className="block mb-6">Indicadores operativos</SrLabel>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="bg-servirest-hueso-sunken p-5 rounded-sr-lg border border-[rgba(42,40,38,0.08)]">
                    <SrLabel className="block mb-1.5">Ticket promedio</SrLabel>
                    <span className="font-black italic text-[22px] text-servirest-midnight tracking-[-0.02em]">
                      ${averageTicket.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-servirest-hueso-sunken p-5 rounded-sr-lg border border-[rgba(42,40,38,0.08)]">
                    <SrLabel className="block mb-1.5">Pedidos</SrLabel>
                    <span className="font-black italic text-[22px] text-servirest-midnight tracking-[-0.02em]">
                      {orders.length}
                    </span>
                  </div>
                  <div className="bg-servirest-hueso-sunken p-5 rounded-sr-lg border border-[rgba(42,40,38,0.08)] col-span-2">
                    <SrLabel className="block mb-1.5">Mix de canales</SrLabel>
                    <div className="flex flex-wrap gap-2 text-[11px] font-bold mt-2">
                      <span className="font-mono"><span className="text-[rgba(42,40,38,0.6)]">Mesa:</span> ${(cashTotal + cardTotal + transferTotal).toLocaleString()}</span>
                      <span className="text-[rgba(42,40,38,0.3)]">·</span>
                      <span className="font-mono"><span className="text-[rgba(42,40,38,0.6)]">Delivery:</span> ${(uberTotal + didiTotal + rappiTotal).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-20 pt-8 border-t border-[rgba(42,40,38,0.08)] text-center">
              <p className="text-[10px] font-black text-[rgba(42,40,38,0.3)] uppercase tracking-[0.3em]">
                ServiRest — Reporte verificado · Aliados del rubro
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
