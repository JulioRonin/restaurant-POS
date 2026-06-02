/**
 * ServiRest UI primitives — Sobremesa Lúcida design system.
 *
 * These are the building blocks reused across every refactored screen.
 * Every primitive is style-only: state lives in the parent. Tailwind classes
 * map 1:1 to the tokens in tailwind.config.js → colors.servirest.* and the
 * CSS variables in index.css. Lucide icons + framer-motion already in the repo.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, X, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* SrCard — default card surface (24px radius, hairline border, soft shadow)  */
/* -------------------------------------------------------------------------- */
type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  as?: 'div' | 'section' | 'article';
  hover?: boolean;
  variant?: 'default' | 'solaris' | 'glass';
};
export const SrCard: React.FC<CardProps> = ({
  as: Tag = 'div',
  hover = false,
  variant = 'default',
  className = '',
  children,
  ...rest
}) => {
  const base =
    variant === 'solaris'
      ? 'bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-sr-2xl shadow-sr-lift'
      : variant === 'glass'
      ? 'sr-glass'
      : 'bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-sr-xl shadow-sr-card';
  const hoverCls = hover
    ? 'transition-all duration-200 ease-sr-out hover:-translate-y-1 hover:shadow-sr-lift hover:border-[rgba(196,99,63,0.3)]'
    : '';
  return (
    <Tag className={`${base} ${hoverCls} ${className}`} {...(rest as any)}>
      {children}
    </Tag>
  );
};

/* -------------------------------------------------------------------------- */
/* SrButton — primary CTA (terracota + glow) · brutal type · scale on press   */
/* -------------------------------------------------------------------------- */
type BtnVariant = 'primary' | 'midnight' | 'ghost' | 'outline' | 'danger';
type BtnSize = 'sm' | 'md' | 'lg';
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
};
export const SrButton: React.FC<BtnProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth = false,
  className = '',
  children,
  ...rest
}) => {
  const variants: Record<BtnVariant, string> = {
    primary:
      'bg-servirest-terracota text-servirest-hueso shadow-sr-glow hover:scale-[1.02] active:scale-[0.96]',
    midnight:
      'bg-servirest-midnight text-servirest-hueso shadow-sr-glow-midnight hover:scale-[1.02] active:scale-[0.96]',
    ghost:
      'bg-transparent text-[rgba(42,40,38,0.6)] hover:bg-[rgba(42,40,38,0.04)] hover:text-servirest-carbon',
    outline:
      'bg-servirest-surface border border-[rgba(42,40,38,0.20)] text-[rgba(42,40,38,0.6)] hover:border-servirest-terracota hover:text-servirest-terracota',
    danger:
      'bg-servirest-danger text-servirest-hueso shadow-[0_0_20px_rgba(225,85,75,0.4)] hover:scale-[1.02] active:scale-[0.96]',
  };
  const sizes: Record<BtnSize, string> = {
    sm: 'px-4 py-2 text-[9px] gap-2 rounded-sr-md',
    md: 'px-6 py-3.5 text-[11px] gap-2.5 rounded-sr-lg',
    lg: 'px-7 py-[18px] text-[14px] gap-3 rounded-sr-xl',
  };
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center font-black italic uppercase tracking-[0.2em] transition-transform duration-[var(--sr-dur-fast)] ease-sr-out disabled:opacity-25 disabled:!shadow-none disabled:cursor-default ${sizes[size]} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon}
      {children}
      {iconRight ?? null}
    </button>
  );
};

/* -------------------------------------------------------------------------- */
/* SrChip — uppercase pill (state badges, table refs, status)                  */
/* -------------------------------------------------------------------------- */
type ChipTone = 'neutral' | 'terracota' | 'mostaza' | 'midnight' | 'success' | 'danger';
type ChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: ChipTone;
  size?: 'xs' | 'sm';
};
export const SrChip: React.FC<ChipProps> = ({
  tone = 'neutral',
  size = 'sm',
  className = '',
  children,
  ...rest
}) => {
  const tones: Record<ChipTone, string> = {
    neutral:
      'bg-servirest-surface border border-[rgba(42,40,38,0.20)] text-[rgba(42,40,38,0.6)]',
    terracota: 'bg-[rgba(196,99,63,0.10)] border border-servirest-terracota/40 text-servirest-terracota',
    mostaza:   'bg-[rgba(201,162,74,0.12)] border border-servirest-mostaza/40 text-servirest-mostaza',
    midnight:  'bg-servirest-midnight text-servirest-hueso border border-servirest-midnight',
    success:   'bg-[rgba(34,160,107,0.08)] border border-servirest-success/30 text-servirest-success',
    danger:    'bg-[rgba(225,85,75,0.08)] border border-servirest-danger/30 text-servirest-danger',
  };
  const sizes = {
    xs: 'text-[8px] px-2.5 py-1 tracking-[0.14em]',
    sm: 'text-[9px] px-3 py-1.5 tracking-[0.16em]',
  };
  return (
    <span
      className={`inline-flex items-center font-black uppercase rounded-sr-pill whitespace-nowrap ${sizes[size]} ${tones[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/* SrInput — pill / boxy text input with optional left icon                    */
/* -------------------------------------------------------------------------- */
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  icon?: React.ReactNode;
  shape?: 'pill' | 'box';
};
export const SrInput: React.FC<InputProps> = ({
  icon,
  shape = 'box',
  className = '',
  ...rest
}) => {
  const radius = shape === 'pill' ? 'rounded-sr-pill' : 'rounded-sr-lg';
  return (
    <div className="relative w-full">
      {icon && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(42,40,38,0.4)] pointer-events-none">
          {icon}
        </span>
      )}
      <input
        className={`w-full bg-servirest-surface border border-[rgba(42,40,38,0.20)] ${radius} px-4 py-3 text-[13px] font-medium text-servirest-carbon placeholder:text-[rgba(42,40,38,0.4)] outline-none transition-colors duration-150 focus:border-servirest-terracota ${icon ? 'pl-11' : ''} ${className}`}
        {...rest}
      />
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* SrLabel · SrKicker · SrKPI · SrMono — typographic primitives                */
/* -------------------------------------------------------------------------- */
export const SrLabel: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({
  className = '',
  ...rest
}) => <span className={`sr-label ${className}`} {...rest} />;

export const SrKicker: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({
  className = '',
  ...rest
}) => <span className={`sr-kicker ${className}`} {...rest} />;

export const SrKPI: React.FC<React.HTMLAttributes<HTMLSpanElement> & { size?: 'sm' | 'md' | 'lg' }> = ({
  className = '',
  size = 'md',
  ...rest
}) => {
  const sizes = { sm: 'text-[21px]', md: 'text-[28px]', lg: 'text-[40px]' };
  return <span className={`sr-kpi ${sizes[size]} ${className}`} {...rest} />;
};

export const SrMono: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({
  className = '',
  ...rest
}) => <span className={`sr-mono ${className}`} {...rest} />;

/* -------------------------------------------------------------------------- */
/* SrProgressRing — terracota stroke ring with center label                    */
/* -------------------------------------------------------------------------- */
type RingProps = {
  pct: number;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
};
export const SrProgressRing: React.FC<RingProps> = ({
  pct,
  size = 44,
  stroke = 4,
  showLabel = true,
}) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(196,99,63,0.15)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#C4633F"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset 0.6s var(--sr-ease-out)' }}
        />
      </svg>
      {showLabel && (
        <span className="absolute inset-0 flex items-center justify-center font-black italic text-[9px] text-servirest-terracota">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* SrScrim + SrModal — full-screen overlay with backdrop blur                  */
/* -------------------------------------------------------------------------- */
type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  closeOnBackdrop?: boolean;
};
export const SrModal: React.FC<ModalProps> = ({
  open,
  onClose,
  children,
  maxWidth = 760,
  closeOnBackdrop = true,
}) => {
  if (!open) return null;
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-8"
      style={{
        background: 'rgba(10,12,20,0.92)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <motion.div
        className="bg-servirest-surface rounded-sr-2xl shadow-sr-modal w-full p-10"
        style={{ maxWidth }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};

type ModalHeaderProps = {
  title: string;
  kicker?: string;
  onClose?: () => void;
};
export const SrModalHeader: React.FC<ModalHeaderProps> = ({ title, kicker, onClose }) => (
  <div className="flex justify-between items-start mb-8">
    <div>
      <h2 className="m-0 font-black italic uppercase tracking-[-0.02em] text-[26px] text-servirest-midnight leading-tight">
        {title}
      </h2>
      {kicker && (
        <p className="m-0 mt-1.5 font-black italic uppercase tracking-[0.3em] text-[9px] text-[rgba(42,40,38,0.4)]">
          {kicker}
        </p>
      )}
    </div>
    {onClose && (
      <button
        type="button"
        onClick={onClose}
        className="w-11 h-11 rounded-sr-md border border-[rgba(42,40,38,0.12)] bg-[rgba(42,40,38,0.04)] text-[rgba(42,40,38,0.6)] hover:text-servirest-carbon hover:bg-[rgba(42,40,38,0.08)] flex items-center justify-center transition-colors"
        aria-label="Cerrar"
      >
        <X size={22} />
      </button>
    )}
  </div>
);

/* -------------------------------------------------------------------------- */
/* SrSectionHeading — serif title + optional right slot for controls           */
/* -------------------------------------------------------------------------- */
type SectionProps = {
  title: string;
  kicker?: string;
  right?: React.ReactNode;
  className?: string;
};
export const SrSectionHeading: React.FC<SectionProps> = ({ title, kicker, right, className = '' }) => (
  <div className={`flex items-end justify-between flex-wrap gap-5 ${className}`}>
    <div>
      {kicker && <div className="sr-kicker mb-2">{kicker}</div>}
      <h1 className="sr-h1 m-0">{title}</h1>
    </div>
    {right && <div className="flex items-center gap-3 flex-wrap">{right}</div>}
  </div>
);

/* -------------------------------------------------------------------------- */
/* SrArrowBadge — small terracota circle with an arrow (used in cards)         */
/* -------------------------------------------------------------------------- */
export const SrArrowBadge: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <span
    className="inline-flex items-center justify-center rounded-full bg-[rgba(196,99,63,0.10)] text-servirest-terracota"
    style={{ width: size, height: size }}
  >
    <ArrowRight size={Math.round(size / 2)} />
  </span>
);

/* -------------------------------------------------------------------------- */
/* SrSeg — segmented control (e.g. range Día/Semana/Mes/Año)                   */
/* -------------------------------------------------------------------------- */
type SegProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
};
export function SrSeg<T extends string>({ options, value, onChange, className = '' }: SegProps<T>) {
  return (
    <div
      className={`inline-flex bg-[rgba(26,30,46,0.03)] border border-[rgba(26,30,46,0.10)] rounded-sr-xl p-1 gap-1 ${className}`}
    >
      {options.map((opt) => {
        const on = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`border-none bg-transparent font-black uppercase tracking-[0.14em] text-[9px] px-4 py-2 rounded-sr-md transition-colors ${on ? 'bg-servirest-surface text-servirest-midnight shadow-sr-card' : 'text-[rgba(42,40,38,0.6)]'}`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SrAlert — inline notice (info / success / warning / danger)                 */
/* -------------------------------------------------------------------------- */
type AlertTone = 'info' | 'success' | 'warning' | 'danger';
type AlertProps = {
  tone?: AlertTone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
};
export const SrAlert: React.FC<AlertProps> = ({ tone = 'info', title, children, className = '' }) => {
  const tones: Record<AlertTone, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
    info:    { bg: 'bg-[rgba(26,30,46,0.04)]',  border: 'border-[rgba(26,30,46,0.12)]',  text: 'text-servirest-midnight',  icon: <Info size={18} /> },
    success: { bg: 'bg-[rgba(34,160,107,0.06)]', border: 'border-servirest-success/30',   text: 'text-servirest-success',  icon: <CheckCircle2 size={18} /> },
    warning: { bg: 'bg-[rgba(201,162,74,0.08)]', border: 'border-servirest-mostaza/40',   text: 'text-servirest-mostaza',  icon: <AlertTriangle size={18} /> },
    danger:  { bg: 'bg-[rgba(225,85,75,0.06)]',  border: 'border-servirest-danger/30',    text: 'text-servirest-danger',   icon: <AlertCircle size={18} /> },
  };
  const t = tones[tone];
  return (
    <div className={`flex items-start gap-3 p-4 rounded-sr-lg border ${t.bg} ${t.border} ${className}`}>
      <span className={t.text}>{t.icon}</span>
      <div className={`flex-1 ${t.text}`}>
        {title && <div className="font-extrabold text-sm tracking-tight mb-1">{title}</div>}
        {children && <div className="text-[13px] font-medium leading-relaxed">{children}</div>}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* SrSpinner — terracota loader                                                 */
/* -------------------------------------------------------------------------- */
export const SrSpinner: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
  <span
    className={`inline-block rounded-full border-[3px] border-current/20 border-t-current animate-spin ${className}`}
    style={{ width: size, height: size, borderTopColor: 'currentColor' }}
    aria-label="Cargando"
  />
);

/* -------------------------------------------------------------------------- */
/* SrEmptyState — branded empty state (Lucide icon + serif title + sub + CTA)  */
/* -------------------------------------------------------------------------- */
type EmptyProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};
export const SrEmptyState: React.FC<EmptyProps> = ({ icon, title, description, action, className = '' }) => (
  <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
    {icon && (
      <div className="w-16 h-16 rounded-full bg-[rgba(42,40,38,0.05)] text-[rgba(42,40,38,0.4)] flex items-center justify-center mb-6">
        {icon}
      </div>
    )}
    <h3 className="font-serif italic font-medium text-[22px] text-servirest-midnight tracking-tight m-0 mb-2 leading-tight">
      {title}
    </h3>
    {description && (
      <p className="text-[13px] text-[rgba(42,40,38,0.6)] font-medium m-0 mb-6 max-w-sm leading-relaxed">
        {description}
      </p>
    )}
    {action}
  </div>
);

/* -------------------------------------------------------------------------- */
/* SrTabs — underline tabs (the pattern used in POS for menu categories)        */
/* -------------------------------------------------------------------------- */
type TabsProps<T extends string> = {
  tabs: readonly { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
};
export function SrTabs<T extends string>({ tabs, active, onChange, className = '' }: TabsProps<T>) {
  return (
    <div
      className={`flex gap-[26px] overflow-x-auto sr-no-scrollbar border-b border-[rgba(42,40,38,0.12)] ${className}`}
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`flex-shrink-0 bg-transparent border-none px-0.5 pt-3 pb-4 font-bold text-sm whitespace-nowrap transition-colors relative ${on ? 'text-servirest-terracota font-extrabold' : 'text-[rgba(42,40,38,0.6)] hover:text-servirest-carbon'}`}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span className={`ml-2 text-[10px] font-black tracking-normal ${on ? 'text-servirest-terracota' : 'text-[rgba(42,40,38,0.4)]'}`}>
                {t.count}
              </span>
            )}
            {on && <span className="absolute left-0 right-0 -bottom-[1px] h-[3px] bg-servirest-terracota rounded-t" />}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SrTierBadge — shows the current plan or the plan that gates a feature       */
/* -------------------------------------------------------------------------- */
type Tier = 'esencial' | 'profesional' | 'prestige' | 'enterprise';
type TierProps = { tier: Tier; size?: 'sm' | 'md'; className?: string };
const TIER_DISPLAY: Record<Tier, { label: string; tone: ChipTone }> = {
  esencial:    { label: 'Esencial',    tone: 'neutral' },
  profesional: { label: 'Profesional', tone: 'terracota' },
  prestige:    { label: 'Prestige',    tone: 'mostaza' },
  enterprise:  { label: 'Enterprise',  tone: 'midnight' },
};
export const SrTierBadge: React.FC<TierProps> = ({ tier, size = 'sm', className = '' }) => {
  const d = TIER_DISPLAY[tier];
  return (
    <SrChip tone={d.tone} size={size === 'sm' ? 'xs' : 'sm'} className={className}>
      {d.label}
    </SrChip>
  );
};

/* -------------------------------------------------------------------------- */
/* SrPanel — section wrapper with optional kicker + title (replaces handrolled  */
/* h2/h3 + divider patterns scattered across screens)                           */
/* -------------------------------------------------------------------------- */
type PanelProps = {
  title?: string;
  kicker?: string;
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
};
export const SrPanel: React.FC<PanelProps> = ({ title, kicker, right, className = '', bodyClassName = '', children }) => (
  <SrCard variant="solaris" className={`p-7 ${className}`}>
    {(title || kicker || right) && (
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          {kicker && <div className="sr-kicker mb-1.5">{kicker}</div>}
          {title && <h3 className="sr-h-brutal text-[19px] m-0">{title}</h3>}
        </div>
        {right}
      </div>
    )}
    <div className={bodyClassName}>{children}</div>
  </SrCard>
);
