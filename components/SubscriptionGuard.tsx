import React, { useState } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useUser } from '../contexts/UserContext';

export const SubscriptionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status, refreshFeatures } = useSubscription();
  const { authProfile } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRealPayment = () => {
    setIsProcessing(true);
    // Redirección al Enlace de Pago Seguro de Stripe, pasando el businessId al webhook
    const cleanId = authProfile?.businessId || '';
    window.location.href = `https://buy.stripe.com/test_3cIcMY0uodDXb4P3S6ffy00?client_reference_id=${encodeURIComponent(cleanId)}`;
  };

  const handleVerifyPayment = async () => {
    setIsProcessing(true);
    try {
        await refreshFeatures();
        
        // El estado se actualizará de forma asíncrona por el contexto y se ocultará automáticamente este modal si pago fue detectado.
        // Simularemos una pequeña espera y mostraremos alerta si aún no es reactivado por el context
        setTimeout(() => {
             // Validar forzando recarga o solo alertando. Si la BD tiene el pago, la prop 'status' cambiará y este componente dejará de renderizarse.
             alert("Hemos consultado el servidor. Si tu pago ya fue procesado, esta pantalla se cerrará automáticamente en breve.");
        }, 800);
        
    } catch (err: any) {
        alert(`DETALLES DEL ERROR:\n${err.message || 'Error desconocido'}`);
    } finally {
        setIsProcessing(false);
    }
  };

  if (status === 'ACTIVE') return <>{children}</>;

  const isExpired = status === 'EXPIRED';
  const isEquipmentDebt = status === 'DEBT_BLOCKED';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950 overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-20%] left-[-10%] w-[60%] h-[60%] ${isEquipmentDebt ? 'bg-amber-600/20' : 'bg-red-600/20'} rounded-full blur-[150px] animate-pulse`}></div>
        <div className={`absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] ${isEquipmentDebt ? 'bg-amber-600/10' : 'bg-red-600/10'} rounded-full blur-[150px]`}></div>
      </div>

      <div className="relative w-full max-w-lg mx-auto p-4 animate-fadeIn">
        <div className="bg-slate-900 border border-white/10 rounded-[48px] shadow-2xl p-10 backdrop-blur-xl flex flex-col items-center text-center">
          <div className={`w-24 h-24 ${isEquipmentDebt ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'} rounded-full flex items-center justify-center mb-8 border border-white/10 shadow-inner`}>
            <span className="material-icons-round text-5xl">{isEquipmentDebt ? 'credit_card_off' : 'lock'}</span>
          </div>

          <div>
            <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">
                {isExpired ? 'Suscripción Vencida' : 'Adeudo de Equipo'}
            </h2>
            <p className={`${isExpired ? 'text-red-200' : 'text-amber-200'} mb-8 font-bold uppercase text-[10px] tracking-[0.2em] opacity-70 leading-relaxed`}>
                {isExpired 
                    ? "Tu licencia de Solaris POS ha expirado. \n Regulariza tu pago mensual para continuar operando."
                    : "Detectamos un atraso en el pago de tu hardware. \n Regulariza tu saldo para desbloquear la estación."
                }
            </p>

            <div className="space-y-4 w-full">
                <button 
                  onClick={handleRealPayment}
                  disabled={isProcessing}
                  className={`w-full ${isExpired ? 'bg-white text-red-600' : 'bg-amber-500 text-black'} font-black py-5 rounded-[24px] flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-lg group`}
                >
                  {isProcessing ? (
                     <div className={`w-6 h-6 border-4 ${isExpired ? 'border-red-200 border-t-red-600' : 'border-amber-800/30 border-t-black'} rounded-full animate-spin`}></div>
                  ) : (
                    <>
                      <span className="material-icons-round transition-transform group-hover:rotate-12">payments</span>
                      {isExpired ? 'PAGAR SUSCRIPCIÓN (STRIPE)' : 'LIQUIDAR ADEUDO (STRIPE)'}
                    </>
                  )}
                </button>

                <button 
                  onClick={handleVerifyPayment}
                  disabled={isProcessing}
                  className="w-full bg-white/10 text-white font-black py-5 rounded-[24px] hover:bg-white/20 transition-all border-2 border-white/20 shadow-xl flex items-center justify-center gap-3 active:scale-95"
                >
                  {isProcessing ? (
                     <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : 'VERIFICAR PAGO EN LA NUBE'}
                </button>
            </div>

            {/* Technical Diagnostic Info */}
            <div className="mt-8 pt-6 border-t border-white/10 text-center">
              <p className="text-[10px] text-white/30 font-mono tracking-tighter uppercase mb-1">Diagnóstico del Sistema</p>
              <code className="text-[9px] text-white/40 bg-black/20 px-2 py-1 rounded">
                Status: {status} | User: {authProfile?.businessId ? `ID:${authProfile.businessId.slice(0, 8)}...` : 'Sin Perfil'}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
