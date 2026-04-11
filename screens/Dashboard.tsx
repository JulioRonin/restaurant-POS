import React, { useState, useMemo } from 'react';
import { DASHBOARD_KPIS, CATEGORIES } from '../constants';
import { useExpenses } from '../contexts/ExpenseContext';
import { useOrders } from '../contexts/OrderContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSettings } from '../contexts/SettingsContext';
import { FinancialReportModal } from '../components/FinancialReportModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';

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

    const handleTimeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value as TimeRange;
        setTimeRange(val);
    };

    const { sales, items, customers, avgTicket } = useMemo(() => {
        let _sales = 0;
        let _items = 0;
        let _customers = 0;
        let _count = 0;
        
        orders.forEach(o => {
            if (o.status === 'COMPLETED' || o.status === 'PAID') {
                _sales += o.total || 0;
                _items += (o.items || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
                _customers += 1;
                _count++;
            }
        });
        
        return {
            sales: _sales,
            items: _items,
            customers: _customers,
            avgTicket: _count > 0 ? (_sales / _count) : 0
        };
    }, [orders]);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netCashFlow = sales - totalExpenses;

    const waiterStats = useMemo(() => {
        const stats: Record<string, number> = {};
        orders.forEach(order => {
            if (order.status !== 'CANCELLED' && order.waiterName) {
                const name = order.waiterName;
                stats[name] = (stats[name] || 0) + (order.total || 0);
            }
        });

        return Object.entries(stats)
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total);
    }, [orders]);

    const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

    const DYNAMIC_KPIS = [
        { label: 'Ventas Totales', value: `$${sales.toFixed(2)}`, trend: 0, trendUp: true, icon: 'monetization_on' },
        { label: 'Platillos Servidos', value: `${items}`, trend: 0, trendUp: true, icon: 'restaurant_menu' },
        { label: 'Clientes Atendidos', value: `${customers}`, trend: 0, trendUp: true, icon: 'groups' },
        { label: 'Ticket Promedio', value: `$${avgTicket.toFixed(2)}`, trend: 0, trendUp: true, icon: 'receipt' },
        {
            label: 'Total Expenses (Caja Chica)',
            value: `$${totalExpenses.toFixed(2)}`,
            trend: 0,
            trendUp: false,
            icon: 'money_off'
        },
        {
            label: 'Net Cash Flow (Est.)',
            value: `$${netCashFlow.toFixed(2)}`,
            trend: 0,
            trendUp: true,
            icon: 'account_balance_wallet'
        }
    ];

    return (
        <div className="flex-1 bg-[#F3F4F6] text-gray-800 p-8 overflow-y-auto h-full relative">
            <style>{`
                @media print {
                    .no-print-dashboard { display: none !important; }
                }
            `}</style>

            <div className="flex justify-between items-center mb-8 flex-wrap gap-4 no-print-dashboard">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-gray-500 text-sm">Financial Overview & Inventory Health</p>
                </div>

                <div className="flex gap-4 items-center flex-wrap">
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none shadow-sm cursor-pointer min-w-[150px]"
                    >
                        {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>

                    <select
                        value={timeRange}
                        onChange={handleTimeRangeChange}
                        className="bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none shadow-sm cursor-pointer"
                    >
                        <option value="Weekly">Semanal (General)</option>
                        <option value="Monthly">Mensual (General)</option>
                        <option value="SpecificDay">Día Específico</option>
                        <option value="SpecificMonth">Mes Específico</option>
                    </select>

                    {timeRange === 'SpecificDay' && (
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none shadow-sm"
                        />
                    )}
                    {timeRange === 'SpecificMonth' && (
                        <input
                            type="month"
                            value={selectedDate.substring(0, 7)}
                            onChange={(e) => setSelectedDate(e.target.value + '-01')}
                            className="bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none shadow-sm"
                        />
                    )}

                    <button
                        onClick={() => setIsReportOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all active:scale-95 text-sm"
                    >
                        <span className="material-icons-round text-lg">description</span>
                        Exportar Reporte
                    </button>
                </div>
            </div>

            <FinancialReportModal 
                isOpen={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                orders={orders}
                expenses={expenses}
                periodLabel={timeRange === 'SpecificDay' ? selectedDate : timeRange === 'SpecificMonth' ? selectedDate.substring(0, 7) : timeRange}
                categoryLabel={selectedCategory}
                restaurantName={settings.name}
            />

            <div className={isReportOpen ? 'no-print-dashboard' : ''}>
                {/* Expiration Warning Banner */}
                {daysRemaining <= 3 && !isExpired && (
                    <div className="mb-8 bg-gradient-to-r from-orange-500 to-orange-600 p-5 rounded-3xl shadow-xl border border-orange-400 animate-in slide-in-from-top duration-500">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-4 text-white">
                                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center animate-pulse shadow-inner">
                                    <span className="material-icons-round text-2xl">notification_important</span>
                                </div>
                                <div>
                                    <p className="font-black uppercase text-[10px] tracking-widest opacity-90 leading-none mb-1.5 flex items-center gap-1">
                                        <span className="w-1 h-1 bg-white rounded-full"></span>
                                        Aviso de Facturación
                                    </p>
                                    <p className="font-bold text-base leading-tight">
                                        Tu suscripción vence en {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}. Te invitamos a pagar antes de su vencimiento para seguir utilizando el servicio de la plataforma Culinex POS.
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => window.location.hash = '#/billing'}
                                className="px-8 py-3.5 bg-white text-orange-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-orange-50 transition-all hover:scale-[1.05] active:scale-95 shadow-2xl shadow-orange-900/40"
                            >
                                Renovar Membresía
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {DYNAMIC_KPIS.map((kpi, index) => (
                        <div key={index} className="bg-white p-6 rounded-2xl shadow-soft flex flex-col relative overflow-hidden group hover:shadow-lg transition-all border border-transparent hover:border-primary/20">
                            <div className="flex items-center gap-4 mb-4 z-10">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.label.includes('Expenses') ? 'bg-red-100 text-red-500' : 'bg-primary/10 text-primary'}`}>
                                    <span className="material-icons-round">{kpi.icon}</span>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${kpi.trendUp ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>
                                    {kpi.trendUp ? '+' : ''}{kpi.trend}%
                                </span>
                            </div>
                            <h3 className="text-3xl font-bold mb-1 z-10 text-gray-900">{kpi.value}</h3>
                            <p className="text-gray-400 text-sm z-10">{kpi.label}</p>
                            <div className="absolute -right-4 -bottom-4 opacity-5 transform rotate-12 group-hover:scale-110 transition-transform duration-500 text-gray-900">
                                <span className="material-icons-round text-9xl">{kpi.icon}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-soft">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Revenue Analytics</h3>
                        </div>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={filteredData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                                    <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                    <Bar dataKey="revenue" fill="#5D5FEF" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-soft">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">Prime Cost Trend</h3>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={filteredData}>
                                    <defs>
                                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#A5A6F6" stopOpacity={0.8} />
                                            <stop offset="95%" stopColor="#A5A6F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="cost" stroke="#5D5FEF" fill="url(#colorCost)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-400 text-sm">Target Prime Cost</span>
                                <span className="text-green-500 font-bold">60%</span>
                            </div>
                            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-primary h-full w-[65%] rounded-full opacity-80"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-soft">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">Desempeño de Meseros</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={waiterStats} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                                    <Tooltip formatter={(val: number) => `$${val.toFixed(2)}`} />
                                    <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={20}>
                                        {waiterStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-soft mb-8">
                    <h3 className="text-xl font-bold mb-4 text-gray-900">Inventory Alerts</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-gray-400 border-b border-gray-100 text-xs uppercase">
                                    <th className="py-3">Item Name</th>
                                    <th className="py-3">Stock Level</th>
                                    <th className="py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                    <td className="py-4 font-medium text-gray-900">Large Brown Eggs</td>
                                    <td className="py-4">15% Left</td>
                                    <td className="py-4"><span className="bg-red-50 text-red-600 px-2 py-1 rounded-md text-xs font-bold uppercase">Critical</span></td>
                                </tr>
                                <tr className="hover:bg-gray-50 transition-colors">
                                    <td className="py-4 font-medium text-gray-900">Basmati Rice</td>
                                    <td className="py-4">45% Left</td>
                                    <td className="py-4"><span className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded-md text-xs font-bold uppercase">Warning</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};