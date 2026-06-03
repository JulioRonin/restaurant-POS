import React, { useState } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useUser } from '../contexts/UserContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, CreditCard, RefreshCw, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';
import { SrCard, SrButton, SrLabel, SrKicker, SrMono, SrAlert, SrSpinner } from './ui/servirest';

export const SubscriptionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    status, refreshFeatures, paySubscription,
    isInGracePeriod, gracePeriodDaysLeft, daysPastExpiry, daysRemaining,
  } = useSubscription();
  const { authProfile } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [graceDismissed, setGraceDismissed] = useState(false);

  const handlePay = async () => {
    setIsProcessing(true);
    const ok = await paySubscription();
    if (!ok) setIsProcessing(false);
  };

  const handleVerify = async () => {
    setIsProcessing(true);
    try {
      await refreshFeatures();
      setTimeout(() => {
        alert('Consultamos tu pago en la nube. Si ya quedó, esta pantalla se cerrará en unos segundos.');
      }, 800);
    } catch (err: any) {
      alert(`Detalles del error:\n${err.message || 'Error desconocido'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  /* ─── ACTIVE ─────────────────────────────────────────────────────────── */
  if (status === 'ACTIVE' || status === 'DEMO') {
    // Grace-period reminder banner — visible across all routes for 5 days
    // after expiry. Operator keeps full access; the banner is informational
    // but persistent (only collapsible per-session).
    return (
      <>
        {isInGracePeriod && !graceDismissed && (
          <GraceBanner
            daysLeft={gracePeriodDaysLeft}
            daysPast={daysPastExpiry}
            onPay={handlePay}
            onDismiss={() => setGraceDismissed(true)}
            isProcessing={isProcessing}
          />
        )}
        {children}
      </>
    );
  }

  /* ─── BLOCKED STATES ─────────────────────────────────────────────────── */
  const isExpired = status === 'EXPIRED';
  const isDemoExpired = status === 'DEMO_EXPIRED';
  const isEquipmentDebt = status === 'DEBT_BLOCKED';

  // Copy varies per blocked state but the screen structure stays the same.
  const messages = isDemoExpired
    ? {
        kicker: 'Tu demo terminó',
        title: 'Listo para seguir vendiendo',
        body: 'Tu prueba gratuita de 20 días llegó a su fin. Activa un plan para que sigas operando sin perder ningún dato.',
        primaryCta: 'Suscribirme',
        icon: <ShieldCheck size={32} />,
        tone: 'mostaza' as const,
      }
    : isEquipmentDebt
    ? {
        kicker: 'Equipo POS pendiente',
        title: 'Tienes un pago de equipo atrasado',
        body: 'Para desbloquear tu estación, regulariza el saldo de tu equipo POS. Tu software queda intacto — solo bloqueamos la operación hasta cubrir el adeudo.',
        primaryCta: 'Pagar equipo',
        icon: <CreditCard size={32} />,
        tone: 'mostaza' as const,
      }
    : {
        kicker: 'Tu plan venció',
        title: 'Renueva para seguir operando',
        body:
          daysPastExpiry > 0
            ? `Pasaron ${daysPastExpiry} días desde tu fecha de pago. Renueva ahora y regresas a operación en menos de un minuto.`
            : 'Tu plan ServiRest expiró. Renueva ahora y regresas a operación en menos de un minuto.',
        primaryCta: 'Renovar suscripción',
        icon: <Lock size={32} />,
        tone: 'danger' as const,
      };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden p-4"
      style={{ background: 'linear-gradient(160deg, #1A1E2E 0%, #232839 60%, #1A1E2E 100%)' }}
    >
      {/* Ambient color wash so the brand still feels warm even at the lock */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
        <div
          className={`absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full blur-[150px] animate-pulse ${
            messages.tone === 'danger' ? 'bg-servirest-danger/20' : 'bg-servirest-mostaza/20'
          }`}
        />
        <div
          className={`absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[150px] ${
            messages.tone === 'danger' ? 'bg-servirest-danger/10' : 'bg-servirest-mostaza/10'
          }`}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <SrCard variant="solaris" className="p-10 flex flex-col items-center text-center bg-servirest-surface">
          {/* Icon halo */}
          <div className="relative mb-7">
            <div
              className={`absolute inset-0 rounded-full blur-2xl ${
                messages.tone === 'danger' ? 'bg-servirest-danger/30' : 'bg-servirest-mostaza/30'
              }`}
              aria-hidden="true"
            />
            <div
              className={`relative w-20 h-20 rounded-full flex items-center justify-center ${
                messages.tone === 'danger'
                  ? 'bg-[rgba(225,85,75,0.10)] text-servirest-danger border border-servirest-danger/30'
                  : 'bg-[rgba(201,162,74,0.12)] text-servirest-mostaza border border-servirest-mostaza/40'
              }`}
            >
              {messages.icon}
            </div>
          </div>

          <SrKicker className="block mb-2">{messages.kicker}</SrKicker>
          <h2 className="font-serif italic font-medium text-[32px] text-servirest-midnight tracking-[-0.02em] m-0 mb-3 leading-tight">
            {messages.title}
          </h2>
          <p className="text-[14px] text-[rgba(42,40,38,0.7)] font-medium leading-relaxed m-0 mb-8 max-w-sm">
            {messages.body}
          </p>

          <div className="w-full space-y-3">
            <SrButton
              variant="primary"
              size="lg"
              fullWidth
              icon={isProcessing ? <SrSpinner size={16} /> : <CreditCard size={16} />}
              onClick={handlePay}
              disabled={isProcessing}
            >
              {isProcessing ? 'Conectando…' : messages.primaryCta}
            </SrButton>

            <SrButton
              variant="outline"
              size="md"
              fullWidth
              icon={<RefreshCw size={14} />}
              onClick={handleVerify}
              disabled={isProcessing}
            >
              {isProcessing ? 'Verificando…' : 'Ya pagué, verifica de nuevo'}
            </SrButton>
          </div>

          {/* Diagnostic footer — small, mono, helpful when calling support */}
          <div className="w-full mt-8 pt-6 border-t border-[rgba(42,40,38,0.10)]">
            <SrLabel className="block mb-2">Diagnóstico</SrLabel>
            <SrMono className="text-[10px] text-[rgba(42,40,38,0.5)]">
              {status} · {authProfile?.businessId
                ? `ID ${authProfile.businessId.slice(0, 8)}…`
                : 'Sin perfil'}
            </SrMono>
          </div>
        </SrCard>

        <p className="text-center mt-6 text-[10px] font-black uppercase tracking-[0.4em] text-servirest-hueso/40">
          ServiRest · Aliados del rubro
        </p>
      </motion.div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* GraceBanner — top banner shown while in the 5-day grace window              */
/* -------------------------------------------------------------------------- */
const GraceBanner: React.FC<{
  daysLeft: number;
  daysPast: number;
  isProcessing: boolean;
  onPay: () => void;
  onDismiss: () => void;
}> = ({ daysLeft, daysPast, isProcessing, onPay, onDismiss }) => (
  <AnimatePresence>
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -60, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-[100] no-print"
    >
      <div className="bg-servirest-mostaza/95 backdrop-blur-md text-servirest-midnight px-5 py-3 flex items-center justify-between gap-4 flex-wrap border-b border-servirest-mostaza">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-full bg-servirest-midnight/15 flex items-center justify-center shrink-0">
            <Clock size={16} />
          </div>
          <div className="min-w-0">
            <div className="font-black italic uppercase tracking-[0.14em] text-[11px] leading-none mb-0.5">
              Tu plan venció hace {daysPast} día{daysPast === 1 ? '' : 's'}
            </div>
            <p className="text-[12px] font-medium leading-tight m-0">
              Te quedan <strong className="font-black">{daysLeft} día{daysLeft === 1 ? '' : 's'} de gracia</strong>{' '}
              para regularizar. Después el sistema se bloquea.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SrButton
            variant="midnight"
            size="sm"
            icon={isProcessing ? <SrSpinner size={12} /> : <CreditCard size={12} />}
            onClick={onPay}
            disabled={isProcessing}
          >
            {isProcessing ? 'Conectando…' : 'Renovar ahora'}
          </SrButton>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Recordar más tarde"
            className="w-8 h-8 rounded-full hover:bg-servirest-midnight/10 flex items-center justify-center transition-colors"
            title="Recordar más tarde"
          >
            <AlertTriangle size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  </AnimatePresence>
);
