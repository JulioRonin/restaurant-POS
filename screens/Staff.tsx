import React, { useState, useMemo, useRef } from 'react';
import { MOCK_STAFF } from '../constants';
import { Employee } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const StaffScreen: React.FC = () => {
    const [staff, setStaff] = useState<Employee[]>(MOCK_STAFF); // Local state for editing
    const [selectedArea, setSelectedArea] = useState<string>('All');
    const [viewMode, setViewMode] = useState<'grid' | 'schedule'>('grid');
    const [activeModal, setActiveModal] = useState<'none' | 'add' | 'profile' | 'schedule'>('none');
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    // Temporary state for editing schedule
    const [editingSchedule, setEditingSchedule] = useState<{ day: string, start: string, end: string }[]>([]);

    const areas = ['All', 'Kitchen', 'Service', 'Bar', 'Management'];

    const filteredStaff = useMemo(() => {
        return selectedArea === 'All'
            ? staff
            : staff.filter(employee => employee.area === selectedArea);
    }, [selectedArea, staff]);

    const onShiftCount = staff.filter(s => s.status === 'ON_SHIFT').length;

    const handleProfileClick = (employee: Employee) => {
        setSelectedEmployee(employee);
        setActiveModal('profile');
    };

    const handleScheduleClick = (employee: Employee) => {
        setSelectedEmployee(employee);
        // Initialize editing state with current schedule or default structure
        setEditingSchedule(employee.schedule || []);
        setActiveModal('schedule');
    };

    const handleSaveSchedule = () => {
        if (!selectedEmployee) return;

        const updatedStaff = staff.map(emp =>
            emp.id === selectedEmployee.id
                ? { ...emp, schedule: editingSchedule }
                : emp
        );
        setStaff(updatedStaff);

        // Update selected employee to reflect changes immediately in modal if needed (though we close it)
        setSelectedEmployee({ ...selectedEmployee, schedule: editingSchedule });

        setActiveModal('none');
        // In a real app, you'd save to backend here
        alert('Schedule updated successfully!');
    };

    const updateScheduleItem = (index: number, field: 'start' | 'end', value: string) => {
        const newSchedule = [...editingSchedule];
        newSchedule[index] = { ...newSchedule[index], [field]: value };
        setEditingSchedule(newSchedule);
    };

    const handleDownload = async () => {
        if (!printRef.current) return;

        try {
            const canvas = await html2canvas(printRef.current, {
                scale: 2, // Higher resolution
                useCORS: true, // Allow loading cross-origin images (like avatars)
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

            // Fit to page width (with margins)
            const margin = 10;
            const finalWidth = pdfWidth - (margin * 2);
            const finalHeight = (imgHeight * finalWidth) / imgWidth;

            pdf.addImage(imgData, 'PNG', margin, margin, finalWidth, finalHeight);
            pdf.save(`Staff_Schedule_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        }
    };

    const handleEmail = () => {
        // Mock email
        alert(`Un correo ha sido enviado a todo el equipo de ${selectedArea !== 'All' ? selectedArea : 'General'} con los horarios actualizados.`);
    };

    return (
        <div className="h-full bg-[#F3F4F6] text-gray-800 p-8 overflow-y-auto relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
                    <p className="text-gray-500 text-sm">Shift Roster, Performance & Content</p>
                </div>

                <div className="flex gap-4 items-center flex-wrap">
                    {/* Action Buttons */}
                    <button
                        onClick={handleDownload}
                        className="bg-white text-gray-600 px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm border border-gray-200 hover:bg-gray-50 font-bold transition-all hover:text-primary"
                        title="Download Format PDF"
                    >
                        <span className="material-icons-round text-lg">picture_as_pdf</span>
                        Download PDF
                    </button>
                    <button
                        onClick={handleEmail}
                        className="bg-white text-gray-600 px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-sm border border-gray-200 hover:bg-gray-50 font-bold transition-all hover:text-primary"
                        title="Email Schedule"
                    >
                        <span className="material-icons-round text-lg">email</span>
                    </button>

                    {/* View Toggles */}
                    <div className="bg-white p-1 rounded-xl flex shadow-sm border border-gray-100">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'grid' ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <span className="material-icons-round text-base">grid_view</span>
                            Grid
                        </button>
                        <button
                            onClick={() => setViewMode('schedule')}
                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'schedule' ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <span className="material-icons-round text-base">calendar_view_week</span>
                            Schedule
                        </button>
                    </div>

                    <button
                        onClick={() => setActiveModal('add')}
                        className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-primary/30 transition-all font-bold"
                    >
                        <span className="material-icons-round text-lg">person_add</span>
                        Add Employee
                    </button>
                </div>
            </div>

            {/* Filters & Stats Row */}
            <div className="flex flex-col xl:flex-row gap-6 mb-8">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                    <div className="bg-white p-4 rounded-2xl flex items-center gap-4 shadow-soft">
                        <div className="p-3 bg-primary/10 rounded-xl text-primary">
                            <span className="material-icons-round text-xl">groups</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">{staff.length}</h3>
                            <p className="text-xs text-gray-500">Total Staff</p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl flex items-center gap-4 shadow-soft">
                        <div className="p-3 bg-green-100 rounded-xl text-green-600">
                            <span className="material-icons-round text-xl">verified_user</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">{onShiftCount}</h3>
                            <p className="text-xs text-gray-500">On Shift</p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl flex items-center gap-4 shadow-soft">
                        <div className="p-3 bg-yellow-100 rounded-xl text-yellow-600">
                            <span className="material-icons-round text-xl">star</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900">4.8</h3>
                            <p className="text-xs text-gray-500">Avg Rating</p>
                        </div>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="bg-white p-2 rounded-2xl shadow-soft flex items-center gap-2 overflow-x-auto">
                    {areas.map(area => (
                        <button
                            key={area}
                            onClick={() => setSelectedArea(area)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${selectedArea === area
                                ? 'bg-primary text-white shadow-md'
                                : 'bg-transparent text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            {area}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredStaff.map(employee => (
                        <div key={employee.id} className="bg-white rounded-2xl p-6 shadow-card hover:shadow-lg relative group transition-all duration-300 border border-transparent hover:border-primary/10">
                            <div className="flex flex-col items-center">
                                <div className="relative mb-4">
                                    <div className={`w-24 h-24 rounded-full p-1 border-2 ${employee.status === 'ON_SHIFT' ? 'border-green-500' :
                                        employee.status === 'BREAK' ? 'border-yellow-500' : 'border-gray-200'
                                        }`}>
                                        <img src={employee.image} alt={employee.name} className="w-full h-full rounded-full object-cover" />
                                    </div>
                                    <span className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-2 border-white ${employee.status === 'ON_SHIFT' ? 'bg-green-500' :
                                        employee.status === 'BREAK' ? 'bg-yellow-500' : 'bg-gray-400'
                                        }`}></span>
                                </div>

                                <h3 className="text-lg font-bold text-gray-900">{employee.name}</h3>
                                <p className="text-primary text-sm font-bold mb-1">{employee.role}</p>
                                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md mb-4">{employee.area}</span>

                                <div className="w-full flex justify-between items-center text-sm text-gray-500 mb-6 bg-gray-50 p-2 rounded-xl">
                                    <div className="flex flex-col items-center flex-1 border-r border-gray-200">
                                        <span className="font-bold text-gray-900">{employee.hoursWorked}h</span>
                                        <span className="text-[10px]">Hours</span>
                                    </div>
                                    <div className="flex flex-col items-center flex-1">
                                        <span className="font-bold text-gray-900 flex items-center gap-1">
                                            {employee.rating} <span className="material-icons-round text-yellow-500 text-xs">star</span>
                                        </span>
                                        <span className="text-[10px]">Rating</span>
                                    </div>
                                </div>

                                <div className="flex gap-2 w-full">
                                    <button
                                        onClick={() => handleProfileClick(employee)}
                                        className="flex-1 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-600 transition-colors"
                                    >
                                        Profile
                                    </button>
                                    <button
                                        onClick={() => handleScheduleClick(employee)}
                                        className="flex-1 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-600 transition-colors"
                                    >
                                        Schedule
                                    </button>
                                </div>
                            </div>

                            {/* Status Label Absolute */}
                            <div className={`absolute top-4 right-4 text-[10px] font-bold px-2 py-1 rounded-full ${employee.status === 'ON_SHIFT' ? 'bg-green-100 text-green-600' :
                                employee.status === 'BREAK' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-400'
                                }`} >
                                {employee.status.replace('_', ' ')}
                            </div>
                        </div>
                    ))}

                    {/* Add New Card (Visual placeholder) */}
                    <button
                        onClick={() => setActiveModal('add')}
                        className="bg-gray-50 rounded-2xl p-6 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-4 hover:bg-white hover:border-primary transition-all group cursor-pointer text-gray-400 hover:text-primary min-h-[300px]"
                    >
                        <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                            <span className="material-icons-round text-3xl">add</span>
                        </div>
                        <span className="font-bold">Recruit New Staff</span>
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm">
                                    <th className="py-4 px-6 font-bold">Employee</th>
                                    <th className="py-4 px-2 text-center">Mon</th>
                                    <th className="py-4 px-2 text-center">Tue</th>
                                    <th className="py-4 px-2 text-center">Wed</th>
                                    <th className="py-4 px-2 text-center">Thu</th>
                                    <th className="py-4 px-2 text-center">Fri</th>
                                    <th className="py-4 px-2 text-center">Sat</th>
                                    <th className="py-4 px-2 text-center">Sun</th>
                                    <th className="py-4 px-6 text-right">Total Hours</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {filteredStaff.map(employee => (
                                    <tr key={employee.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-3">
                                                <img src={employee.image} alt={employee.name} className="w-10 h-10 rounded-full object-cover" />
                                                <div>
                                                    <p className="font-bold text-gray-900">{employee.name}</p>
                                                    <p className="text-xs text-gray-500">{employee.role}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {employee.schedule?.map((shift, idx) => (
                                            <td key={idx} className="py-4 px-2 text-center">
                                                <button
                                                    onClick={() => handleScheduleClick(employee)}
                                                    className="inline-flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs font-medium min-w-[60px] transition-colors cursor-pointer"
                                                >
                                                    {shift.start !== 'Off' ? (
                                                        <>
                                                            <span>{shift.start}</span>
                                                            <span className="text-[10px] opacity-75">{shift.end}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-400 font-bold">-</span>
                                                    )}
                                                </button>
                                            </td>
                                        ))}
                                        {/* Fill remaining days if schedule incomplete (mock fix) */}
                                        {Array.from({ length: 7 - (employee.schedule?.length || 0) }).map((_, i) => (
                                            <td key={`empty-${i}`} className="py-4 px-2 text-center">
                                                <span className="text-gray-300 font-bold text-xs">-</span>
                                            </td>
                                        ))}
                                        <td className="py-4 px-6 text-right font-bold text-gray-900">
                                            {employee.hoursWorked}h
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Hidden Printable Area */}
            <div className="fixed top-0 left-[-9999px] w-[1100px] bg-white p-12 text-gray-900 font-sans" ref={printRef}>
                <div className="flex justify-between items-center mb-12 border-b-2 border-primary pb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
                            <span className="material-icons-round text-white text-4xl">restaurant</span>
                        </div>
                        <div>
                            <h1 className="text-4xl font-bold text-primary">Culinex Application</h1>
                            <p className="text-xl text-gray-500 font-medium">Weekly Staff Schedule</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-400 uppercase tracking-widest font-bold mb-1">Generated On</p>
                        <p className="text-lg font-bold">{new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100 shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b-2 border-gray-200">
                                <th className="py-6 px-4 font-black uppercase text-gray-400 text-sm tracking-wider">Employee</th>
                                <th className="py-6 px-4 font-black uppercase text-gray-400 text-sm tracking-wider text-center">Area</th>
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                    <th key={day} className="py-6 px-2 font-black uppercase text-gray-400 text-sm tracking-wider text-center">{day}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStaff.map((employee, idx) => (
                                <tr key={employee.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                    <td className="py-6 px-4 font-bold text-lg text-gray-800">{employee.name} <span className="block text-xs font-normal text-gray-500 mt-1">{employee.role}</span></td>
                                    <td className="py-6 px-4 text-center">
                                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary uppercase tracking-wide">{employee.area}</span>
                                    </td>
                                    {employee.schedule?.map((shift, i) => (
                                        <td key={i} className="py-6 px-2 text-center">
                                            {shift.start !== 'Off' ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="font-bold text-gray-900">{shift.start}</span>
                                                    <span className="text-xs text-gray-400">{shift.end}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 font-bold block text-center">—</span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-12 text-center border-t border-gray-200 pt-8">
                    <p className="text-gray-400 text-sm font-medium">Generated by Culinex OS • Intelligent Restaurant Management</p>
                </div>
            </div>

            {/* Basic Overlays/Modals */}
            {activeModal !== 'none' && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative animate-[fadeIn_0.5s_ease-out]">
                        {/* Close Button */}
                        <button
                            onClick={() => setActiveModal('none')}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
                        >
                            <span className="material-icons-round">close</span>
                        </button>

                        <div className="p-6">
                            {activeModal === 'add' && (
                                <>
                                    <h2 className="text-2xl font-bold mb-4">Add New Employee</h2>
                                    <form className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Full Name</label>
                                            <input type="text" className="w-full border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="e.g. Juan Perez" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Role</label>
                                                <select className="w-full border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                                                    <option>Chef</option>
                                                    <option>Waiter</option>
                                                    <option>Manager</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Area</label>
                                                <select className="w-full border border-gray-200 rounded-xl px-4 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                                                    <option>Kitchen</option>
                                                    <option>Service</option>
                                                    <option>Management</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setActiveModal('none')} className="w-full bg-primary text-white font-bold py-3 rounded-xl mt-4 hover:bg-blue-600 transition-colors">
                                            Create Employee
                                        </button>
                                    </form>
                                </>
                            )}

                            {activeModal === 'profile' && selectedEmployee && (
                                <div className="text-center">
                                    <img src={selectedEmployee.image} alt={selectedEmployee.name} className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-gray-100" />
                                    <h2 className="text-2xl font-bold text-gray-900">{selectedEmployee.name}</h2>
                                    <p className="text-primary font-bold mb-6">{selectedEmployee.role}</p>

                                    <div className="grid grid-cols-2 gap-4 text-left p-4 bg-gray-50 rounded-xl mb-6">
                                        <div>
                                            <p className="text-xs text-gray-500">Status</p>
                                            <p className="font-bold text-green-600">{selectedEmployee.status}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Rating</p>
                                            <p className="font-bold flex items-center gap-1">
                                                {selectedEmployee.rating} <span className="material-icons-round text-yellow-500 text-sm">star</span>
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Hours Worked</p>
                                            <p className="font-bold">{selectedEmployee.hoursWorked}h</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Area</p>
                                            <p className="font-bold">{selectedEmployee.area}</p>
                                        </div>
                                    </div>
                                    <button className="w-full border border-gray-200 text-gray-600 font-bold py-3 rounded-xl hover:bg-gray-50 transition-colors">
                                        View Full History
                                    </button>
                                </div>
                            )}

                            {activeModal === 'schedule' && selectedEmployee && (
                                <div>
                                    <div className="flex items-center gap-4 mb-6">
                                        <img src={selectedEmployee.image} alt={selectedEmployee.name} className="w-12 h-12 rounded-full" />
                                        <div>
                                            <h2 className="text-xl font-bold">{selectedEmployee.name}</h2>
                                            <p className="text-xs text-gray-500">Edit Weekly Schedule</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                        {editingSchedule.map((shift, idx) => (
                                            <div key={idx} className="flex flex-col p-3 bg-gray-50 rounded-xl">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-bold text-gray-700 w-12">{shift.day}</span>
                                                    <label className="text-xs text-gray-500 flex items-center gap-1 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={shift.start === 'Off'}
                                                            onChange={(e) => updateScheduleItem(idx, 'start', e.target.checked ? 'Off' : '09:00')}
                                                        />
                                                        Rest Day
                                                    </label>
                                                </div>

                                                {shift.start !== 'Off' && (
                                                    <div className="flex gap-2 items-center">
                                                        <input
                                                            type="time"
                                                            value={shift.start}
                                                            onChange={(e) => updateScheduleItem(idx, 'start', e.target.value)}
                                                            className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-primary"
                                                        />
                                                        <span className="text-gray-400">-</span>
                                                        <input
                                                            type="time"
                                                            value={shift.end === '-' ? '17:00' : shift.end}
                                                            onChange={(e) => updateScheduleItem(idx, 'end', e.target.value)}
                                                            className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-primary"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={handleSaveSchedule}
                                        className="w-full bg-primary text-white font-bold py-3 rounded-xl mt-6 hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <span className="material-icons-round text-lg">save</span>
                                        Save Schedule
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};