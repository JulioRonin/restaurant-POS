import React, { useState } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSettings } from '../contexts/SettingsContext';
import { SubscriptionStatus } from '../types';

export const BillingScreen: React.FC = () => {
    const { daysRemaining, status, expiryDate, paymentHistory, paySubscription, payEquipment, posStatus } = useSubscription();
    const { settings } = useSettings();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
    const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
    const [selectedEquipmentPlan, setSelectedEquipmentPlan] = useState<{name: string, price: number} | null>(null);
    const [isPaying, setIsPaying] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [stripeModalConfig, setStripeModalConfig] = useState<{isOpen: boolean, amount: number, title: string, onPay: () => void} | null>(null);

    const equipmentPlans = [
        { name: 'Contado', price: 5000, label: 'Pago Único' },
        { name: '3 Meses', price: 1666.66, label: 'Mensual' },
        { name: '6 Meses', price: 833.33, label: 'Mensual' },
        { name: '8 Meses', price: 625.00, label: 'Mensual' },
    ];

    const handleRenovar = () => {
        setStripeModalConfig({
            isOpen: true,
            amount: 850,
            title: 'Renovación Mensual - Solaris POS',
            onPay: async () => {
                setIsPaying(true);
                const success = await paySubscription();
                if (success) {
                    setIsPaying(false);
                    setStripeModalConfig(null);
                    setShowSuccess(true);
                    setTimeout(() => setShowSuccess(false), 5000);
                } else {
                    setIsPaying(false);
                }
            }
        });
    };

    const handlePayment = async () => {
        setIsPaying(true);
        const success = await paySubscription();
        if (success) {
            setIsPaying(false);
            setIsModalOpen(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 5000);
        }
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
                    setIsPaying(true); // Keep spinner a bit
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
        [SubscriptionStatus.ACTIVE]: { bg: 'bg-green-500', text: 'Activa', icon: 'check_circle' },
        [SubscriptionStatus.WARNING]: { bg: 'bg-orange-500', text: 'Próxima a vencer', icon: 'error_outline' },
        [SubscriptionStatus.EXPIRED]: { bg: 'bg-red-500', text: 'Vencida', icon: 'lock' },
    }[status];

    return (
        <div className="p-8 bg-gray-50 h-full overflow-y-auto">
            <header className="mb-10">
                <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2 uppercase">Gestión de Suscripción</h1>
                <p className="text-gray-500 font-medium">Administra el acceso a tu plataforma Solaris POS.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                {/* Status Card */}
                <div className="lg:col-span-2 bg-white rounded-[32px] p-8 shadow-soft border border-gray-100 flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-primary/10 transition-colors"></div>
                    
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-12">
                            <div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Estado Actual</span>
                                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-white font-black text-xs uppercase tracking-wider ${statusConfig.bg}`}>
                                    <span className="material-icons-round text-sm">{statusConfig.icon}</span>
                                    {statusConfig.text}
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">Solaris POS ID</span>
                                <span className="text-gray-900 font-mono font-bold uppercase">
                                    POS-{settings.name.substring(0, 3).toUpperCase()}-{Math.floor(100+Math.random()*899)}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-end gap-6 mb-8">
                            <div className="space-y-1">
                                <span className="text-6xl font-black text-gray-900 tracking-tighter">{daysRemaining}</span>
                                <p className="text-gray-400 font-black uppercase text-xs tracking-widest">Días de Servicio</p>
                            </div>
                            <div className="mb-2 pb-1 text-gray-300 font-light text-6xl">/</div>
                            <div className="pb-2">
                                <p className="text-gray-400 text-xs font-bold uppercase mb-1">Vence el:</p>
                                <p className="text-gray-900 font-bold">{expiryDate?.toLocaleDateString() || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 flex flex-wrap gap-4">
                        <button 
                            onClick={handleRenovar}
                            className="flex-1 min-w-[240px] py-4 bg-primary hover:bg-blue-600 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 text-lg"
                        >
                            <span className="material-icons-round">refresh</span>
                            RENOVAR AHORA - $850.00
                        </button>
                        <button 
                            onClick={handleEquipmentButtonClick}
                            className={`px-8 py-4 rounded-2xl transition-all font-black flex items-center gap-2 shadow-xl hover:scale-[1.02] active:scale-95 ${posStatus.isFullyPaid ? 'bg-green-600 shadow-green-200 text-white cursor-default' : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-200'}`}
                        >
                            <span className="material-icons-round">{posStatus.isFullyPaid ? 'check_circle' : 'devices'}</span>
                            {posStatus.isFullyPaid ? 'Equipo Pagado' : 'Equipo POS'}
                        </button>
                        <button className="px-6 py-4 bg-gray-50 hover:bg-gray-100 text-gray-400 rounded-2xl border border-gray-100 transition-all font-bold">
                            Plan Anual
                        </button>
                    </div>
                </div>

                {/* Info Card */}
                <div className="bg-slate-900 rounded-[32px] p-8 text-white flex flex-col justify-between shadow-2xl relative overflow-hidden">
                    <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-primary/20 rounded-full blur-[80px]"></div>
                    <div>
                        <h3 className="text-xl font-black mb-6 tracking-tight tracking-wider uppercase text-[10px] text-primary">Beneficios de tu Suscripción</h3>
                        <ul className="space-y-4">
                            {[
                                'Soporte técnico vía WhatsApp',
                                'Datos en web cloud',
                                'Estadísticas y Dashboard avanzado',
                                'Usuarios ilimitados',
                                'Actualizaciones de seguridad gratuitas'
                            ].map((item, i) => (
                                <li key={i} className="flex gap-3 text-sm text-slate-300 font-medium">
                                    <span className="material-icons-round text-primary text-sm">verified</span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="mt-8 pt-8 border-t border-white/10">
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Ronin Studio Support</p>
                        <p className="text-xs text-slate-500">+52 55 1234 5678</p>
                    </div>
                </div>
            </div>

            {/* Payment Success Toast */}
            {showSuccess && (
                <div className="fixed top-8 right-8 bg-green-600 text-white px-8 py-4 rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-right flex items-center gap-4">
                    <span className="material-icons-round bg-white text-green-600 rounded-full p-1">check</span>
                    <div>
                        <p className="font-black text-sm uppercase tracking-wider">¡Pago Completado!</p>
                        <p className="text-xs font-bold opacity-80">Tu suscripción se ha renovado por 30 días.</p>
                    </div>
                </div>
            )}

            {/* History Table */}
            <div className="bg-white rounded-[32px] p-8 shadow-soft border border-gray-100 mb-20">
                <h3 className="text-xl font-black text-gray-900 tracking-tight mb-8 flex items-center gap-3">
                    <span className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center material-icons-round text-gray-400">history</span>
                    Historial de Pagos
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left border-b border-gray-100">
                                <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">ID TRANSACCIÓN</th>
                                <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">FECHA</th>
                                <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">MÉTODO</th>
                                <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">MONTO</th>
                                <th className="pb-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">STADO</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {paymentHistory.length > 0 ? paymentHistory.map(record => (
                                <tr key={record.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="py-5">
                                        <div className="text-sm font-black text-gray-900">{record.transactionId}</div>
                                        <div className="text-[10px] text-gray-400 uppercase font-black tracking-tighter">
                                            {record.id.startsWith('EQU-') ? 'Pago Equipo POS' : 'FACTURA GENERADA'}
                                        </div>
                                    </td>
                                    <td className="py-5 text-sm text-gray-600 font-bold">{new Date(record.date).toLocaleDateString()}</td>
                                    <td className="py-5 text-sm text-gray-500 font-medium">{record.method}</td>
                                    <td className="py-5 text-sm font-black text-gray-900">${record.amount.toFixed(2)}</td>
                                    <td className="py-5 text-right">
                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-black uppercase tracking-wider">PAGADO</span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center text-gray-300 font-bold uppercase tracking-widest text-xs">Aún no hay registros de pago</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Modal de Equipo POS */}
            {isEquipmentModalOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="bg-slate-50 p-8 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase tracking-widest leading-none mb-1">Planes de Equipo POS</h1>
                                <p className="text-gray-500 font-medium text-sm">Selecciona el plan que mejor se adapte a tu negocio</p>
                            </div>
                            <button onClick={() => !isPaying && setIsEquipmentModalOpen(false)} className="w-12 h-12 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all hover:rotate-90">
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
                                        className={`p-6 rounded-[24px] border-2 transition-all flex flex-col items-start gap-1 text-left ${selectedEquipmentPlan?.name === plan.id ? 'border-primary bg-primary/5 ring-4 ring-primary/10' : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'}`}
                                    >
                                        <div className="flex justify-between w-full items-center mb-1">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{plan.label}</span>
                                            {selectedEquipmentPlan?.name === plan.id && <span className="material-icons-round text-primary text-sm">check_circle</span>}
                                        </div>
                                        <span className="text-xl font-black text-gray-900">{plan.name}</span>
                                        <span className="text-2xl font-black text-primary">${plan.price.toLocaleString()} <span className="text-[10px] font-bold text-gray-400 uppercase">MXN</span></span>
                                    </button>
                                ))}
                            </div>

                            {selectedEquipmentPlan && (
                                <div className="animate-in slide-in-from-bottom-4 duration-500">
                                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mb-8 flex items-center justify-between">
                                        <div>
                                            <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest mb-1">Total a Pagar Hoy</p>
                                            <p className="text-3xl font-black text-blue-900">${selectedEquipmentPlan.price.toLocaleString()} MXN</p>
                                        </div>
                                        <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-200">
                                            <span className="material-icons-round">shopping_cart</span>
                                        </div>
                                    </div>
                                    
                                    <button
                                        onClick={handleEquipmentPayment}
                                        className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[24px] font-black text-xl shadow-2xl shadow-blue-200 transition-all flex items-center justify-center gap-3 active:scale-95"
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
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">Mi Plan Equipo POS</h3>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Plan: {posStatus.plan?.replace('_', ' ')}</p>
                            </div>
                            <button onClick={() => setIsProgressModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <span className="material-icons-round text-3xl">close</span>
                            </button>
                        </div>
                        
                        <div className="p-8">
                            <div className="mb-10 text-center">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 block">Progreso de Pago</span>
                                <div className="text-5xl font-black text-gray-900 tracking-tighter mb-2">
                                    ${posStatus.amountPaid.toLocaleString()}
                                    <span className="text-xl font-bold text-gray-300 ml-2">/ $5,000</span>
                                </div>
                                <div className="w-full bg-gray-100 h-4 rounded-full overflow-hidden mt-6 mb-2 border border-gray-100">
                                    <div 
                                        className="h-full bg-primary transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(93,95,239,0.4)]" 
                                        style={{ width: `${(posStatus.amountPaid / 5000) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                                    <span>Pagado</span>
                                    <span>Restante: ${(5000 - posStatus.amountPaid).toLocaleString()} MXN</span>
                                </div>
                            </div>

                            <div className="space-y-4 mb-10">
                                <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100 flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Monto Mensual</p>
                                        <p className="text-xl font-black text-gray-900">${(posStatus.plan === '3_MESES' ? 1666.66 : posStatus.plan === '6_MESES' ? 833.33 : 625).toLocaleString()} MXN</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Estatus</p>
                                        <span className="text-xs font-black text-primary p-2 bg-primary/10 rounded-lg">PENDIENTE PAGO</span>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleRecurringEquipmentPayment}
                                className="w-full py-5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-lg shadow-xl shadow-slate-200 transition-all flex items-center justify-center gap-3 active:scale-95"
                            >
                                <span className="material-icons-round">payment</span>
                                REALIZAR SIGUIENTE PAGO
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
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="bg-white rounded-[24px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-slate-50 p-6 border-b border-gray-100 flex justify-between items-center text-gray-900">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <span className="material-icons-round text-white text-sm">payments</span>
                    </div>
                    <span className="font-black tracking-tight">{title}</span>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <span className="material-icons-round">close</span>
                </button>
            </div>

            <div className="p-8">
                <div className="mb-8">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Monto a Pagar</span>
                    <div className="text-3xl font-black text-gray-900 leading-none flex items-baseline gap-1">
                        ${amount.toFixed(2)} 
                        <span className="text-sm font-bold text-gray-400 uppercase">MXN</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 block">Correo Electrónico</label>
                        <input type="email" placeholder="ejemplo@correo.com" className="w-full p-3 border border-gray-200 rounded-xl outline-none transition-all font-medium text-gray-800" />
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 block">Información de la Tarjeta</label>
                        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <input type="text" placeholder="Número de tarjeta" className="w-full p-4 bg-white outline-none font-mono text-gray-700" />
                            <div className="flex border-t border-gray-200">
                                <input type="text" placeholder="MM / YY" className="w-1/2 p-4 bg-white border-r border-gray-200 outline-none font-mono text-gray-700" />
                                <input type="text" placeholder="CVC" className="w-1/2 p-4 bg-white outline-none font-mono text-gray-700" />
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onPay}
                    disabled={isPaying}
                    className={`w-full mt-10 py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50`}
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

                <p className="mt-8 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                    <span className="material-icons-round text-sm">security</span>
                    Pagos Seguros by Stripe
                </p>
            </div>
        </div>
    </div>
);
