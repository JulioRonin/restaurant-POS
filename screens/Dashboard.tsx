import React, { useState, useMemo } from 'react';
import { CATEGORIES } from '../constants';
import { useExpenses } from '../contexts/ExpenseContext';
import { useOrders } from '../contexts/OrderContext';
import { useSettings } from '../contexts/SettingsContext';
import { useInventory } from '../contexts/InventoryContext';
import { FinancialReportModal } from '../components/FinancialReportModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  TrendingUp, Utensils, Ban, Receipt, Wallet, Banknote,
  FileText, TrendingDown, Layers, ArrowUpRight, Target,
} from 'lucide-react';
import {
  SrCard, SrButton, SrSeg, SrLabel, SrKicker,
} from '../components/ui/servirest';

type TimeRange = 'Día' | 'Semana' | 'Mes' | 'Año' | 'Día específico' | 'Mes específico' | 'Rango';

const RANGE_OPTS = ['Día', 'Semana', 'Mes', 'Año'] as const;

export const DashboardScreen: React.FC = () => {
  const { expenses } = useExpenses();
  const { orders } = useOrders();
  const { settings } = useSettings();
  const { inventory } = useInventory();

  const [timeRange, setTimeRange] = useState<TimeRange>('Semana');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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
    if (timeRange === 'Día')   return Math.abs(Date.now() - d.getTime()) <= ms(1);
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

  const { sales, items, cancelledSales, avgTicket } = useMemo(() => {
    let _sales = 0, _items = 0, _count = 0, _cSales = 0;
    activeOrders.forEach((o) => {
      if (o.status === 'COMPLETED' || o.status === 'PAID') {
        _sales += o.total || 0;
        _items += (o.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
        _count++;
      } else if (o.status === 'CANCELLED') {
        _cSales += o.total || 0;
      }
    });
    return { sales: _sales, items: _items, cancelledSales: _cSales, avgTicket: _count > 0 ? _sales / _count : 0 };
  }, [activeOrders]);

  const totalExpenses = activeExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netCashFlow = sales - totalExpenses;

  type Kpi = { label: string; value: string; icon: any; delta?: string; deltaTone?: 'success' | 'danger' | 'mute' };
  const DYNAMIC_KPIS: Kpi[] = [
    { label: 'Ventas netas',  value: `$${sales.toLocaleString()}`,         icon: TrendingUp, delta: '▲ vs periodo previo', deltaTone: 'success' },
    { label: 'Platillos',     value: `${items}`,                            icon: Utensils,   delta: `${activeOrders.length} órdenes`, deltaTone: 'mute' },
    { label: 'Cancelaciones', value: `$${cancelledSales.toLocaleString()}`, icon: Ban,        delta: 'Pérdida', deltaTone: 'danger' },
    { label: 'Ticket medio',  value: `$${avgTicket.toFixed(0)}`,            icon: Receipt,    delta: 'Por orden', deltaTone: 'mute' },
    { label: 'Gastos caja',   value: `$${totalExpenses.toLocaleString()}`,  icon: Wallet,     delta: 'Prime cost', deltaTone: 'mute' },
    { label: 'Flujo estimado', value: `$${netCashFlow.toLocaleString()}`,   icon: Banknote,   delta: netCashFlow >= 0 ? '▲ saludable' : '▼ revisa', deltaTone: netCashFlow >= 0 ? 'success' : 'danger' },
  ];

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
    return { top: sorted.slice(0, 10), bottom: [...sorted].reverse().slice(0, 5) };
  }, [activeOrders]);

  const categoryInsights = useMemo(() => {
    const invByCat: Record<string, number> = {};
    inventory.forEach((i) => {
      const cat = i.category || 'Sin Cat.';
      invByCat[cat] = (invByCat[cat] || 0) + i.quantity * (i.costPrice || 0);
    });
    const expByCat: Record<string, number> = {};
    activeExpenses.forEach((e) => {
      const cat = e.category || 'Varios';
      expByCat[cat] = (expByCat[cat] || 0) + Number(e.amount || 0);
    });
    const topInv = Object.entries(invByCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topExp = Object.entries(expByCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { topInv, topExp };
  }, [inventory, activeExpenses]);

  const periodLabel =
    timeRange === 'Rango'
      ? `${dateRange.start} a ${dateRange.end}`
      : timeRange === 'Día específico'
      ? selectedDate
      : selectedDate.substring(0, 7);

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-servirest-hueso text-servirest-carbon p-[38px] no-print">
      {/* HEADER */}
      <div className="flex justify-between items-start flex-wrap gap-5 mb-10 no-print-dashboard">
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="sr-h1 m-0 mb-2">{settings.name || 'ServiRest'}</h1>
          <div className="sr-label">Orquestación financiera en tiempo real</div>
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
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {(timeRange === 'Día específico' || timeRange === 'Mes específico') && (
            <input
              type={timeRange === 'Día específico' ? 'date' : 'month'}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-servirest-carbon px-4 py-3 rounded-sr-md text-[10px] font-black uppercase tracking-[0.14em] outline-none cursor-pointer"
            />
          )}
          {timeRange === 'Rango' && (
            <div className="flex items-center gap-2 bg-servirest-surface border border-[rgba(42,40,38,0.12)] px-3 py-2 rounded-sr-md">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))}
                className="bg-transparent text-servirest-carbon text-[10px] font-bold outline-none"
              />
              <span className="text-[10px] text-[rgba(42,40,38,0.6)] font-bold">→</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))}
                className="bg-transparent text-servirest-carbon text-[10px] font-bold outline-none"
              />
            </div>
          )}

          <SrButton variant="primary" size="md" icon={<FileText size={16} />} onClick={() => setIsReportOpen(true)}>
            Exportar reporte
          </SrButton>
        </div>
      </div>

      {/* KPI GRID */}
      <div
        className="grid gap-3.5 mb-6"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
      >
        {DYNAMIC_KPIS.map((kpi, idx) => {
          const Icon = kpi.icon;
          const dtone = kpi.deltaTone === 'success' ? 'text-servirest-success'
            : kpi.deltaTone === 'danger' ? 'text-servirest-danger'
            : 'text-[rgba(42,40,38,0.4)]';
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <SrCard hover className="p-[22px]">
                <Icon size={20} className="text-servirest-terracota mb-4" />
                <SrLabel className="mb-1.5 block">{kpi.label}</SrLabel>
                <div className="sr-kpi text-[21px] mb-1">{kpi.value}</div>
                {kpi.delta && (
                  <div className={`font-mono text-[9px] ${dtone}`}>{kpi.delta}</div>
                )}
              </SrCard>
            </motion.div>
          );
        })}
      </div>

      {/* MAIN ROW — bars + cost area */}
      <div className="grid gap-[18px] mb-[18px]" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <SrCard variant="solaris" className="p-7">
          <SrKicker className="block mb-1">Proyección financiera</SrKicker>
          <h3 className="sr-h-brutal text-[19px] mb-[26px]">Ventas por día</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2826" opacity={0.05} vertical={false} />
                <XAxis dataKey="name" stroke="#2A2826" opacity={0.3}
                  tick={{ fill: '#2A2826', fontSize: 9, fontWeight: 900 }}
                  axisLine={false} tickLine={false} />
                <YAxis stroke="#2A2826" opacity={0.3}
                  tick={{ fill: '#2A2826', fontSize: 9, fontWeight: 900 }}
                  axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(196,99,63,0.05)' }}
                  content={({ active, payload, label }) =>
                    active && payload && payload.length ? (
                      <div className="sr-card p-3">
                        <p className="text-[10px] font-bold text-[rgba(42,40,38,0.6)] mb-1">{label}</p>
                        <p className="text-servirest-terracota font-black text-sm">
                          Ventas: ${Number(payload[0]?.value || 0).toLocaleString()}
                        </p>
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="revenue" fill="#C4633F" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SrCard>

        <SrCard variant="solaris" className="p-7">
          <SrKicker className="block mb-1">Operación</SrKicker>
          <h3 className="sr-h-brutal text-[19px] mb-[26px]">Costo (Prime Cost)</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <Area type="monotone" dataKey="cost" stroke="#C4633F" fill="#C4633F" fillOpacity={0.1} strokeWidth={3} />
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <Tooltip
                  cursor={{ stroke: 'rgba(196,99,63,0.2)', strokeWidth: 1 }}
                  content={({ active, payload }) =>
                    active && payload && payload.length ? (
                      <div className="sr-card p-3">
                        <p className="text-[10px] font-bold text-[rgba(42,40,38,0.6)] mb-1">Gastos</p>
                        <p className="text-servirest-terracota font-black text-sm">
                          ${Number(payload[0]?.value || 0).toLocaleString()}
                        </p>
                      </div>
                    ) : null
                  }
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SrCard>
      </div>

      {/* INSIGHTS — best sellers + category split */}
      <div className="grid lg:grid-cols-2 gap-[18px] mb-12">
        <SrCard variant="solaris" className="p-7">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ArrowUpRight className="text-servirest-success" size={20} />
              <h3 className="sr-h-brutal text-[17px]">Best Sellers · Top 10</h3>
            </div>
            <span className="sr-label">{activeOrders.length} ventas</span>
          </div>
          <div className="space-y-2">
            {productStats.top.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-sr-md bg-servirest-hueso border border-[rgba(42,40,38,0.12)] hover:bg-[rgba(42,40,38,0.04)] transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <span className="font-black italic text-servirest-terracota w-6 text-base">#{i + 1}</span>
                  <span className="font-black uppercase tracking-[0.1em] text-[10px] text-servirest-carbon">{p.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-black italic text-[11px] text-servirest-carbon">{p.quantity} unid.</div>
                  <div className="text-[9px] text-[rgba(42,40,38,0.4)] font-bold tracking-[0.1em] font-mono group-hover:text-servirest-terracota transition-colors">
                    ${p.revenue.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
            {productStats.top.length === 0 && (
              <p className="text-center py-10 sr-label">Sin datos de volumen</p>
            )}
          </div>
        </SrCard>

        <div className="space-y-[18px]">
          <SrCard variant="solaris" className="p-7">
            <div className="flex items-center gap-3 mb-6">
              <Target className="text-servirest-mostaza" size={20} />
              <h3 className="sr-h-brutal text-[17px]">Análisis por categoría</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <SrLabel className="block mb-4 inline-flex items-center gap-2">
                  <Layers size={12} /> Costo inventario
                </SrLabel>
                <div className="space-y-2.5">
                  {categoryInsights.topInv.map(([cat, val]) => (
                    <div key={cat} className="flex justify-between text-[10px]">
                      <span className="font-bold text-[rgba(42,40,38,0.6)]">{cat}</span>
                      <span className="font-black text-servirest-terracota font-mono">${val.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <SrLabel className="block mb-4 inline-flex items-center gap-2">
                  <Wallet size={12} /> Distribución gastos
                </SrLabel>
                <div className="space-y-2.5">
                  {categoryInsights.topExp.map(([cat, val]) => {
                    const max = Math.max(...categoryInsights.topExp.map(([, v]) => v as number)) || 1;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="font-bold text-[rgba(42,40,38,0.6)]">{cat}</span>
                          <span className="font-black text-servirest-terracota font-mono">${(val as number).toLocaleString()}</span>
                        </div>
                        <div className="h-[5px] bg-[rgba(42,40,38,0.07)] rounded-[3px] overflow-hidden">
                          <div
                            className="h-full bg-servirest-terracota rounded-[3px] transition-all duration-500"
                            style={{ width: `${((val as number) / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </SrCard>

          <SrCard variant="solaris" className="p-7">
            <div className="flex items-center gap-3 mb-6">
              <TrendingDown className="text-servirest-danger" size={20} />
              <h3 className="sr-h-brutal text-[17px]">Ventas críticas (bajas)</h3>
            </div>
            <div className="space-y-2.5">
              {productStats.bottom.map((p, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-3 rounded-sr-md bg-[rgba(225,85,75,0.03)] border border-servirest-danger/10"
                >
                  <span className="font-black uppercase tracking-[0.1em] text-[10px] text-[rgba(42,40,38,0.6)]">{p.name}</span>
                  <span className="font-black text-servirest-danger text-[10px] font-mono">{p.quantity} unid.</span>
                </div>
              ))}
              {productStats.bottom.length === 0 && (
                <p className="text-center py-6 sr-label">Operación saludable</p>
              )}
            </div>
          </SrCard>
        </div>
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
