import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { useSettings } from '../contexts/SettingsContext';

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
                
                // CASE 1: First-time PIN setup
                if (targetUser && targetUser.pin === null) {
                    setEmployeePin(selectedUser, pin).then(() => {
                        setPin('');
                    });
                    return;
                }

                // CASE 2: Regular login
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900 text-white overflow-hidden font-sans">
            {/* Background Effects */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>

            <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">

                {/* Header */}
                <div className="mb-8 text-center px-4">
                    {settings.logoUrl ? (
                        <div className="w-24 h-24 mb-6 mx-auto rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10">
                            <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/50 mx-auto mb-6">
                            <span className="material-icons-round text-3xl">restaurant</span>
                        </div>
                    )}
                    <h1 className="text-3xl font-black tracking-tight mb-2 uppercase">{settings.name || 'Culinex OS'}</h1>
                    <p className="text-gray-400 font-medium text-sm">Selecciona tu perfil para desbloquear la estación</p>
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sesión: {authProfile?.fullName || 'Admin'}</span>
                    </div>
                </div>

                {/* User Selection */}
                <div className="w-full flex justify-center gap-6 mb-12 overflow-x-auto pb-6 px-6 scrollbar-hide">
                    {/* Super Admin Bypass Button */}
                    {isSuperAdmin && (
                        <button
                            onClick={() => {
                                // Super Admin can enter without PIN or with a dummy employee switch
                                // But since App.tsx already bypasses LockScreen for SuperAdmins, 
                                // this is an extra layer if they ever see it.
                                window.location.hash = '#/dashboard'; 
                            }}
                            className="flex flex-col items-center gap-3 transition-all duration-300 min-w-[100px] opacity-80 hover:opacity-100 hover:scale-105"
                        >
                            <div className="w-20 h-20 rounded-3xl overflow-hidden border-4 border-primary/30 bg-primary/10 flex items-center justify-center shadow-2xl shadow-primary/20">
                                <span className="material-icons-round text-3xl text-primary">admin_panel_settings</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] font-black uppercase tracking-tight text-primary">Acceso Global</span>
                                <span className="text-[8px] font-bold text-gray-500 uppercase">Super Admin</span>
                            </div>
                        </button>
                    )}

                    {employees.map(user => (
                        <button
                            key={user.id}
                            onClick={() => { setSelectedUser(user.id); setPin(''); setError(false); }}
                            className={`flex flex-col items-center gap-3 transition-all duration-300 min-w-[100px] ${selectedUser === user.id ? 'scale-110' : 'opacity-50 hover:opacity-100 hover:scale-105'
                                }`}
                        >
                            <div className={`w-20 h-20 rounded-3xl overflow-hidden border-4 transition-all shadow-2xl ${selectedUser === user.id ? 'border-primary shadow-primary/50' : 'border-white/5'
                                }`}>
                                <img 
                                    src={(user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'owner') ? ADMIN_AVATAR : (user.image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200&h=200')} 
                                    alt={user.name} 
                                    className="w-full h-full object-cover" 
                                />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className={`text-xs font-black uppercase tracking-tight ${selectedUser === user.id ? 'text-white' : 'text-gray-400'}`}>
                                    {user.name.split(' ')[0]}
                                </span>
                                <span className="text-[9px] font-bold text-gray-500 uppercase">{user.role}</span>
                            </div>
                        </button>
                    ))}

                    {employees.length === 0 && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="text-center opacity-50">
                                <span className="material-icons-round text-4xl mb-2">people_outline</span>
                                <p className="text-xs font-bold uppercase tracking-widest">Sin personal registrado</p>
                            </div>
                            <button 
                                onClick={() => {
                                    triggerSync();
                                    refreshEmployees();
                                }}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                <span className="flex items-center gap-2">
                                    <span className="material-icons-round text-sm animate-spin-slow">sync</span>
                                    Actualizar Personal
                                </span>
                            </button>
                        </div>
                    )}
                </div>

                {/* PIN Entry Area */}
                {selectedUser && (
                    <div className="flex flex-col items-center animate-in slide-in-from-bottom-8 fade-in duration-500 fill-mode-forwards mb-12">
                        {/* PIN Prompt Message */}
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-6 animate-pulse">
                            {employees.find(e => e.id === selectedUser)?.pin === null 
                                ? "Crea tu PIN personal (4 dígitos)" 
                                : "Ingresa tu PIN de acceso"}
                        </p>
                        {/* PIN Dots */}
                        <div className={`flex gap-5 mb-10 ${error ? 'animate-shake' : ''}`}>
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${pin.length > i ? 'bg-primary scale-125 shadow-lg shadow-primary/50' : 'bg-white/10'
                                    }`}></div>
                            ))}
                        </div>

                        {/* Keypad */}
                        <div className="grid grid-cols-3 gap-5">
                            {keys.map((key, idx) => {
                                if (key === '') return <div key={idx}></div>;
                                const isBackspace = key === 'backspace';

                                return (
                                    <button
                                        key={key}
                                        onClick={() => handleKeyPress(key)}
                                        className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black transition-all duration-150 ${isBackspace
                                                ? 'text-red-400 hover:bg-red-500/10 border border-transparent'
                                                : 'bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10'
                                            } ${activeKey === key ? 'scale-90 bg-primary/20 border-primary/30' : 'hover:scale-105 active:scale-95'}`}
                                    >
                                        {isBackspace ? (
                                            <span className="material-icons-round text-lg">backspace</span>
                                        ) : (
                                            key
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* System Logout Link */}
                <div className="mt-4">
                    <button 
                        onClick={signOut}
                        className="text-[10px] font-black text-gray-500 hover:text-red-400 uppercase tracking-[0.2em] transition-colors flex items-center gap-2"
                    >
                        <span className="material-icons-round text-sm">logout</span>
                        Cerrar Sesión del Sistema
                    </button>
                </div>

            </div>
        </div>
    );
};
