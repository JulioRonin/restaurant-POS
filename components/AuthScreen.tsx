import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';

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
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-gray-900 text-white overflow-hidden font-sans">
            {/* Ambient Background */}
            <div className="absolute top-[-10%] right-[-5%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-5%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>

            <div className="relative z-10 w-full max-w-md px-6">
                {/* Logo Section */}
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/40 mx-auto mb-6 transform hover:rotate-12 transition-transform duration-500">
                        <span className="material-icons-round text-3xl">restaurant</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight mb-2 uppercase">Culinex POS</h1>
                    <p className="text-gray-400 font-medium">SaaS Multi-Tenant Architecture</p>
                </div>

                {/* Auth Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
                    <div className="flex gap-4 mb-8 p-1 bg-gray-800/50 rounded-xl">
                        <button 
                            onClick={() => { setIsLogin(true); setIsSuccess(false); }}
                            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${isLogin ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'}`}
                        >
                            Ingresar
                        </button>
                        <button 
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all duration-300 ${!isLogin ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white'}`}
                        >
                            Registrar
                        </button>
                    </div>

                    {isSuccess ? (
                        <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-8 rounded-3xl flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-500">
                            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/40 mb-2 transform scale-110">
                                <span className="material-icons-round text-white text-4xl">email</span>
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tight text-white">¡Confirma tu Correo!</h2>
                            <p className="text-sm leading-relaxed text-gray-300">
                                Hemos enviado un enlace de activación a:
                                <br/>
                                <span className="font-bold text-green-400 text-base">{email}</span>
                            </p>
                            <div className="bg-white/5 p-4 rounded-2xl text-left w-full space-y-2 border border-white/5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Próximos pasos:</p>
                                <ul className="text-xs text-gray-400 space-y-1">
                                    <li className="flex gap-2"><span className="text-green-500">✔</span> Busca el correo de Culinex POS</li>
                                    <li className="flex gap-2"><span className="text-green-500">✔</span> Haz clic en el botón de confirmar</li>
                                    <li className="flex gap-2"><span className="text-green-500">✔</span> Regresa aquí para iniciar sesión</li>
                                </ul>
                            </div>
                            <button 
                                onClick={() => { setIsLogin(true); setIsSuccess(false); }}
                                className="mt-4 w-full py-3 bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all outline-none border border-white/10"
                            >
                                ← Volver al Inicio de Sesión
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {!isLogin && (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nombre del Negocio</label>
                                        <input 
                                            type="text" required value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                                            placeholder="Ej. Tacos El Don"
                                            className="w-full bg-gray-800/50 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-gray-600 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nombre Completo (Admin)</label>
                                        <input 
                                            type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)}
                                            placeholder="Tu nombre"
                                            className="w-full bg-gray-800/50 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-gray-600 transition-all"
                                        />
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Correo Electrónico</label>
                                <input 
                                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@business.com"
                                    className="w-full bg-gray-800/50 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-gray-600 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Contraseña</label>
                                <input 
                                    type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-gray-800/50 border border-white/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-gray-600 transition-all"
                                />
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-3 px-4 rounded-xl flex items-center gap-2">
                                    <span className="material-icons-round text-sm">error_outline</span>
                                    {error}
                                </div>
                            )}

                            <button 
                                type="submit" disabled={loading}
                                className="w-full bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-xl shadow-primary/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <span>{isLogin ? 'Entrar al Sistema' : 'Crear Negocio'}</span>
                                        <span className="material-icons-round text-lg">arrow_forward</span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
            
            {/* Footer Branding */}
            <div className="absolute bottom-8 text-center w-full">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em]">By Ronin Studio</p>
            </div>
        </div>
    );
};
