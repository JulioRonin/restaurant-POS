import React, { useState } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { SubscriptionStatus } from '../types';

export const SubscriptionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isExpired, daysRemaining, status, paySubscription } = useSubscription();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRenew = async () => {
    setIsProcessing(true);
    await paySubscription();
    setIsProcessing(false);
  };

  if (isExpired) {
    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center p-6 overflow-hidden">
        {/* Background Aura */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] opacity-50 animate-pulse"></div>
        
        <div className="relative bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[40px] p-12 max-w-lg w-full text-center shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-red-500/20 border border-red-500/50 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
            <span className="material-icons-round text-5xl text-red-500">lock</span>
          </div>
          
          <h1 className="text-4xl font-black text-white mb-4 tracking-tight">Suscripción Vencida</h1>
          <p className="text-slate-300 text-lg mb-10 leading-relaxed font-medium">
            Tu licencia de <span className="text-primary font-bold">Culinex POS</span> ha expirado. Por favor, realiza tu pago mensual de **$965.00 MXN** para continuar operando tu negocio.
          </p>

          <div className="bg-slate-800/50 rounded-2xl p-6 mb-10 border border-white/5">
             <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Costo Mensual</span>
                <span className="text-white font-black text-xl">$965.00 MXN</span>
             </div>
             <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div className="bg-red-500 h-full w-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
             </div>
          </div>

          <button
            onClick={handleRenew}
            disabled={isProcessing}
            className={`w-full py-5 bg-primary hover:bg-blue-600 text-white rounded-2xl font-black text-xl shadow-2xl shadow-primary/30 transition-all active:scale-95 flex items-center justify-center gap-3 ${isProcessing ? 'opacity-80' : ''}`}
          >
            {isProcessing ? (
              <>
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                Procesando Pago...
              </>
            ) : (
              <>
                <span className="material-icons-round">payments</span>
                PAGAR Y RENOVAR AHORA
              </>
            )}
          </button>
          
          <p className="mt-8 text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
             <span className="material-icons-round text-sm">verified_user</span> Transacción Segura by Ronin Studio
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
