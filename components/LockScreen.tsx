import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { useSettings } from '../contexts/SettingsContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, LogOut, RefreshCw, Smartphone, Monitor, UserCheck, Delete, LayoutDashboard } from 'lucide-react';

export const LockScreen: React.FC = () => {
    const { employees, switchEmployee, setEmployeePin, signOut, authProfile, isSuperAdmin, triggerSync, refreshEmployees } = useUser();
    const { settings } = useSettings();
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    const ADMIN_AVATAR = "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200&h=200";

    // Animation state for keypad presses
    const [activeKey, setActiveKey] = useState<string | null>(null);

    const handleKeyPress = (key: string) => {
        setActiveKey(key);
        setTimeout(() => setActiveKey(null), 150);

        if (key === 'backspace') {
            setPin(prev => prev.slice(0, -1));
            return;
        }

        if (pin.length < 4) {
            setPin(prev => prev + key);
        }
    };

    useEffect(() => {
        if (pin.length === 4) {
            if (selectedUser) {
                const targetUser = employees.find(e => e.id === selectedUser);
                
                if (targetUser && targetUser.pin === null) {
                    setEmployeePin(selectedUser, pin).then(() => {
                        setPin('');
                    });
                    return;
                }

                const success = switchEmployee(selectedUser, pin);
                if (success) {
                    setPin('');
                } else {
                    setError(true);
                    setTimeout(() => {
                        setPin('');
                        setError(false);
                    }, 1000);
                }
            }
        }
    }, [pin, selectedUser, switchEmployee, setEmployeePin, employees]);

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-solaris-black text-white overflow-hidden font-sans antialiased">
            {/* Solaris Ambient Shadows */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-solaris-orange/5 rounded-full blur-[150px] animate-pulse"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-solaris-orange/10 rounded-full blur-[150px] animate-pulse delay-700"></div>

            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 w-full max-w-5xl flex flex-col items-center"
            >
                {/* Header */}
                <div className="mb-12 text-center px-4">
                    {settings.logoUrl ? (
                        <motion.div 
                            whileHover={{ scale: 1.05 }}
                            className="w-28 h-28 mb-8 mx-auto rounded-solaris overflow-hidden shadow-solaris-glow border border-white/10 p-2 bg-white/[0.02]"
                        >
                            <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover rounded-2xl" />
                        </motion.div>
                    ) : (
                        <div className="w-20 h-20 bg-solaris-orange rounded-solaris flex items-center justify-center shadow-solaris-glow mx-auto mb-8">
                            <Smartphone className="w-10 h-10 text-white" />
                        </div>
                    )}
                    <h1 className="text-4xl font-black tracking-tighter mb-3 uppercase italic">{settings.name || 'Solaris Terminal'}</h1>
                    <p className="text-gray-500 font-bold text-[10px] uppercase tracking-[0.4em] mb-6">Selecciona tu perfil de acceso</p>
                    
                    <div className="flex items-center gap-3 px-6 py-2.5 bg-white/[0.03] rounded-full border border-white/5 mx-auto w-fit">
                        <span className="w-2 h-2 bg-solaris-orange rounded-full animate-ping"></span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Estación: {authProfile?.fullName || 'Root'}</span>
                    </div>
                </div>

                {/* User Cards Grid */}
                <div className="w-full flex justify-center gap-8 mb-16 overflow-x-auto pb-8 px-12 scrollbar-hide">
                    {isSuperAdmin && (
                        <button
                            onClick={() => { window.location.hash = '#/dashboard'; }}
                            className="flex flex-col items-center gap-4 transition-all duration-500 group"
                        >
                            <div className="w-24 h-24 rounded-solaris overflow-hidden border border-solaris-orange/30 bg-solaris-orange/5 flex items-center justify-center shadow-2xl group-hover:bg-solaris-orange/20 transition-all">
                                <LayoutDashboard className="w-10 h-10 text-solaris-orange" />
                            </div>
                            <div className="text-center">
                                <span className="block text-[10px] font-black uppercase tracking-tighter text-solaris-orange">Super Admin</span>
                                <span className="text-[8px] font-bold text-gray-600 uppercase">Acceso Global</span>
                            </div>
                        </button>
                    )}

                    {employees.map(user => (
                        <button
                            key={user.id}
                            onClick={() => { setSelectedUser(user.id); setPin(''); setError(false); }}
                            className={`flex flex-col items-center gap-4 transition-all duration-500 min-w-[120px] ${selectedUser === user.id ? 'scale-110' : 'opacity-40 hover:opacity-100 hover:scale-105'}`}
                        >
                            <div className={`w-24 h-24 rounded-solaris overflow-hidden border-2 transition-all shadow-2xl relative ${selectedUser === user.id ? 'border-solaris-orange shadow-solaris-glow' : 'border-white/5'}`}>
                                <img 
                                    src={(user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'owner') ? ADMIN_AVATAR : (user.image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200&h=200')} 
                                    alt={user.name} 
                                    className="w-full h-full object-cover" 
                                />
                                {selectedUser === user.id && (
                                    <div className="absolute inset-0 bg-solaris-orange/20 flex items-center justify-center">
                                        <UserCheck className="w-10 h-10 text-white" />
                                    </div>
                                )}
                            </div>
                            <div className="text-center px-2">
                                <span className={`block text-xs font-black uppercase tracking-tight truncate max-w-[110px] ${selectedUser === user.id ? 'text-white' : 'text-gray-500'}`}>
                                    {user.name}
                                </span>
                                <span className="text-[9px] font-bold text-gray-700 uppercase tracking-widest">{user.role}</span>
                            </div>
                        </button>
                    ))}

                    {employees.length === 0 && (
                        <div className="flex flex-col items-center gap-6 py-12">
                            <div className="w-20 h-20 bg-white/[0.02] border border-white/5 rounded-solaris flex items-center justify-center">
                                <RefreshCw className="w-8 h-8 text-gray-700 animate-spin-slow" />
                            </div>
                            <button 
                                onClick={() => { triggerSync(); refreshEmployees(); }}
                                className="px-8 py-3 bg-solaris-orange/10 hover:bg-solaris-orange text-solaris-orange hover:text-white border border-solaris-orange/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                            >
                                Sincronizar Personal
                            </button>
                        </div>
                    )}
                </div>

                {/* PIN Entry Area */}
                <AnimatePresence>
                {selectedUser && (
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 30 }}
                        className="flex flex-col items-center mb-16"
                    >
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-solaris-orange mb-8 animate-pulse">
                            {employees.find(e => e.id === selectedUser)?.pin === null 
                                ? "Crea tu código de acceso" 
                                : "Confirma tu identidad"}
                        </p>
                        
                        {/* PIN Dots Solaris Style */}
                        <div className={`flex gap-6 mb-12 ${error ? 'animate-shake' : ''}`}>
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className={`w-4 h-4 rounded-full transition-all duration-500 ${pin.length > i ? 'bg-solaris-orange scale-125 shadow-solaris-glow' : 'bg-white/[0.05] border border-white/5'}`}></div>
                            ))}
                        </div>

                        {/* Solaris Keypad */}
                        <div className="grid grid-cols-3 gap-6">
                            {keys.map((key, idx) => {
                                if (key === '') return <div key={idx}></div>;
                                const isBackspace = key === 'backspace';

                                return (
                                    <motion.button
                                        key={key}
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleKeyPress(key)}
                                        className={`w-20 h-20 rounded-solaris flex items-center justify-center text-2xl font-black transition-all duration-150 ${isBackspace
                                                ? 'text-red-500 bg-red-500/5 hover:bg-red-500/20 border border-red-500/10'
                                                : 'bg-white/[0.02] hover:bg-white/[0.08] border border-white/5 hover:border-solaris-orange/30'
                                            } ${activeKey === key ? 'bg-solaris-orange text-white border-solaris-orange shadow-solaris-glow' : ''}`}
                                    >
                                        {isBackspace ? <Delete className="w-6 h-6" /> : key}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
                </AnimatePresence>

                {/* System Logout */}
                <button 
                    onClick={signOut}
                    className="group flex items-center gap-3 px-8 py-3 text-[10px] font-black text-gray-600 hover:text-red-500 uppercase tracking-[0.3em] transition-all"
                >
                    <LogOut className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                    Abandonar Terminal
                </button>
            </motion.div>
        </div>
    );
};
