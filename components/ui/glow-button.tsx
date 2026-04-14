import React, { useEffect, useRef, ReactNode } from 'react';

interface GlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  glowColor?: 'blue' | 'purple' | 'green' | 'red' | 'orange';
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}

const colorMap = {
  blue: { h: 220, s: 100, l: 70 },
  purple: { h: 280, s: 100, l: 70 },
  green: { h: 120, s: 100, l: 70 },
  red: { h: 0, s: 100, l: 70 },
  orange: { h: 30, s: 100, l: 70 }
};

export const GlowButton: React.FC<GlowButtonProps> = ({ 
  children, 
  glowColor = 'orange',
  variant = 'primary',
  className = '',
  ...props
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const syncPointer = (e: PointerEvent) => {
      const { clientX: x, clientY: y } = e;
      if (buttonRef.current) {
        const bounds = buttonRef.current.getBoundingClientRect();
        buttonRef.current.style.setProperty('--x', (x - bounds.left).toFixed(2));
        buttonRef.current.style.setProperty('--y', (y - bounds.top).toFixed(2));
      }
    };

    document.addEventListener('pointermove', syncPointer);
    return () => document.removeEventListener('pointermove', syncPointer);
  }, []);

  const color = colorMap[glowColor];
  
  const style: any = {
    '--hue': color.h,
    '--saturation': color.s,
    '--lightness': color.l,
    '--radius': '24', // Default for buttons
    '--border': '1.5',
    '--size': '200',
  };

  const getVariantClasses = () => {
    switch(variant) {
      case 'primary': return 'bg-solaris-orange/10 text-white border-white/5 hover:border-solaris-orange/40';
      case 'secondary': return 'bg-white/[0.03] text-white/60 border-white/5 hover:text-white';
      case 'ghost': return 'bg-transparent text-white/20 border-transparent hover:text-white/40';
      default: return '';
    }
  };

  return (
    <button
      ref={buttonRef}
      data-glow
      style={style}
      className={`
        px-8 py-4 rounded-[24px] 
        font-black italic uppercase tracking-widest text-[10px]
        transition-all active:scale-95 
        disabled:opacity-20 disabled:cursor-not-allowed
        overflow-hidden
        ${getVariantClasses()}
        ${className}
      `}
      {...props}
    >
      <div data-glow-bg />
      <span className="relative z-10">{children}</span>
    </button>
  );
};
