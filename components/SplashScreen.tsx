import React from 'react';
import { motion } from 'framer-motion';
import { Logo } from './Logo';

export const SplashScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-[#1A1E2E] overflow-hidden">
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                    duration: 0.8,
                    ease: [0.23, 1, 0.32, 1]
                }}
                className="flex flex-col items-center"
            >
                <div className="mb-8">
                    <Logo variant="midnight" size={110} showText={true} className="flex-col" textClassName="text-3xl font-semibold mt-4 !text-[#FAF8F4]" />
                </div>
                
                <div className="flex flex-col items-center gap-4 mt-4">
                    <div className="w-48 h-1 bg-[#FAF8F4]/10 rounded-full overflow-hidden relative">
                        <motion.div 
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ 
                                duration: 2,
                                ease: "easeInOut",
                                repeat: Infinity
                            }}
                            className="absolute top-0 left-0 h-full bg-[#C4633F] shadow-[0_0_15px_rgba(196,99,63,0.5)]"
                        />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#FAF8F4]/40 italic animate-pulse">
                        Sincronizando Nodo Maestro...
                    </p>
                </div>
            </motion.div>
            
            {/* Subtle background decoration */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.05]">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#C4633F] blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#C9A24A] blur-[120px]" />
            </div>
        </div>
    );
};
