import React, { useEffect, useRef, ReactNode } from 'react';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: 'blue' | 'purple' | 'green' | 'red' | 'orange';
  size?: 'sm' | 'md' | 'lg';
  width?: string | number;
  height?: string | number;
  customSize?: boolean;
}

const glowColorMap = {
  blue: { h: 220, s: 100, l: 70 },
  purple: { h: 280, s: 100, l: 70 },
  green: { h: 120, s: 100, l: 70 },
  red: { h: 0, s: 100, l: 70 },
  orange: { h: 30, s: 100, l: 70 }
};

const sizeMap = {
  sm: 'w-48 h-64',
  md: 'w-64 h-80',
  lg: 'w-80 h-96'
};

const GlowCard: React.FC<GlowCardProps> = ({ 
  children, 
  className = '', 
  glowColor = 'blue',
  size = 'md',
  width,
  height,
  customSize = false
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncPointer = (e: PointerEvent) => {
      const { clientX: x, clientY: y } = e;
      if (cardRef.current) {
        const bounds = cardRef.current.getBoundingClientRect();
        cardRef.current.style.setProperty('--x', (x - bounds.left).toFixed(2));
        cardRef.current.style.setProperty('--y', (y - bounds.top).toFixed(2));
        // Also global coords for background fixed mode if needed
        cardRef.current.style.setProperty('--gx', x.toFixed(2));
        cardRef.current.style.setProperty('--gy', y.toFixed(2));
      }
    };

    document.addEventListener('pointermove', syncPointer);
    return () => document.removeEventListener('pointermove', syncPointer);
  }, []);

  const color = glowColorMap[glowColor];

  const style: any = {
    '--hue': color.h,
    '--saturation': color.s,
    '--lightness': color.l,
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      ref={cardRef}
      data-glow
      style={style}
      className={`
        ${customSize ? '' : sizeMap[size]}
        ${!customSize ? 'aspect-[3/4]' : ''}
        rounded-[32px] 
        relative 
        shadow-[0_1rem_2rem_-1rem_black] 
        p-4 
        backdrop-blur-[10px]
        transition-shadow
        ${className}
      `}
    >
      <div data-glow-bg />
      {/* flex flex-col: los usos con paneles internos (header shrink-0 +
          contenido flex-1 overflow-y-auto, p.ej. "Ventas detalladas" en
          Cashier) dependen de que este wrapper sea un contenedor flex —
          si no, flex-1/shrink-0 en los hijos no hacen nada y el contenido
          crece sin límite en vez de hacer scroll interno. */}
      <div className="relative z-10 w-full h-full flex flex-col min-h-0">
          {children}
      </div>
    </div>
  );
};

export { GlowCard };
