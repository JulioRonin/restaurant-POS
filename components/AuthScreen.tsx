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
        <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden font-sans" style={{ background: '#FAFAF3' }}>
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
                        className="inline-flex items-center justify-center w-16 h-16 md:w-24 md:h-24 rounded-solaris bg-[#505530]/10 border border-[#505530]/20 mb-4 md:mb-8 overflow-hidden"
                    >
                        <img src="/koso-logo.jpg" alt="KŌSO" className="w-full h-full object-cover" />
                    </motion.div>
                    <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-[#FAFAF3] !text-[#FAFAF3] uppercase mb-2 md:mb-4 drop-shadow-lg">KŌSO POS</h1>
                    <p className="text-white/60 font-bold text-[8px] md:text-[10px] uppercase tracking-[0.4em] md:tracking-[0.6em] italic">Restaurant Management System</p>
                </div>

                <GlowCard glowColor="orange" customSize className="w-full !p-0 overflow-hidden border border-[#505530]/20 bg-white rounded-solaris shadow-2xl">
                    <div className="p-6 md:p-14">
                            <div className="border-b border-[#505530]/10">
                            <button 
                                onClick={() => setIsLogin(true)}
                                className={`pb-4 md:pb-6 text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] transition-all relative whitespace-nowrap ${isLogin ? 'text-[#F98359]' : 'text-[#505530]/30 hover:text-[#505530]/60'}`}
                            >
                                Iniciar Sesión
                                {isLogin && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#F98359] shadow-solaris-glow" />}
                            </button>
                            <button 
                                onClick={() => setIsLogin(false)}
                                className={`pb-6 text-[11px] font-black uppercase tracking-[0.3em] transition-all relative ${!isLogin ? 'text-[#F98359]' : 'text-[#505530]/30 hover:text-[#505530]/60'}`}
                            >
                                Registrar Negocio
                                {!isLogin && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#F98359] shadow-solaris-glow" />}
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
                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#505530]/60 mb-3 px-2">Nombre Comercial</label>
                                            <div className="relative">
                                                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-[#505530]/30 group-focus-within/field:text-[#F98359] transition-colors" size={20} />
                                                <input 
                                                    type="text" required value={businessName}
                                                    onChange={(e) => setBusinessName(e.target.value)}
                                                    className="w-full bg-[#F0F0E8] border border-[#505530]/20 rounded-[22px] py-5 pl-14 pr-6 text-[#505530] text-sm focus:bg-white focus:border-[#F98359]/50 transition-all outline-none placeholder:text-[#505530]/30"
                                                    placeholder="ej. Mi Restaurante"
                                                />
                                            </div>
                                        </div>
                                        <div className="relative group/field">
                                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#505530]/60 mb-3 px-2">Nombre Completo (Dueño)</label>
                                            <div className="relative">
                                                <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-[#505530]/30 group-focus-within/field:text-[#F98359] transition-colors" size={20} />
                                                <input 
                                                    type="text" required value={fullName}
                                                    onChange={(e) => setFullName(e.target.value)}
                                                    className="w-full bg-[#F0F0E8] border border-[#505530]/20 rounded-[22px] py-5 pl-14 pr-6 text-[#505530] text-sm focus:bg-white focus:border-[#F98359]/50 transition-all outline-none placeholder:text-[#505530]/30"
                                                    placeholder="Tu nombre real"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="relative group/field">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#505530]/60 mb-3 px-2">E-mail</label>
                                <div className="relative">
                                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-[#505530]/30 group-focus-within/field:text-[#F98359] transition-colors" size={20} />
                                    <input 
                                        type="email" required value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-[#F0F0E8] border border-[#505530]/20 rounded-[22px] py-5 pl-14 pr-6 text-[#505530] text-sm focus:bg-white focus:border-[#F98359]/50 transition-all outline-none placeholder:text-[#505530]/30"
                                        placeholder="correo@turestaurante.com"
                                    />
                                </div>
                            </div>

                            <div className="relative group/field">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-[#505530]/60 mb-3 px-2">Contrasena</label>
                                <div className="relative">
                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-[#505530]/30 group-focus-within/field:text-[#F98359] transition-colors" size={20} />
                                    <input 
                                        type="password" required value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-[#F0F0E8] border border-[#505530]/20 rounded-[22px] py-5 pl-14 pr-6 text-[#505530] text-sm focus:bg-white focus:border-[#F98359]/50 transition-all outline-none placeholder:text-[#505530]/30"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <motion.button 
                                whileHover={{ scale: 1.02, boxShadow: "0 0 40px rgba(249, 115, 22, 0.4)" }}
                                whileTap={{ scale: 0.98 }}
                                disabled={loading}
                                className="w-full bg-[#F98359] text-[#FAFAF3] !text-[#FAFAF3] font-black uppercase tracking-[0.4em] py-6 rounded-[24px] shadow-solaris-glow transition-all flex items-center justify-center gap-4 mt-12 disabled:opacity-50 text-[11px] italic"
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

                <p className="text-center mt-12 text-[10px] font-black text-white/30 uppercase tracking-[0.5em] italic mb-16">
                    KŌSO POS v1.0 • Secure Restaurant Management
                </p>
            </motion.div>
        </div>
    );
};
