import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { motion, AnimatePresence } from 'framer-motion';
import { GlowCard } from './ui/spotlight-card';
import { SolarisShader } from './ui/solaris-shader';
import { Lock, Mail, User, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

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
        <div className="relative min-h-screen w-full flex items-center justify-center bg-[#111827] overflow-hidden font-sans">
            {/* Background Shader */}
            <SolarisShader />

            {/* Content Container */}
            <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-xl px-6"
            >
                {/* Branding */}
                <div className="text-center mb-8 md:mb-12">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="inline-flex items-center justify-center w-16 h-16 md:w-24 md:h-24 rounded-solaris bg-white/[0.03] border border-white/10 mb-4 md:mb-8 shadow-solaris-glow"
                    >
                        <Zap className="text-solaris-orange" size={32} />
                    </motion.div>
                    <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white uppercase mb-2 md:mb-4">Solaris Core</h1>
                    <p className="text-white/20 font-bold text-[8px] md:text-[10px] uppercase tracking-[0.4em] md:tracking-[0.6em] italic">Ultimate OS Control Terminal</p>
                </div>

                <GlowCard glowColor="orange" customSize className="w-full !p-0 overflow-hidden border border-white/5 backdrop-blur-3xl bg-white/[0.02] rounded-solaris shadow-2xl">
                    <div className="p-6 md:p-14">
                        <div className="flex gap-6 md:gap-10 mb-8 md:mb-12 border-b border-white/5 overflow-x-auto no-scrollbar">
                            <button 
                                onClick={() => setIsLogin(true)}
                                className={`pb-4 md:pb-6 text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] transition-all relative whitespace-nowrap ${isLogin ? 'text-solaris-orange' : 'text-white/20 hover:text-white/40'}`}
                            >
                                Iniciar Sesión
                                {isLogin && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-solaris-orange shadow-solaris-glow" />}
                            </button>
                            <button 
                                onClick={() => setIsLogin(false)}
                                className={`pb-6 text-[11px] font-black uppercase tracking-[0.3em] transition-all relative ${!isLogin ? 'text-solaris-orange' : 'text-white/20 hover:text-white/40'}`}
                            >
                                Registrar Negocio
                                {!isLogin && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-solaris-orange shadow-solaris-glow" />}
                            </button>
                        </div>

                        {error && (
                            <motion.div 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="mb-10 p-5 bg-red-500/10 border border-red-500/20 rounded-[20px] flex items-center gap-4"
                            >
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                <p className="text-red-500 text-[11px] font-black uppercase tracking-widest">{error}</p>
                            </motion.div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-8">
                            <AnimatePresence mode="wait">
                                {!isLogin && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="space-y-8"
                                    >
                                        <div className="relative group/field">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3 px-2">Nombre Comercial</label>
                                            <div className="relative">
                                                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-white/10 group-focus-within/field:text-solaris-orange transition-colors" size={20} />
                                                <input 
                                                    type="text" required value={businessName}
                                                    onChange={(e) => setBusinessName(e.target.value)}
                                                    className="w-full bg-white/[0.03] border border-white/5 rounded-[22px] py-5 pl-14 pr-6 text-white text-sm focus:bg-white/[0.06] focus:border-solaris-orange/30 transition-all outline-none placeholder:text-white/5"
                                                    placeholder="ej. Solaris Bistro"
                                                />
                                            </div>
                                        </div>
                                        <div className="relative group/field">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3 px-2">Nombre Completo (Dueño)</label>
                                            <div className="relative">
                                                <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-white/10 group-focus-within/field:text-solaris-orange transition-colors" size={20} />
                                                <input 
                                                    type="text" required value={fullName}
                                                    onChange={(e) => setFullName(e.target.value)}
                                                    className="w-full bg-white/[0.03] border border-white/5 rounded-[22px] py-5 pl-14 pr-6 text-white text-sm focus:bg-white/[0.06] focus:border-solaris-orange/30 transition-all outline-none placeholder:text-white/5"
                                                    placeholder="Tu nombre real"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="relative group/field">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3 px-2">E-mail Operativo</label>
                                <div className="relative">
                                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-white/10 group-focus-within/field:text-solaris-orange transition-colors" size={20} />
                                    <input 
                                        type="email" required value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/5 rounded-[22px] py-5 pl-14 pr-6 text-white text-sm focus:bg-white/[0.06] focus:border-solaris-orange/30 transition-all outline-none placeholder:text-white/5"
                                        placeholder="terminal@solaris.os"
                                    />
                                </div>
                            </div>

                            <div className="relative group/field">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3 px-2">Security PIN / Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-white/10 group-focus-within/field:text-solaris-orange transition-colors" size={20} />
                                    <input 
                                        type="password" required value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/5 rounded-[22px] py-5 pl-14 pr-6 text-white text-sm focus:bg-white/[0.06] focus:border-solaris-orange/30 transition-all outline-none placeholder:text-white/5"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <motion.button 
                                whileHover={{ scale: 1.02, boxShadow: "0 0 40px rgba(249, 115, 22, 0.4)" }}
                                whileTap={{ scale: 0.98 }}
                                disabled={loading}
                                className="w-full bg-solaris-orange text-white font-black uppercase tracking-[0.4em] py-6 rounded-[24px] shadow-solaris-glow transition-all flex items-center justify-center gap-4 mt-12 disabled:opacity-50 text-[11px] italic"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        {isLogin ? 'Acceder al Nodo' : 'Iniciar Secuencia de Registro'}
                                        <ArrowRight size={20} />
                                    </>
                                )}
                            </motion.button>
                        </form>
                    </div>
                </GlowCard>

                <p className="text-center mt-12 text-[10px] font-black text-white/10 uppercase tracking-[0.5em] italic mb-16">
                    Solaris OS v4.1 • Secure Transaction Layer Encrypted
                </p>
            </motion.div>
        </div>
    );
};
