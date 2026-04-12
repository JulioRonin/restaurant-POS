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
  const widthClass = is58mm ? 'w-[48mm]' : 'w-[72mm]';
  const fontSize = is58mm ? 'text-[10px]' : 'text-sm';
  
  return (
    <div className={`bg-white text-black p-0 font-mono ${fontSize} leading-tight ${widthClass} mx-auto print:mx-auto print:w-[48mm]`}>
      {/* Kitchen Header */}
      <div className="flex flex-col items-center text-center mb-4 border-b-2 border-black pb-2">
        {order.source && order.source !== 'DINE_IN' && (
          <div className="bg-black text-white px-4 py-1 mb-2 w-full text-center">
             <span className="text-xl font-black">*** {order.source.replace('_', ' ')} ***</span>
          </div>
        )}
        <h1 className="text-3xl font-black">{order.tableId}</h1>
        <p className="text-sm font-bold uppercase">ORDEN: #{order.id}</p>
        <div className="flex justify-center gap-2 items-center w-full mt-1 px-1 font-bold text-[11px]">
          <span>{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <span>|</span>
          <span>{order.waiterName || 'Mesero'}</span>
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {order.items.map((item: OrderItem, idx: number) => (
          <div key={idx} className="border-b border-black border-dotted pb-2">
            <div className="flex items-start gap-2">
              <span className="text-2xl font-black bg-black text-white px-2 py-0.5 min-w-[30px] text-center">
                {item.quantity}
              </span>
              <div className="flex-1">
                <span className="text-lg font-black uppercase leading-none">{item.name}</span>
                
                {/* Notes are critical for Kitchen */}
                {item.notes && (
                  <div className="mt-1 p-1 border-2 border-black bg-gray-100 font-black">
                    <p className="text-xs">*** NOTA ***</p>
                    <p className="text-sm">{item.notes.toUpperCase()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer for kitchen */}
      <div className="mt-4 text-center border-t-2 border-black pt-2">
        <p className="text-[10px] font-bold">--- FIN DE COMANDA ---</p>
        <p className="text-[9px] mt-1">Culinex POS</p>
        <p className="text-[9px]">Ronin Studio</p>
      </div>

      <style>{`
        @media print {
          @page { margin: 0; size: auto; }
          body { background: white; margin: 0; padding: 0; }
        }
      `}</style>
    </div>
  );
};
