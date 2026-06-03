import React, { useState } from 'react';
import { useSubscription, BusinessTier, TIER_PRICING, TIER_LIMITS } from '../contexts/SubscriptionContext';
import { useSettings } from '../contexts/SettingsContext';
import { SubscriptionStatus, PaymentRecord } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, AlertTriangle, Lock, Sparkles, ShieldCheck,
  ArrowRight, X, CreditCard, Receipt, Crown, Building2, Zap, History, Calendar,
} from 'lucide-react';
import {
  SrCard, SrButton, SrChip, SrLabel, SrKicker, SrModal, SrModalHeader,
  SrAlert, SrSpinner, SrEmptyState, SrPanel, SrMono, SrTierBadge,
} from '../components/ui/servirest';

/* -------------------------------------------------------------------------- */
/* Tier card — used in the 3-up pricing comparison                            */
/* -------------------------------------------------------------------------- */
type TierCardProps = {
  id: BusinessTier;
  current: BusinessTier;
  recommended?: boolean;
  bullets: string[];
  description: string;
  highlightTone: 'midnight' | 'terracota' | 'mostaza';
  onSelect: () => void;
  busy?: boolean;
};

const TierCard: React.FC<TierCardProps> = ({
  id, current, recommended, bullets, description, highlightTone, onSelect, busy,
}) => {
  const tone = {
    midnight:  { ring: 'border-[rgba(42,40,38,0.12)]', accent: 'text-servirest-midnight',  bg: 'bg-servirest-surface' },
    terracota: { ring: 'border-servirest-terracota/40', accent: 'text-servirest-terracota', bg: 'bg-servirest-surface' },
    mostaza:   { ring: 'border-servirest-mostaza/50',  accent: 'text-servirest-mostaza',   bg: 'bg-servirest-surface' },
  }[highlightTone];

  const isCurrent = id === current;
  const isDowngrade =
    (current === 'profesional' && id === 'esencial') ||
    (current === 'prestige' && (id === 'esencial' || id === 'profesional')) ||
    (current === 'enterprise' && id !== 'enterprise');

  const pricing = TIER_PRICING[id];
  const limits = TIER_LIMITS[id];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      {recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <SrChip tone="mostaza" size="sm">
            <Sparkles size={10} className="mr-1.5" /> Recomendado para tu zona
          </SrChip>
        </div>
      )}
      <div
        className={`relative bg-servirest-surface rounded-sr-2xl border-2 ${tone.ring} shadow-sr-lift overflow-hidden h-full flex flex-col`}
        style={{ borderColor: recommended ? '#C9A24A' : undefined }}
      >
        {recommended && (
          <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ background: 'radial-gradient(circle at 50% 0%, #C9A24A 0%, transparent 60%)' }} />
        )}
        <div className="p-8 pb-4 relative">
          <SrTierBadge tier={id} size="md" />
          <h3 className="font-serif italic font-medium text-[34px] text-servirest-midnight tracking-[-0.02em] mt-4 mb-2 leading-none">
            {pricing.label}
          </h3>
          <p className="text-[13px] text-[rgba(42,40,38,0.6)] font-medium leading-relaxed min-h-[48px]">
            {description}
          </p>
        </div>

        <div className="px-8 pt-2 pb-6 relative">
          {id === 'enterprise' ? (
            <div className="flex items-baseline gap-2">
              <span className="font-serif italic font-medium text-[34px] text-servirest-midnight leading-none">
                A medida
              </span>
              <span className="sr-label">contacta ventas</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-[18px] text-servirest-midnight">$</span>
              <span className="font-black italic text-[52px] text-servirest-midnight tracking-[-0.03em] leading-none">
                {pricing.monthly.toLocaleString()}
              </span>
              <span className="font-mono text-[11px] text-[rgba(42,40,38,0.6)] ml-1 mb-1.5">MXN / mes</span>
            </div>
          )}
          {id !== 'enterprise' && (
            <div className="mt-2">
              <SrLabel className="text-[8px]">
                ó ${pricing.yearly.toLocaleString()} al año <span className="text-servirest-terracota">— ahorra 2 meses</span>
              </SrLabel>
            </div>
          )}
        </div>

        <div className="px-8 pb-6 flex-1">
          <ul className="space-y-3">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] text-servirest-carbon font-medium leading-snug">
                <CheckCircle2 size={15} className={`flex-shrink-0 mt-0.5 ${tone.accent}`} />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Limit footer — gives the buyer a feel for the boundary */}
        <div className="px-8 py-4 border-t border-[rgba(42,40,38,0.08)] bg-servirest-hueso-sunken/60">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-medium text-[rgba(42,40,38,0.6)]">
            <span>Mesas</span><span className="font-mono text-right">{limits.maxTables >= 999 ? '∞' : limits.maxTables}</span>
            <span>Empleados</span><span className="font-mono text-right">{limits.maxEmployees >= 999 ? '∞' : limits.maxEmployees}</span>
            <span>Sucursales</span><span className="font-mono text-right">{limits.maxLocations >= 999 ? '∞' : limits.maxLocations}</span>
            <span>Terminales</span><span className="font-mono text-right">{limits.maxConcurrentTerminals >= 999 ? '∞' : limits.maxConcurrentTerminals}</span>
          </div>
        </div>

        <div className="p-6 pt-4">
          {isCurrent ? (
            <SrButton variant="outline" size="md" fullWidth disabled icon={<CheckCircle2 size={14} />}>
              Tu plan actual
            </SrButton>
          ) : isDowngrade ? (
            <SrButton variant="ghost" size="md" fullWidth disabled>
              Cambiar a plan menor — escríbenos
            </SrButton>
          ) : id === 'enterprise' ? (
            <SrButton variant="midnight" size="md" fullWidth iconRight={<ArrowRight size={16} />}>
              Hablar con ventas
            </SrButton>
          ) : (
            <SrButton
              variant={recommended ? 'primary' : 'midnight'}
              size="md"
              fullWidth
              iconRight={busy ? <SrSpinner size={14} /> : <ArrowRight size={16} />}
              disabled={busy}
              onClick={onSelect}
            >
              {busy ? 'Conectando…' : current === 'esencial' && id === 'esencial' ? 'Suscribirme' : `Pasar a ${pricing.label}`}
            </SrButton>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* -------------------------------------------------------------------------- */
/* Status pill — top of page                                                  */
/* -------------------------------------------------------------------------- */
const STATUS_LABEL: Record<SubscriptionStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'mostaza' }> = {
  [SubscriptionStatus.ACTIVE]:        { label: 'Suscripción activa',     tone: 'success' },
  [SubscriptionStatus.WARNING]:       { label: 'Próxima a vencer',        tone: 'warning' },
  [SubscriptionStatus.EXPIRED]:       { label: 'Suscripción vencida',     tone: 'danger'  },
  [SubscriptionStatus.DEMO]:          { label: 'Demo gratuito',           tone: 'mostaza' },
  [SubscriptionStatus.DEMO_EXPIRED]:  { label: 'Demo finalizado',         tone: 'danger'  },
  [SubscriptionStatus.DEBT_BLOCKED]:  { label: 'Bloqueo por equipo',      tone: 'danger'  },
};

/* -------------------------------------------------------------------------- */
/* BillingScreen                                                              */
/* -------------------------------------------------------------------------- */
export const BillingScreen: React.FC = () => {
  const {
    daysRemaining, status, paymentHistory, paySubscription, payEquipment,
    posStatus, tier,
  } = useSubscription();
  const { settings } = useSettings();

  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [selectedEquipmentPlan, setSelectedEquipmentPlan] = useState<{ name: string; price: number } | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const statusInfo = STATUS_LABEL[status] || { label: 'Sin estado', tone: 'warning' as const };

  /* ── TIER DEFINITIONS (kept here so it's the single source of truth for UX) */
  const TIERS: Array<{
    id: BusinessTier;
    description: string;
    bullets: string[];
    tone: 'midnight' | 'terracota' | 'mostaza';
    priceId?: string;
  }> = [
    {
      id: 'esencial',
      description: 'Para fondas, cafés, taquerías y locales chicos. Lo justo para vender, cobrar y cerrar el día sin perder tiempo.',
      bullets: [
        'POS Línea de Órdenes',
        'Menú con variantes',
        'Mesas, caja y tickets',
        'Inventario básico',
        'CFDI 4.0 — 50 timbres al mes',
        'Soporte por email + WhatsApp (lun-sáb)',
      ],
      tone: 'midnight',
      priceId: 'price_1TWMW07vbDuHdmHoPmOOuBCx',
    },
    {
      id: 'profesional',
      description: 'Para restaurantes pyme con cocina y meseros. Suma cocina en pantalla, inventario fino y operación multi-terminal.',
      bullets: [
        'Todo lo de Esencial',
        'Kitchen Display System (KDS)',
        'Hostess y waitlist',
        'Bar y comandas separadas',
        'Inventario con proveedores y food cost',
        'Hasta 5 terminales en paralelo',
        'Orden remota (Rappi, Uber Eats, DiDi)',
        'CFDI 4.0 — 200 timbres / mes',
        'Soporte WhatsApp prioritario',
      ],
      tone: 'terracota',
      priceId: 'price_1TWMWX7vbDuHdmHofLolyZcZ',
    },
    {
      id: 'prestige',
      description: 'Para restaurantes en corredor premium, hoteles y conceptos boutique. Reservaciones, carta digital pública y look editorial.',
      bullets: [
        'Todo lo de Profesional',
        'Reservaciones con confirmación WhatsApp + email',
        'Carta digital pública con URL propia + QR',
        'Wine list con maridajes y coctelería con costeo',
        'Hasta 5 sucursales en consolidador',
        'Reportes con KPIs hospitality + análisis de menú',
        'Branding co-cliente (tu logo encima)',
        'Cuenta dedicada + onboarding asistido',
        'SLA 99.5% mensual',
      ],
      tone: 'mostaza',
    },
    {
      id: 'enterprise',
      description: 'Cadenas, franquicias y grupos. White label total, API privada y pricing por volumen.',
      bullets: [
        'Todo lo de Prestige',
        'Sucursales ilimitadas',
        'White label completo (tu marca, sin ServiRest visible)',
        'API privada + integración ERP (SAP, Microsip, Contpaqi)',
        'Auditoría avanzada y roles personalizados',
        'SLA 99.9% + soporte 24/7',
      ],
      tone: 'midnight',
    },
  ];

  const handleSubscribe = async (planId: BusinessTier, priceId?: string) => {
    setIsPaying(true);
    const planName = `ServiRest ${TIER_PRICING[planId].label} — Renovación mensual`;
    const success = await paySubscription(priceId, planName);
    if (!success) setIsPaying(false);
  };

  const handleEquipmentPayment = async () => {
    if (!selectedEquipmentPlan) return;
    setIsPaying(true);
    const ok = await payEquipment(selectedEquipmentPlan.price, selectedEquipmentPlan.name);
    if (ok) {
      setIsPaying(false);
      setIsEquipmentModalOpen(false);
      setSelectedEquipmentPlan(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } else {
      setIsPaying(false);
    }
  };

  const handleRecurringEquipmentPayment = async () => {
    if (!posStatus.plan) return;
    const amount = posStatus.plan === '3_MESES' ? 1666.66
                 : posStatus.plan === '6_MESES' ? 833.33
                 : posStatus.plan === '8_MESES' ? 625.00 : 0;
    setIsPaying(true);
    const ok = await payEquipment(amount, posStatus.plan);
    if (ok) {
      setIsPaying(false);
      setIsProgressModalOpen(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } else {
      setIsPaying(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-servirest-hueso text-servirest-carbon">
      <div className="px-[38px] py-10 max-w-[1400px] mx-auto">
        {/* HEADER */}
        <div className="flex justify-between items-start flex-wrap gap-5 mb-10">
          <div>
            <SrKicker className="block mb-2">Plan & facturación</SrKicker>
            <h1 className="sr-h1 m-0 mb-2">Tu plan de ServiRest</h1>
            <p className="text-[14px] text-[rgba(42,40,38,0.6)] font-medium max-w-[600px]">
              Escoge el plan que mejor le queda a tu restaurante. Sube o baja cuando quieras, sin penalización.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <SrButton
              variant={posStatus.isFullyPaid ? 'outline' : 'midnight'}
              size="md"
              icon={posStatus.isFullyPaid ? <CheckCircle2 size={14} /> : <CreditCard size={14} />}
              onClick={() => {
                if (posStatus.isFullyPaid) return;
                if (posStatus.plan) setIsProgressModalOpen(true);
                else setIsEquipmentModalOpen(true);
              }}
              disabled={posStatus.isFullyPaid}
            >
              {posStatus.isFullyPaid ? 'Equipo pagado' : 'Equipo POS'}
            </SrButton>
          </div>
        </div>

        {/* CURRENT STATUS — narrative card, not a dashboard widget */}
        <SrCard variant="solaris" className="p-8 mb-10">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-sr-lg bg-servirest-midnight text-servirest-mostaza flex items-center justify-center flex-shrink-0">
                {tier === 'prestige' ? <Crown size={26} /> : tier === 'profesional' ? <Zap size={26} /> : tier === 'enterprise' ? <Building2 size={26} /> : <Receipt size={26} />}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <SrLabel>Tu plan</SrLabel>
                  <SrTierBadge tier={tier} />
                </div>
                <div className="font-serif italic font-medium text-[34px] text-servirest-midnight tracking-[-0.02em] leading-none mb-1.5">
                  {TIER_PRICING[tier].label}
                </div>
                <SrChip tone={statusInfo.tone === 'mostaza' ? 'mostaza' : statusInfo.tone}>
                  {statusInfo.label}
                </SrChip>
              </div>
            </div>
            <div className="text-right">
              <SrLabel className="block mb-1">Días restantes</SrLabel>
              <div className="font-black italic text-[44px] text-servirest-midnight tracking-[-0.03em] leading-none">
                {daysRemaining}<span className="text-[20px] text-[rgba(42,40,38,0.4)] ml-1">d</span>
              </div>
              <div className="font-mono text-[10px] text-[rgba(42,40,38,0.4)] mt-1">
                ID {settings.name?.substring(0, 3).toUpperCase() || 'SRV'}-{(Math.floor(100 + Math.random() * 899))}
              </div>
            </div>
          </div>
        </SrCard>

        {/* WARNING ALERTS */}
        {status === SubscriptionStatus.WARNING && (
          <SrAlert tone="warning" title="Tu plan vence pronto" className="mb-8">
            Te quedan {daysRemaining} días. Renueva ahora para no interrumpir el servicio en cocina.
          </SrAlert>
        )}
        {status === SubscriptionStatus.EXPIRED && (
          <SrAlert tone="danger" title="Tu suscripción expiró" className="mb-8">
            Algunas funciones quedaron bloqueadas. Renueva para regresar a tu operación normal.
          </SrAlert>
        )}
        {status === SubscriptionStatus.DEMO_EXPIRED && (
          <SrAlert tone="danger" title="Tu demo terminó" className="mb-8">
            Escoge un plan para seguir usando ServiRest. Tu data está intacta esperándote.
          </SrAlert>
        )}

        {/* BILLING CYCLE TOGGLE */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <SrKicker className="block mb-1">Modalidades</SrKicker>
            <h2 className="sr-h-brutal text-[22px] m-0">El plan que le queda a tu restaurante</h2>
          </div>
          <div className="flex items-center gap-2 p-1 bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-sr-xl">
            {(['monthly', 'yearly'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBillingCycle(c)}
                className={`px-4 py-2 rounded-sr-md text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${billingCycle === c ? 'bg-servirest-midnight text-servirest-hueso' : 'text-[rgba(42,40,38,0.6)] hover:text-servirest-carbon'}`}
              >
                {c === 'monthly' ? 'Mensual' : (
                  <>Anual <span className="text-servirest-mostaza ml-1">−2 meses</span></>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 3-up tier comparison + Enterprise rail */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
          {TIERS.filter((t) => t.id !== 'enterprise').map((t) => (
            <TierCard
              key={t.id}
              id={t.id}
              current={tier}
              recommended={t.id === 'profesional' && tier === 'esencial'}
              description={t.description}
              bullets={t.bullets}
              highlightTone={t.tone}
              busy={isPaying}
              onSelect={() => handleSubscribe(t.id, t.priceId)}
            />
          ))}
        </div>

        {/* Enterprise rail — narrower, sits below the 3-up */}
        <SrCard variant="solaris" className="p-8 mb-12 flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-5 flex-1 min-w-0">
            <div className="w-14 h-14 rounded-sr-lg bg-servirest-midnight text-servirest-mostaza flex items-center justify-center flex-shrink-0">
              <Building2 size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <SrTierBadge tier="enterprise" />
                <SrLabel>Para cadenas y franquicias</SrLabel>
              </div>
              <h3 className="font-serif italic font-medium text-[26px] text-servirest-midnight tracking-[-0.02em] m-0 mb-1.5 leading-tight">
                Enterprise — white label y API privada
              </h3>
              <p className="text-[13px] text-[rgba(42,40,38,0.6)] font-medium leading-relaxed max-w-[600px]">
                Sucursales ilimitadas, integración ERP, auditoría avanzada, soporte 24/7 y precio por volumen. Hablamos.
              </p>
            </div>
          </div>
          <SrButton variant="midnight" size="md" iconRight={<ArrowRight size={16} />}>
            Solicitar propuesta
          </SrButton>
        </SrCard>

        {/* PAYMENT HISTORY — editorial table */}
        <SrPanel title="Historial de pagos" kicker="Movimientos">
          {paymentHistory.length === 0 ? (
            <SrEmptyState
              icon={<History size={28} />}
              title="Aún no hay pagos registrados"
              description="Cuando renueves tu plan o abones a tu equipo, los movimientos aparecerán aquí."
            />
          ) : (
            <div className="overflow-x-auto -mx-7 px-7">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-[rgba(42,40,38,0.12)]">
                    <th className="text-left py-3 sr-label">Transacción</th>
                    <th className="text-left py-3 sr-label">Fecha</th>
                    <th className="text-left py-3 sr-label">Método</th>
                    <th className="text-right py-3 sr-label">Monto</th>
                    <th className="text-right py-3 sr-label">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((r: PaymentRecord) => (
                    <tr key={r.id} className="border-b border-[rgba(42,40,38,0.06)] hover:bg-servirest-hueso-sunken/40 transition-colors">
                      <td className="py-4">
                        <SrMono className="block text-servirest-midnight">{r.transactionId}</SrMono>
                        <span className="text-[10px] text-[rgba(42,40,38,0.4)] font-bold uppercase tracking-[0.12em]">
                          {r.id.startsWith('EQU-') || (r as any).type === 'EQUIPMENT' ? 'Equipo' : 'Suscripción'}
                        </span>
                      </td>
                      <td className="py-4 text-[13px] font-medium text-servirest-carbon">
                        {new Date(r.date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-4 text-[13px] font-medium text-[rgba(42,40,38,0.6)]">{r.method}</td>
                      <td className="py-4 text-right">
                        <SrMono>${r.amount.toFixed(2)}</SrMono>
                      </td>
                      <td className="py-4 text-right">
                        <SrChip tone="success" size="xs">Pagado</SrChip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SrPanel>
      </div>

      {/* Success toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-[200]"
          >
            <SrCard className="px-5 py-4 flex items-center gap-3 shadow-sr-modal min-w-[280px]">
              <div className="w-9 h-9 rounded-full bg-servirest-success/10 text-servirest-success flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div className="font-extrabold text-sm text-servirest-midnight">¡Operación exitosa!</div>
                <div className="text-[11px] text-[rgba(42,40,38,0.6)] font-medium">Movimiento registrado.</div>
              </div>
            </SrCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EQUIPMENT MODAL — select a plan */}
      <AnimatePresence>
        {isEquipmentModalOpen && (
          <SrModal open onClose={() => !isPaying && setIsEquipmentModalOpen(false)} maxWidth={720}>
            <SrModalHeader
              title="Tu equipo POS"
              kicker="Escoge tu plan de financiamiento"
              onClose={() => !isPaying && setIsEquipmentModalOpen(false)}
            />
            <div className="grid grid-cols-2 gap-3.5 mb-6">
              {[
                { id: 'CONTADO',  name: 'Contado',  price: 5000,    label: 'Pago único' },
                { id: '3_MESES',  name: '3 Meses',  price: 1666.66, label: 'Mensual × 3' },
                { id: '6_MESES',  name: '6 Meses',  price: 833.33,  label: 'Mensual × 6' },
                { id: '8_MESES',  name: '8 Meses',  price: 625.00,  label: 'Mensual × 8' },
              ].map((p) => {
                const on = selectedEquipmentPlan?.name === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedEquipmentPlan({ name: p.id, price: p.price })}
                    className={`p-5 rounded-sr-xl border-2 text-left transition-all ${on ? 'border-servirest-terracota bg-[rgba(196,99,63,0.06)] shadow-sr-glow' : 'border-[rgba(42,40,38,0.12)] bg-servirest-surface hover:border-[rgba(42,40,38,0.20)]'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <SrLabel className="text-[8px]">{p.label}</SrLabel>
                      {on && <CheckCircle2 size={16} className="text-servirest-terracota" />}
                    </div>
                    <div className="font-serif italic font-medium text-[22px] text-servirest-midnight mb-1 leading-none">{p.name}</div>
                    <div className={`font-mono font-bold ${on ? 'text-servirest-terracota' : 'text-servirest-carbon'}`}>
                      ${p.price.toLocaleString()} <span className="text-[10px] font-medium text-[rgba(42,40,38,0.4)]">MXN</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedEquipmentPlan && (
              <>
                <SrAlert tone="info" title="A pagar hoy" className="mb-5">
                  <span className="font-mono font-bold text-base">${selectedEquipmentPlan.price.toLocaleString()} MXN</span>
                  {' · '} Stripe Checkout abre en una pestaña nueva.
                </SrAlert>
                <SrButton
                  variant="primary"
                  size="lg"
                  fullWidth
                  iconRight={isPaying ? <SrSpinner size={16} /> : <ArrowRight size={18} />}
                  onClick={handleEquipmentPayment}
                  disabled={isPaying}
                >
                  {isPaying ? 'Procesando…' : 'Continuar al pago'}
                </SrButton>
              </>
            )}
          </SrModal>
        )}
      </AnimatePresence>

      {/* EQUIPMENT PROGRESS MODAL — show how much paid */}
      <AnimatePresence>
        {isProgressModalOpen && (
          <SrModal open onClose={() => setIsProgressModalOpen(false)} maxWidth={520}>
            <SrModalHeader
              title="Tu equipo POS"
              kicker={`Plan ${posStatus.plan?.replace('_', ' ') || ''}`}
              onClose={() => setIsProgressModalOpen(false)}
            />
            <div className="mb-7">
              <SrLabel className="block mb-2">Progreso de pago</SrLabel>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-black italic text-[44px] text-servirest-midnight tracking-[-0.03em] leading-none">
                  ${posStatus.amountPaid.toLocaleString()}
                </span>
                <span className="font-mono text-[14px] text-[rgba(42,40,38,0.4)]">
                  / ${(posStatus.totalAmount || 5000).toLocaleString()}
                </span>
              </div>
              <div className="w-full h-2 rounded-sr-pill bg-[rgba(42,40,38,0.08)] overflow-hidden">
                <div
                  className="h-full bg-servirest-terracota rounded-sr-pill transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (posStatus.amountPaid / (posStatus.totalAmount || 5000)) * 100)}%`,
                    boxShadow: '0 0 12px rgba(196,99,63,0.4)',
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] mt-2 font-mono text-[rgba(42,40,38,0.6)]">
                <span>Pagado</span>
                <span>Restan ${((posStatus.totalAmount || 5000) - posStatus.amountPaid).toLocaleString()}</span>
              </div>
            </div>

            <SrCard className="p-5 mb-6 flex justify-between items-center">
              <div>
                <SrLabel className="block mb-1">Mensualidad</SrLabel>
                <SrMono className="text-base">
                  ${(posStatus.plan === '3_MESES' ? 1666.66 : posStatus.plan === '6_MESES' ? 833.33 : 625).toLocaleString()} MXN
                </SrMono>
              </div>
              <SrChip tone="mostaza">Pendiente</SrChip>
            </SrCard>

            <SrButton
              variant="primary"
              size="lg"
              fullWidth
              iconRight={isPaying ? <SrSpinner size={16} /> : <ArrowRight size={18} />}
              onClick={handleRecurringEquipmentPayment}
              disabled={isPaying}
            >
              {isPaying ? 'Procesando…' : 'Pagar mensualidad'}
            </SrButton>
          </SrModal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BillingScreen;
