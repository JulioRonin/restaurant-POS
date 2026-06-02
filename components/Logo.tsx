import React from 'react';

interface LogoProps {
  variant?: 'light' | 'midnight' | 'monochrome';
  size?: number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'light',
  size = 48,
  showText = false,
  className = '',
  textClassName = '',
}) => {
  // Configuración de colores basados en la variante
  // Light (para fondos claros Blanco Hueso): Círculo Midnight Tinto, Espiral Terracota, Texto Midnight Tinto
  // Midnight (para fondos oscuros Midnight Tinto): Círculo Blanco Hueso, Espiral Mostaza Mate, Texto Blanco Hueso
  // Monochrome (escala de grises / blanco puro): Círculo blanco o negro, Espiral blanca o negra
  const colors = {
    light: {
      circle: '#1A1E2E', // Midnight Tinto
      path: '#C4633F',   // Terracota
      text: '#1A1E2E',
    },
    midnight: {
      circle: '#FAF8F4', // Blanco Hueso
      path: '#C9A24A',   // Mostaza Mate
      text: '#FAF8F4',
    },
    monochrome: {
      circle: 'currentColor',
      path: 'currentColor',
      text: 'currentColor',
    },
  };

  const selectedColors = colors[variant];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* El Plato Asimétrico SVG */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Círculo exterior (Plato) */}
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke={selectedColors.circle}
          strokeWidth="6"
          vectorEffect="non-scaling-stroke"
        />
        {/* Espiral asimétrica orgánica (Pasta/Gesto manual) */}
        <path
          d="M 35,62 C 30,52 42,44 50,48 C 60,52 58,68 46,66 C 30,64 28,42 50,38 C 72,34 74,68 50,72"
          fill="none"
          stroke={selectedColors.path}
          strokeWidth="4.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Nombre de Marca: ServiRest */}
      {showText && (
        <span
          className={`font-serif text-2xl font-medium tracking-tight ${textClassName}`}
          style={{
            fontFamily: '"Fraunces", Georgia, serif',
            color: selectedColors.text,
          }}
        >
          ServiRest
        </span>
      )}
    </div>
  );
};

export default Logo;
