import React, { useState, useMemo } from 'react';
import { CATEGORIES } from '../constants';
import { useExpenses } from '../contexts/ExpenseContext';
import { useOrders } from '../contexts/OrderContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSettings } from '../contexts/SettingsContext';
import { useInventory } from '../contexts/InventoryContext';
import { FinancialReportModal } from '../components/FinancialReportModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';
import { motion } from 'framer-motion';
import { GlowCard } from '../components/ui/spotlight-card';
import { SolarisShader } from '../components/ui/solaris-shader';
import { 
  TrendingUp, 
  Utensils, 
  Ban, 
  Receipt, 
  Wallet, 
  Banknote, 
  FileText, 
  Calendar,
  AlertCircle,
  TrendingDown,
  Layers,
  ArrowUpRight,
  Target
} from 'lucide-react';

type TimeRange = 'Weekly' | 'Monthly' | 'Yearly' | 'SpecificDay' | 'SpecificMonth' | 'DateRange';

export const DashboardScreen: React.FC = () => {
    const { expenses } = useExpenses();
    const { orders } = useOrders();
    const { daysRemaining } = useSubscription();
    const { settings } = useSettings();
    const { inventory } = useInventory();
    
    const [timeRange, setTimeRange] = useState<TimeRange>('Weekly');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }); 
    const [dateRange, setDateRange] = useState<{ start: string, end: string }>({
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [isReportOpen, setIsReportOpen] = useState(false);

    // Helper to get local date string YYYY-MM-DD or YYYY-MM
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

    // Filtered data based on time range and category
    const activeOrders = useMemo(() => {
        return orders.filter(o => {
            try {
                const dateVal = o.timestamp || (o as any).created_at || (o as any).createdAt || Date.now();
                const d = new Date(dateVal);
                if (isNaN(d.getTime())) return false;
                
                const orderDateStr = getLocalDatePart(d, 'date');
                const orderMonthStr = getLocalDatePart(d, 'month');

                if (timeRange === 'SpecificDay') {
                    if (orderDateStr !== selectedDate) return false;
                } else if (timeRange === 'SpecificMonth') {
                    // selectedDate from "month" input is usually YYYY-MM
                    if (orderMonthStr !== selectedDate) return false;
                } else if (timeRange === 'Weekly') {
                    const diffTime = Math.abs(new Date().getTime() - d.getTime());
                    const diffDays = diffTime / (1000 * 60 * 60 * 24);
                    if (diffDays > 7) return false;
                } else if (timeRange === 'Monthly') {
                    const diffTime = Math.abs(new Date().getTime() - d.getTime());
                    const diffDays = diffTime / (1000 * 60 * 60 * 24);
                    if (diffDays > 30) return false;
                } else if (timeRange === 'Yearly') {
                    const diffTime = Math.abs(new Date().getTime() - d.getTime());
                    const diffDays = diffTime / (1000 * 60 * 60 * 24);
                    if (diffDays > 365) return false;
                } else if (timeRange === 'DateRange') {
                    if (orderDateStr < dateRange.start || orderDateStr > dateRange.end) return false;
                }

                // Category filter
                if (selectedCategory !== 'All') {
                    const hasCategoryItem = o.items?.some(item => item.category === selectedCategory);
                    if (!hasCategoryItem) return false;
                }

                return true;
            } catch (e) {
                return false;
            }
        });
    }, [orders, timeRange, selectedDate, selectedCategory, dateRange]);

    const activeExpenses = useMemo(() => {
        return expenses.filter(e => {
            try {
                const dateVal = e.date || new Date();
                const d = new Date(dateVal);
                if (isNaN(d.getTime())) return false;
                
                const expDateStr = getLocalDatePart(d, 'date');
                const expMonthStr = getLocalDatePart(d, 'month');

                if (timeRange === 'SpecificDay') {
                    // Check local date OR UTC date to be extra resilient to shift issues
                    const expUTCDateStr = d.toISOString().split('T')[0];
                    if (expDateStr !== selectedDate && expUTCDateStr !== selectedDate) return false;
                } else if (timeRange === 'SpecificMonth') {
                    const expUTCMonthStr = d.toISOString().split('T')[0].substring(0, 7);
                    if (expMonthStr !== selectedDate && expUTCMonthStr !== selectedDate) return false;
                } else if (timeRange === 'Weekly') {
                    const diffTime = Math.abs(new Date().getTime() - d.getTime());
                    const diffDays = diffTime / (1000 * 60 * 60 * 24);
                    if (diffDays > 7) return false;
                } else if (timeRange === 'Monthly') {
                    const diffTime = Math.abs(new Date().getTime() - d.getTime());
                    const diffDays = diffTime / (1000 * 60 * 60 * 24);
                    if (diffDays > 30) return false;
                } else if (timeRange === 'Yearly') {
                    const diffTime = Math.abs(new Date().getTime() - d.getTime());
                    const diffDays = diffTime / (1000 * 60 * 60 * 24);
                    if (diffDays > 365) return false;
                } else if (timeRange === 'DateRange') {
                    if (expDateStr < dateRange.start || expDateStr > dateRange.end) return false;
                }
                
                return true;
            } catch (e) {
                return false;
            }
        });
    }, [expenses, timeRange, selectedDate, dateRange]);

    // Real Chart Data
    const chartData = useMemo(() => {
        const aggr: Record<string, { name: string; revenue: number; cost: number }> = {};
        
        activeOrders.forEach(o => {
            if (o.status !== 'CANCELLED') {
                const d = new Date(o.timestamp || Date.now());
                let key = getLocalDatePart(d, 'date');
                
                if (timeRange === 'SpecificDay') {
                    key = `${String(d.getHours()).padStart(2, '0')}:00`;
                } else if (timeRange === 'Yearly') {
                    key = getLocalDatePart(d, 'month');
                } else if (timeRange === 'DateRange') {
                    const start = new Date(dateRange.start);
                    const end = new Date(dateRange.end);
                    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
                    if (diffDays > 60) key = getLocalDatePart(d, 'month');
                }

                if (!aggr[key]) aggr[key] = { name: key, revenue: 0, cost: 0 };
                aggr[key].revenue += (o.total || 0);
            }
        });

        activeExpenses.forEach(e => {
            const d = new Date(e.date || Date.now());
            let key = getLocalDatePart(d, 'date');
            
            if (timeRange === 'SpecificDay') {
                key = `${String(d.getHours()).padStart(2, '0')}:00`;
            } else if (timeRange === 'Yearly') {
                key = getLocalDatePart(d, 'month');
            } else if (timeRange === 'DateRange') {
                const start = new Date(dateRange.start);
                const end = new Date(dateRange.end);
                const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
                if (diffDays > 60) key = getLocalDatePart(d, 'month');
            }

            if (!aggr[key]) aggr[key] = { name: key, revenue: 0, cost: 0 };
            aggr[key].cost += Number(e.amount || 0);
        });

        return Object.values(aggr).sort((a, b) => a.name.localeCompare(b.name));
    }, [activeOrders, activeExpenses, timeRange, dateRange]);

    const { sales, items, cancelledSales, cancelledCount, avgTicket } = useMemo(() => {
        let _sales = 0, _items = 0, _count = 0, _cSales = 0, _cCount = 0;
        activeOrders.forEach(o => {
            if (o.status === 'COMPLETED' || o.status === 'PAID') {
                _sales += o.total || 0;
                _items += (o.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
                _count++;
            } else if (o.status === 'CANCELLED') {
                _cSales += o.total || 0;
                _cCount++;
            }
        });
        return { sales: _sales, items: _items, cancelledSales: _cSales, cancelledCount: _cCount, avgTicket: _count > 0 ? (_sales / _count) : 0 };
    }, [activeOrders]);

    const totalExpenses = activeExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const netCashFlow = sales - totalExpenses;

    const DYNAMIC_KPIS = [
        { label: 'Ventas Netas', value: `$${sales.toLocaleString()}`, icon: TrendingUp, color: 'orange' },
        { label: 'Platillos', value: `${items}`, icon: Utensils, color: 'orange' },
        { label: 'Cancelaciones', value: `$${cancelledSales.toLocaleString()}`, icon: Ban, color: 'red' },
        { label: 'Ticket Med.', value: `$${avgTicket.toFixed(1)}`, icon: Receipt, color: 'blue' },
        { label: 'Gastos Caja', value: `$${totalExpenses.toLocaleString()}`, icon: Wallet, color: 'red' },
        { label: 'Flujo Estimado', value: `$${netCashFlow.toLocaleString()}`, icon: Banknote, color: 'green' },
    ];

    // Analytics: Best Sellers
    const productStats = useMemo(() => {
        const stats: Record<string, { name: string; quantity: number; revenue: number }> = {};
        activeOrders.forEach(o => {
            if (o.status !== 'CANCELLED') {
                o.items?.forEach(item => {
                    const id = item.id || item.name;
                    if (!stats[id]) stats[id] = { name: item.name, quantity: 0, revenue: 0 };
                    stats[id].quantity += item.quantity || 1;
                    stats[id].revenue += (item.priceAtTime || item.price || 0) * (item.quantity || 1);
                });
            }
        });
        const sorted = Object.values(stats).sort((a, b) => b.quantity - a.quantity);
        return { 
            top: sorted.slice(0, 10),
            bottom: [...sorted].reverse().slice(0, 5)
        };
    }, [activeOrders]);

    // Financial Categories
    const categoryInsights = useMemo(() => {
        const invByCat: Record<string, number> = {};
        inventory.forEach(i => {
            const cat = i.category || 'Sin Cat.';
            invByCat[cat] = (invByCat[cat] || 0) + (i.quantity * (i.costPrice || 0));
        });

        const expByCat: Record<string, number> = {};
        activeExpenses.forEach(e => {
            const cat = e.category || 'Varios';
            expByCat[cat] = (expByCat[cat] || 0) + Number(e.amount || 0);
        });

        const topInv = Object.entries(invByCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const topExp = Object.entries(expByCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
        
        return { topInv, topExp };
    }, [inventory, activeExpenses]);

    return (
        <div className="h-full w-full relative">
            <div className="flex-1 text-[#1a1c14] p-6 md:p-10 overflow-y-auto h-full relative font-sans antialiased custom-scrollbar no-print" style={{ backgroundImage: 'url(/bg-koso.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <SolarisShader />

                <div className="relative z-10">
                {/* Header Section */}
                <div className="flex justify-between items-center mb-12 flex-wrap gap-6 no-print-dashboard">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                        <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-2 text-[#1a1c14]">KOSO POS</h1>
                        <p className="text-[#505530]/55 font-bold text-[10px] uppercase tracking-[0.5em]">Real-time Financial Orchestration</p>
                    </motion.div>

                    <div className="flex gap-4 items-center flex-wrap">
                        <div className="flex bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[24px] p-1 gap-1">
                            <select
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                                className="bg-transparent text-[#1a1c14] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-white/[0.05] transition-all"
                            >
                                <option value="Weekly" className="bg-white">Weekly</option>
                                <option value="Monthly" className="bg-white">Monthly</option>
                                <option value="Yearly" className="bg-white">Yearly</option>
                                <option value="SpecificDay" className="bg-white">Specific Day</option>
                                <option value="SpecificMonth" className="bg-white">Specific Month</option>
                                <option value="DateRange" className="bg-white">Date Range</option>
                            </select>
                            {(timeRange === 'SpecificDay' || timeRange === 'SpecificMonth') && (
                                <input 
                                    type={timeRange === 'SpecificDay' ? 'date' : 'month'}
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-white/5 text-[#1a1c14] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none border-none cursor-pointer hover:bg-white/[0.08] transition-all"
                                />
                            )}
                            {timeRange === 'DateRange' && (
                                <div className="flex items-center gap-2 px-2">
                                    <input 
                                        type="date"
                                        value={dateRange.start}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                        className="bg-white/5 text-[#1a1c14] px-2 py-1 rounded-lg text-[9px] font-bold outline-none border-none"
                                    />
                                    <span className="text-[9px] text-[#505530]/45">to</span>
                                    <input 
                                        type="date"
                                        value={dateRange.end}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                        className="bg-white/5 text-[#1a1c14] px-2 py-1 rounded-lg text-[9px] font-bold outline-none border-none"
                                    />
                                </div>
                            )}
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="bg-transparent text-[#1a1c14] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-white/[0.05] transition-all"
                            >
                                {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-white">{cat}</option>)}
                            </select>
                        </div>

                        <button
                            onClick={() => setIsReportOpen(true)}
                            className="flex items-center gap-3 px-8 py-4 bg-solaris-orange text-[#1a1c14] text-[10px] font-black uppercase tracking-[0.2em] rounded-[24px] shadow-solaris-glow hover:scale-105 transition-all"
                        >
                            <FileText size={16} />
                            Export Master
                        </button>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
                    {DYNAMIC_KPIS.map((kpi, idx) => (
                        <GlowCard key={idx} glowColor={kpi.color as any} customSize className="!p-0 border border-white/5 bg-white/[0.02] backdrop-blur-xl rounded-[24px]">
                            <div className="p-6">
                                <kpi.icon size={20} className="text-solaris-orange mb-4" />
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#505530]/45 mb-1">{kpi.label}</p>
                                <p className="text-xl font-black italic tracking-tight">{kpi.value}</p>
                            </div>
                        </GlowCard>
                    ))}
                </div>

                {/* Main Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                    <GlowCard glowColor="orange" customSize className="lg:col-span-2 !p-0 border border-white/5 bg-white/[0.02] backdrop-blur-xl rounded-[32px]">
                        <div className="p-8">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#505530]/45 mb-1 italic">Proyección Financiera</h3>
                            <p className="text-xl font-black text-[#1a1c14] italic tracking-tight mb-8">Revenue Analytics</p>
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#fff" opacity={0.05} vertical={false} />
                                        <XAxis dataKey="name" stroke="#fff" opacity={0.3} tick={{ fill: '#fff', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} />
                                        <YAxis stroke="#fff" opacity={0.3} tick={{ fill: '#fff', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} />
                                        <Tooltip 
                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                            content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-3 shadow-2xl">
                                                            <p className="text-[#505530]/65 text-[10px] font-bold mb-1">{label}</p>
                                                            <p className="text-solaris-orange font-black text-sm">
                                                                Ventas: ${Number(payload[0]?.value || 0).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </GlowCard>

                    <GlowCard glowColor="orange" customSize className="!p-0 border border-white/5 bg-white/[0.02] backdrop-blur-xl rounded-[32px]">
                        <div className="p-8">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-[#505530]/45 mb-1 italic">Operación</h3>
                            <p className="text-xl font-black text-[#1a1c14] italic tracking-tight mb-8">Prime Cost</p>
                            <div className="h-72 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <Area type="monotone" dataKey="cost" stroke="#f97316" fill="#f97316" fillOpacity={0.1} strokeWidth={3} />
                                        <XAxis dataKey="name" hide />
                                        <YAxis hide />
                                        <Tooltip 
                                            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl p-3 shadow-2xl">
                                                            <p className="text-[#505530]/65 text-[10px] font-bold mb-1">Costo (Prime Cost)</p>
                                                            <p className="text-solaris-orange font-black text-sm">
                                                                Gastos: ${Number(payload[0]?.value || 0).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </GlowCard>
                </div>

                {/* New Insights Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20">
                    {/* Top Selling Products */}
                    <GlowCard glowColor="orange" customSize className="!p-0 border border-white/5 bg-white/[0.02] backdrop-blur-xl rounded-[32px]">
                       <div className="p-8">
                           <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <ArrowUpRight className="text-green-500" size={20} />
                                    <h3 className="text-lg font-black italic uppercase tracking-tight">Best Sellers Top 10</h3>
                                </div>
                                <span className="text-[10px] font-black text-[#505530]/30 uppercase tracking-[0.2em]">{activeOrders.length} Ventas</span>
                           </div>
                           <div className="space-y-4">
                               {productStats.top.map((p, i) => (
                                   <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 group hover:bg-white/5 transition-all">
                                       <div className="flex items-center gap-4">
                                           <span className="text-solaris-orange font-black italic w-6">#{i+1}</span>
                                           <span className="text-[11px] font-black uppercase tracking-widest text-[#505530]/70">{p.name}</span>
                                       </div>
                                       <div className="text-right">
                                           <span className="text-[11px] font-black text-[#1a1c14] italic">{p.quantity} Unid.</span>
                                           <p className="text-[9px] text-[#505530]/30 font-bold tracking-widest group-hover:text-solaris-orange transition-colors">${p.revenue.toLocaleString()}</p>
                                       </div>
                                   </div>
                               ))}
                               {productStats.top.length === 0 && <p className="text-center py-10 text-[#505530]/30 uppercase font-black text-[10px] italic">Sin datos de volumen</p>}
                           </div>
                       </div>
                    </GlowCard>

                    <div className="space-y-8">
                        {/* Financial Categories */}
                        <GlowCard glowColor="orange" customSize className="!p-0 border border-white/5 bg-white/[0.02] backdrop-blur-xl rounded-[32px]">
                            <div className="p-8">
                                <div className="flex items-center gap-3 mb-8">
                                    <Target className="text-blue-400" size={20} />
                                    <h3 className="text-lg font-black italic uppercase tracking-tight">Análisis por Categoría</h3>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#505530]/30 mb-4 flex items-center gap-2">
                                            <Layers size={12} /> Costo Inventario
                                        </p>
                                        <div className="space-y-3">
                                            {categoryInsights.topInv.map(([cat, val], i) => (
                                                <div key={i} className="flex justify-between items-center text-[10px]">
                                                    <span className="font-bold text-[#505530]/55">{cat}</span>
                                                    <span className="font-black text-solaris-orange">${val.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#505530]/30 mb-4 flex items-center gap-2">
                                            <Wallet size={12} /> Distribución Gastos
                                        </p>
                                        <div className="space-y-3">
                                            {categoryInsights.topExp.map(([cat, val], i) => (
                                                <div key={i} className="flex justify-between items-center text-[10px]">
                                                    <span className="font-bold text-[#505530]/55">{cat}</span>
                                                    <span className="font-black text-red-500">${val.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </GlowCard>

                        {/* Low Sales Alert */}
                        <GlowCard glowColor="red" customSize className="!p-0 border border-white/5 bg-white/[0.02] backdrop-blur-xl rounded-[32px]">
                            <div className="p-8">
                                <div className="flex items-center gap-3 mb-8">
                                    <TrendingDown className="text-red-500" size={20} />
                                    <h3 className="text-lg font-black italic uppercase tracking-tight">Ventas Críticas (Bajas)</h3>
                                </div>
                                <div className="space-y-3">
                                    {productStats.bottom.map((p, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-red-500/[0.03] border border-red-500/10">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-[#505530]/60">{p.name}</span>
                                            <span className="text-[10px] font-black text-red-500">{p.quantity} Unid.</span>
                                        </div>
                                    ))}
                                    {productStats.bottom.length === 0 && <p className="text-center py-6 text-[#505530]/30 uppercase font-black text-[10px]">Ecosistema Saludable</p>}
                                </div>
                            </div>
                        </GlowCard>
                    </div>
                    </div>
                </div>
            </div>

            <FinancialReportModal 
                isOpen={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                orders={activeOrders}
                expenses={activeExpenses}
                periodLabel={
                    timeRange === 'DateRange' 
                        ? `${dateRange.start} a ${dateRange.end}` 
                        : timeRange === 'SpecificDay' 
                            ? selectedDate 
                            : selectedDate.substring(0, 7)
                }
                categoryLabel={selectedCategory}
                restaurantName={settings.name}
            />
        </div>
    );
};
