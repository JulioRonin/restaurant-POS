import React, { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Delete, LogOut, Terminal, ShieldAlert } from 'lucide-react';
import { SrCard, SrButton, SrLabel, SrKicker } from './ui/servirest';

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

    const selectedEmployee = employees.find(e => e.id === selectedUser);
    const getInitials = (name: string) =>
        name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

    return (
        <div className="relative min-h-screen w-full flex flex-col md:flex-row bg-servirest-midnight overflow-hidden font-sans pt-12 md:pt-0">
            {/* Atmospheric mesh — terracota + mostaza wash on midnight */}
            <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
                <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full bg-servirest-terracota/15 blur-[140px]" />
                <div className="absolute bottom-[-15%] right-[35%] w-[40%] h-[45%] rounded-full bg-servirest-mostaza/10 blur-[120px]" />
                <div
                    className="absolute inset-0 opacity-[0.025]"
                    style={{
                        backgroundImage:
                            'radial-gradient(circle at 1px 1px, rgba(250,248,244,0.6) 1px, transparent 0)',
                        backgroundSize: '32px 32px',
                    }}
                />
            </div>

            {/* ─── LEFT · Employee picker (midnight) ─────────────────────── */}
            <div className="relative z-10 flex-1 flex flex-col px-6 md:px-14 lg:px-20 py-10 md:py-14 overflow-y-auto custom-scrollbar lg:max-h-screen">
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="mb-10 md:mb-14"
                >
                    <SrKicker className="block mb-3 text-servirest-mostaza/90">
                        Sobremesa lúcida · Terminal abierto
                    </SrKicker>
                    <h1
                        className="font-serif italic font-medium text-[44px] md:text-[64px] text-servirest-hueso tracking-[-0.025em] leading-[0.95] m-0"
                    >
                        ¿Quién abre turno?
                    </h1>
                    <p className="text-[13px] md:text-[14px] text-servirest-hueso/55 font-medium mt-3 max-w-[480px] leading-relaxed">
                        Toca tu retrato para identificarte. Cada PIN es tuyo —
                        nadie cobra, descarga inventario ni cierra caja en tu nombre.
                    </p>
                </motion.div>

                {/* Roster */}
                <div className="grid grid-cols-2 xs:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    {employees.map((emp, idx) => {
                        const isSelected = selectedUser === emp.id;
                        return (
                            <motion.button
                                key={emp.id}
                                type="button"
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    duration: 0.45,
                                    delay: 0.1 + idx * 0.05,
                                    ease: [0.16, 1, 0.3, 1],
                                }}
                                whileHover={{ y: -4 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => {
                                    setSelectedUser(emp.id);
                                    setPin('');
                                    setError(false);
                                }}
                                className={`group relative text-left rounded-sr-xl border transition-all duration-200 ease-out p-5 md:p-6 flex flex-col items-center ${
                                    isSelected
                                        ? 'border-servirest-terracota bg-servirest-terracota/[0.08] shadow-sr-glow'
                                        : 'border-servirest-hueso/10 bg-servirest-hueso/[0.03] hover:border-servirest-hueso/25 hover:bg-servirest-hueso/[0.06]'
                                }`}
                            >
                                {/* Avatar */}
                                <div className="relative mb-4">
                                    <div
                                        className={`w-[88px] h-[88px] md:w-[104px] md:h-[104px] rounded-full overflow-hidden border-2 transition-all duration-300 ${
                                            isSelected
                                                ? 'border-servirest-terracota'
                                                : 'border-servirest-hueso/10 group-hover:border-servirest-hueso/30'
                                        }`}
                                    >
                                        {emp.image ? (
                                            <img
                                                src={emp.image}
                                                alt={emp.name}
                                                className={`w-full h-full object-cover transition-all duration-300 ${
                                                    isSelected ? 'contrast-110 saturate-110' : 'grayscale-[40%] group-hover:grayscale-0'
                                                }`}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-servirest-midnight/40">
                                                <span className="font-serif italic text-[32px] md:text-[38px] text-servirest-mostaza tracking-tight leading-none">
                                                    {getInitials(emp.name)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {isSelected && (
                                        <motion.div
                                            layoutId="lock-select-dot"
                                            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-servirest-terracota border-2 border-servirest-midnight flex items-center justify-center shadow-sr-glow"
                                        >
                                            <Lock size={11} className="text-servirest-hueso" strokeWidth={2.5} />
                                        </motion.div>
                                    )}
                                </div>

                                {/* Name (editorial serif) */}
                                <h3
                                    className={`font-serif italic text-[20px] md:text-[22px] tracking-[-0.015em] leading-tight text-center truncate w-full transition-colors ${
                                        isSelected ? 'text-servirest-hueso' : 'text-servirest-hueso/75 group-hover:text-servirest-hueso'
                                    }`}
                                >
                                    {emp.name.split(' ')[0]}
                                </h3>

                                {/* Role */}
                                <span
                                    className={`mt-1.5 text-[8px] md:text-[9px] font-black uppercase tracking-[0.22em] ${
                                        isSelected ? 'text-servirest-mostaza' : 'text-servirest-hueso/40'
                                    }`}
                                >
                                    {emp.role}
                                </span>
                            </motion.button>
                        );
                    })}
                </div>

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.6 }}
                    className="mt-auto pt-12 flex items-center justify-between gap-4 flex-wrap"
                >
                    <div className="flex items-center gap-3 text-servirest-hueso/35">
                        <Terminal size={14} strokeWidth={2} />
                        <div className="flex flex-col">
                            <SrLabel className="!text-servirest-hueso/55">
                                Terminal
                            </SrLabel>
                            <span className="text-[11px] font-medium text-servirest-hueso/70 tracking-tight">
                                {authProfile?.businessName || 'ServiRest'}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={signOut}
                        className="inline-flex items-center gap-2 text-servirest-hueso/40 hover:text-servirest-danger transition-colors text-[10px] font-black uppercase tracking-[0.22em] group"
                    >
                        Cerrar sesión del local
                        <LogOut size={13} className="transition-transform group-hover:translate-x-0.5" />
                    </button>
                </motion.div>
            </div>

            {/* ─── RIGHT · PIN keypad (cream) ────────────────────────────── */}
            <div className="relative z-10 w-full md:w-[460px] lg:w-[480px] bg-servirest-hueso border-t md:border-t-0 md:border-l border-[rgba(42,40,38,0.08)] flex flex-col items-center justify-center p-6 md:p-10">
                <div className="w-full max-w-[320px]">
                    {/* Lock crest + status */}
                    <div className="text-center mb-8 md:mb-10">
                        <motion.div
                            animate={
                                error
                                    ? { x: [0, -6, 6, -6, 6, 0] }
                                    : { scale: [0.95, 1] }
                            }
                            transition={{ duration: error ? 0.4 : 0.35 }}
                            className={`relative inline-flex items-center justify-center w-[72px] h-[72px] md:w-[84px] md:h-[84px] rounded-full border-2 mb-5 transition-colors duration-300 ${
                                error
                                    ? 'border-servirest-danger bg-servirest-danger/8 text-servirest-danger shadow-[0_0_28px_rgba(225,85,75,0.25)]'
                                    : 'border-servirest-terracota bg-servirest-terracota/5 text-servirest-terracota shadow-sr-glow'
                            }`}
                        >
                            {error ? (
                                <ShieldAlert size={28} strokeWidth={1.75} />
                            ) : (
                                <Lock size={26} strokeWidth={1.75} />
                            )}
                        </motion.div>

                        <SrKicker className="block mb-2">
                            {error ? 'PIN no reconocido' : 'Ingresa tu PIN'}
                        </SrKicker>

                        <AnimatePresence mode="wait">
                            <motion.h2
                                key={selectedEmployee?.id || 'none'}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.25 }}
                                className="font-serif italic font-medium text-[26px] md:text-[30px] text-servirest-midnight tracking-[-0.02em] leading-[1] m-0"
                            >
                                {selectedEmployee
                                    ? `Hola, ${selectedEmployee.name.split(' ')[0]}`
                                    : 'Elige un operador'}
                            </motion.h2>
                        </AnimatePresence>

                        {/* PIN dots */}
                        <div className="flex justify-center gap-4 mt-7">
                            {[0, 1, 2, 3].map((i) => {
                                const filled = pin.length > i;
                                return (
                                    <motion.div
                                        key={i}
                                        animate={
                                            error
                                                ? { x: [0, -5, 5, -5, 5, 0] }
                                                : filled
                                                ? { scale: [1, 1.25, 1.1] }
                                                : { scale: 1 }
                                        }
                                        transition={{ duration: 0.3 }}
                                        className={`w-3.5 h-3.5 rounded-full border transition-all duration-200 ${
                                            error
                                                ? 'bg-servirest-danger border-servirest-danger'
                                                : filled
                                                ? 'bg-servirest-terracota border-servirest-terracota shadow-sr-glow'
                                                : 'bg-transparent border-[rgba(42,40,38,0.22)]'
                                        }`}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    {/* Keypad */}
                    <div className="grid grid-cols-3 gap-3 md:gap-3.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <motion.button
                                key={num}
                                type="button"
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.94 }}
                                onClick={() => handlePinClick(num.toString())}
                                disabled={!selectedUser}
                                className="h-[64px] md:h-[72px] rounded-sr-lg border border-[rgba(42,40,38,0.10)] bg-[rgba(42,40,38,0.025)] text-servirest-midnight font-serif italic font-medium text-[28px] md:text-[32px] tracking-tight transition-all duration-150 hover:bg-servirest-surface hover:shadow-sr-card hover:text-servirest-terracota hover:border-servirest-terracota/40 disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-[rgba(42,40,38,0.025)] disabled:hover:shadow-none disabled:hover:text-servirest-midnight disabled:hover:border-[rgba(42,40,38,0.10)]"
                            >
                                {num}
                            </motion.button>
                        ))}
                        <div className="h-[64px] md:h-[72px]" aria-hidden />
                        <motion.button
                            type="button"
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handlePinClick('0')}
                            disabled={!selectedUser}
                            className="h-[64px] md:h-[72px] rounded-sr-lg border border-[rgba(42,40,38,0.10)] bg-[rgba(42,40,38,0.025)] text-servirest-midnight font-serif italic font-medium text-[28px] md:text-[32px] tracking-tight transition-all duration-150 hover:bg-servirest-surface hover:shadow-sr-card hover:text-servirest-terracota hover:border-servirest-terracota/40 disabled:opacity-25 disabled:cursor-not-allowed"
                        >
                            0
                        </motion.button>
                        <motion.button
                            type="button"
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.94 }}
                            onClick={handleDelete}
                            disabled={!selectedUser || pin.length === 0}
                            aria-label="Borrar"
                            className="h-[64px] md:h-[72px] rounded-sr-lg border border-servirest-danger/15 bg-servirest-danger/[0.04] text-servirest-danger/70 flex items-center justify-center transition-all duration-150 hover:bg-servirest-danger/10 hover:text-servirest-danger hover:border-servirest-danger/40 disabled:opacity-25 disabled:cursor-not-allowed"
                        >
                            <Delete size={22} strokeWidth={1.75} />
                        </motion.button>
                    </div>

                    {/* Hint */}
                    <p className="text-center mt-7 text-[10px] font-medium uppercase tracking-[0.18em] text-[rgba(42,40,38,0.4)]">
                        {selectedUser ? '4 dígitos · se abre solo' : 'Selecciona tu retrato a la izquierda'}
                    </p>
                </div>
            </div>
        </div>
    );
};
