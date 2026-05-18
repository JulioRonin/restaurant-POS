import React, { useState } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSettings } from '../contexts/SettingsContext';
import { SubscriptionStatus } from '../types';
import { GlowCard } from '../components/ui/spotlight-card';

export const BillingScreen: React.FC = () => {
    const { daysRemaining, status, expiryDate, paymentHistory, paySubscription, payEquipment, posStatus, saasStatus } = useSubscription();
    const { settings } = useSettings();
    const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
    const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
    const [selectedEquipmentPlan, setSelectedEquipmentPlan] = useState<{name: string, price: number} | null>(null);
    const [isPaying, setIsPaying] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [stripeModalConfig, setStripeModalConfig] = useState<{isOpen: boolean, amount: number, title: string, onPay: () => void} | null>(null);

    const PLAN_TIERS = [
        {
            id: 'basico',
            name: 'Plan Básico',
            price: 550,
            color: 'blue' as const,
            priceId: 'price_1TWMW07vbDuHdmHoPmOOuBCx',
            description: 'Software Only',
            features: ['Punto de Venta Base', 'Gestión de Menú', 'Ventas y Recibos', 'Soporte por Email']
        },
        {
            id: 'pro',
            name: 'Plan PRO',
            price: 849.99,
            color: 'purple' as const,
            priceId: 'price_1TWMWX7vbDuHdmHofLolyZcZ',
            popular: true,
            description: 'Software POS Avanzado',
            features: ['Todas las funciones Básicas', 'Kitchen Display System (KDS)', 'Inventario Avanzado', 'Soporte Prioritario WhatsApp', 'Múltiples Terminales']
        }
    ];

    const handleSubscribe = async (planId: string, priceId: string, planName: string) => {
        setIsPaying(true);
        const success = await paySubscription(priceId, planName);
        if (!success) {
            setIsPaying(false);
        }
        // If success, it redirects to Stripe, so no need to stop spinner
    };

    const handleEquipmentPayment = async () => {
        if (!selectedEquipmentPlan) return;
        
        setStripeModalConfig({
            isOpen: true,
            amount: selectedEquipmentPlan.price,
            title: `Pago Equipo POS - ${selectedEquipmentPlan.name}`,
            onPay: async () => {
                setIsPaying(true);
                const success = await payEquipment(selectedEquipmentPlan!.price, selectedEquipmentPlan!.name);
                if (success) {
                    setIsPaying(false);
                    setStripeModalConfig(null);
                    setIsEquipmentModalOpen(false);
                    setSelectedEquipmentPlan(null);
                    setShowSuccess(true);
                    setTimeout(() => setShowSuccess(false), 5000);
                }
            }
        });
    };

    const handleRecurringEquipmentPayment = () => {
        if (!posStatus.plan) return;
        
        let amount = 0;
        if (posStatus.plan === '3_MESES') amount = 1666.66;
        else if (posStatus.plan === '6_MESES') amount = 833.33;
        else if (posStatus.plan === '8_MESES') amount = 625.00;

        setStripeModalConfig({
            isOpen: true,
            amount: amount,
            title: `Pago Mensualidad Equipo POS`,
            onPay: async () => {
                setIsPaying(true);
                const success = await payEquipment(amount, posStatus.plan!);
                if (success) {
                    setIsPaying(true);
                    setTimeout(() => {
                        setIsPaying(false);
                        setStripeModalConfig(null);
                        setShowSuccess(true);
                        setTimeout(() => setShowSuccess(false), 5000);
                    }, 1000);
                }
            }
        });
    };

    const handleEquipmentButtonClick = () => {
        if (posStatus.isFullyPaid) return;
        if (posStatus.plan) {
            setIsProgressModalOpen(true);
        } else {
            setIsEquipmentModalOpen(true);
        }
    };

    const statusConfig = {
        [SubscriptionStatus.ACTIVE]: { bg: 'bg-green-500/20 text-green-400 border border-green-500/30', text: 'Suscripción Activa', icon: 'check_circle', glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]' },
        [SubscriptionStatus.WARNING]: { bg: 'bg-orange-500/20 text-orange-400 border border-orange-500/30', text: 'Próxima a Vencer', icon: 'error_outline', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.3)]' },
        [SubscriptionStatus.EXPIRED]: { bg: 'bg-red-500/20 text-red-400 border border-red-500/30', text: 'Suscripción Vencida', icon: 'lock', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]' },
        [SubscriptionStatus.DEMO]: { bg: 'bg-amber-500/20 text-amber-400 border border-amber-500/30', text: 'Demo (Prueba Gratuita)', icon: 'workspace_premium', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]' },
        [SubscriptionStatus.DEMO_EXPIRED]: { bg: 'bg-red-500/20 text-red-400 border border-red-500/30', text: 'Demo Finalizada', icon: 'lock', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]' },
        [SubscriptionStatus.DEBT_BLOCKED]: { bg: 'bg-red-500/20 text-red-400 border border-red-500/30', text: 'Bloqueo por Adeudo', icon: 'block', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]' },
    }[status] || { bg: 'bg-slate-500/20 text-slate-400 border border-slate-500/30', text: 'Desconocido', icon: 'help_outline', glow: '' };

    return (
        <div className="p-8 h-full overflow-y-auto bg-[#0a0a0a] text-white">
            <header className="mb-10 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black tracking-tight mb-2 uppercase bg-gradient-to-r from-white to-white/50 bg-clip-text text-transparent">Suscripción & Facturación</h1>
                    <p className="text-slate-400 font-medium">Gestiona tu licencia, planes y equipo POS.</p>
                </div>
                <button 
                    onClick={handleEquipmentButtonClick}
                    className={`px-6 py-3 rounded-2xl transition-all font-black flex items-center gap-2 border ${posStatus.isFullyPaid ? 'bg-green-500/10 border-green-500/30 text-green-400 cursor-default' : 'bg-slate-800/50 border-slate-700 hover:bg-slate-800 text-white shadow-xl'}`}
                >
                    <span className="material-icons-round">{posStatus.isFullyPaid ? 'check_circle' : 'devices'}</span>
                    {posStatus.isFullyPaid ? 'Equipo Pagado' : 'Adeudo de Equipo POS'}
                </button>
            </header>

            {/* Current Status Card */}
            <div className={`mb-12 rounded-[32px] p-8 flex flex-col md:flex-row justify-between items-center relative overflow-hidden backdrop-blur-xl bg-white/5 border border-white/10 ${statusConfig.glow}`}>
                <div className="flex items-center gap-6 mb-6 md:mb-0">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-md ${statusConfig.bg}`}>
                        <span className="material-icons-round text-3xl">{statusConfig.icon}</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">Estado Actual</span>
                        <div className="flex items-baseline gap-3">
                            <h2 className="text-2xl font-black text-white">{statusConfig.text}</h2>
                            {(status === SubscriptionStatus.DEMO || saasStatus === 'ACTIVE') && (
                                <span className="text-sm font-bold text-slate-400">
                                    — {daysRemaining} días restantes
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block">ID de Establecimiento</span>
                    <span className="text-xl font-mono font-bold uppercase text-white/80 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                        POS-{settings.name.substring(0, 3).toUpperCase()}-{Math.floor(100+Math.random()*899)}
                    </span>
                </div>
            </div>

            {/* Plans Section */}
            <div className="mb-12">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-black mb-3">Elige el plan ideal para tu negocio</h2>
                    <p className="text-slate-400">Mejora tus herramientas y desbloquea todo el potencial de KŌSO POS.</p>
                </div>

                <div className="flex flex-wrap justify-center gap-8">
                    {PLAN_TIERS.map((plan) => (
                        <GlowCard key={plan.id} glowColor={plan.color} customSize className="w-full max-w-[340px] flex flex-col min-h-[500px]">
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-lg z-20">
                                    Más Popular
                                </div>
                            )}
                            <div className="text-center mb-6 relative z-10">
                                <h3 className="text-2xl font-black mb-2">{plan.name}</h3>
                                <p className="text-slate-400 text-sm mb-6 min-h-[40px]">{plan.description}</p>
                                <div className="flex items-end justify-center gap-1">
                                    <span className="text-xl font-bold text-slate-400">$</span>
                                    <span className="text-5xl font-black tracking-tighter">{plan.price}</span>
                                    <span className="text-sm font-bold text-slate-400 mb-1 uppercase">/ mes</span>
                                </div>
                            </div>
                            
                            <div className="flex-1 relative z-10">
                                <ul className="space-y-4 mb-8">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-3 text-sm text-slate-300 font-medium">
                                            <span className="material-icons-round text-green-400 text-sm mt-0.5">check_circle</span>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <button 
                                onClick={() => handleSubscribe(plan.id, plan.priceId, plan.name)}
                                disabled={isPaying}
                                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 relative z-10 disabled:opacity-50
                                    ${plan.popular ? 'bg-white text-black hover:bg-slate-200' : 'bg-white/10 text-white hover:bg-white/20'}`}
                            >
                                {isPaying ? (
                                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <span className="material-icons-round text-lg">bolt</span>
                                        {status === SubscriptionStatus.DEMO ? 'Mejorar Plan' : 'Suscribirse'}
                                    </>
                                )}
                            </button>
                        </GlowCard>
                    ))}
                </div>
            </div>

            {/* History Table */}
            <div className="bg-white/5 rounded-[32px] p-8 border border-white/10 mb-20 backdrop-blur-xl">
                <h3 className="text-xl font-black text-white tracking-tight mb-8 flex items-center gap-3">
                    <span className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center material-icons-round text-slate-300">history</span>
                    Historial de Pagos
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left border-b border-white/10">
                                <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">ID TRANSACCIÓN</th>
                                <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">FECHA</th>
                                <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">MÉTODO</th>
                                <th className="pb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">MONTO</th>
                                <th className="pb-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">ESTADO</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {paymentHistory.length > 0 ? paymentHistory.map(record => (
                                <tr key={record.id} className="hover:bg-white/5 transition-colors">
                                    <td className="py-5">
                                        <div className="text-sm font-black text-white">{record.transactionId}</div>
                                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">
                                            {record.id.startsWith('EQU-') ? 'Pago Equipo POS' : 'Suscripción'}
                                        </div>
                                    </td>
                                    <td className="py-5 text-sm text-slate-300 font-bold">{new Date(record.date).toLocaleDateString()}</td>
                                    <td className="py-5 text-sm text-slate-400 font-medium">{record.method}</td>
                                    <td className="py-5 text-sm font-black text-white">${record.amount.toFixed(2)}</td>
                                    <td className="py-5 text-right">
                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-[10px] font-black uppercase tracking-wider">PAGADO</span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">Aún no hay registros de pago</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Payment Success Toast */}
            {showSuccess && (
                <div className="fixed top-8 right-8 bg-green-500 text-black px-8 py-4 rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-right flex items-center gap-4 font-black">
                    <span className="material-icons-round bg-black text-green-500 rounded-full p-1">check</span>
                    <div>
                        <p className="text-sm uppercase tracking-wider">¡Operación Exitosa!</p>
                    </div>
                </div>
            )}

            {/* Modal de Equipo POS */}
            {isEquipmentModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-[#111] border border-white/10 rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight uppercase tracking-widest leading-none mb-1">Planes de Equipo POS</h1>
                                <p className="text-slate-400 font-medium text-sm">Selecciona el plan de financiamiento</p>
                            </div>
                            <button onClick={() => !isPaying && setIsEquipmentModalOpen(false)} className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all hover:bg-white/10 hover:rotate-90">
                                <span className="material-icons-round">close</span>
                            </button>
                        </div>

                        <div className="p-8">
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                {[
                                    { id: 'CONTADO', name: 'Contado', price: 5000, label: 'Pago Único' },
                                    { id: '3_MESES', name: '3 Meses', price: 1666.66, label: 'Mensual' },
                                    { id: '6_MESES', name: '6 Meses', price: 833.33, label: 'Mensual' },
                                    { id: '8_MESES', name: '8 Meses', price: 625.00, label: 'Mensual' },
                                ].map((plan) => (
                                    <button
                                        key={plan.id}
                                        onClick={() => setSelectedEquipmentPlan({name: plan.id, price: plan.price})}
                                        className={`p-6 rounded-[24px] border-2 transition-all flex flex-col items-start gap-1 text-left ${selectedEquipmentPlan?.name === plan.id ? 'border-blue-500 bg-blue-500/10 ring-4 ring-blue-500/20' : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                                    >
                                        <div className="flex justify-between w-full items-center mb-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{plan.label}</span>
                                            {selectedEquipmentPlan?.name === plan.id && <span className="material-icons-round text-blue-500 text-sm">check_circle</span>}
                                        </div>
                                        <span className="text-xl font-black text-white">{plan.name}</span>
                                        <span className="text-2xl font-black text-blue-400">${plan.price.toLocaleString()} <span className="text-[10px] font-bold text-slate-500 uppercase">MXN</span></span>
                                    </button>
                                ))}
                            </div>

                            {selectedEquipmentPlan && (
                                <div className="animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6 mb-8 flex items-center justify-between">
                                        <div>
                                            <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-1">Total a Pagar Hoy</p>
                                            <p className="text-3xl font-black text-white">${selectedEquipmentPlan.price.toLocaleString()} MXN</p>
                                        </div>
                                        <div className="w-12 h-12 bg-blue-500 text-black rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                                            <span className="material-icons-round">shopping_cart</span>
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={handleEquipmentPayment}
                                        className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[24px] font-black text-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all flex items-center justify-center gap-3 active:scale-95"
                                    >
                                        <span className="material-icons-round">credit_card</span>
                                        CONTINUAR AL PAGO
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Progreso de Equipo */}
            {isProgressModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-[#111] border border-white/10 rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-widest">Mi Plan Equipo POS</h3>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Plan: {posStatus.plan?.replace('_', ' ')}</p>
                            </div>
                            <button onClick={() => setIsProgressModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <span className="material-icons-round text-3xl">close</span>
                            </button>
                        </div>
                        
                        <div className="p-8">
                            <div className="mb-10 text-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block">Progreso de Pago</span>
                                <div className="text-5xl font-black text-white tracking-tighter mb-2">
                                    ${posStatus.amountPaid.toLocaleString()}
                                    <span className="text-xl font-bold text-slate-500 ml-2">/ $5,000</span>
                                </div>
                                <div className="w-full bg-white/5 h-4 rounded-full overflow-hidden mt-6 mb-2 border border-white/10 relative">
                                    <div 
                                        className="h-full bg-blue-500 transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(59,130,246,0.8)] relative z-10" 
                                        style={{ width: `${(posStatus.amountPaid / 5000) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                                    <span>Pagado</span>
                                    <span>Restante: ${(5000 - posStatus.amountPaid).toLocaleString()} MXN</span>
                                </div>
                            </div>

                            <div className="space-y-4 mb-10">
                                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Monto Mensual</p>
                                        <p className="text-xl font-black text-white">${(posStatus.plan === '3_MESES' ? 1666.66 : posStatus.plan === '6_MESES' ? 833.33 : 625).toLocaleString()} MXN</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Estatus</p>
                                        <span className="text-xs font-black text-orange-400 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">PENDIENTE</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleRecurringEquipmentPayment}
                                className="w-full py-5 bg-white text-black hover:bg-slate-200 rounded-2xl font-black text-lg shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all flex items-center justify-center gap-3 active:scale-95"
                            >
                                <span className="material-icons-round">payment</span>
                                PAGAR MENSUALIDAD
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {stripeModalConfig?.isOpen && (
                <PaymentStripeModal 
                    onClose={() => setStripeModalConfig(null)}
                    onPay={stripeModalConfig.onPay}
                    amount={stripeModalConfig.amount}
                    isPaying={isPaying}
                    title={stripeModalConfig.title}
                />
            )}
        </div>
    );
};

const PaymentStripeModal: React.FC<{
    onClose: () => void;
    onPay: () => void;
    amount: number;
    isPaying: boolean;
    title: string;
}> = ({ onClose, onPay, amount, isPaying, title }) => (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-[#111] border border-white/10 rounded-[24px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-white/5 p-6 border-b border-white/10 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                        <span className="material-icons-round text-black text-sm">payments</span>
                    </div>
                    <span className="font-black tracking-tight">{title}</span>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                    <span className="material-icons-round">close</span>
                </button>
            </div>

            <div className="p-8">
                <div className="mb-8">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Monto a Pagar</span>
                    <div className="text-3xl font-black text-white leading-none flex items-baseline gap-1">
                        ${amount.toFixed(2)} 
                        <span className="text-sm font-bold text-slate-500 uppercase">MXN</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Correo Electrónico</label>
                        <input type="email" placeholder="ejemplo@correo.com" className="w-full p-3 bg-black border border-white/10 rounded-xl outline-none focus:border-blue-500 transition-all font-medium text-white placeholder-slate-600" />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Información de la Tarjeta</label>
                        <div className="border border-white/10 rounded-xl overflow-hidden shadow-sm bg-black flex flex-col focus-within:border-blue-500 transition-colors">
                            <input type="text" placeholder="Número de tarjeta" className="w-full p-4 bg-transparent outline-none font-mono text-white placeholder-slate-600 border-b border-white/10" />
                            <div className="flex">
                                <input type="text" placeholder="MM / YY" className="w-1/2 p-4 bg-transparent border-r border-white/10 outline-none font-mono text-white placeholder-slate-600" />
                                <input type="text" placeholder="CVC" className="w-1/2 p-4 bg-transparent outline-none font-mono text-white placeholder-slate-600" />
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onPay}
                    disabled={isPaying}
                    className={`w-full mt-10 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:scale-[1.02] active:scale-95 disabled:opacity-50`}
                >
                    {isPaying ? (
                        <>
                            <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                            PROCESANDO PAGO...
                        </>
                    ) : (
                        `PAGAR $${amount.toFixed(2)}`
                    )}
                </button>

                <p className="mt-8 text-center text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                    <span className="material-icons-round text-sm">security</span>
                    Pagos Seguros
                </p>
            </div>
        </div>
    </div>
);
