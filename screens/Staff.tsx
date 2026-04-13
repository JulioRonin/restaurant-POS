import React, { useState, useMemo, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import { Employee } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'framer-motion';
import { GlowCard } from '../components/ui/spotlight-card';
import { 
  Users, 
  UserCheck, 
  Star, 
  FileText, 
  LayoutGrid, 
  Calendar, 
  UserPlus, 
  Search,
  Mail,
  X,
  Plus,
  RefreshCw
} from 'lucide-react';

export const StaffScreen: React.FC = () => {
    const { employees, addEmployee, updateEmployee, triggerSync, authProfile, isAuthenticating, activeEmployee, isSuperAdmin } = useUser();
    const [selectedArea, setSelectedArea] = useState<string>('All');
    const [viewMode, setViewMode] = useState<'grid' | 'schedule'>('grid');
    const [activeModal, setActiveModal] = useState<'none' | 'add' | 'profile' | 'schedule'>('none');
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Partial<Employee>>({});
    const printRef = useRef<HTMLDivElement>(null);

    const ADMIN_AVATAR = "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=200&h=200";
    const areas = ['All', 'Kitchen', 'Service', 'Bar', 'Management'];

    const filteredStaff = useMemo(() => {
        return selectedArea === 'All'
            ? employees
            : employees.filter(employee => employee.area === selectedArea);
    }, [selectedArea, employees]);

    const onShiftCount = employees.filter(s => s.status === 'ON_SHIFT').length;

    const handleProfileClick = (employee: Employee) => {
        setSelectedEmployee(employee);
        setEditingEmployee(employee);
        setIsEditing(false);
        setActiveModal('profile');
    };

    const handleSaveEmployee = () => {
        if (!editingEmployee.id) return;
        updateEmployee(editingEmployee.id, editingEmployee);
        setIsEditing(false);
        setActiveModal('none');
    };

    const handleAddEmployee = (e: React.FormEvent) => {
        e.preventDefault();
        if (!authProfile) return;
        const formData = new FormData(e.target as HTMLFormElement);
        addEmployee({
            name: formData.get('name') as string,
            role: formData.get('role') as string,
            area: formData.get('area') as any,
            status: 'OFF_SHIFT',
            pin: '1111',
            image: `https://ui-avatars.com/api/?name=${formData.get('name')}&background=f97316&color=fff`,
            rating: 5,
            hoursWorked: 0,
            schedule: [],
            businessId: authProfile.businessId
        });
        setActiveModal('none');
    };

    const handleDownload = async () => {
        if (!printRef.current) return;
        const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#030303' });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        pdf.addImage(imgData, 'PNG', 10, 10, 277, (canvas.height * 277) / canvas.width);
        pdf.save(`Staff_Solaris_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    if (isAuthenticating) {
        return (
            <div className="h-full flex items-center justify-center bg-solaris-black">
                <div className="w-10 h-10 border-4 border-solaris-orange/20 border-t-solaris-orange rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="h-full bg-solaris-black text-white p-6 md:p-10 overflow-y-auto relative antialiased">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase mb-2">Staff Network</h1>
                    <p className="text-gray-600 font-bold text-[10px] uppercase tracking-[0.4em]">Resource Orchestration & Bio-ID Management</p>
                </motion.div>

                <div className="flex gap-4 items-center flex-wrap">
                    <button onClick={handleDownload} className="bg-white/[0.03] border border-white/5 text-gray-400 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-white/[0.05] hover:text-white transition-all">
                        <FileText size={16} /> Export Intel
                    </button>
                    
                    <div className="bg-white/[0.03] border border-white/5 p-1 rounded-2xl flex">
                        <button onClick={() => setViewMode('grid')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${viewMode === 'grid' ? 'bg-solaris-orange text-white shadow-solaris-glow' : 'text-gray-500 hover:text-gray-300'}`}>
                            <LayoutGrid size={14} /> Matrix
                        </button>
                        <button onClick={() => setViewMode('schedule')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${viewMode === 'schedule' ? 'bg-solaris-orange text-white shadow-solaris-glow' : 'text-gray-500 hover:text-gray-300'}`}>
                            <Calendar size={14} /> Timeline
                        </button>
                    </div>

                    {(activeEmployee?.role?.toLowerCase() === 'admin' || isSuperAdmin) && (
                        <button onClick={() => setActiveModal('add')} className="bg-solaris-orange text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-solaris-glow hover:scale-105 transition-all">
                             <UserPlus size={16} /> Recruit
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="flex flex-col xl:flex-row gap-6 mb-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                    {[
                        { label: 'Total Node Units', val: employees.length, icon: Users, color: 'text-gray-400' },
                        { label: 'Active Channels', val: onShiftCount, icon: UserCheck, color: 'text-solaris-orange' },
                        { label: 'Network Integrity', val: '4.8', icon: Star, color: 'text-solaris-orange' },
                    ].map((s, i) => (
                        <div key={i} className="bg-white/[0.02] border border-white/5 p-6 rounded-solaris flex items-center gap-6">
                            <div className={`p-4 bg-white/[0.03] rounded-2xl ${s.color}`}><s.icon size={24} /></div>
                            <div>
                                <h3 className="text-2xl font-black italic tracking-tighter text-white">{s.val}</h3>
                                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-white/[0.02] border border-white/5 p-2 rounded-2xl flex items-center gap-1 overflow-x-auto min-w-max">
                    {areas.map(area => (
                        <button key={area} onClick={() => setSelectedArea(area)} className={`px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${selectedArea === area ? 'bg-white/[0.05] text-solaris-orange border border-solaris-orange/20' : 'text-gray-500 hover:text-gray-300'}`}>
                            {area}
                        </button>
                    ))}
                </div>
            </div>

            {filteredStaff.length === 0 ? (
                <div className="bg-white/[0.01] rounded-solaris p-20 flex flex-col items-center justify-center text-center border border-white/5 border-dashed">
                    <Search size={64} className="text-gray-800 mb-6" />
                    <h2 className="text-xl font-black italic text-white uppercase tracking-tighter mb-2">No Bio-ID Detected</h2>
                    <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest max-w-sm mb-10">Iniciando protocolo de búsqueda en red local...</p>
                    <div className="flex gap-4">
                        <button onClick={() => triggerSync()} className="bg-solaris-orange text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-solaris-glow hover:scale-105 transition-all flex items-center gap-3">
                            <RefreshCw size={16} /> Sync Network
                        </button>
                    </div>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredStaff.map(emp => (
                        <div key={emp.id}>
                            <GlowCard glowColor="orange" className={`relative group border !p-8 ${emp.status === 'ON_SHIFT' ? 'border-solaris-orange/20' : 'border-white/5'}`}>
                                <div className="flex flex-col items-center">
                                    <div className="relative mb-6">
                                        <div className={`w-28 h-28 rounded-full p-1 border-2 transition-all ${emp.status === 'ON_SHIFT' ? 'border-solaris-orange' : 'border-white/10 opacity-50'}`}>
                                            <img 
                                                src={emp.image || `https://ui-avatars.com/api/?name=${emp.name}&background=333&color=fff`} 
                                                alt={emp.name} 
                                                className="w-full h-full rounded-full object-cover filter contrast-125" 
                                            />
                                        </div>
                                        <div className={`absolute bottom-2 right-2 w-4 h-4 rounded-full border-2 border-solaris-black ${emp.status === 'ON_SHIFT' ? 'bg-solaris-orange shadow-solaris-glow' : 'bg-gray-800'}`}></div>
                                    </div>
                                    <h3 className="text-lg font-black italic text-white tracking-tight text-center mb-1 uppercase">{emp.name}</h3>
                                    <p className="text-solaris-orange text-[9px] font-black uppercase tracking-[0.3em] mb-4">{emp.role}</p>
                                    
                                    <div className="w-full grid grid-cols-2 gap-2 text-center mb-8 bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                                        <div><p className="text-[10px] font-black text-white italic">{emp.hoursWorked}h</p><p className="text-[8px] font-black uppercase text-gray-700">Payload</p></div>
                                        <div><p className="text-[10px] font-black text-white flex items-center justify-center gap-1 italic">{emp.rating} <Star size={10} className="text-solaris-orange" /></p><p className="text-[8px] font-black uppercase text-gray-700">Trust Index</p></div>
                                    </div>

                                    <div className="flex gap-2 w-full">
                                        <button onClick={() => handleProfileClick(emp)} className="flex-1 py-3 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/10 transition-all">Profile</button>
                                        {(activeEmployee?.role?.toLowerCase() === 'admin' || isSuperAdmin) && (
                                            <button onClick={() => setActiveModal('schedule')} className="flex-1 py-3 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/10 transition-all">Tasking</button>
                                        )}
                                    </div>
                                </div>
                                <div className={`absolute top-4 right-4 text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${emp.status === 'ON_SHIFT' ? 'bg-solaris-orange/10 text-solaris-orange border border-solaris-orange/20' : 'bg-white/5 text-gray-700'}`}>
                                    {emp.status.replace('_', ' ')}
                                </div>
                            </GlowCard>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white/[0.02] border border-white/5 rounded-solaris overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5 text-gray-600 text-[9px] font-black uppercase tracking-[0.3em]">
                                    <th className="py-6 px-8 italic">Operator Biological ID</th>
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <th key={day} className="py-6 px-4 text-center">{day}</th>)}
                                    <th className="py-6 px-8 text-right italic">Node Hours</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {filteredStaff.map(emp => (
                                    <tr key={emp.id} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors group">
                                        <td className="py-6 px-8">
                                            <div className="flex items-center gap-4">
                                                <img 
                                                    src={emp.image || `https://ui-avatars.com/api/?name=${emp.name}&background=333&color=fff`} 
                                                    alt={emp.name} 
                                                    className="w-10 h-10 rounded-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" 
                                                />
                                                <div>
                                                    <p className="font-bold text-white group-hover:text-solaris-orange transition-colors">{emp.name}</p>
                                                    <p className="text-[8px] font-black uppercase text-gray-700 tracking-widest">{emp.role}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {Array.from({ length: 7 }).map((_, idx) => (
                                            <td key={idx} className="py-6 px-4 text-center">
                                                <div className="w-16 h-8 mx-auto rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-center">
                                                   <div className="w-1.5 h-1.5 rounded-full bg-solaris-orange/20"></div>
                                                </div>
                                            </td>
                                        ))}
                                        <td className="py-6 px-8 text-right font-black italic text-solaris-orange">{emp.hoursWorked}h</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal Layer */}
            <AnimatePresence>
                {activeModal !== 'none' && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#0a0a0b] border border-white/10 rounded-solaris w-full max-w-lg overflow-hidden shadow-2xl"
                        >
                            <div className="p-10">
                                <div className="flex justify-between items-center mb-10">
                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">System Command</h2>
                                    <button onClick={() => setActiveModal('none')} className="text-gray-600 hover:text-white transition-colors"><X size={24} /></button>
                                </div>

                                {activeModal === 'add' && (
                                    <form onSubmit={handleAddEmployee} className="space-y-8">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest px-1">Biological Identity</label>
                                            <input name="name" type="text" required placeholder="Unidad de Personal" className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-6 text-white outline-none focus:border-solaris-orange/50 transition-all font-bold" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest px-1">Functional Designation</label>
                                                <input name="role" type="text" required placeholder="Role" className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-6 text-white outline-none focus:border-solaris-orange/50 transition-all font-bold" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-gray-600 tracking-widest px-1">Sector Node</label>
                                                <select name="area" className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-6 text-white outline-none focus:border-solaris-orange/50 transition-all font-bold appearance-none">
                                                    <option value="Kitchen" className="bg-[#0a0a0b]">Kitchen</option>
                                                    <option value="Service" className="bg-[#0a0a0b]">Service</option>
                                                    <option value="Bar" className="bg-[#0a0a0b]">Bar</option>
                                                    <option value="Management" className="bg-[#0a0a0b]">Management</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button type="submit" className="w-full bg-solaris-orange text-white font-black uppercase tracking-[0.2em] py-5 rounded-2xl shadow-solaris-glow hover:bg-orange-600 transition-all text-[11px] flex items-center justify-center gap-3">
                                            <Plus size={18} /> Integrate into Bio-Network
                                        </button>
                                    </form>
                                )}

                                {activeModal === 'profile' && selectedEmployee && (
                                    <div className="space-y-8">
                                        <div className="flex items-center gap-8 mb-10">
                                            <img src={selectedEmployee.image} className="w-24 h-24 rounded-solaris border border-white/10" alt="" />
                                            <div>
                                                <h3 className="text-2xl font-black italic text-white uppercase">{selectedEmployee.name}</h3>
                                                <p className="text-solaris-orange text-[9px] font-black uppercase tracking-widest">{selectedEmployee.role}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-center">
                                                <p className="text-[8px] font-black text-gray-700 uppercase mb-1">Status</p>
                                                <p className="text-[10px] font-black text-white italic">{selectedEmployee.status}</p>
                                            </div>
                                            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-center">
                                                <p className="text-[8px] font-black text-gray-700 uppercase mb-1">Node Security</p>
                                                <p className="text-[10px] font-black text-solaris-orange italic">Tier 5 Encryption</p>
                                            </div>
                                        </div>
                                        <button className="w-full bg-white/[0.03] border border-white/10 text-gray-500 font-black uppercase py-4 rounded-2xl text-[10px] tracking-widest cursor-not-allowed">Access Blocked • Auth Level 1 Required</button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};