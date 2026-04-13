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
import { 
  TrendingUp, 
  Utensils, 
  Ban, 
  Receipt, 
  Wallet, 
  Banknote, 
  FileText, 
  Calendar,
  AlertCircle
} from 'lucide-react';

type TimeRange = 'Weekly' | 'Monthly' | 'SpecificDay' | 'SpecificMonth';

const getRevenueData = (range: TimeRange, category: string, date: string) => {
    const baseMultiplier = category === 'All' ? 1 : 0.2 + (category.length % 5) / 10; 

    if (range === 'Weekly') {
        return [
            { name: 'Mon', revenue: 4000 * baseMultiplier, cost: 2400 * baseMultiplier },
            { name: 'Tue', revenue: 3000 * baseMultiplier, cost: 1398 * baseMultiplier },
            { name: 'Wed', revenue: 2000 * baseMultiplier, cost: 9800 * baseMultiplier },
            { name: 'Thu', revenue: 2780 * baseMultiplier, cost: 3908 * baseMultiplier },
            { name: 'Fri', revenue: 1890 * baseMultiplier, cost: 4800 * baseMultiplier },
            { name: 'Sat', revenue: 2390 * baseMultiplier, cost: 3800 * baseMultiplier },
            { name: 'Sun', revenue: 3490 * baseMultiplier, cost: 4300 * baseMultiplier },
        ];
    } else if (range === 'Monthly' || range === 'SpecificMonth') {
        const days = Array.from({ length: 30 }, (_, i) => ({
            name: `${i + 1}`,
            revenue: (Math.random() * 2000 + 1000) * baseMultiplier,
            cost: (Math.random() * 1000 + 500) * baseMultiplier
        }));
        return days;
    } else if (range === 'SpecificDay') {
        const hours = Array.from({ length: 15 }, (_, i) => ({
            name: `${i + 8}:00`,
            revenue: (Math.random() * 500 + 100) * baseMultiplier,
            cost: (Math.random() * 200 + 50) * baseMultiplier
        }));
        return hours;
    }
    return [];
};

export const DashboardScreen: React.FC = () => {
    const { expenses } = useExpenses();
    const { orders } = useOrders();
    const { daysRemaining, isExpired } = useSubscription();
    const { settings } = useSettings();
    const [timeRange, setTimeRange] = useState<TimeRange>('Weekly');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]); 
    const [isReportOpen, setIsReportOpen] = useState(false);

    const filteredData = useMemo(() => getRevenueData(timeRange, selectedCategory, selectedDate), [timeRange, selectedCategory, selectedDate]);

    const activeOrders = useMemo(() => {
        return orders.filter(o => {
            if (timeRange === 'Weekly' || timeRange === 'Monthly') return true;
            try {
                const dateVal = o.timestamp || (o as any).created_at || (o as any).createdAt || Date.now();
                const d = new Date(dateVal);
                if (isNaN(d.getTime())) return false;
                
                const localD = new Date(d);
                localD.setMinutes(localD.getMinutes() - localD.getTimezoneOffset());
                const dateStr = localD.toISOString().split('T')[0];

                if (timeRange === 'SpecificDay') {
                    return dateStr === selectedDate;
                } else if (timeRange === 'SpecificMonth') {
                    return dateStr.startsWith(selectedDate.substring(0, 7));
                }
            } catch (e) {
                return false;
            }
            return true;
        });
    }, [orders, timeRange, selectedDate]);

    const activeExpenses = useMemo(() => {
        return expenses.filter(e => {
            if (timeRange === 'Weekly' || timeRange === 'Monthly') return true;
            try {
                const dateVal = e.date || new Date();
                const d = new Date(dateVal);
                if (isNaN(d.getTime())) return false;
                
                const localD = new Date(d);
                localD.setMinutes(localD.getMinutes() - localD.getTimezoneOffset());
                const dateStr = localD.toISOString().split('T')[0];

                if (timeRange === 'SpecificDay') {
                    return dateStr === selectedDate;
                } else if (timeRange === 'SpecificMonth') {
                    return dateStr.startsWith(selectedDate.substring(0, 7));
                }
            } catch (e) {
                return false;
            }
            return true;
        });
    }, [expenses, timeRange, selectedDate]);

    const { sales, items, customers, avgTicket, cancelledSales, cancelledCount } = useMemo(() => {
        let _sales = 0;
        let _items = 0;
        let _customers = 0;
        let _count = 0;
        let _cancelledSales = 0;
        let _cancelledCount = 0;
        
        activeOrders.forEach(o => {
            if (o.status === 'COMPLETED' || o.status === 'PAID') {
                _sales += o.total || 0;
                _items += (o.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
                _customers += 1;
                _count++;
            } else if (o.status === 'CANCELLED') {
                _cancelledSales += o.total || 0;
                _cancelledCount += 1;
            }
        });
        
        return {
            sales: _sales,
            items: _items,
            customers: _customers,
            avgTicket: _count > 0 ? (_sales / _count) : 0,
            cancelledSales: _cancelledSales,
            cancelledCount: _cancelledCount
        };
    }, [activeOrders]);

    const totalExpenses = activeExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netCashFlow = sales - totalExpenses;

    const waiterStats = useMemo(() => {
        const stats: Record<string, number> = {};
        activeOrders.forEach(order => {
            if (order.status !== 'CANCELLED' && order.waiterName) {
                const name = order.waiterName;
                stats[name] = (stats[name] || 0) + (order.total || 0);
            }
        });

        return Object.entries(stats)
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total);
    }, [activeOrders]);

    const COLORS = ['#f97316', '#fb923c', '#ea580c', '#c2410c', '#9a3412', '#7c2d12'];

    const DYNAMIC_KPIS = [
        { label: 'Ventas Netas', value: `$${sales.toLocaleString()}`, icon: TrendingUp, color: 'orange' },
        { label: 'Platillos', value: `${items}`, icon: Utensils, color: 'orange' },
        { label: 'Cancelaciones', value: `$${cancelledSales.toLocaleString()}`, sub: `${cancelledCount} orders`, icon: Ban, color: 'red' },
        { label: 'Ticket Med.', value: `$${avgTicket.toFixed(1)}`, icon: Receipt, color: 'blue' },
        { label: 'Gastos Caja', value: `$${totalExpenses.toLocaleString()}`, icon: Wallet, color: 'red' },
        { label: 'Flujo Estimado', value: `$${netCashFlow.toLocaleString()}`, icon: Banknote, color: 'green' },
    ];

    const { inventory } = useInventory();

    return (
        <div className="flex-1 bg-[#030303] text-white p-6 md:p-10 overflow-y-auto h-full relative font-sans antialiased custom-scrollbar">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-solaris-orange/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-solaris-orange/5 rounded-full blur-[100px]"></div>
            </div>

            {/* Header Section */}
            <div className="relative z-10 flex justify-between items-center mb-12 flex-wrap gap-6 no-print-dashboard">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-2 text-white">Solaris Core</h1>
                    <p className="text-white/40 font-bold text-[10px] uppercase tracking-[0.5em]">Real-time Financial Orchestration</p>
                </motion.div>

                <div className="flex gap-4 items-center flex-wrap">
                    <div className="flex bg-white/[0.03] border border-white/5 rounded-[24px] p-1 gap-1">
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                            className="bg-transparent text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-white/[0.05] transition-all"
                        >
                            <option value="Weekly" className="bg-[#0a0a0b]">Weekly</option>
                            <option value="Monthly" className="bg-[#0a0a0b]">Monthly</option>
                            <option value="SpecificDay" className="bg-[#0a0a0b]">Filter by Day</option>
                        </select>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="bg-transparent text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-white/[0.05] transition-all"
                        >
                            {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-[#0a0a0b]">{cat}</option>)}
                        </select>
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(249, 115, 22, 0.4)" }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsReportOpen(true)}
                        className="flex items-center gap-3 px-8 py-4 bg-solaris-orange text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-[24px] shadow-solaris-glow transition-all"
                    >
                        <FileText size={16} />
                        Export Master File
                    </motion.button>
                </div>
            </div>

            <FinancialReportModal 
                isOpen={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                orders={activeOrders}
                expenses={activeExpenses}
                periodLabel={timeRange === 'SpecificDay' ? selectedDate : selectedDate.substring(0, 7)}
                categoryLabel={selectedCategory}
                restaurantName={settings.name}
            />

            {/* Expired/Warning Banner */}
            {daysRemaining <= 3 && (
                <GlowCard glowColor="orange" customSize className="w-full !p-0 mb-10 border border-solaris-orange/20 overflow-hidden relative z-10">
                    <div className="p-6 md:p-8 flex items-center justify-between gap-6 flex-wrap">
                        <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-solaris-orange/10 rounded-solaris flex items-center justify-center border border-solaris-orange/20 animate-pulse">
                                <AlertCircle className="text-solaris-orange" size={28} />
                            </div>
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-solaris-orange mb-2 italic">Aviso de Estación</h4>
                                <p className="text-white/70 font-medium max-w-xl">
                                    Licencia Solaris próxima a vencer en <span className="text-solaris-orange font-black">{daysRemaining} días</span>. Asegure la continuidad operativa renovando su membresía.
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => window.location.hash = '#/billing'}
                            className="px-8 py-4 bg-solaris-orange text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-solaris-glow hover:scale-105 transition-all"
                        >
                            Renovar Ahora
                        </button>
                    </div>
                </GlowCard>
            )}

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-12 relative z-10">
                {DYNAMIC_KPIS.map((kpi, idx) => (
                    <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-[#0a0a0b] border border-white/5 p-6 rounded-solaris relative overflow-hidden group hover:border-white/20 transition-all shadow-2xl"
                    >
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <div className="w-10 h-10 bg-white/[0.03] rounded-xl flex items-center justify-center border border-white/5">
                                <kpi.icon size={20} className={kpi.color === 'orange' ? 'text-solaris-orange' : kpi.color === 'red' ? 'text-red-500' : 'text-blue-400'} />
                            </div>
                        </div>
                        <div className="relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">{kpi.label}</p>
                            <h3 className="text-2xl font-black italic text-white tracking-tighter">{kpi.value}</h3>
                        </div>
                        <div className="absolute -right-4 -bottom-4 opacity-[0.03] transform rotate-12 group-hover:scale-125 transition-all duration-700 pointer-events-none">
                           <kpi.icon size={120} />
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12 relative z-10">
                <div className="lg:col-span-2 bg-[#0a0a0b] border border-white/5 p-8 rounded-solaris shadow-2xl">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-1 italic">Proyección Financiera</h3>
                            <p className="text-xl font-black text-white italic tracking-tight">Revenue Analytics</p>
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.03} vertical={false} />
                                <XAxis dataKey="name" stroke="#fff" opacity={0.3} tick={{ fill: '#fff', opacity: 0.5, fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                                <YAxis stroke="#fff" opacity={0.3} tick={{ fill: '#fff', opacity: 0.5, fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#030303', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', color: '#fff' }}
                                    itemStyle={{ color: '#f97316', fontWeight: 'bold' }}
                                />
                                <Bar dataKey="revenue" fill="#f97316" radius={[8, 8, 0, 0]} barSize={40}>
                                    {filteredData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fillOpacity={0.8 + (index / filteredData.length) * 0.2} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-[#0a0a0b] border border-white/5 p-8 rounded-solaris shadow-2xl">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-1 italic">Costos de Operación</h3>
                    <p className="text-xl font-black text-white italic tracking-tight mb-8">Prime Cost Trend</p>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredData}>
                                <defs>
                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#030303', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="cost" stroke="#f97316" fill="url(#colorCost)" strokeWidth={4} dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#030303' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Inventory Alerts */}
            <div className="bg-[#0a0a0b] border border-white/5 p-8 rounded-solaris shadow-2xl relative z-10 mb-20">
                <div className="flex items-center gap-3 mb-8">
                   <div className="w-8 h-8 bg-solaris-orange rounded-lg flex items-center justify-center shadow-solaris-glow">
                      <AlertCircle size={16} className="text-white" />
                   </div>
                   <div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 italic">Gestión de Almacén</h3>
                      <p className="text-xl font-black text-white italic tracking-tight">Alertas de Stock Crítico</p>
                   </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-white/20 border-b border-white/5 text-[9px] font-black uppercase tracking-[0.3em]">
                                <th className="py-4 px-2">Producto / Insumo</th>
                                <th className="py-4 px-2 text-center">Nivel Actual</th>
                                <th className="py-4 px-2 text-right">Estatus Solaris</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {inventory.filter(i => i.quantity <= (i.minStock || 5)).map((item, i) => {
                                const isCritical = item.quantity <= (item.minStock || 2);
                                return (
                                    <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors group">
                                        <td className="py-5 px-2 font-bold text-white/70 group-hover:text-white transition-colors">{item.name}</td>
                                        <td className="py-5 px-2 text-center font-black italic text-white">{item.quantity} <span className="text-[10px] font-normal not-italic text-white/30">{item.unit || 'UN'}</span></td>
                                        <td className="py-5 px-2 text-right">
                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isCritical ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-solaris-orange/10 text-solaris-orange border border-solaris-orange/20'}`}>
                                                {isCritical ? 'Critical' : 'Low Level'}
                                            </span>
                                        </td>
                                    </tr>
                                  );
                              })}
                              {inventory.filter(i => i.quantity <= (i.minStock || 5)).length === 0 && (
                                  <tr>
                                      <td colSpan={3} className="py-20 text-center text-white/20 italic font-medium uppercase tracking-[0.3em] text-[10px]">Sin detecciones críticas en el ecosistema</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
        </div>
    );
};