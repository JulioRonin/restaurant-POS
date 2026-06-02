import React, { useState, useMemo } from 'react';
import { CATEGORIES } from '../constants';
import { useExpenses } from '../contexts/ExpenseContext';
import { useOrders } from '../contexts/OrderContext';
import { useSettings } from '../contexts/SettingsContext';
import { useInventory } from '../contexts/InventoryContext';
import { FinancialReportModal } from '../components/FinancialReportModal';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, FileText, ArrowUpRight, ArrowDownRight,
  Utensils, Receipt, Wallet, Banknote, Ban, Layers, Sparkles,
} from 'lucide-react';
import {
  SrCard, SrButton, SrSeg, SrLabel, SrKicker, SrMono, SrPanel,
  SrEmptyState, SrTabs,
} from '../components/ui/servirest';

type TimeRange = 'Día' | 'Semana' | 'Mes' | 'Año' | 'Día específico' | 'Mes específico' | 'Rango';
const RANGE_OPTS = ['Día', 'Semana', 'Mes', 'Año'] as const;

/* -------------------------------------------------------------------------- */
/* MicroSparkline — inline 56×24 sparkline used inside KPI cards               */
/* Returns null when data is too short to be meaningful.                       */
/* -------------------------------------------------------------------------- */
const MicroSparkline: React.FC<{ data: number[]; tone: 'success' | 'danger' | 'mostaza' | 'terracota' }> = ({ data, tone }) => {
  if (!data || data.length < 2) return null;
  const color = {
    success:   '#22A06B',
    danger:    '#E1554B',
    mostaza:   '#C9A24A',
    terracota: '#C4633F',
  }[tone];
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 56;
    const y = 22 - ((v - min) / range) * 20;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width="56" height="24" viewBox="0 0 56 24" className="overflow-visible" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={56} cy={22 - ((data[data.length - 1] - min) / range) * 20} r="2.5" fill={color} />
    </svg>
  );
};

/* -------------------------------------------------------------------------- */
/* HeroKPI — single dramatic figure with delta + sparkline + period label      */
/* Replaces the "6 KPI cards in equal grid" anti-pattern at the top of Dashboards */
/* -------------------------------------------------------------------------- */
type HeroProps = {
  label: string;
  value: string;
  deltaPct?: number;
  series?: number[];
  periodLabel: string;
};
const HeroKPI: React.FC<HeroProps> = ({ label, value, deltaPct, series, periodLabel }) => {
  const positive = (deltaPct ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden"
    >
      <SrCard variant="solaris" className="p-10 relative">
        <div className="absolute inset-y-0 right-0 w-1/2 pointer-events-none opacity-[0.04]" aria-hidden="true">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 80% 50%, #C4633F 0%, transparent 60%)' }} />
        </div>
        <div className="relative">
          <SrKicker className="block mb-3">Esta {periodLabel.toLowerCase()}</SrKicker>
          <div className="flex flex-wrap items-end gap-x-10 gap-y-3">
            <div className="flex-shrink-0">
              <SrLabel className="block mb-2">{label}</SrLabel>
              <div className="flex items-baseline gap-3">
                <span className="font-black italic text-[88px] text-servirest-midnight tracking-[-0.03em] leading-none">
                  {value}
                </span>
                {typeof deltaPct === 'number' && (
                  <span className={`inline-flex items-center gap-1 font-mono font-bold text-[14px] ${positive ? 'text-servirest-success' : 'text-servirest-danger'} ${positive ? '' : ''}`}>
                    {positive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    {Math.abs(deltaPct).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            {series && series.length >= 2 && (
              <div className="flex-1 min-w-[200px] max-w-[400px] pb-2">
                <SrLabel className="block mb-1.5">Tendencia diaria</SrLabel>
                <div className="h-[60px] -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 6, left: 6, bottom: 0 }}>
                      <defs>
                        <linearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#C4633F" stopOpacity={0.30} />
                          <stop offset="100%" stopColor="#C4633F" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke="#C4633F" strokeWidth={2.5} fill="url(#heroFade)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </SrCard>
    </motion.div>
  );
};

/* -------------------------------------------------------------------------- */
/* InlineKPI — compact row card with sparkline at right                         */
/* -------------------------------------------------------------------------- */
type InlineProps = {
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  delta?: string;
  deltaTone?: 'success' | 'danger' | 'mostaza';
  series?: number[];
  sparkTone?: 'success' | 'danger' | 'mostaza' | 'terracota';
};
const InlineKPI: React.FC<InlineProps> = ({ icon: Icon, label, value, delta, deltaTone, series, sparkTone = 'terracota' }) => {
  const dtone = deltaTone === 'success' ? 'text-servirest-success'
              : deltaTone === 'danger'  ? 'text-servirest-danger'
              : deltaTone === 'mostaza' ? 'text-servirest-mostaza'
              : 'text-[rgba(42,40,38,0.4)]';
  return (
    <SrCard hover className="p-5 relative">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <Icon size={14} className="text-servirest-terracota" />
            <SrLabel>{label}</SrLabel>
          </div>
          <div className="font-black italic text-[28px] text-servirest-midnight tracking-[-0.02em] leading-none mb-1.5">
            {value}
          </div>
          {delta && <div className={`font-mono text-[10px] ${dtone}`}>{delta}</div>}
        </div>
        {series && series.length >= 2 && (
          <div className="flex-shrink-0 pt-1">
            <MicroSparkline data={series} tone={sparkTone} />
          </div>
        )}
      </div>
    </SrCard>
  );
};

/* -------------------------------------------------------------------------- */
/* SectionDivider — narrative section break with serif italic title             */
/* -------------------------------------------------------------------------- */
const SectionDivider: React.FC<{ kicker: string; title: string; meta?: string }> = ({ kicker, title, meta }) => (
  <div className="flex items-end justify-between gap-4 mt-12 mb-6 pb-4 border-b border-[rgba(42,40,38,0.10)]">
    <div>
      <SrKicker className="block mb-1.5">{kicker}</SrKicker>
      <h2 className="font-serif italic font-medium text-[32px] text-servirest-midnight tracking-[-0.02em] m-0 leading-none">
        {title}
      </h2>
    </div>
    {meta && <SrLabel>{meta}</SrLabel>}
  </div>
);

/* -------------------------------------------------------------------------- */
/* DashboardScreen — editorial composition with hero KPI                        */
/* -------------------------------------------------------------------------- */
export const DashboardScreen: React.FC = () => {
  const { expenses } = useExpenses();
  const { orders } = useOrders();
  const { settings } = useSettings();
  const { inventory } = useInventory();

  const [timeRange, setTimeRange] = useState<TimeRange>('Semana');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [isReportOpen, setIsReportOpen] = useState(false);

  const getLocalDatePart = (dateVal: any, part: 'date' | 'month' = 'date') => {
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return part === 'date' ? `${yyyy}-${mm}-${dd}` : `${yyyy}-${mm}`;
    } catch { return ''; }
  };

  const inRange = (d: Date) => {
    const dateStr = getLocalDatePart(d, 'date');
    const monthStr = getLocalDatePart(d, 'month');
    const ms = (n: number) => n * 24 * 60 * 60 * 1000;
    if (timeRange === 'Día específico') return dateStr === selectedDate;
    if (timeRange === 'Mes específico') return monthStr === selectedDate;
    if (timeRange === 'Día')    return Math.abs(Date.now() - d.getTime()) <= ms(1);
    if (timeRange === 'Semana') return Math.abs(Date.now() - d.getTime()) <= ms(7);
    if (timeRange === 'Mes')    return Math.abs(Date.now() - d.getTime()) <= ms(30);
    if (timeRange === 'Año')    return Math.abs(Date.now() - d.getTime()) <= ms(365);
    if (timeRange === 'Rango')  return dateStr >= dateRange.start && dateStr <= dateRange.end;
    return true;
  };

  const activeOrders = useMemo(
    () =>
      orders.filter((o) => {
        try {
          const dv = o.timestamp || (o as any).created_at || (o as any).createdAt || Date.now();
          const d = new Date(dv);
          if (isNaN(d.getTime())) return false;
          if (!inRange(d)) return false;
          if (selectedCategory !== 'All') {
            const hit = o.items?.some((it) => it.category === selectedCategory);
            if (!hit) return false;
          }
          return true;
        } catch { return false; }
      }),
    [orders, timeRange, selectedDate, selectedCategory, dateRange]
  );

  const activeExpenses = useMemo(
    () =>
      expenses.filter((e) => {
        try {
          const d = new Date(e.date || new Date());
          if (isNaN(d.getTime())) return false;
          return inRange(d);
        } catch { return false; }
      }),
    [expenses, timeRange, selectedDate, dateRange]
  );

  const chartData = useMemo(() => {
    const aggr: Record<string, { name: string; revenue: number; cost: number }> = {};
    const bucket = (d: Date) => {
      let key = getLocalDatePart(d, 'date');
      if (timeRange === 'Día' || timeRange === 'Día específico') key = `${String(d.getHours()).padStart(2, '0')}:00`;
      else if (timeRange === 'Año') key = getLocalDatePart(d, 'month');
      else if (timeRange === 'Rango') {
        const s = new Date(dateRange.start).getTime();
        const e = new Date(dateRange.end).getTime();
        if ((e - s) / (1000 * 60 * 60 * 24) > 60) key = getLocalDatePart(d, 'month');
      }
      return key;
    };

    activeOrders.forEach((o) => {
      if (o.status !== 'CANCELLED') {
        const d = new Date(o.timestamp || Date.now());
        const key = bucket(d);
        if (!aggr[key]) aggr[key] = { name: key, revenue: 0, cost: 0 };
        aggr[key].revenue += o.total || 0;
      }
    });
    activeExpenses.forEach((e) => {
      const d = new Date(e.date || Date.now());
      const key = bucket(d);
      if (!aggr[key]) aggr[key] = { name: key, revenue: 0, cost: 0 };
      aggr[key].cost += Number(e.amount || 0);
    });
    return Object.values(aggr).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeOrders, activeExpenses, timeRange, dateRange]);

  const { sales, items, cancelledSales, avgTicket, salesSparkline } = useMemo(() => {
    let _sales = 0, _items = 0, _count = 0, _cSales = 0;
    const dailyMap: Record<string, number> = {};
    activeOrders.forEach((o) => {
      if (o.status === 'COMPLETED' || o.status === 'PAID') {
        _sales += o.total || 0;
        _items += (o.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
        _count++;
        const key = getLocalDatePart(o.timestamp || Date.now(), 'date');
        dailyMap[key] = (dailyMap[key] || 0) + (o.total || 0);
      } else if (o.status === 'CANCELLED') {
        _cSales += o.total || 0;
      }
    });
    const spark = Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => v);
    return {
      sales: _sales, items: _items, cancelledSales: _cSales,
      avgTicket: _count > 0 ? _sales / _count : 0,
      salesSparkline: spark,
    };
  }, [activeOrders]);

  const totalExpenses = activeExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netCashFlow = sales - totalExpenses;
  const grossMarginPct = sales > 0 ? ((sales - totalExpenses) / sales) * 100 : 0;

  // Tendencias diarias para sparklines individuales
  const itemSpark = useMemo(() => {
    const m: Record<string, number> = {};
    activeOrders.forEach((o) => {
      if (o.status === 'COMPLETED' || o.status === 'PAID') {
        const key = getLocalDatePart(o.timestamp || Date.now(), 'date');
        m[key] = (m[key] || 0) + (o.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
      }
    });
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [activeOrders]);

  const expenseSpark = useMemo(() => {
    const m: Record<string, number> = {};
    activeExpenses.forEach((e) => {
      const key = getLocalDatePart(e.date || Date.now(), 'date');
      m[key] = (m[key] || 0) + Number(e.amount || 0);
    });
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [activeExpenses]);

  // Simple delta: compare last value vs average of previous values
  const deltaPct = useMemo(() => {
    if (salesSparkline.length < 2) return undefined;
    const last = salesSparkline[salesSparkline.length - 1];
    const prev = salesSparkline.slice(0, -1);
    const avg = prev.reduce((s, v) => s + v, 0) / prev.length;
    if (avg === 0) return undefined;
    return ((last - avg) / avg) * 100;
  }, [salesSparkline]);

  const productStats = useMemo(() => {
    const stats: Record<string, { name: string; quantity: number; revenue: number }> = {};
    activeOrders.forEach((o) => {
      if (o.status !== 'CANCELLED') {
        o.items?.forEach((item) => {
          const id = item.id || item.name;
          if (!stats[id]) stats[id] = { name: item.name, quantity: 0, revenue: 0 };
          stats[id].quantity += item.quantity || 1;
          stats[id].revenue += ((item as any).priceAtTime || item.price || 0) * (item.quantity || 1);
        });
      }
    });
    const sorted = Object.values(stats).sort((a, b) => b.quantity - a.quantity);
    return { top: sorted.slice(0, 8), bottom: [...sorted].reverse().slice(0, 4) };
  }, [activeOrders]);

  const categoryInsights = useMemo(() => {
    const expByCat: Record<string, number> = {};
    activeExpenses.forEach((e) => {
      const cat = e.category || 'Varios';
      expByCat[cat] = (expByCat[cat] || 0) + Number(e.amount || 0);
    });
    const invByCat: Record<string, number> = {};
    inventory.forEach((i) => {
      const cat = i.category || 'Sin categoría';
      invByCat[cat] = (invByCat[cat] || 0) + i.quantity * (i.costPrice || 0);
    });
    return {
      exp: Object.entries(expByCat).sort((a, b) => b[1] - a[1]).slice(0, 5),
      inv: Object.entries(invByCat).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [inventory, activeExpenses]);

  const periodLabel =
    timeRange === 'Rango' ? `${dateRange.start} a ${dateRange.end}`
    : timeRange === 'Día específico' ? selectedDate
    : timeRange === 'Mes específico' ? selectedDate.substring(0, 7)
    : timeRange;

  const expMax = Math.max(...categoryInsights.exp.map(([, v]) => v as number), 1);

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-servirest-hueso text-servirest-carbon no-print">
      <div className="px-[38px] py-10 max-w-[1480px] mx-auto pb-32 lg:pb-12">
        {/* ─── HEADER ────────────────────────────────────────────────────── */}
        <div className="flex justify-between items-start flex-wrap gap-6 mb-12">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <SrKicker className="block mb-2">Orquestación financiera</SrKicker>
            <h1 className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0">
              {settings.name || 'Tu restaurante'}
            </h1>
            <p className="text-[14px] text-[rgba(42,40,38,0.6)] font-medium mt-2 max-w-[480px] leading-relaxed">
              Resumen de operación en tiempo real. Ventas, gastos y margen — listo para que cierres tu día sin Excel.
            </p>
          </motion.div>

          <div className="flex items-center gap-3 flex-wrap">
            <SrSeg
              options={RANGE_OPTS}
              value={(RANGE_OPTS as readonly string[]).includes(timeRange as any) ? (timeRange as any) : 'Semana'}
              onChange={(v) => setTimeRange(v as TimeRange)}
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-servirest-carbon px-4 py-3 rounded-sr-md text-[10px] font-black uppercase tracking-[0.14em] outline-none cursor-pointer hover:border-servirest-terracota transition-colors"
            >
              {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <SrButton variant="primary" size="md" icon={<FileText size={16} />} onClick={() => setIsReportOpen(true)}>
              Exportar reporte
            </SrButton>
          </div>
        </div>

        {/* ─── HERO KPI + 3 INLINE KPIS — asymmetric composition ─────────── */}
        <div className="grid lg:grid-cols-5 gap-5 mb-3">
          <div className="lg:col-span-3">
            <HeroKPI
              label="Ventas netas"
              value={`$${sales.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`}
              deltaPct={deltaPct}
              series={salesSparkline}
              periodLabel={periodLabel}
            />
          </div>
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
            <InlineKPI
              icon={Receipt}
              label="Ticket promedio"
              value={`$${avgTicket.toFixed(0)}`}
              delta={`${activeOrders.length} órdenes`}
              series={salesSparkline.length > 1 ? salesSparkline : undefined}
              sparkTone="terracota"
            />
            <InlineKPI
              icon={Banknote}
              label="Margen del periodo"
              value={`${grossMarginPct.toFixed(1)}%`}
              delta={grossMarginPct >= 25 ? 'Sano' : grossMarginPct >= 15 ? 'Aceptable' : 'Revisa food cost'}
              deltaTone={grossMarginPct >= 25 ? 'success' : grossMarginPct >= 15 ? 'mostaza' : 'danger'}
            />
          </div>
        </div>

        {/* ─── 4 SECONDARY KPIs — uniform row, smaller weight ──────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-3">
          <InlineKPI
            icon={Utensils}
            label="Platillos vendidos"
            value={`${items}`}
            delta={`${activeOrders.length} órdenes`}
            series={itemSpark}
            sparkTone="terracota"
          />
          <InlineKPI
            icon={Wallet}
            label="Gastos del periodo"
            value={`$${totalExpenses.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`}
            delta="Caja chica + proveedores"
            series={expenseSpark}
            sparkTone="danger"
          />
          <InlineKPI
            icon={Ban}
            label="Cancelaciones"
            value={`$${cancelledSales.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`}
            delta={cancelledSales > 0 ? 'Revisa' : 'Sin cancelaciones'}
            deltaTone={cancelledSales > 0 ? 'danger' : 'success'}
          />
          <InlineKPI
            icon={TrendingUp}
            label="Flujo neto"
            value={`$${netCashFlow.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`}
            delta={netCashFlow >= 0 ? '▲ Saldo positivo' : '▼ Saldo negativo'}
            deltaTone={netCashFlow >= 0 ? 'success' : 'danger'}
          />
        </div>

        {/* ─── SECTION 1 — Tesorería ────────────────────────────────────── */}
        <SectionDivider
          kicker="Tesorería"
          title="Movimiento del periodo"
          meta={`${chartData.length} puntos · ${activeOrders.length} órdenes · ${activeExpenses.length} egresos`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-3">
          {/* Main combined chart — sales + expenses overlay */}
          <SrCard variant="solaris" className="lg:col-span-2 p-7 relative">
            <div className="flex items-start justify-between mb-6">
              <div>
                <SrKicker className="block mb-1">Ingresos vs gastos</SrKicker>
                <h3 className="sr-h-brutal text-[19px] m-0">Tendencia diaria</h3>
              </div>
              <div className="flex gap-3 text-[10px] font-medium">
                <span className="flex items-center gap-1.5 text-[rgba(42,40,38,0.6)]">
                  <span className="w-2.5 h-2.5 rounded-full bg-servirest-terracota" /> Ingresos
                </span>
                <span className="flex items-center gap-1.5 text-[rgba(42,40,38,0.6)]">
                  <span className="w-2.5 h-2.5 rounded-full bg-servirest-mostaza" /> Gastos
                </span>
              </div>
            </div>
            {chartData.length === 0 ? (
              <SrEmptyState
                icon={<TrendingUp size={28} />}
                title="Aún sin movimientos"
                description="Cuando comiences a registrar órdenes y gastos en este periodo, verás la tendencia aquí."
              />
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <defs>
                      <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C4633F" stopOpacity={0.30} />
                        <stop offset="100%" stopColor="#C4633F" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C9A24A" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#C9A24A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,40,38,0.06)" vertical={false} />
                    <XAxis dataKey="name"
                      stroke="#2A2826" opacity={0.4}
                      tick={{ fill: '#2A2826', fontSize: 10, fontWeight: 700 }}
                      axisLine={false} tickLine={false} />
                    <YAxis
                      stroke="#2A2826" opacity={0.4}
                      tick={{ fill: '#2A2826', fontSize: 10, fontWeight: 700 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                    <Tooltip
                      cursor={{ stroke: 'rgba(196,99,63,0.20)', strokeWidth: 1 }}
                      content={({ active, payload, label }) =>
                        active && payload && payload.length ? (
                          <div className="sr-card p-4 min-w-[200px]">
                            <p className="text-[10px] font-bold text-[rgba(42,40,38,0.6)] mb-2 uppercase tracking-[0.12em]">{label}</p>
                            {payload.map((p, i) => (
                              <p key={i} className="text-[12px] font-medium flex items-center justify-between gap-3">
                                <span className="flex items-center gap-1.5 text-[rgba(42,40,38,0.6)]">
                                  <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                                  {p.dataKey === 'revenue' ? 'Ingresos' : 'Gastos'}
                                </span>
                                <span className="font-mono font-bold text-servirest-midnight">${Number(p.value).toLocaleString()}</span>
                              </p>
                            ))}
                          </div>
                        ) : null
                      }
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#C4633F" strokeWidth={2.5} fill="url(#gradRevenue)" />
                    <Area type="monotone" dataKey="cost" stroke="#C9A24A" strokeWidth={2} fill="url(#gradCost)" strokeDasharray="4 4" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </SrCard>

          {/* Side: expense distribution with bar gauges */}
          <SrCard variant="solaris" className="p-7">
            <div className="flex items-start justify-between mb-6">
              <div>
                <SrKicker className="block mb-1">Operación</SrKicker>
                <h3 className="sr-h-brutal text-[19px] m-0">Mix de gastos</h3>
              </div>
            </div>
            {categoryInsights.exp.length === 0 ? (
              <SrEmptyState
                icon={<Wallet size={24} />}
                title="Sin gastos registrados"
                description="Cuando registres compras o gastos de caja chica, verás cómo se distribuyen aquí."
              />
            ) : (
              <div className="space-y-4">
                {categoryInsights.exp.map(([cat, val]) => {
                  const pct = ((val as number) / expMax) * 100;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between items-baseline text-[11px] mb-1.5">
                        <span className="font-extrabold text-servirest-midnight tracking-tight">{cat}</span>
                        <SrMono className="text-servirest-terracota">${(val as number).toLocaleString()}</SrMono>
                      </div>
                      <div className="h-1.5 bg-[rgba(42,40,38,0.06)] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full bg-servirest-terracota rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SrCard>
        </div>

        {/* ─── SECTION 2 — Producto ────────────────────────────────────── */}
        <SectionDivider
          kicker="Producto"
          title="Qué se está vendiendo"
          meta={`${productStats.top.length} platillos en cohorte`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-3">
          {/* Top sellers — editorial list */}
          <SrCard variant="solaris" className="lg:col-span-2 p-7">
            <div className="flex items-start justify-between mb-6">
              <div>
                <SrKicker className="block mb-1">Más vendidos</SrKicker>
                <h3 className="sr-h-brutal text-[19px] m-0">Top {productStats.top.length} del periodo</h3>
              </div>
              <SrLabel>Ordenados por volumen</SrLabel>
            </div>

            {productStats.top.length === 0 ? (
              <SrEmptyState
                icon={<Utensils size={24} />}
                title="Aún sin platillos vendidos"
                description="Cierra al menos una orden para empezar a ver tu top de ventas."
              />
            ) : (
              <div>
                {productStats.top.map((p, i) => {
                  const max = productStats.top[0]?.quantity || 1;
                  const pct = (p.quantity / max) * 100;
                  return (
                    <motion.div
                      key={p.name + i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="grid grid-cols-[36px_1fr_auto] gap-4 items-center py-3 border-b border-[rgba(42,40,38,0.06)] last:border-0 group"
                    >
                      <span className="font-black italic text-[20px] text-servirest-terracota text-center leading-none">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-baseline justify-between gap-3 mb-1.5">
                          <span className="font-extrabold text-[14px] text-servirest-midnight tracking-tight truncate">
                            {p.name}
                          </span>
                          <SrMono className="text-[11px] text-[rgba(42,40,38,0.6)] flex-shrink-0">
                            ${p.revenue.toLocaleString()}
                          </SrMono>
                        </div>
                        <div className="h-1 bg-[rgba(42,40,38,0.06)] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full bg-servirest-terracota rounded-full"
                          />
                        </div>
                      </div>
                      <span className="font-mono font-bold text-[12px] text-servirest-midnight">
                        {p.quantity}<span className="text-[rgba(42,40,38,0.4)] font-medium ml-0.5">und</span>
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </SrCard>

          {/* Underperformers + insight */}
          <SrCard variant="solaris" className="p-7">
            <div className="flex items-start justify-between mb-6">
              <div>
                <SrKicker className="block mb-1">Atención</SrKicker>
                <h3 className="sr-h-brutal text-[19px] m-0">Bajo desempeño</h3>
              </div>
            </div>

            {productStats.bottom.length === 0 ? (
              <SrEmptyState
                icon={<Sparkles size={24} />}
                title="Catálogo equilibrado"
                description="Todos tus platillos están vendiendo en el periodo. Bien."
              />
            ) : (
              <div className="space-y-3">
                {productStats.bottom.map((p) => (
                  <div key={p.name} className="flex items-center justify-between p-3.5 rounded-sr-md bg-servirest-hueso-sunken/40 border border-[rgba(42,40,38,0.06)]">
                    <span className="font-extrabold text-[12px] text-servirest-midnight tracking-tight truncate flex-1 mr-3">
                      {p.name}
                    </span>
                    <span className="font-mono font-bold text-[11px] text-servirest-mostaza flex-shrink-0">
                      {p.quantity}<span className="text-[rgba(42,40,38,0.4)] font-medium ml-0.5">und</span>
                    </span>
                  </div>
                ))}

                <div className="mt-5 p-4 rounded-sr-md bg-[rgba(196,99,63,0.05)] border-l-2 border-servirest-terracota">
                  <SrLabel className="block mb-1.5">Sugerencia</SrLabel>
                  <p className="text-[12px] font-medium text-servirest-carbon leading-relaxed">
                    Estos platillos cubren menos del 5% de tus ventas. Considera revisar precio, foto o sacarlos del menú.
                  </p>
                </div>
              </div>
            )}
          </SrCard>
        </div>

        {/* ─── SECTION 3 — Inventario ────────────────────────────────── */}
        {categoryInsights.inv.length > 0 && (
          <>
            <SectionDivider
              kicker="Capital amarrado"
              title="Tu dinero en inventario"
            />
            <SrCard variant="solaris" className="p-7 mb-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
                {categoryInsights.inv.map(([cat, val]) => {
                  const max = Math.max(...categoryInsights.inv.map(([, v]) => v as number), 1);
                  const pct = ((val as number) / max) * 100;
                  return (
                    <div key={cat} className="py-2 border-b border-[rgba(42,40,38,0.06)]">
                      <div className="flex justify-between items-baseline text-[12px] mb-1.5">
                        <span className="font-extrabold text-servirest-midnight tracking-tight">{cat}</span>
                        <SrMono className="text-servirest-midnight">${(val as number).toLocaleString()}</SrMono>
                      </div>
                      <div className="h-1 bg-[rgba(42,40,38,0.06)] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full bg-servirest-midnight rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </SrCard>
          </>
        )}
      </div>

      <FinancialReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        orders={activeOrders}
        expenses={activeExpenses}
        periodLabel={periodLabel}
        categoryLabel={selectedCategory}
        restaurantName={settings.name}
      />
    </div>
  );
};

export default DashboardScreen;
