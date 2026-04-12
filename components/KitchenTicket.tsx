import React from 'react';
import { Order, OrderItem } from '../types';
import { BusinessSettings } from '../contexts/SettingsContext';

interface KitchenTicketProps {
  order: Order;
  settings: BusinessSettings;
}

export const KitchenTicket: React.FC<KitchenTicketProps> = ({ order, settings }) => {
  if (!settings) return null;
  const is58mm = settings.printerWidth === '58mm';
  
  // High-precision dimensions for thermal rolls
  const paperWidth = is58mm ? '58mm' : '80mm';
  const printableWidth = is58mm ? '48mm' : '72mm';
  const fontSize = is58mm ? 'text-[10px]' : 'text-sm';
  
  return (
    <div className={`print-only-content bg-white text-[#000] p-0 font-mono ${fontSize} leading-tight w-[${printableWidth}] text-left`}>
      {/* Kitchen Header */}
      <div className="flex flex-col items-center text-center mb-4 border-b-2 border-black pb-2">
        {order.source && order.source !== 'DINE_IN' && (
          <div className="bg-black text-white px-2 py-1 mb-2 w-full text-center">
             <span className="text-xl font-black italic">*** {order.source.replace('_', ' ')} ***</span>
          </div>
        )}
        <h1 className="text-3xl font-black">{order.tableId}</h1>
        <p className="text-xs font-bold uppercase tracking-tighter">ORDEN: #{order.id.slice(0,8)}</p>
        <div className="flex justify-center gap-2 items-center w-full mt-1 px-1 font-bold text-[10px]">
          <span>{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span>|</span>
          <span>{order.waiterName || 'Mesero'}</span>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-4">
        {order.items.map((item: OrderItem, idx: number) => (
          <div key={idx} className="border-b border-black border-dotted pb-2">
            <div className="flex items-start gap-2">
              <span className="text-2xl font-black bg-black text-white px-2 py-0.5 min-w-[32px] text-center">
                {item.quantity}
              </span>
              <div className="flex-1">
                <span className="text-lg font-black uppercase leading-none block">{item.name}</span>
                
                {/* Notes are critical for Kitchen */}
                {item.notes && (
                  <div className="mt-1 p-1 border-2 border-black bg-gray-50 font-black">
                    <p className="text-[9px]">*** NOTAS ***</p>
                    <p className="text-[11px] leading-tight">{item.notes.toUpperCase()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer for kitchen */}
      <div className="mt-4 text-center border-t-2 border-black pt-2 pb-8">
        <p className="text-[10px] font-bold">--- FIN DE COMANDA ---</p>
        <p className="text-[8px] mt-1 tabular-nums italic text-gray-500">{new Date().toLocaleString()}</p>
      </div>

      <style>{`
        @media print {
          @page { 
            margin: 0 !important; 
            size: ${paperWidth} auto !important; 
          }
          html, body { 
            margin: 0 !important; 
            padding: 0 !important;
            background: #fff !important;
          }
          /* Prevent system headers/footers */
          header, footer { display: none !important; }
        }
      `}</style>
    </div>
  );
};
