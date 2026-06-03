import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { motion, AnimatePresence } from 'framer-motion';
import { GlowCard } from './ui/spotlight-card';
import { Lock, Mail, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';

export const AuthScreen: React.FC = () => {
    const { signIn, signUp } = useUser();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (isLogin) {
                await signIn(email, password);
            } else {
                await signUp(email, password, businessName, fullName);
                setError('Cuenta creada con éxito. Revisa tu correo para confirmar antes de entrar.');
                setIsLogin(true);
            }
        } catch (err: any) {
            setError(err.message || 'Ocurrió un error inesperado');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden font-sans" style={{ background: '#1A1E2E' }}>
            {/* Background Gradient/Mesh */}
            <div className="absolute inset-0 w-full h-full z-0 pointer-events-none opacity-40">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#C4633F]/20 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#C9A24A]/10 blur-[100px]" />
            </div>

            {/* Content Container */}
            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-xl px-6"
            >
                {/* Branding */}
                <div className="text-center mb-10 flex flex-col items-center">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
                        className="mb-4"
                    >
                        <Logo variant="midnight" size={96} showText={true} textClassName="text-4xl font-semibold !text-[#FAF8F4]" />
                    </motion.div>
                </div>

                <GlowCard glowColor="orange" customSize className="w-full !p-0 overflow-hidden border border-[#FAF8F4]/10 bg-[#FAF8F4] rounded-solaris shadow-2xl">
                    <div className="p-6 md:p-14">
                        <div className="border-b border-[#2A2826]/10 flex gap-8">
                            <button 
                                onClick={() => setIsLogin(true)}
                                className={`pb-4 md:pb-6 text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] transition-all relative whitespace-nowrap ${isLogin ? 'text-[#C4633F]' : 'text-[#2A2826]/30 hover:text-[#2A2826]/60'}`}
                            >
                                Iniciar Sesión
                                {isLogin && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#C4633F] shadow-solaris-glow" />}
                            </button>
                            <button 
                                onClick={() => setIsLogin(false)}
                                className={`pb-4 md:pb-6 text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] transition-all relative whitespace-nowrap ${!isLogin ? 'text-[#C4633F]' : 'text-[#2A2826]/30 hover:text-[#2A2826]/60'}`}
                            >
                                Registrar Negocio
                                {!isLogin && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#C4633F] shadow-solaris-glow" />}
                            </button>
                        </div>

                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="mb-10 p-5 bg-red-500/10 border border-red-500/20 rounded-[20px] flex items-center gap-4 mt-6"
                            >
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <p className="text-red-500 text-[11px] font-black uppercase tracking-widest">{error}</p>
                            </motion.div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-8 mt-8">
                            <AnimatePresence mode="wait">
                                {!isLogin && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="space-y-8"
                                    >
                                        <div className="relative group/field">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#2A2826]/60 mb-3 px-2">Nombre Comercial</label>
                                            <div className="relative">
                                                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-[#2A2826]/30 group-focus-within/field:text-[#C4633F] transition-colors" size={20} />
                                                <input 
                                                    type="text" required value={businessName}
                                                    onChange={(e) => setBusinessName(e.target.value)}
                                                    className="w-full bg-[#FAF8F4] border border-[#2A2826]/20 rounded-[22px] py-5 pl-14 pr-6 text-[#2A2826] text-sm focus:bg-white focus:border-[#C4633F]/50 transition-all outline-none placeholder:text-[#2A2826]/30"
                                                    placeholder="ej. Mi Restaurante"
                                                />
                                            </div>
                                        </div>
                                        <div className="relative group/field">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#2A2826]/60 mb-3 px-2">Nombre Completo (Dueño)</label>
                                            <div className="relative">
                                                <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-[#2A2826]/30 group-focus-within/field:text-[#C4633F] transition-colors" size={20} />
                                                <input 
                                                    type="text" required value={fullName}
                                                    onChange={(e) => setFullName(e.target.value)}
                                                    className="w-full bg-[#FAF8F4] border border-[#2A2826]/20 rounded-[22px] py-5 pl-14 pr-6 text-[#2A2826] text-sm focus:bg-white focus:border-[#C4633F]/50 transition-all outline-none placeholder:text-[#2A2826]/30"
                                                    placeholder="Tu nombre real"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="relative group/field">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#2A2826]/60 mb-3 px-2">E-mail</label>
                                <div className="relative">
                                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-[#2A2826]/30 group-focus-within/field:text-[#C4633F] transition-colors" size={20} />
                                    <input 
                                        type="email" required value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-[#FAF8F4] border border-[#2A2826]/20 rounded-[22px] py-5 pl-14 pr-6 text-[#2A2826] text-sm focus:bg-white focus:border-[#C4633F]/50 transition-all outline-none placeholder:text-[#2A2826]/30"
                                        placeholder="correo@turestaurante.com"
                                    />
                                </div>
                            </div>

                            <div className="relative group/field">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#2A2826]/60 mb-3 px-2">Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-[#2A2826]/30 group-focus-within/field:text-[#C4633F] transition-colors" size={20} />
                                    <input 
                                        type="password" required value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-[#FAF8F4] border border-[#2A2826]/20 rounded-[22px] py-5 pl-14 pr-6 text-[#2A2826] text-sm focus:bg-white focus:border-[#C4633F]/50 transition-all outline-none placeholder:text-[#2A2826]/30"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <motion.button 
                                whileHover={{ scale: 1.02, boxShadow: "0 0 40px rgba(196, 99, 63, 0.4)" }}
                                whileTap={{ scale: 0.98 }}
                                disabled={loading}
                                className="w-full bg-[#C4633F] text-[#FAF8F4] !text-[#FAF8F4] font-black uppercase tracking-[0.4em] py-6 rounded-[24px] shadow-solaris-glow transition-all flex items-center justify-center gap-4 mt-12 disabled:opacity-50 text-[11px] italic"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        {isLogin ? 'Entrar' : 'Crear mi restaurante'}
                                        <ArrowRight size={20} />
                                    </>
                                )}
                             </motion.button>
                        </form>
                    </div>
                </GlowCard>

                <p className="text-center mt-12 text-[10px] font-black text-white/30 uppercase tracking-[0.5em] italic mb-16">
                    ServiRest — Aliados del rubro
                </p>
            </motion.div>
        </div>
    );
};
