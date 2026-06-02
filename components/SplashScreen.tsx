import React from 'react';
import { motion } from 'framer-motion';
import { Logo } from './Logo';

/**
 * SplashScreen — ServiRest Sobremesa Lúcida.
 * Fiel al handoff /reference/Shell.jsx: gradient midnight + Plato Asimétrico
 * + nombre Fraunces italic + 3 dots mostaza con blink escalonado.
 */
export const SplashScreen: React.FC = () => {
  return (
    <div
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-7 overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #1A1E2E 0%, #232839 60%, #1A1E2E 100%)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-7"
      >
        <Logo variant="midnight" size={76} showText={false} />
        <span
          className="font-serif italic font-medium text-[38px] text-servirest-hueso tracking-[-0.02em] leading-none"
          style={{ fontFamily: '"Fraunces", Georgia, serif' }}
        >
          ServiRest
        </span>
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-servirest-mostaza"
              style={{ animation: `sr-blink 1.2s infinite ${i * 0.2}s` }}
            />
          ))}
        </div>
      </motion.div>

      {/* Ambient corners — kept from previous splash for warmth */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05]" aria-hidden="true">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-servirest-terracota blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-servirest-mostaza blur-[120px]" />
      </div>
    </div>
  );
};
