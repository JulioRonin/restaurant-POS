/**
 * Tarjeta de sellos visual. Se usa en la vista previa de la configuración,
 * en Caja y en la app del cliente, para que todos vean exactamente la misma.
 */
import React from 'react';
import { Check, Gift } from 'lucide-react';

interface StampCardProps {
  businessName: string;
  logoUrl?: string;
  color: string;
  stampsRequired: number;
  stamps: number;
  rewardTitle: string;
  rewardsAvailable?: number;
  customerName?: string | null;
  compact?: boolean;
}

/** true si el color es oscuro → texto claro encima. */
function isDark(hex: string): boolean {
  const h = (hex || '#1A1E2E').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 150;
}

export const StampCard: React.FC<StampCardProps> = ({
  businessName, logoUrl, color, stampsRequired, stamps, rewardTitle, rewardsAvailable = 0, customerName, compact,
}) => {
  const dark = isDark(color);
  const fg = dark ? '#FAF8F4' : '#1A1E2E';
  const sub = dark ? 'rgba(250,248,244,0.6)' : 'rgba(26,30,46,0.6)';
  const slotBorder = dark ? 'rgba(250,248,244,0.35)' : 'rgba(26,30,46,0.25)';
  const total = Math.max(2, Math.min(30, stampsRequired || 8));
  const filled = Math.max(0, Math.min(total, stamps));
  const cols = total <= 5 ? total : total <= 10 ? 5 : 6;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl shadow-lg ${compact ? 'p-4' : 'p-5 sm:p-6'}`}
      style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}E6 60%, ${color}CC 100%)`, color: fg }}
    >
      <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full opacity-10" style={{ background: fg }} />

      <div className="relative flex items-center gap-3 mb-4">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="w-11 h-11 rounded-full object-cover bg-white flex-shrink-0" />
        ) : (
          <div className="w-11 h-11 rounded-full flex items-center justify-center font-serif italic text-xl flex-shrink-0" style={{ background: sub, color }}>
            {(businessName || '?')[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-serif italic text-[19px] leading-tight truncate">{businessName || 'Tu restaurante'}</div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-black" style={{ color: sub }}>
            Tarjeta de sellos{customerName ? ` · ${customerName}` : ''}
          </div>
        </div>
      </div>

      <div className="relative grid gap-2.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: total }).map((_, i) => {
          const on = i < filled;
          const last = i === total - 1;
          return (
            <div
              key={i}
              className="aspect-square rounded-full flex items-center justify-center transition-all"
              style={{
                border: `2px ${on ? 'solid' : 'dashed'} ${on ? fg : slotBorder}`,
                background: on ? fg : 'transparent',
                color: on ? color : sub,
              }}
            >
              {on ? <Check size={compact ? 14 : 18} strokeWidth={3} /> : last ? <Gift size={compact ? 13 : 16} /> : null}
            </div>
          );
        })}
      </div>

      <div className="relative flex items-end justify-between gap-3 mt-4">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] font-black" style={{ color: sub }}>Premio</div>
          <div className="font-bold text-[14px] leading-tight truncate">{rewardTitle}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-serif italic text-[22px] leading-none">{filled}/{total}</div>
          {rewardsAvailable > 0 && (
            <div className="text-[10px] uppercase tracking-[0.12em] font-black mt-1 px-2 py-0.5 rounded-full" style={{ background: fg, color }}>
              {rewardsAvailable} premio{rewardsAvailable === 1 ? '' : 's'} listo{rewardsAvailable === 1 ? '' : 's'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
