import React, { useState, useMemo, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Employee } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserCheck, Star, FileText, LayoutGrid, Calendar, UserPlus,
  Search, X, Plus, RefreshCw, ChefHat, Wine, Briefcase, CheckCircle2,
} from 'lucide-react';
import {
  SrCard, SrButton, SrChip, SrInput, SrLabel, SrKicker, SrMono,
  SrModal, SrModalHeader, SrEmptyState, SrTabs, SrProgressRing,
  SrTierUpgradeModal,
} from '../components/ui/servirest';

type RoleFilter = 'All' | 'Kitchen' | 'Service' | 'Bar' | 'Management';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_LABEL: Record<string, string> = {
  Mon: 'Lun', Tue: 'Mar', Wed: 'Mié', Thu: 'Jue', Fri: 'Vie', Sat: 'Sáb', Sun: 'Dom',
};

const AREA_TONE = (area?: string) =>
  area === 'Kitchen' ? 'terracota'
    : area === 'Bar' ? 'mostaza'
    : area === 'Management' ? 'midnight'
    : 'neutral';

export const StaffScreen: React.FC = () => {
  const {
    employees, addEmployee, updateEmployee, triggerSync,
    authProfile, isAuthenticating, activeEmployee, isSuperAdmin,
  } = useUser();
  const { tier, isWithinLimit } = useSubscription();
  const [showLimitModal, setShowLimitModal] = useState(false);

  const [selectedArea, setSelectedArea] = useState<RoleFilter>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'schedule'>('grid');
  const [activeModal, setActiveModal] = useState<'none' | 'add' | 'profile' | 'schedule'>('none');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee>>({});
  const printRef = useRef<HTMLDivElement>(null);

  const filteredStaff = useMemo(() => {
    return selectedArea === 'All'
      ? employees
      : employees.filter((employee) => employee.area === selectedArea);
  }, [selectedArea, employees]);

  const onShiftCount = employees.filter((s) => s.status === 'ON_SHIFT').length;
  const avgRating = useMemo(() => {
    if (employees.length === 0) return 0;
    return employees.reduce((s, e) => s + (e.rating || 0), 0) / employees.length;
  }, [employees]);

  const areaTabs = useMemo(
    () =>
      [
        { id: 'All' as RoleFilter, label: 'Todos', count: employees.length },
        { id: 'Service' as RoleFilter, label: 'Meseros', count: employees.filter((e) => e.area === 'Service').length },
        { id: 'Kitchen' as RoleFilter, label: 'Cocina', count: employees.filter((e) => e.area === 'Kitchen').length },
        { id: 'Bar' as RoleFilter, label: 'Bar', count: employees.filter((e) => e.area === 'Bar').length },
        { id: 'Management' as RoleFilter, label: 'Gerencia', count: employees.filter((e) => e.area === 'Management').length },
      ] as const,
    [employees]
  );

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
    // Tier limit gate — block if adding this employee crosses the plan cap.
    if (!isWithinLimit('maxEmployees', employees.length + 1)) {
      setActiveModal('none');
      setShowLimitModal(true);
      return;
    }
    const formData = new FormData(e.target as HTMLFormElement);
    addEmployee({
      name: formData.get('name') as string,
      role: formData.get('role') as string,
      area: formData.get('area') as any,
      status: 'OFF_SHIFT',
      pin: '1111',
      image: `https://ui-avatars.com/api/?name=${formData.get('name')}&background=C4633F&color=fff`,
      rating: 5,
      hoursWorked: 0,
      schedule: [],
      businessId: authProfile.businessId,
    });
    setActiveModal('none');
  };

  const handleDownload = async () => {
    if (!printRef.current) return;
    const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#FAF8F4' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdf.addImage(imgData, 'PNG', 10, 10, 277, (canvas.height * 277) / canvas.width);
    pdf.save(`Personal_ServiRest_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const getShiftPct = (emp: Employee) => {
    const max = 40; // semanales
    return Math.min(100, Math.round(((emp.hoursWorked || 0) / max) * 100));
  };

  if (isAuthenticating) {
    return (
      <div className="h-full flex items-center justify-center bg-servirest-hueso">
        <div className="w-10 h-10 border-4 border-servirest-terracota/20 border-t-servirest-terracota rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = activeEmployee?.role?.toLowerCase() === 'admin' || isSuperAdmin;

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-servirest-hueso text-servirest-carbon antialiased">
      <div className="px-[38px] py-10 max-w-[1480px] mx-auto pb-32 lg:pb-12">
        {/* ─── HEADER ────────────────────────────────────────────── */}
        <div className="flex justify-between items-start flex-wrap gap-6 mb-12">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <SrKicker className="block mb-2">Equipo y horarios</SrKicker>
            <h1 className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0">
              Personal
            </h1>
            <p className="text-[14px] text-[rgba(42,40,38,0.6)] font-medium mt-2 max-w-[480px] leading-relaxed">
              Tu gente. Quién está en turno, quién no, y cómo se está moviendo cada uno en el piso.
            </p>
          </motion.div>

          {/* Mini-stats rail */}
          <div className="flex gap-3 flex-wrap">
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Activos</SrLabel>
              <div className="font-black italic text-[32px] text-servirest-success tracking-[-0.03em] leading-none">
                {onShiftCount}
              </div>
            </SrCard>
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Total</SrLabel>
              <div className="font-black italic text-[32px] text-servirest-midnight tracking-[-0.03em] leading-none">
                {employees.length}
              </div>
            </SrCard>
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Calificación</SrLabel>
              <div className="font-black italic text-[32px] text-servirest-terracota tracking-[-0.03em] leading-none">
                {avgRating.toFixed(1)}
              </div>
            </SrCard>
          </div>
        </div>

        {/* ─── ACTIONS BAR ───────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between mb-8">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-5 py-3 rounded-sr-md text-[10px] font-black uppercase tracking-[0.16em] transition-colors flex items-center gap-2 border ${
                viewMode === 'grid'
                  ? 'bg-servirest-midnight text-servirest-hueso border-servirest-midnight'
                  : 'bg-servirest-surface text-[rgba(42,40,38,0.6)] border-[rgba(42,40,38,0.12)] hover:text-servirest-carbon'
              }`}
            >
              <LayoutGrid size={14} /> Equipo
            </button>
            <button
              type="button"
              onClick={() => setViewMode('schedule')}
              className={`px-5 py-3 rounded-sr-md text-[10px] font-black uppercase tracking-[0.16em] transition-colors flex items-center gap-2 border ${
                viewMode === 'schedule'
                  ? 'bg-servirest-midnight text-servirest-hueso border-servirest-midnight'
                  : 'bg-servirest-surface text-[rgba(42,40,38,0.6)] border-[rgba(42,40,38,0.12)] hover:text-servirest-carbon'
              }`}
            >
              <Calendar size={14} /> Horarios
            </button>
          </div>

          <div className="flex gap-3 flex-wrap">
            <SrButton variant="outline" size="md" icon={<FileText size={14} />} onClick={handleDownload}>
              Exportar PDF
            </SrButton>
            {isAdmin && (
              <SrButton
                variant="primary"
                size="md"
                icon={<UserPlus size={14} />}
                onClick={() => setActiveModal('add')}
              >
                Agregar persona
              </SrButton>
            )}
          </div>
        </div>

        {/* ─── ROLE TABS ─────────────────────────────────────────── */}
        <div className="mb-8">
          <SrTabs<RoleFilter>
            tabs={areaTabs}
            active={selectedArea}
            onChange={setSelectedArea}
          />
        </div>

        <div ref={printRef} className="pb-12">
          {filteredStaff.length === 0 ? (
            <SrCard variant="solaris" className="p-12">
              <SrEmptyState
                icon={<Users size={28} />}
                title={employees.length === 0 ? 'Aún sin gente en tu equipo' : 'Sin personal en este filtro'}
                description={
                  employees.length === 0
                    ? 'Suma a tu primera mesera o cocinero para empezar a operar.'
                    : 'Cambia de filtro o sincroniza para traer al equipo desde la nube.'
                }
                action={
                  employees.length === 0 ? (
                    isAdmin ? (
                      <SrButton variant="primary" icon={<UserPlus size={14} />} onClick={() => setActiveModal('add')}>
                        Agregar primera persona
                      </SrButton>
                    ) : (
                      <SrButton variant="outline" icon={<RefreshCw size={14} />} onClick={() => triggerSync()}>
                        Sincronizar equipo
                      </SrButton>
                    )
                  ) : undefined
                }
              />
            </SrCard>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              <AnimatePresence mode="popLayout">
                {filteredStaff.map((emp, idx) => {
                  const onShift = emp.status === 'ON_SHIFT';
                  const pct = getShiftPct(emp);
                  return (
                    <motion.div
                      key={emp.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.3, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <SrCard hover className="p-6 flex flex-col items-center text-center h-full">
                        {/* Avatar */}
                        <div className="relative mb-4">
                          <div
                            className={`w-24 h-24 rounded-full p-1 border-2 transition-colors ${
                              onShift ? 'border-servirest-success' : 'border-[rgba(42,40,38,0.15)]'
                            }`}
                          >
                            <img
                              src={emp.image || `https://ui-avatars.com/api/?name=${emp.name}&background=C4633F&color=fff`}
                              alt={emp.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          </div>
                          <span
                            className={`absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full border-2 border-servirest-surface ${
                              onShift ? 'bg-servirest-success shadow-[0_0_10px_rgba(34,160,107,0.5)]' : 'bg-[rgba(42,40,38,0.20)]'
                            }`}
                          />
                        </div>

                        <h3 className="font-serif italic font-medium text-[18px] text-servirest-midnight tracking-[-0.015em] m-0 mb-1 leading-tight">
                          {emp.name}
                        </h3>

                        <div className="flex items-center gap-2 mb-4 flex-wrap justify-center">
                          <SrChip tone={AREA_TONE(emp.area)} size="xs">
                            {emp.role}
                          </SrChip>
                          <SrChip tone={onShift ? 'success' : 'neutral'} size="xs">
                            {onShift ? 'En turno' : 'Descansa'}
                          </SrChip>
                        </div>

                        {/* Stats row with progress ring */}
                        <div className="w-full flex items-center gap-4 mb-5 pt-4 border-t border-[rgba(42,40,38,0.08)]">
                          <SrProgressRing pct={pct} size={48} stroke={4} showLabel />
                          <div className="flex-1 text-left">
                            <SrLabel className="block mb-1">Horas semana</SrLabel>
                            <SrMono className="text-[14px] text-servirest-midnight font-extrabold">
                              {emp.hoursWorked || 0}h
                            </SrMono>
                          </div>
                          <div className="text-right">
                            <SrLabel className="block mb-1">Rating</SrLabel>
                            <div className="flex items-center justify-end gap-1">
                              <SrMono className="text-[14px] text-servirest-mostaza font-extrabold">
                                {emp.rating}
                              </SrMono>
                              <Star size={11} className="text-servirest-mostaza fill-servirest-mostaza" />
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 w-full">
                          <SrButton variant="outline" size="sm" className="flex-1" onClick={() => handleProfileClick(emp)}>
                            Perfil
                          </SrButton>
                          {isAdmin && (
                            <SrButton variant="outline" size="sm" className="flex-1" onClick={() => handleScheduleClick(emp)}>
                              Horario
                            </SrButton>
                          )}
                        </div>
                      </SrCard>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <SrCard variant="solaris" className="p-7 overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left min-w-[760px]">
                  <thead>
                    <tr className="border-b border-[rgba(42,40,38,0.10)]">
                      <th className="py-4 px-3 text-left">
                        <SrLabel>Persona</SrLabel>
                      </th>
                      {DAYS.map((d) => (
                        <th key={d} className="py-4 px-2 text-center">
                          <SrLabel>{DAY_LABEL[d]}</SrLabel>
                        </th>
                      ))}
                      <th className="py-4 px-3 text-right">
                        <SrLabel>Horas</SrLabel>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((emp, idx) => (
                      <motion.tr
                        key={emp.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: idx * 0.03 }}
                        className="border-b border-[rgba(42,40,38,0.06)] last:border-0 hover:bg-servirest-hueso-sunken/40 transition-colors"
                      >
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={emp.image || `https://ui-avatars.com/api/?name=${emp.name}&background=C4633F&color=fff`}
                              alt={emp.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                            <div>
                              <div className="font-extrabold text-[13px] text-servirest-midnight tracking-tight">{emp.name}</div>
                              <SrLabel>{emp.role}</SrLabel>
                            </div>
                          </div>
                        </td>
                        {DAYS.map((day) => {
                          const shift = emp.schedule?.find((s) => s.day === day);
                          return (
                            <td key={day} className="py-4 px-2 text-center">
                              <div
                                className={`min-w-[68px] h-10 mx-auto rounded-sr-md flex items-center justify-center transition-colors border ${
                                  shift
                                    ? 'bg-[rgba(196,99,63,0.08)] border-servirest-terracota/30 text-servirest-terracota'
                                    : 'bg-servirest-hueso-sunken/40 border-[rgba(42,40,38,0.06)] text-[rgba(42,40,38,0.2)]'
                                }`}
                              >
                                {shift ? (
                                  <SrMono className="text-[10px] font-extrabold leading-tight">
                                    {shift.start}–{shift.end}
                                  </SrMono>
                                ) : (
                                  <span className="text-[8px] font-black uppercase tracking-[0.16em]">—</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="py-4 px-3 text-right">
                          <SrMono className="text-[14px] text-servirest-terracota font-extrabold">
                            {emp.hoursWorked}h
                          </SrMono>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SrCard>
          )}
        </div>
      </div>

      {/* ─── ADD MODAL ─────────────────────────────────────────── */}
      <AnimatePresence>
        {activeModal === 'add' && (
          <SrModal open onClose={() => setActiveModal('none')} maxWidth={560}>
            <SrModalHeader
              title="Agregar persona"
              kicker="Suma a tu equipo"
              onClose={() => setActiveModal('none')}
            />
            <form onSubmit={handleAddEmployee} className="space-y-5">
              <div>
                <SrLabel className="block mb-2">Nombre completo *</SrLabel>
                <SrInput name="name" type="text" required placeholder="Ej. María González" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <SrLabel className="block mb-2">Puesto</SrLabel>
                  <SrInput name="role" type="text" required placeholder="Ej. Mesera, Cocinero" />
                </div>
                <div>
                  <SrLabel className="block mb-2">Área</SrLabel>
                  <select
                    name="area"
                    defaultValue="Service"
                    className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.20)] rounded-sr-lg py-3 px-4 text-[13px] font-medium text-servirest-carbon outline-none focus:border-servirest-terracota transition-colors cursor-pointer"
                  >
                    <option value="Service">Servicio</option>
                    <option value="Kitchen">Cocina</option>
                    <option value="Bar">Bar</option>
                    <option value="Management">Gerencia</option>
                  </select>
                </div>
              </div>
              <SrCard className="p-4 bg-[rgba(196,99,63,0.04)] border-servirest-terracota/20">
                <div className="flex items-center gap-3">
                  <Briefcase size={16} className="text-servirest-terracota shrink-0" />
                  <SrMono className="text-[11px] text-servirest-carbon">
                    PIN inicial: <span className="text-servirest-terracota font-extrabold">1111</span> — la persona puede cambiarlo al primer login.
                  </SrMono>
                </div>
              </SrCard>
              <SrButton type="submit" variant="primary" size="lg" fullWidth icon={<UserPlus size={16} />}>
                Sumar al equipo
              </SrButton>
            </form>
          </SrModal>
        )}
      </AnimatePresence>

      {/* ─── PROFILE MODAL ─────────────────────────────────────── */}
      <AnimatePresence>
        {activeModal === 'profile' && selectedEmployee && (
          <SrModal open onClose={() => setActiveModal('none')} maxWidth={560}>
            <SrModalHeader
              title="Perfil"
              kicker={selectedEmployee.role}
              onClose={() => setActiveModal('none')}
            />

            <div className="space-y-6">
              <div className="flex items-center gap-5">
                <img
                  src={selectedEmployee.image || `https://ui-avatars.com/api/?name=${selectedEmployee.name}&background=C4633F&color=fff`}
                  className="w-20 h-20 rounded-full border-2 border-[rgba(42,40,38,0.10)] object-cover"
                  alt=""
                />
                <div className="flex-1">
                  {!isEditing ? (
                    <>
                      <h3 className="font-serif italic font-medium text-[26px] text-servirest-midnight tracking-[-0.02em] m-0 leading-tight">
                        {selectedEmployee.name}
                      </h3>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <SrChip tone={AREA_TONE(selectedEmployee.area)} size="xs">
                          {selectedEmployee.role}
                        </SrChip>
                        <SrChip tone={selectedEmployee.status === 'ON_SHIFT' ? 'success' : 'neutral'} size="xs">
                          {selectedEmployee.status === 'ON_SHIFT' ? 'En turno' : 'Descansa'}
                        </SrChip>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <SrInput
                        value={editingEmployee.name || ''}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                        placeholder="Nombre"
                      />
                      <SrInput
                        value={editingEmployee.role || ''}
                        onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                        placeholder="Puesto"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <SrCard className="p-4 text-center">
                  <SrLabel className="block mb-1.5">Área</SrLabel>
                  {isEditing ? (
                    <select
                      value={editingEmployee.area}
                      onChange={(e) => setEditingEmployee({ ...editingEmployee, area: e.target.value as any })}
                      className="bg-transparent text-[12px] font-extrabold text-servirest-midnight outline-none w-full text-center"
                    >
                      <option value="Service">Servicio</option>
                      <option value="Kitchen">Cocina</option>
                      <option value="Bar">Bar</option>
                      <option value="Management">Gerencia</option>
                    </select>
                  ) : (
                    <div className="font-extrabold text-[14px] text-servirest-midnight italic">{selectedEmployee.area}</div>
                  )}
                </SrCard>
                <SrCard className="p-4 text-center">
                  <SrLabel className="block mb-1.5">Horas semana</SrLabel>
                  <SrMono className="text-[16px] text-servirest-terracota font-extrabold">
                    {selectedEmployee.hoursWorked || 0}h
                  </SrMono>
                </SrCard>
                <SrCard className="p-4 text-center">
                  <SrLabel className="block mb-1.5">Rating</SrLabel>
                  <div className="flex items-center justify-center gap-1">
                    <SrMono className="text-[16px] text-servirest-mostaza font-extrabold">
                      {selectedEmployee.rating}
                    </SrMono>
                    <Star size={12} className="text-servirest-mostaza fill-servirest-mostaza" />
                  </div>
                </SrCard>
              </div>

              {!isEditing ? (
                isAdmin && (
                  <SrButton variant="primary" size="lg" fullWidth onClick={() => setIsEditing(true)}>
                    Editar perfil
                  </SrButton>
                )
              ) : (
                <div className="flex gap-3">
                  <SrButton variant="ghost" size="md" fullWidth onClick={() => setIsEditing(false)}>
                    Cancelar
                  </SrButton>
                  <SrButton variant="primary" size="md" fullWidth icon={<CheckCircle2 size={14} />} onClick={handleSaveEmployee}>
                    Guardar cambios
                  </SrButton>
                </div>
              )}
            </div>
          </SrModal>
        )}
      </AnimatePresence>

      {/* ─── SCHEDULE MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {activeModal === 'schedule' && selectedEmployee && (
          <SrModal open onClose={() => setActiveModal('none')} maxWidth={620}>
            <SrModalHeader
              title="Horarios"
              kicker={`${selectedEmployee.name} · ${selectedEmployee.role}`}
              onClose={() => setActiveModal('none')}
            />

            <div className="space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
              {/* Current shifts */}
              <div>
                <SrLabel className="block mb-3">Turnos asignados</SrLabel>
                {(editingEmployee.schedule || []).length === 0 ? (
                  <SrCard className="p-6 border-dashed">
                    <p className="text-[12px] text-[rgba(42,40,38,0.4)] font-medium italic text-center m-0">
                      Sin turnos por ahora. Suma uno abajo.
                    </p>
                  </SrCard>
                ) : (
                  <div className="space-y-2">
                    {editingEmployee.schedule?.map((shift, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <SrCard className="p-4 flex items-center justify-between">
                          <div>
                            <SrLabel className="block text-servirest-terracota mb-1">{DAY_LABEL[shift.day] || shift.day}</SrLabel>
                            <SrMono className="text-[14px] text-servirest-midnight font-extrabold">
                              {shift.start} — {shift.end}
                            </SrMono>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const newSched = [...(editingEmployee.schedule || [])];
                              newSched.splice(idx, 1);
                              setEditingEmployee({ ...editingEmployee, schedule: newSched });
                            }}
                            className="w-9 h-9 rounded-sr-md text-servirest-danger/50 hover:text-servirest-danger hover:bg-[rgba(225,85,75,0.08)] flex items-center justify-center transition-colors"
                            aria-label="Quitar turno"
                          >
                            <X size={16} />
                          </button>
                        </SrCard>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add shift */}
              <SrCard variant="solaris" className="p-6">
                <SrKicker className="block mb-3">Nuevo turno</SrKicker>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="col-span-3">
                    <SrLabel className="block mb-2">Día</SrLabel>
                    <select
                      id="new-shift-day"
                      className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.20)] rounded-sr-lg py-3 px-4 text-[13px] font-medium text-servirest-carbon outline-none focus:border-servirest-terracota transition-colors cursor-pointer"
                    >
                      {DAYS.map((d) => (
                        <option key={d} value={d}>{DAY_LABEL[d]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <SrLabel className="block mb-2">Entrada</SrLabel>
                    <SrInput id="new-shift-start" type="time" defaultValue="09:00" />
                  </div>
                  <div>
                    <SrLabel className="block mb-2">Salida</SrLabel>
                    <SrInput id="new-shift-end" type="time" defaultValue="17:00" />
                  </div>
                  <div className="flex items-end">
                    <SrButton
                      type="button"
                      variant="outline"
                      size="md"
                      fullWidth
                      icon={<Plus size={14} />}
                      onClick={() => {
                        const day = (document.getElementById('new-shift-day') as HTMLSelectElement).value;
                        const start = (document.getElementById('new-shift-start') as HTMLInputElement).value;
                        const end = (document.getElementById('new-shift-end') as HTMLInputElement).value;
                        const newSched = [...(editingEmployee.schedule || []), { day, start, end }];
                        setEditingEmployee({ ...editingEmployee, schedule: newSched });
                      }}
                    >
                      Sumar
                    </SrButton>
                  </div>
                </div>
              </SrCard>

              <SrButton variant="primary" size="lg" fullWidth icon={<CheckCircle2 size={16} />} onClick={handleSaveEmployee}>
                Guardar horarios
              </SrButton>
            </div>
          </SrModal>
        )}
      </AnimatePresence>

      <SrTierUpgradeModal
        open={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limit="maxEmployees"
        currentTier={tier}
      />
    </div>
  );
};

export default StaffScreen;
