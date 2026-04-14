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
        setEditingEmployee({ ...employee });
        setIsEditing(false);
        setActiveModal('profile');
    };

    const handleScheduleClick = (employee: Employee) => {
        setSelectedEmployee(employee);
        setEditingEmployee({ ...employee });
        setActiveModal('schedule');
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
                    <p className="text-solaris-orange/40 font-bold text-[10px] uppercase tracking-[0.4em]">Resource Orchestration & Bio-ID Management</p>
                </motion.div>

                <div className="flex gap-4 items-center flex-wrap">
                    <button onClick={handleDownload} className="bg-white/[0.03] border border-white/5 text-white/40 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-white/[0.05] hover:text-white transition-all">
                        <FileText size={16} /> Export Intel
                    </button>
                    
                    <div className="bg-white/[0.03] border border-white/5 p-1 rounded-2xl flex">
                        <button onClick={() => setViewMode('grid')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${viewMode === 'grid' ? 'bg-solaris-orange text-white shadow-solaris-glow' : 'text-white/20 hover:text-white'}`}>
                            <LayoutGrid size={14} /> Matrix
                        </button>
                        <button onClick={() => setViewMode('schedule')} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${viewMode === 'schedule' ? 'bg-solaris-orange text-white shadow-solaris-glow' : 'text-white/20 hover:text-white'}`}>
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
                        { label: 'Total Node Units', val: employees.length, icon: Users, color: 'text-white/40' },
                        { label: 'Active Channels', val: onShiftCount, icon: UserCheck, color: 'text-solaris-orange' },
                        { label: 'Network Integrity', val: '4.8', icon: Star, color: 'text-solaris-orange' },
                    ].map((s, i) => (
                        <div key={i} className="bg-white/[0.02] border border-white/5 p-6 rounded-solaris flex items-center gap-6">
                            <div className={`p-4 bg-white/[0.03] rounded-2xl ${s.color}`}><s.icon size={24} /></div>
                            <div>
                                <h3 className="text-2xl font-black italic tracking-tighter text-white">{s.val}</h3>
                                <p className="text-[9px] font-black uppercase tracking-widest text-solaris-orange/40">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-white/[0.02] border border-white/5 p-2 rounded-2xl flex items-center gap-1 overflow-x-auto min-w-max">
                    {areas.map(area => (
                        <button key={area} onClick={() => setSelectedArea(area)} className={`px-5 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${selectedArea === area ? 'bg-white/[0.05] text-solaris-orange border border-solaris-orange/20' : 'text-white/20 hover:text-white'}`}>
                            {area}
                        </button>
                    ))}
                </div>
            </div>

            <div ref={printRef} className="space-y-12 pb-20">
            {filteredStaff.length === 0 ? (
                <div className="bg-white/[0.01] rounded-solaris p-20 flex flex-col items-center justify-center text-center border border-white/5 border-dashed">
                    <Search size={64} className="text-white/5 mb-6" />
                    <h2 className="text-xl font-black italic text-white uppercase tracking-tighter mb-2">No Bio-ID Detected</h2>
                    <p className="text-solaris-orange/20 text-[10px] font-bold uppercase tracking-widest max-w-sm mb-10">Iniciando protocolo de búsqueda en red local...</p>
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
                                        <div className={`absolute bottom-2 right-2 w-4 h-4 rounded-full border-2 border-solaris-black ${emp.status === 'ON_SHIFT' ? 'bg-solaris-orange shadow-solaris-glow' : 'bg-[#1a1a1b]'}`}></div>
                                    </div>
                                    <h3 className="text-lg font-black italic text-white tracking-tight text-center mb-1 uppercase">{emp.name}</h3>
                                    <p className="text-solaris-orange text-[9px] font-black uppercase tracking-[0.3em] mb-4">{emp.role}</p>
                                    
                                    <div className="w-full grid grid-cols-2 gap-2 text-center mb-8 bg-white/[0.03] p-4 rounded-2xl border border-white/5">
                                        <div><p className="text-[10px] font-black text-white italic">{emp.hoursWorked}h</p><p className="text-[8px] font-black uppercase text-solaris-orange/40">Payload</p></div>
                                        <div><p className="text-[10px] font-black text-white flex items-center justify-center gap-1 italic">{emp.rating} <Star size={10} className="text-solaris-orange" /></p><p className="text-[8px] font-black uppercase text-solaris-orange/40">Trust Index</p></div>
                                    </div>

                                    <div className="flex gap-2 w-full">
                                        <button onClick={() => handleProfileClick(emp)} className="flex-1 py-3 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white hover:bg-white/10 transition-all">Profile</button>
                                        {(activeEmployee?.role?.toLowerCase() === 'admin' || isSuperAdmin) && (
                                            <button onClick={() => handleScheduleClick(emp)} className="flex-1 py-3 px-4 rounded-xl bg-white/[0.03] border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white hover:bg-white/10 transition-all">Tasking</button>
                                        )}
                                    </div>
                                </div>
                                <div className={`absolute top-4 right-4 text-[8px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${emp.status === 'ON_SHIFT' ? 'bg-solaris-orange/10 text-solaris-orange border border-solaris-orange/20' : 'bg-white/5 text-white/20'}`}>
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
                                <tr className="border-b border-white/5 text-solaris-orange/40 text-[9px] font-black uppercase tracking-[0.3em]">
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
                                                    <p className="text-[8px] font-black uppercase text-solaris-orange/30 tracking-widest">{emp.role}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                                            const shift = emp.schedule?.find(s => s.day === day);
                                            return (
                                                <td key={day} className="py-6 px-4 text-center">
                                                    <div className={`min-w-[80px] h-10 mx-auto rounded-xl flex items-center justify-center transition-all ${shift ? 'bg-solaris-orange/10 border border-solaris-orange/30 animate-pulse' : 'bg-white/[0.01] border border-white/5 opacity-20'}`}>
                                                       {shift ? (
                                                            <div className="text-center">
                                                                <p className="text-[8px] font-bold text-white leading-none">{shift.start}</p>
                                                                <div className="w-1 h-1 rounded-full bg-solaris-orange my-1 mx-auto"></div>
                                                                <p className="text-[8px] font-bold text-white leading-none">{shift.end}</p>
                                                            </div>
                                                       ) : (
                                                            <div className="w-1 h-1 rounded-full bg-white/10"></div>
                                                       )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td className="py-6 px-8 text-right font-black italic text-solaris-orange">{emp.hoursWorked}h</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            </div>

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
                                    <button onClick={() => setActiveModal('none')} className="text-white/20 hover:text-white transition-colors"><X size={24} /></button>
                                </div>

                                {activeModal === 'add' && (
                                    <form onSubmit={handleAddEmployee} className="space-y-8">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase text-solaris-orange/60 tracking-widest px-1 italic">Biological Identity</label>
                                            <input name="name" type="text" required placeholder="Unidad de Personal" className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-6 text-white outline-none focus:border-solaris-orange/50 transition-all font-bold placeholder:text-white/5" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-solaris-orange/60 tracking-widest px-1 italic">Functional Designation</label>
                                                <input name="role" type="text" required placeholder="Role" className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-6 text-white outline-none focus:border-solaris-orange/50 transition-all font-bold placeholder:text-white/5" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-solaris-orange/60 tracking-widest px-1 italic">Sector Node</label>
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
                                            <div className="flex-1">
                                                {!isEditing ? (
                                                    <>
                                                        <h3 className="text-2xl font-black italic text-white uppercase">{selectedEmployee.name}</h3>
                                                        <p className="text-solaris-orange text-[9px] font-black uppercase tracking-widest">{selectedEmployee.role}</p>
                                                    </>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <input 
                                                            value={editingEmployee.name} 
                                                            onChange={e => setEditingEmployee({...editingEmployee, name: e.target.value})}
                                                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 px-4 text-white text-sm font-black italic uppercase"
                                                        />
                                                        <input 
                                                            value={editingEmployee.role} 
                                                            onChange={e => setEditingEmployee({...editingEmployee, role: e.target.value})}
                                                            className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-2 px-4 text-solaris-orange text-[10px] font-black uppercase"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-center">
                                                <p className="text-[8px] font-black text-solaris-orange/40 uppercase mb-1">Sector node</p>
                                                {isEditing ? (
                                                    <select 
                                                        value={editingEmployee.area} 
                                                        onChange={e => setEditingEmployee({...editingEmployee, area: e.target.value as any})}
                                                        className="bg-transparent text-[10px] font-black text-white outline-none"
                                                    >
                                                        {areas.filter(a => a !== 'All').map(a => <option key={a} value={a} className="bg-[#0a0a0b]">{a}</option>)}
                                                    </select>
                                                ) : (
                                                    <p className="text-[10px] font-black text-white italic">{selectedEmployee.area}</p>
                                                )}
                                            </div>
                                            <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-center">
                                                <p className="text-[8px] font-black text-solaris-orange/40 uppercase mb-1">Status</p>
                                                <p className="text-[10px] font-black text-white italic">{selectedEmployee.status}</p>
                                            </div>
                                        </div>

                                        {!isEditing ? (
                                            <button 
                                                onClick={() => setIsEditing(true)}
                                                className="w-full bg-solaris-orange text-white font-black uppercase py-5 rounded-2xl text-[11px] tracking-widest shadow-solaris-glow hover:scale-[1.02] transition-all"
                                            >
                                                Edit Operator Intel
                                            </button>
                                        ) : (
                                            <div className="flex gap-4">
                                                <button onClick={() => setIsEditing(false)} className="flex-1 bg-white/[0.03] border border-white/10 text-white/40 font-black uppercase py-4 rounded-xl text-[10px] tracking-widest">Cancel</button>
                                                <button onClick={handleSaveEmployee} className="flex-1 bg-solaris-orange text-white font-black uppercase py-4 rounded-xl text-[10px] tracking-widest shadow-solaris-glow">Save Changes</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeModal === 'schedule' && selectedEmployee && (
                                    <div className="space-y-8 max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
                                        <div className="flex items-center gap-6 mb-8 border-b border-white/5 pb-6">
                                            <img src={selectedEmployee.image} className="w-16 h-16 rounded-2xl grayscale brightness-75 border border-white/10" alt="" />
                                            <div>
                                                <h3 className="text-xl font-black italic text-white uppercase tracking-tight">{selectedEmployee.name}</h3>
                                                <p className="text-solaris-orange text-[8px] font-black uppercase tracking-widest">Temporal Tasking Matrix</p>
                                            </div>
                                        </div>

                                        {/* Current Shifts */}
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black uppercase text-white/20 tracking-widest italic ml-1">Active Time-Nodes</label>
                                            {(editingEmployee.schedule || []).length === 0 ? (
                                                <div className="p-8 rounded-2xl border border-dashed border-white/5 text-center">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-white/10">No tasks assigned</p>
                                                </div>
                                            ) : (
                                                editingEmployee.schedule?.map((shift, idx) => (
                                                    <div key={idx} className="flex items-center justify-between bg-white/[0.02] border border-white/5 p-4 rounded-2xl animate-in fade-in slide-in-from-right-2">
                                                        <div>
                                                            <p className="text-[10px] font-black text-solaris-orange uppercase tracking-widest">{shift.day}</p>
                                                            <p className="text-[12px] font-black text-white italic">{shift.start} — {shift.end}</p>
                                                        </div>
                                                        <button 
                                                            onClick={() => {
                                                                const newSched = [...(editingEmployee.schedule || [])];
                                                                newSched.splice(idx, 1);
                                                                setEditingEmployee({...editingEmployee, schedule: newSched});
                                                            }}
                                                            className="p-2 text-red-500/20 hover:text-red-500 transition-colors"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Add New Shift */}
                                        <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl space-y-6">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 italic">New Temporal Allocation</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="col-span-2">
                                                    <label className="text-[8px] font-black uppercase text-white/10 mb-2 block">Day</label>
                                                    <select id="new-shift-day" className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-white text-xs font-black appearance-none outline-none focus:border-solaris-orange/50 transition-all">
                                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <option key={d} value={d} className="bg-[#0a0a0b]">{d}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black uppercase text-white/10 mb-2 block">Start</label>
                                                    <input id="new-shift-start" type="time" defaultValue="09:00" className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-white text-xs font-black outline-none focus:border-solaris-orange/50 transition-all" />
                                                </div>
                                                <div>
                                                    <label className="text-[8px] font-black uppercase text-white/10 mb-2 block">End</label>
                                                    <input id="new-shift-end" type="time" defaultValue="17:00" className="w-full bg-white/[0.03] border border-white/10 rounded-xl py-3 px-4 text-white text-xs font-black outline-none focus:border-solaris-orange/50 transition-all" />
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    const day = (document.getElementById('new-shift-day') as HTMLSelectElement).value;
                                                    const start = (document.getElementById('new-shift-start') as HTMLInputElement).value;
                                                    const end = (document.getElementById('new-shift-end') as HTMLInputElement).value;
                                                    const newSched = [...(editingEmployee.schedule || []), { day, start, end }];
                                                    setEditingEmployee({...editingEmployee, schedule: newSched});
                                                }}
                                                className="w-full bg-white/[0.04] border border-solaris-orange/20 text-solaris-orange font-black uppercase py-4 rounded-xl text-[9px] tracking-widest hover:bg-solaris-orange hover:text-white transition-all shadow-lg hover:shadow-solaris-glow"
                                            >
                                                Inject Shift Data
                                            </button>
                                        </div>

                                        <button 
                                            onClick={handleSaveEmployee}
                                            className="w-full bg-solaris-orange text-white font-black uppercase py-5 rounded-2xl text-[11px] tracking-widest shadow-solaris-glow mt-8"
                                        >
                                            Save Scheduling Matrix
                                        </button>
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