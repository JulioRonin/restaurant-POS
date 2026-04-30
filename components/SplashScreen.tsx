import React from 'react';
import { motion } from 'framer-motion';

export const SplashScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-[#FAFAF3] overflow-hidden">
            <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ 
                    duration: 0.8,
                    ease: [0.23, 1, 0.32, 1]
                }}
                className="flex flex-col items-center"
            >
                <div className="w-48 h-48 md:w-64 md:h-64 mb-8">
                    <img 
                        src="/koso-logo.png" 
                        alt="KŌSO Logo" 
                        className="w-full h-full object-contain filter drop-shadow-2xl"
                    />
                </div>
                
                <div className="flex flex-col items-center gap-4">
                    <div className="w-48 h-1 bg-[#505530]/10 rounded-full overflow-hidden relative">
                        <motion.div 
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ 
                                duration: 2,
                                ease: "easeInOut",
                                repeat: Infinity
                            }}
                            className="absolute top-0 left-0 h-full bg-[#F98359] shadow-[0_0_15px_rgba(249,131,89,0.5)]"
                        />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#505530]/40 italic animate-pulse">
                        Sincronizando Nodo Maestro...
                    </p>
                </div>
            </motion.div>
            
            {/* Subtle background decoration */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.03]">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#F98359] blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#505530] blur-[120px]" />
            </div>
        </div>
    );
};
