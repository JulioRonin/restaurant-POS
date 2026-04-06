import React, { useState, useMemo } from 'react';
import { DASHBOARD_KPIS, CATEGORIES } from '../constants';
import { useExpenses } from '../contexts/ExpenseContext';
import { useOrders } from '../contexts/OrderContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSettings } from '../contexts/SettingsContext';
import { FinancialReportModal } from '../components/FinancialReportModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from 'recharts';

type TimeRange = 'Weekly' | 'Monthly' | 'SpecificDay' | 'SpecificMonth';

// ... (keep existing helper functions like getRevenueData if they are outside component) 
// Re-including getRevenueData for completeness if replacing whole file, but I will target specific lines to avoid massive rewrite if possible. 
// However, the `replace_file_content` below targets the whole component for safety as I need to inject the hook and new section.

// Since I cannot see the helper function in the diff block easily without re-reading, I will assume it's there. 
// Actually, I'll try to just edit the component part.

const getRevenueData = (range: TimeRange, category: string, date: string) => {
    // Simple seeded random to make "consistent" data for a view
    const seed = date.length + category.length + range.length;
    const baseMultiplier = category === 'All' ? 1 : 0.2 + (category.length % 5) / 10; // Variance per category

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
        // Generate daily data for a month (approx 30 days)
        const days = Array.from({ length: 30 }, (_, i) => ({
            name: `${i + 1}`,
            revenue: (Math.random() * 2000 + 1000) * baseMultiplier,
            cost: (Math.random() * 1000 + 500) * baseMultiplier
        }));
        return days;
    } else if (range === 'SpecificDay') {
        // Generate hourly data (08:00 - 22:00)
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
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    const [isReportOpen, setIsReportOpen] = useState(false);

    const filteredData = useMemo(() => getRevenueData(timeRange, selectedCategory, selectedDate), [timeRange, selectedCategory, selectedDate]);

    // Handle Time Range Change logic
    const handleTimeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value as TimeRange;
        setTimeRange(val);
    };

    // Calculate Real-Time Stats from Expenses
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const MOCK_DAILY_REVENUE = 15000;
    const netCashFlow = MOCK_DAILY_REVENUE - totalExpenses;

    // --- Waiter Performance Logic ---
    const waiterStats = useMemo(() => {
        const stats: Record<string, number> = {};
        orders.forEach(order => {
            // Consider only completed/paid orders or all? Let's take all non-cancelled for now to show activity
            if (order.status !== 'CANCELLED' && order.waiterName) {
                const name = order.waiterName;
                stats[name] = (stats[name] || 0) + order.total;
            }
        });

        return Object.entries(stats)
            .map(([name, total]) => ({ name, total }))
            .sort((a, b) => b.total - a.total);
    }, [orders]);

    const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

    const DYNAMIC_KPIS = [
        ...DASHBOARD_KPIS,
        {
            label: 'Total Expenses (Caja Chica)',
            value: `$${totalExpenses.toFixed(2)}`,
            trend: 0,
            trendUp: false,
            icon: 'money_off' // Material icon
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
        <div className={`flex-1 bg-[#F3F4F6] text-gray-800 p-8 overflow-y-auto h-full ${isReportOpen ? 'no-print' : ''}`}>
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

            <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-gray-500 text-sm">Financial Overview & Inventory Health</p>
                </div>

                <div className="flex gap-4 items-center flex-wrap">
                    {/* Category Filter */}
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none shadow-sm cursor-pointer min-w-[150px]"
                    >
                        {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>

                    {/* Time Range Filter */}
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

                    {/* Conditional Date Inputs */}
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

                    {/* Export Report Button */}
                    <button
                        onClick={() => setIsReportOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all active:scale-95 text-sm"
                    >
                        <span className="material-icons-round text-lg">description</span>
                        Exportar Reporte
                    </button>
                </div>
            </div>

            {/* Financial Report Modal */}
            <FinancialReportModal 
                isOpen={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                orders={orders}
                expenses={expenses}
                periodLabel={timeRange === 'SpecificDay' ? selectedDate : timeRange === 'SpecificMonth' ? selectedDate.substring(0, 7) : timeRange}
                categoryLabel={selectedCategory}
                restaurantName={settings.name}
            />

            {/* KPI Cards */}
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

                        {/* Background Decoration */}
                        <div className="absolute -right-4 -bottom-4 opacity-5 transform rotate-12 group-hover:scale-110 transition-transform duration-500 text-gray-900">
                            <span className="material-icons-round text-9xl">{kpi.icon}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Main Revenue Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-soft">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900">Revenue Analytics</h3>
                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-md uppercase">
                            {timeRange === 'SpecificDay' ? selectedDate : timeRange === 'SpecificMonth' ? selectedDate.substring(0, 7) : timeRange}
                        </span>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                                <XAxis dataKey="name" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} interval={timeRange === 'SpecificMonth' ? 2 : 0} />
                                <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderRadius: '8px', color: '#1F2937', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    cursor={{ fill: '#F3F4F6' }}
                                />
                                <Bar dataKey="revenue" fill="#5D5FEF" radius={[4, 4, 0, 0]} barSize={timeRange === 'SpecificMonth' ? undefined : 40} animationDuration={800} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Order Report */}
                <div className="bg-white p-6 rounded-2xl shadow-soft">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900">Prime Cost Trend</h3>
                        <button className="text-primary text-sm font-bold hover:underline">View Report</button>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredData}>
                                <defs>
                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#A5A6F6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#A5A6F6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', color: '#1F2937' }} />
                                <Area type="monotone" dataKey="cost" stroke="#5D5FEF" fillOpacity={1} fill="url(#colorCost)" animationDuration={800} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-400 text-sm">Target Prime Cost</span>
                            <span className="text-green-500 font-bold">60%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-primary h-full w-[65%] rounded-full relative">
                                <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/50"></div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 text-right">Current: 65% (Attention Needed)</p>
                    </div>
                </div>
            </div>

            {/* New Waiter Performance Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-soft">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900">Desempeño de Meseros</h3>
                        <span className="text-xs text-gray-400">Ventas Totales</span>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={waiterStats} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                                <XAxis type="number" stroke="#9ca3af" fontSize={12} tickFormatter={(val) => `$${val}`} />
                                <YAxis dataKey="name" type="category" stroke="#4b5563" fontSize={12} width={100} />
                                <Tooltip
                                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Ventas']}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={20}>
                                    {waiterStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Recent Inventory Transactions */}
            <div className="bg-white p-6 rounded-2xl shadow-soft mb-8">
                <h3 className="text-xl font-bold mb-4 text-gray-900">Inventory Alerts (FIFO Triggered)</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-gray-400 border-b border-gray-100">
                                <th className="py-3 font-medium text-sm">Item Name</th>
                                <th className="py-3 font-medium text-sm">Batch ID</th>
                                <th className="py-3 font-medium text-sm">Stock Level</th>
                                <th className="py-3 font-medium text-sm">Status</th>
                                <th className="py-3 font-medium text-sm text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                <td className="py-4 flex items-center gap-3 font-medium text-gray-900">
                                    <div className="w-8 h-8 rounded-full bg-gray-100"></div>
                                    Large Brown Eggs
                                </td>
                                <td className="py-4 text-gray-500">#8932-A</td>
                                <td className="py-4">
                                    <div className="w-24 bg-gray-100 h-1.5 rounded-full">
                                        <div className="bg-red-500 h-1.5 rounded-full w-[15%]"></div>
                                    </div>
                                    <span className="text-xs text-red-500 mt-1 block font-bold">15% Left</span>
                                </td>
                                <td className="py-4"><span className="bg-red-50 text-red-600 px-2 py-1 rounded-md text-xs font-bold">Critical</span></td>
                                <td className="py-4 text-right">
                                    <button className="text-primary hover:text-blue-700 font-medium transition-colors">Restock</button>
                                </td>
                            </tr>
                            <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                <td className="py-4 flex items-center gap-3 font-medium text-gray-900">
                                    <div className="w-8 h-8 rounded-full bg-gray-100"></div>
                                    Basmati Rice
                                </td>
                                <td className="py-4 text-gray-500">#8944-B</td>
                                <td className="py-4">
                                    <div className="w-24 bg-gray-100 h-1.5 rounded-full">
                                        <div className="bg-yellow-500 h-1.5 rounded-full w-[45%]"></div>
                                    </div>
                                    <span className="text-xs text-yellow-600 mt-1 block font-bold">45% Left</span>
                                </td>
                                <td className="py-4"><span className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded-md text-xs font-bold">Warning</span></td>
                                <td className="py-4 text-right">
                                    <button className="text-primary hover:text-blue-700 font-medium transition-colors">Restock</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};