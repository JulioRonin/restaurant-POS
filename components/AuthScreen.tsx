import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, Building2, User, Mail, Lock, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const AuthScreen: React.FC = () => {
    const { signIn, signUp } = useUser();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    // Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [fullName, setFullName] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                await signIn(email, password);
            } else {
                const success = await signUp(email, password, businessName, fullName);
                if (success) {
                    setIsSuccess(true);
                }
            }
        } catch (err: any) {
            setError(err.message || 'Ocurrió un error inesperado');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-solaris-black text-white overflow-hidden font-sans antialiased">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] right-[-5%] w-[60%] h-[60%] bg-solaris-orange/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-5%] w-[60%] h-[60%] bg-solaris-orange/5 rounded-full blur-[120px] animate-pulse delay-1000"></div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-md px-6"
            >
                {/* Logo Section */}
                <div className="text-center mb-12">
                    <motion.div 
                        whileHover={{ rotate: 12, scale: 1.1 }}
                        className="w-20 h-20 bg-solaris-orange rounded-solaris flex items-center justify-center shadow-solaris-glow mx-auto mb-6"
                    >
                        <ShieldCheck className="w-10 h-10 text-white" />
                    </motion.div>
                    <h1 className="text-4xl font-black tracking-tighter mb-2 uppercase italic">Solaris OS</h1>
                    <p className="text-gray-500 font-bold text-[10px] uppercase tracking-[0.5em]">Intelligent POS Ecosystem</p>
                </div>

                {/* Auth Card */}
                <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/5 p-10 rounded-solaris shadow-2xl relative overflow-hidden group">
                    {/* Inner Glow Decorative */}
                    <div className="absolute -top-24 -left-24 w-48 h-48 bg-solaris-orange/10 rounded-full blur-3xl group-hover:bg-solaris-orange/20 transition-all duration-700"></div>

                    <div className="flex gap-4 mb-10 p-1.5 bg-white/[0.03] rounded-2xl border border-white/5">
                        <button 
                            onClick={() => { setIsLogin(true); setIsSuccess(false); }}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${isLogin ? 'bg-solaris-orange text-white shadow-solaris-glow' : 'text-gray-500 hover:text-white'}`}
                        >
                            <LogIn className="w-3.5 h-3.5" />
                            Ingresar
                        </button>
                        <button 
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2 ${!isLogin ? 'bg-solaris-orange text-white shadow-solaris-glow' : 'text-gray-500 hover:text-white'}`}
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                            Registrar
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        {isSuccess ? (
                            <motion.div 
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center text-center gap-6"
                            >
                                <div className="w-24 h-24 bg-solaris-orange/10 rounded-full flex items-center justify-center border border-solaris-orange/20">
                                    <Mail className="w-10 h-10 text-solaris-orange animate-bounce" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2">¡Confirma tu Correo!</h2>
                                    <p className="text-sm text-gray-400 font-medium">Hemos enviado un enlace a <span className="text-solaris-orange font-bold">{email}</span></p>
                                </div>
                                <button 
                                    onClick={() => { setIsLogin(true); setIsSuccess(false); }}
                                    className="w-full py-4 bg-white/[0.05] hover:bg-white/[0.1] text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border border-white/10"
                                >
                                    ← Volver al Inicio
                                </button>
                            </motion.div>
                        ) : (
                            <motion.form 
                                key={isLogin ? 'login' : 'signup'}
                                initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
                                onSubmit={handleSubmit} 
                                className="space-y-6"
                            >
                                {!isLogin && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Establecimiento</label>
                                            <div className="relative">
                                                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                                                <input 
                                                    type="text" required value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                                                    placeholder="Ej. Solaris Gastropub"
                                                    className="w-full bg-white/[0.02] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-solaris-orange/50 focus:bg-white/[0.05] transition-all placeholder:text-gray-700 font-medium"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nombre Completo</label>
                                            <div className="relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                                                <input 
                                                    type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                                                    placeholder="Tu nombre real"
                                                    className="w-full bg-white/[0.02] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-solaris-orange/50 focus:bg-white/[0.05] transition-all placeholder:text-gray-700 font-medium"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                                        <input 
                                            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                                            placeholder="admin@solaris-pos.com"
                                            className="w-full bg-white/[0.02] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-solaris-orange/50 focus:bg-white/[0.05] transition-all placeholder:text-gray-700 font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Contraseña</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                                        <input 
                                            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-white/[0.02] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-solaris-orange/50 focus:bg-white/[0.05] transition-all placeholder:text-gray-700 font-medium"
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold py-3 px-4 rounded-xl flex items-center gap-2"
                                    >
                                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
                                        {error}
                                    </motion.div>
                                )}

                                <button 
                                    type="submit" disabled={loading}
                                    className="w-full bg-solaris-orange text-white font-black uppercase tracking-[0.2em] py-5 rounded-2xl shadow-solaris-glow transition-all transform hover:scale-[1.02] active:scale-[0.98] mt-4 flex items-center justify-center gap-3 group"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <span>{isLogin ? 'Desbloquear Terminal' : 'Registrar Estación'}</span>
                                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                        </>
                                    )}
                                </button>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
            
            {/* Footer Branding */}
            <div className="absolute bottom-12 text-center w-full">
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.6em]">Powered by Ronin Solaris System</p>
            </div>
        </div>
    );
};
