import React, { useState, useMemo } from 'react';
import { DASHBOARD_KPIS, CATEGORIES } from '../constants'; // Import CATEGORIES
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// Check if CATEGORIES is actually exported from constants.ts, if not, fallback or ensure it is. 
// Based on previous file read, it IS exported.

type TimeRange = 'Weekly' | 'Monthly' | 'SpecificDay' | 'SpecificMonth';

// Mock Data Generators with more specificity
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
    const [timeRange, setTimeRange] = useState<TimeRange>('Weekly');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]); // YYYY-MM-DD

    const filteredData = useMemo(() => getRevenueData(timeRange, selectedCategory, selectedDate), [timeRange, selectedCategory, selectedDate]);

    // Handle Time Range Change logic
    const handleTimeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value as TimeRange;
        setTimeRange(val);
        // Reset date defaults if needed, but current date is fine
    };

    return (
        <div className="flex-1 bg-[#F3F4F6] text-gray-800 p-8 overflow-y-auto">
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
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {DASHBOARD_KPIS.map((kpi, index) => (
                    <div key={index} className="bg-white p-6 rounded-2xl shadow-soft flex flex-col relative overflow-hidden group hover:shadow-lg transition-all border border-transparent hover:border-primary/20">
                        <div className="flex items-center gap-4 mb-4 z-10">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                <span className="material-icons-round">{kpi.icon}</span>
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${kpi.trendUp ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'}`}>
                                {kpi.trendUp ? '+' : '-'}{kpi.trend}%
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

            {/* Recent Inventory Transactions */}
            <div className="mt-8 bg-white p-6 rounded-2xl shadow-soft">
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