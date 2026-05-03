import React from 'react';
import { Order, OrderItem } from '../types';
import { BusinessSettings } from '../contexts/SettingsContext';

interface TicketProps {
  order: Order;
  settings: BusinessSettings;
  isTest?: boolean;
}

export const Ticket: React.FC<TicketProps> = ({ order, settings, isTest = false }) => {
  const is58mm = settings.printerWidth === '58mm';
  // Use 44mm for 58mm paper to be extremely safe with margins
  const widthClass = is58mm ? 'w-[44mm]' : 'w-[72mm]';
  const fontSize = is58mm ? 'text-[8px]' : 'text-sm';
  const padding = is58mm ? 'p-0' : 'p-4';
  
  const taxIVA = 0;
  const subtotal = (order.total - (order.tip || 0));

  return (
    <div className={`bg-white text-black ${padding} font-mono ${fontSize} leading-tight ${widthClass} mx-auto print:mx-auto print:w-[48mm]`}>
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-4 w-full">
        <h1 className="text-[12px] font-black uppercase leading-tight">{settings.name}</h1>
        <p className="text-[10px] font-bold">{settings.legalName}</p>
        <p className="text-[9px] opacity-70">{settings.rfc}</p>
        <p className="text-[9px] mt-1 line-clamp-1">{settings.address}</p>
        <p className="text-[9px] font-bold">{settings.phone}</p>
      </div>

      <div className="border-t border-b border-black border-dashed py-2 mb-4">
        <div className="flex justify-between">
          <span>ORDEN:</span>
          <span className="font-bold">#{order.dailyNumber !== undefined ? String(order.dailyNumber).padStart(6, '0') : order.id.slice(-6).toUpperCase()}</span>
        </div>
        <div className="flex justify-between">
          <span>FECHA:</span>
          <span>{new Date(order.timestamp).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between">
          <span>HORA:</span>
          <span>{new Date(order.timestamp).toLocaleTimeString()}</span>
        </div>
        {order.tableId && (
          <div className="flex justify-between">
            <span>MESA:</span>
            <span>{order.tableId}</span>
          </div>
        )}
        {order.waiterName && (
          <div className="flex justify-between">
            <span>MESERO:</span>
            <span>{order.waiterName}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="mb-4">
        <div className="flex font-bold border-b border-black mb-1">
          <span className="w-8">CANT</span>
          <span className="flex-1">DESCRIPCION</span>
          <span className="w-16 text-right">TOTAL</span>
        </div>
        {order.items.map((item: OrderItem, idx: number) => (
          <div key={idx} className="flex">
            <span className="w-8">{item.quantity}</span>
            <span className="flex-1 uppercase">{item.name}</span>
            <span className="w-16 text-right">${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t border-black pt-2 mb-4">
        <div className="flex justify-between">
          <span>SUBTOTAL:</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        {/* IVA deshabilitado por solicitud de usuario */}
        {/* <div className="flex justify-between">
          <span>IVA (16%):</span>
          <span>${taxIVA.toFixed(2)}</span>
        </div> */}
        {order.tip && (
          <div className="flex justify-between">
            <span>PROPINA:</span>
            <span>${order.tip.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-bold">
          <span>TOTAL:</span>
          <span>${order.total.toFixed(2)}</span>
        </div>
        {/* <p className="text-[8px] text-center mt-1 opacity-60">PRECIOS INCLUYEN IVA</p> */}

        {order.receivedAmount !== undefined && order.receivedAmount > 0 && (
          <>
            <div className="flex justify-between mt-2 pt-2 border-t border-black border-dotted">
              <span>EFECTIVO:</span>
              <span>${order.receivedAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>CAMBIO:</span>
              <span>${(order.changeAmount || 0).toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      {/* Payment Info */}
      {order.paymentMethod && (
          <div className="text-center mb-4">
             <p className="text-xs uppercase">PAGO: {order.paymentMethod}</p>
          </div>
      )}

      {/* Footer */}
      <div className="flex flex-col items-center text-center border-t border-black border-dashed pt-4 mt-4">
        <p className="font-bold">{settings.footerMessage}</p>
        <p className="text-[10px] font-bold">--- FIN DE COMANDA ---</p>
        <p className="text-[9px] mt-1">KŌSO POS</p>
        <p className="text-[9px]">Ronin Studio</p>
        {isTest && (
          <div className="mt-4 border border-black p-1 w-full max-w-[40mm]">
             <p className="text-[8px] font-bold">--- REGLA DE CALIBRACION ---</p>
             <p className="text-[9px] break-all">123456789012345678901234567890</p>
             <p className="text-[8px]">Verifica que los nmeros no se corten</p>
          </div>
        )}
      </div>

      {/* Print-only CSS to force receipt style */}
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            background: white;
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
