import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { motion, AnimatePresence } from 'framer-motion';
import { GlowCard } from './ui/spotlight-card';
import { SolarisShader } from './ui/solaris-shader';
import { Lock, User, Terminal, LogOut, ShieldAlert } from 'lucide-react';

export const LockScreen: React.FC = () => {
    const { employees, switchEmployee, signOut, authProfile } = useUser();
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    const handlePinClick = (num: string) => {
        if (pin.length < 4) {
            setPin(prev => prev + num);
        }
    };

    const handleDelete = () => setPin(prev => prev.slice(0, -1));

    const handleUnlock = () => {
        if (selectedUser && pin.length === 4) {
            const success = switchEmployee(selectedUser, pin);
            if (!success) {
                setError(true);
                setPin('');
                setTimeout(() => setError(false), 2000);
            }
        }
    };

    // Auto-trigger unlock when pin reaches 4 digits
    React.useEffect(() => {
        if (pin.length === 4) handleUnlock();
    }, [pin]);

    return (
        <div className="relative min-h-screen w-full flex flex-col md:flex-row bg-[#FAFAF3] overflow-hidden font-sans pt-12 md:pt-0">
            {/* Background Shader */}
            <SolarisShader />

            {/* Left: User Selection */}
            <div className="relative z-10 flex-1 flex flex-col justify-center px-6 md:px-12 py-10 overflow-y-auto custom-scrollbar lg:max-h-screen">
                <div className="mb-8 md:mb-12 mt-8 md:mt-0">
                    <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter text-white uppercase mb-2 leading-none drop-shadow-lg">KOSO Terminal</h1>
                    <p className="text-white/50 font-bold text-[8px] md:text-[10px] uppercase tracking-[0.3em] md:tracking-[0.5em]">Identidad de Operador Requerida</p>
                </div>

                <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                    {employees.map((emp) => (
                        <motion.div
                            key={emp.id}
                            whileHover={{ y: -5 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                                setSelectedUser(emp.id);
                                setPin('');
                            }}
                        >
                            <GlowCard 
                                glowColor="orange"
                                className={`cursor-pointer transition-all border-2 flex flex-col items-center !p-4 md:!p-6 rounded-solaris h-full ${selectedUser === emp.id ? 'border-solaris-orange bg-solaris-orange/5 shadow-solaris-glow' : 'border-white/5 bg-white/[0.01]'}`}
                            >
                                <div className="relative mb-3 md:mb-4">
                                    <div className={`w-14 h-14 md:w-20 md:h-20 rounded-full p-1 border-2 ${selectedUser === emp.id ? 'border-solaris-orange' : 'border-white/10'}`}>
                                        <img 
                                            src={emp.image || 'https://ui-avatars.com/api/?background=333&color=fff'} 
                                            alt={emp.name} 
                                            className="w-full h-full rounded-full object-cover filter contrast-125 transition-all"
                                        />
                                    </div>
                                    {selectedUser === emp.id && (
                                        <motion.div 
                                            layoutId="check"
                                            className="absolute -bottom-1 -right-1 bg-solaris-orange text-white rounded-full p-1 shadow-lg"
                                        >
                                            <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                                                <div className="w-2 h-2 bg-white rounded-full" />
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                                <h3 className={`font-black uppercase text-[9px] md:text-[10px] tracking-widest text-center truncate w-full ${selectedUser === emp.id ? 'text-[#1a1c14]' : 'text-white/40'}`}>{emp.name}</h3>
                                <p className={`text-[7px] md:text-[8px] font-bold uppercase mt-1 ${selectedUser === emp.id ? 'text-solaris-orange' : 'text-white/20'}`}>{emp.role}</p>
                            </GlowCard>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-auto pt-12 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-white/20">
                        <Terminal size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{authProfile?.businessName || 'KOSO POS'}</span>
                    </div>
                    <button 
                        onClick={signOut}
                        className="flex items-center gap-2 text-red-500/40 hover:text-red-500 transition-colors text-[10px] font-black uppercase tracking-widest"
                    >
                        Salir del Nodo <LogOut size={16} />
                    </button>
                </div>
            </div>

            {/* Right: Keypad Area */}
            <div className="relative z-10 w-full md:w-[450px] bg-[#505530]/5 backdrop-blur-3xl border-t md:border-t-0 md:border-l border-[#505530]/10 flex flex-col items-center justify-center p-6 md:p-8">
                <div className="w-full max-w-[280px] md:max-w-[300px]">
                    <div className="text-center mb-6 md:mb-10">
                        <div className={`inline-flex items-center justify-center w-14 h-14 md:w-20 md:h-20 rounded-[24px] md:rounded-[32px] bg-white/[0.02] border border-white/10 mb-4 md:mb-6 ${error ? 'border-red-500/50 bg-red-500/5 text-red-500' : 'text-solaris-orange shadow-solaris-glow'}`}>
                           {error ? <ShieldAlert size={24} /> : <Lock size={24} />}
                        </div>
                        <h2 className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] md:tracking-[0.4em] text-[#505530]/50 mb-6 md:mb-10 italic">Protocolo de Seguridad</h2>
                        
                        <div className="flex justify-center gap-4 md:gap-5">
                            {[0, 1, 2, 3].map((i) => (
                                <motion.div
                                    key={i}
                                    animate={error ? { x: [0, -5, 5, -5, 5, 0] } : {}}
                                    className={`w-3 h-3 md:w-4 md:h-4 rounded-full transition-all duration-300 border border-white/10 ${pin.length > i ? 'bg-solaris-orange scale-125 shadow-solaris-glow border-solaris-orange/50' : 'bg-white/5'}`}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 md:gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <motion.button
                                key={num}
                                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handlePinClick(num.toString())}
                                className="h-16 md:h-20 rounded-[20px] md:rounded-[28px] border border-[#505530]/15 bg-white text-xl md:text-2xl font-black italic text-[#1a1c14] transition-all shadow-sm hover:shadow-2xl hover:text-solaris-orange"
                            >
                                {num}
                            </motion.button>
                        ))}
                        <button className="h-16 md:h-20" />
                        <motion.button
                            whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handlePinClick('0')}
                            className="h-16 md:h-20 rounded-[20px] md:rounded-[28px] border border-[#505530]/15 bg-white text-xl md:text-2xl font-black italic text-[#1a1c14] transition-all shadow-sm hover:shadow-2xl hover:text-solaris-orange"
                        >
                            0
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.05, backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleDelete}
                            className="h-16 md:h-20 rounded-[20px] md:rounded-[28px] border border-red-500/10 bg-red-500/5 text-red-500/60 flex items-center justify-center transition-all hover:text-red-500"
                        >
                            <User size={20} />
                        </motion.button>
                    </div>
                </div>
            </div>
        </div>
    );
};
