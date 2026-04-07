import React from 'react';
import { Order, Expense } from '../types';
import { BusinessSettings } from '../contexts/SettingsContext';

interface CashCutTicketProps {
  orders: Order[];
  metrics: {
    totalRevenue: number;
    cashSales: number;
    cardSales: number;
    mixedSales: number;
    deliverySales: number;
    categoryBreakdown: Record<string, number>;
  };
  expenses: Expense[];
  totalExpenses: number;
  settings: BusinessSettings;
}

export const CashCutTicket: React.FC<CashCutTicketProps> = ({ 
  orders, 
  metrics, 
  expenses, 
  totalExpenses, 
  settings 
}) => {
  const is58mm = settings.printerWidth === '58mm';
  const widthClass = is58mm ? 'w-[44mm]' : 'w-[72mm]';
  const fontSize = is58mm ? 'text-[9px]' : 'text-sm';
  const padding = is58mm ? 'p-0' : 'p-4';

  return (
    <div className={`bg-white text-black ${padding} font-mono ${fontSize} leading-tight ${widthClass} mx-auto print:mx-auto print:w-[48mm]`}>
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-6 w-full">
        <h1 className="text-[14px] font-black uppercase leading-tight">{settings.name}</h1>
        <p className="text-[10px] font-bold">CORTE DE CAJA</p>
        <p className="text-[9px] opacity-70">{new Date().toLocaleString()}</p>
      </div>

      {/* Metrics Summary */}
      <div className="border-t border-b border-black border-dashed py-3 mb-4">
        <div className="flex justify-between font-bold">
          <span>INGRESOS (BRUTO):</span>
          <span>${metrics.totalRevenue.toFixed(2)}</span>
        </div>
        <div className="flex justify-between pl-2 pb-1">
          <span>- EFECTIVO:</span>
          <span>${metrics.cashSales.toFixed(2)}</span>
        </div>
        <div className="flex justify-between pl-2">
          <span>- TARJETA:</span>
          <span>${metrics.cardSales.toFixed(2)}</span>
        </div>
        <div className="flex justify-between pl-2 pb-1">
          <span>- DELIVERY:</span>
          <span>${metrics.deliverySales.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold mt-2">
          <span>GASTOS (CONTADO):</span>
          <span className="text-red-600">-${totalExpenses.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-[14px] font-black border-t border-black mt-2 pt-2">
          <span>FLUJO NETO:</span>
          <span>${(metrics.totalRevenue - totalExpenses).toFixed(2)}</span>
        </div>
      </div>

      {/* Detailed Orders List */}
      <div className="mb-6">
        <div className="text-center font-bold mb-2 p-1 bg-gray-100 uppercase text-[10px]">Detalle de Ventas</div>
        <div className="flex font-bold border-b border-black mb-1 text-[10px]">
          <span className="w-12">ID</span>
          <span className="flex-1">MESA/REF</span>
          <span className="w-16 text-right">MONTO</span>
        </div>
        {orders.map((order, idx) => (
          <div key={idx} className="flex border-b border-gray-100 py-1">
            <span className="w-12">#{order.id.slice(-4)}</span>
            <span className="flex-1 uppercase truncate pr-1">{order.tableId || 'VENTA'}</span>
            <span className="w-16 text-right font-bold">${order.total.toFixed(2)}</span>
          </div>
        ))}
        {/* Orders Total Summation */}
        <div className="flex justify-between font-black mt-2 pt-2 border-t-2 border-black">
          <span>SUMA TOTAL:</span>
          <span>${metrics.totalRevenue.toFixed(2)}</span>
        </div>
        <p className="text-[8px] text-center mt-1 opacity-50 italic">Total acumulado de órdenes finalizadas</p>
      </div>

      {/* Expenses Summary (Optional if long list) */}
      {expenses.length > 0 && (
          <div className="mb-6">
             <div className="text-center font-bold mb-2 p-1 bg-gray-100 uppercase text-[10px]">Detalle de Gastos</div>
             {expenses.map((exp, idx) => (
                 <div key={idx} className="flex justify-between py-0.5">
                    <span className="flex-1 truncate pr-2 text-[8px]">{exp.description.toUpperCase()}</span>
                    <span className="w-16 text-right">-${exp.amount.toFixed(2)}</span>
                 </div>
             ))}
          </div>
      )}

      {/* Footer */}
      <div className="flex flex-col items-center text-center border-t border-black border-dashed pt-4 mt-6">
        <p className="text-[10px] font-bold">--- CIERRE DE TURNO ---</p>
        <p className="text-[9px] mt-1">Soporte: Ronin Studio</p>
        <p className="text-[9px]">Culinex POS</p>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page { margin: 0; }
          body { background: white; margin: 0; padding: 0; }
        }
      `}</style>
    </div>
  );
};
