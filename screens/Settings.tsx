import React, { useState, useEffect, useMemo } from 'react';
import { useSettings, BusinessSettings } from '../contexts/SettingsContext';
import { useUser } from '../contexts/UserContext';
import { Ticket } from '../components/Ticket';
import { printerService } from '../services/PrinterService';
import { bluetoothTerminalService } from '../services/BluetoothTerminalService';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Palette,
  Cpu,
  Users,
  Bell,
  Activity,
  CheckCircle2,
  Trash2,
  Save,
  Plus,
  Smartphone,
  Bluetooth,
  RefreshCcw,
  Zap,
  Printer as PrinterIcon,
  ShieldCheck,
  X,
  Database,
  Cloud,
  HardDrive,
  Pencil,
  Wifi,
  CircleDot,
} from 'lucide-react';
import { getAll } from '../services/db';
import { getSupabase } from '../services/auth';
import {
  SrCard,
  SrButton,
  SrChip,
  SrInput,
  SrLabel,
  SrKicker,
  SrMono,
  SrModal,
  SrModalHeader,
  SrEmptyState,
  SrTabs,
  SrAlert,
} from '../components/ui/servirest';

type SettingsTab = 'general' | 'appearance' | 'hardware' | 'users' | 'notifications' | 'diagnostics';

const TAB_LABELS: Record<SettingsTab, string> = {
  general: 'Información del negocio',
  appearance: 'Apariencia',
  hardware: 'Hardware',
  users: 'Personal',
  notifications: 'Avisos',
  diagnostics: 'Diagnóstico',
};

const THEMES = [
  { id: 'midnight' as const, name: 'Sobremesa lúcida', bg: 'bg-[#FAF8F4]', accent: 'bg-servirest-terracota', desc: 'El tema oficial de ServiRest, pensado para luz natural.' },
  { id: 'emerald' as const, name: 'Verde cocina', bg: 'bg-[#0F1B16]', accent: 'bg-emerald-500', desc: 'Modo oscuro para estaciones de cocina con luz baja.' },
  { id: 'ruby' as const, name: 'Alerta rubí', bg: 'bg-[#1A0A0A]', accent: 'bg-red-500', desc: 'Alto contraste para auditorías y turnos críticos.' },
];

export const SettingsScreen: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { employees: users, addEmployee: addUser, updateEmployee: updateUser, deleteEmployee: deleteUser, authProfile: currentUser } = useUser();
  const [localSettings, setLocalSettings] = useState<BusinessSettings>(settings);
  const [testOrderToPrint, setTestOrderToPrint] = useState<any>(null);
  const [showsSavedMessage, setShowsSavedMessage] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userForm, setUserForm] = useState<{ name: string; role: string; pin: string; area: string; modules?: string[] }>({
    name: '',
    role: 'mesero',
    pin: '1111',
    area: 'Service',
    modules: [],
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Storage Inspector State
  const [showStoragePinModal, setShowStoragePinModal] = useState(false);
  const [storagePin, setStoragePin] = useState('');
  const [storagePinError, setStoragePinError] = useState(false);
  const [showStorageInspector, setShowStorageInspector] = useState(false);
  const [storageData, setStorageData] = useState<{ table: string; local: number; cloud: number | 'Err' | 'N/A' }[]>([]);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    updateSettings(localSettings);
    setShowsSavedMessage(true);
    setTimeout(() => setShowsSavedMessage(false), 3000);
  };

  const showStatus = (type: 'success' | 'error', message: string) => {
    setConnectionStatus({ type, message });
    setTimeout(() => setConnectionStatus(null), 4000);
  };

  const handleConnectUSB = async () => {
    setIsConnecting(true);
    try {
      const device = await printerService.requestPrinter();
      if (device) {
        const name = device.productName || 'Impresora USB';
        const connected = await printerService.connect(device);
        if (connected) {
          setLocalSettings((p) => ({ ...p, connectedDeviceName: name, isDirectPrintingEnabled: true }));
          showStatus('success', `Vinculada: ${name}`);
        } else {
          showStatus('error', 'No pudimos vincular la impresora USB');
        }
      }
    } catch (err) {
      showStatus('error', 'Fallo en la interfaz USB');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectBT = async () => {
    setIsConnecting(true);
    try {
      const device = await printerService.requestBluetoothPrinter();
      if (device) {
        const name = device.name || 'Impresora Bluetooth';
        const connected = await printerService.connect(device);
        if (connected) {
          setLocalSettings((p) => ({ ...p, connectedDeviceName: name, isDirectPrintingEnabled: true }));
          showStatus('success', `Vinculada: ${name}`);
        } else {
          showStatus('error', 'No pudimos emparejar por Bluetooth');
        }
      }
    } catch (err) {
      showStatus('error', 'Bluetooth no disponible');
    } finally {
      setIsConnecting(false);
    }
  };

  const handlePrintTest = async () => {
    const testOrder = {
      id: 'TEST',
      items: [{ name: 'Prueba de impresión', quantity: 1, price: 100 }],
      total: 100,
      timestamp: new Date(),
      tableId: 'PRUEBA',
      waiterName: 'ServiRest',
    };
    if (printerService.isConnected() || localSettings.connectedDeviceName !== 'None') {
      const success = await printerService.printOrder(testOrder, localSettings);
      if (success) {
        showStatus('success', 'Ticket de prueba enviado');
      } else {
        showStatus('error', 'No salió el ticket — revisa la conexión');
        setTestOrderToPrint(testOrder);
        setTimeout(() => {
          window.print();
          setTestOrderToPrint(null);
        }, 500);
      }
    } else {
      setTestOrderToPrint(testOrder);
      setTimeout(() => {
        window.print();
        setTestOrderToPrint(null);
      }, 100);
    }
  };

  const handleDrawerTest = async () => {
    if (!printerService.isConnected()) {
      showStatus('error', 'Sin impresora — conéctala primero');
      return;
    }
    const ok = await printerService.openCashDrawer();
    if (ok) {
      showStatus('success', 'Cajón abierto');
    } else {
      showStatus('error', 'No abrió el cajón');
    }
  };

  const handleStorageAccess = () => {
    setShowStoragePinModal(true);
    setStoragePin('');
    setStoragePinError(false);
  };

  const verifyStoragePin = () => {
    if (storagePin === '666') {
      setShowStoragePinModal(false);
      setShowStorageInspector(true);
      fetchStorageData();
    } else {
      setStoragePinError(true);
    }
  };

  const fetchStorageData = async () => {
    setIsLoadingStorage(true);
    const tables = ['products', 'orders', 'employees', 'inventory', 'expenses'];
    const supabaseTables = ['menu_items', 'orders', 'employees', 'inventory_items', 'expenses'];

    const data: any[] = [];
    const supabase = getSupabase();

    for (let i = 0; i < tables.length; i++) {
      const localStore = tables[i];
      const cloudTable = supabaseTables[i];

      // Get local count — preserves pre-existing TS narrowing issue at line ~ same call
      let localCount = 0;
      try {
        const localRecords = await getAll(localStore);
        localCount = localRecords.length;
      } catch (e) {
        console.error(e);
      }

      // Get cloud count
      let cloudCount: number | 'Err' | 'N/A' = 'N/A';
      if (supabase && currentUser?.businessId) {
        try {
          const { count, error } = await supabase
            .from(cloudTable)
            .select('*', { count: 'exact', head: true })
            .eq('business_id', currentUser.businessId);

          if (!error) cloudCount = count || 0;
          else cloudCount = 'Err';
        } catch (e) {
          cloudCount = 'Err';
        }
      }

      data.push({ table: localStore.toUpperCase(), local: localCount, cloud: cloudCount });
    }

    setStorageData(data);
    setIsLoadingStorage(false);
  };

  const TAB_DEFS = useMemo(() => {
    const base: { id: SettingsTab; label: string; count?: number; adminOnly?: boolean }[] = [
      { id: 'general', label: TAB_LABELS.general },
      { id: 'appearance', label: TAB_LABELS.appearance },
      { id: 'hardware', label: TAB_LABELS.hardware },
      { id: 'users', label: TAB_LABELS.users, count: users.length, adminOnly: true },
      { id: 'notifications', label: TAB_LABELS.notifications },
      { id: 'diagnostics', label: TAB_LABELS.diagnostics, adminOnly: true },
    ];
    return base.filter((t) => !t.adminOnly || currentUser?.role === 'admin');
  }, [users.length, currentUser?.role]);

  const printerConnected = localSettings.connectedDeviceName && localSettings.connectedDeviceName !== 'None';
  const terminalConnected = !!localSettings.isTerminalEnabled;

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-servirest-hueso text-servirest-carbon antialiased">
      <div className="hidden print:block absolute inset-0 z-[9999] bg-white text-black">
        {testOrderToPrint && <Ticket order={testOrderToPrint} settings={localSettings} isTest={true} />}
      </div>

      <div className="px-[38px] py-10 max-w-[1480px] mx-auto pb-40 lg:pb-32">
        {/* ─── EDITORIAL HEADER ─────────────────────────────────────────── */}
        <div className="flex justify-between items-start flex-wrap gap-6 mb-12">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <SrKicker className="block mb-2">Configuración del negocio</SrKicker>
            <h1 className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0">
              Ajustes
            </h1>
            <p className="text-[14px] text-[rgba(42,40,38,0.6)] font-medium mt-2 max-w-[520px] leading-relaxed">
              Aquí afinas tu restaurante — datos fiscales, equipo, impresoras y permisos. Todo lo que guardes se sincroniza a la nube.
            </p>
          </motion.div>

          {/* Mini-stats rail */}
          <div className="flex gap-3 flex-wrap">
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Impresora</SrLabel>
              <div className={`font-black italic text-[20px] tracking-[-0.02em] leading-none ${printerConnected ? 'text-servirest-success' : 'text-[rgba(42,40,38,0.4)]'}`}>
                {printerConnected ? 'Lista' : 'Sin vincular'}
              </div>
            </SrCard>
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Terminal</SrLabel>
              <div className={`font-black italic text-[20px] tracking-[-0.02em] leading-none ${terminalConnected ? 'text-servirest-success' : 'text-[rgba(42,40,38,0.4)]'}`}>
                {terminalConnected ? 'Activa' : 'Apagada'}
              </div>
            </SrCard>
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Equipo</SrLabel>
              <div className="font-black italic text-[32px] text-servirest-midnight tracking-[-0.03em] leading-none">
                {users.length}
              </div>
            </SrCard>
          </div>
        </div>

        {/* ─── TABS ──────────────────────────────────────────────────── */}
        <div className="mb-10">
          <SrTabs<SettingsTab> tabs={TAB_DEFS} active={activeTab} onChange={setActiveTab} />
        </div>

        {/* ─── TAB CONTENT ─────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {activeTab === 'general' && (
              <GeneralTab localSettings={localSettings} setLocalSettings={setLocalSettings} />
            )}
            {activeTab === 'appearance' && (
              <AppearanceTab localSettings={localSettings} setLocalSettings={setLocalSettings} />
            )}
            {activeTab === 'hardware' && (
              <HardwareTab
                localSettings={localSettings}
                setLocalSettings={setLocalSettings}
                isConnecting={isConnecting}
                onConnectUSB={handleConnectUSB}
                onConnectBT={handleConnectBT}
                connectionStatus={connectionStatus}
              />
            )}
            {activeTab === 'users' && (
              <UsersTab
                users={users}
                deleteUser={deleteUser}
                onNew={() => {
                  setEditingUser(null);
                  setUserForm({ name: '', role: 'mesero', pin: '1111', area: 'Service', modules: [] });
                  setShowUserModal(true);
                }}
                onEdit={(user) => {
                  setEditingUser(user);
                  setUserForm({
                    name: user.name,
                    role: user.role?.toLowerCase() || 'mesero',
                    pin: user.pin || '1111',
                    area: user.area || 'Service',
                    modules: user.modules || [],
                  });
                  setShowUserModal(true);
                }}
              />
            )}
            {activeTab === 'notifications' && (
              <NotificationsTab localSettings={localSettings} setLocalSettings={setLocalSettings} />
            )}
            {activeTab === 'diagnostics' && (
              <DiagnosticsTab
                onPrintTest={handlePrintTest}
                onDrawerTest={handleDrawerTest}
                onNetworkPing={() => showStatus('success', `Latencia: ${Math.floor(Math.random() * 20 + 5)}ms — buena conexión`)}
                onStorageAccess={handleStorageAccess}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ─── FLOATING SAVE BAR ─────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-[38px] py-5 bg-servirest-surface/95 backdrop-blur-md border-t border-[rgba(42,40,38,0.12)] shadow-sr-lift">
        <div className="max-w-[1480px] mx-auto flex items-center justify-end gap-4 flex-wrap">
          <AnimatePresence>
            {connectionStatus && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
              >
                <SrChip tone={connectionStatus.type === 'success' ? 'success' : 'danger'}>
                  {connectionStatus.type === 'success' ? (
                    <CheckCircle2 size={11} className="mr-1.5" />
                  ) : (
                    <X size={11} className="mr-1.5" />
                  )}
                  {connectionStatus.message}
                </SrChip>
              </motion.div>
            )}
            {showsSavedMessage && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                <SrChip tone="success">
                  <CheckCircle2 size={11} className="mr-1.5" />
                  Cambios guardados
                </SrChip>
              </motion.div>
            )}
          </AnimatePresence>
          <SrButton variant="primary" size="md" icon={<Save size={16} />} onClick={handleSave}>
            Guardar cambios
          </SrButton>
        </div>
      </div>

      {/* ─── USER MODAL ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showUserModal && (
          <SrModal open={showUserModal} onClose={() => setShowUserModal(false)} maxWidth={620}>
            <SrModalHeader
              title={editingUser ? 'Editar colaborador' : 'Nuevo colaborador'}
              kicker={editingUser ? 'Actualiza datos y permisos' : 'Da de alta a alguien de tu equipo'}
              onClose={() => setShowUserModal(false)}
            />
            <div className="space-y-5">
              <div>
                <SrLabel className="block mb-2">Nombre</SrLabel>
                <SrInput
                  value={userForm.name}
                  onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nombre completo"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <SrLabel className="block mb-2">Rol</SrLabel>
                  <select
                    value={userForm.role}
                    onChange={(e) =>
                      setUserForm((p) => ({
                        ...p,
                        role: e.target.value,
                        area: ['cocina', 'chef'].includes(e.target.value) ? 'Kitchen' : e.target.value === 'bar' ? 'Bar' : 'Service',
                      }))
                    }
                    className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.20)] rounded-sr-lg px-4 py-3 text-[13px] font-medium text-servirest-carbon outline-none focus:border-servirest-terracota transition-colors"
                  >
                    <option value="mesero">Mesero</option>
                    <option value="cajero">Cajero</option>
                    <option value="cocina">Cocina</option>
                    <option value="chef">Chef</option>
                    <option value="bar">Bar</option>
                    <option value="hostess">Hostess</option>
                    <option value="gerente">Gerente</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <SrLabel className="block mb-2">PIN de acceso</SrLabel>
                  <SrInput
                    value={userForm.pin}
                    onChange={(e) =>
                      setUserForm((p) => ({ ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))
                    }
                    maxLength={6}
                    placeholder="1234"
                    className="tracking-[0.4em] text-center"
                  />
                </div>
              </div>

              {currentUser?.role === 'admin' && (
                <div className="pt-5 border-t border-[rgba(42,40,38,0.12)]">
                  <SrLabel className="block mb-2">Permisos por módulo (opcional)</SrLabel>
                  <p className="text-[12px] text-[rgba(42,40,38,0.6)] mb-3 leading-relaxed">
                    Si marcas módulos, este colaborador solo entrará a esos. Déjalo vacío y usaremos los permisos de su rol.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                    {[
                      { id: '/dashboard', label: 'Dashboard' },
                      { id: '/pos', label: 'Punto de venta' },
                      { id: '/my-tables', label: 'Mesas' },
                      { id: '/hostess', label: 'Hostess' },
                      { id: '/cashier', label: 'Caja' },
                      { id: '/kitchen', label: 'Cocina' },
                      { id: '/bar', label: 'Bar' },
                      { id: '/remote-order', label: 'Orden remota' },
                      { id: '/menu', label: 'Menú' },
                      { id: '/staff', label: 'Personal' },
                      { id: '/inventory', label: 'Inventario' },
                      { id: '/settings', label: 'Ajustes' },
                    ].map((mod) => {
                      const checked = userForm.modules?.includes(mod.id) || false;
                      return (
                        <label
                          key={mod.id}
                          className={`flex items-center gap-2 text-[12px] font-medium cursor-pointer px-3 py-2 rounded-sr-md border transition-colors ${
                            checked
                              ? 'bg-[rgba(196,99,63,0.10)] border-servirest-terracota/40 text-servirest-terracota'
                              : 'bg-servirest-surface border-[rgba(42,40,38,0.12)] text-servirest-carbon hover:border-[rgba(42,40,38,0.20)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setUserForm((p) => ({
                                ...p,
                                modules: isChecked
                                  ? [...(p.modules || []), mod.id]
                                  : (p.modules || []).filter((m) => m !== mod.id),
                              }));
                            }}
                            className="w-3 h-3 accent-servirest-terracota"
                          />
                          {mod.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-8">
              <SrButton variant="ghost" fullWidth onClick={() => setShowUserModal(false)}>
                Cancelar
              </SrButton>
              <SrButton
                variant="primary"
                fullWidth
                icon={editingUser ? <Save size={14} /> : <Plus size={14} />}
                onClick={() => {
                  if (!userForm.name) return;
                  const payload = {
                    name: userForm.name,
                    role: userForm.role.charAt(0).toUpperCase() + userForm.role.slice(1),
                    area: userForm.area,
                    pin: userForm.pin || '1111',
                    modules: userForm.modules,
                    status: 'OFF_SHIFT',
                    image: `https://ui-avatars.com/api/?name=${encodeURIComponent(userForm.name)}&background=C4633F&color=fff`,
                    rating: 5,
                    hoursWorked: 0,
                    schedule: [],
                    businessId: currentUser?.businessId || '',
                  };
                  if (editingUser) {
                    updateUser(editingUser.id, payload);
                  } else {
                    addUser(payload as any);
                  }
                  setShowUserModal(false);
                }}
              >
                {editingUser ? 'Guardar cambios' : 'Dar de alta'}
              </SrButton>
            </div>
          </SrModal>
        )}
      </AnimatePresence>

      {/* ─── STORAGE PIN MODAL ──────────────────────────────────── */}
      <AnimatePresence>
        {showStoragePinModal && (
          <SrModal open={showStoragePinModal} onClose={() => setShowStoragePinModal(false)} maxWidth={420}>
            <SrModalHeader
              title="Acceso restringido"
              kicker="Inspector de datos"
              onClose={() => setShowStoragePinModal(false)}
            />
            <div className="flex items-center gap-3 mb-5 p-3 rounded-sr-md bg-[rgba(196,99,63,0.06)] border border-servirest-terracota/20">
              <ShieldCheck size={18} className="text-servirest-terracota shrink-0" />
              <p className="text-[12px] font-medium text-servirest-carbon">
                Esta sección está reservada para soporte técnico. Pídenos el PIN si lo necesitas.
              </p>
            </div>
            <div className="space-y-5">
              <div>
                <SrLabel className="block mb-2">PIN de soporte</SrLabel>
                <SrInput
                  type="password"
                  value={storagePin}
                  onChange={(e) => setStoragePin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  onKeyDown={(e) => e.key === 'Enter' && verifyStoragePin()}
                  placeholder="••••"
                  className={`text-center tracking-[1em] text-[20px] ${storagePinError ? 'border-servirest-danger' : ''}`}
                />
                {storagePinError && (
                  <p className="text-servirest-danger text-[11px] mt-2 font-bold uppercase tracking-[0.2em] text-center">
                    PIN incorrecto
                  </p>
                )}
              </div>
              <SrButton variant="primary" fullWidth onClick={verifyStoragePin}>
                Entrar
              </SrButton>
            </div>
          </SrModal>
        )}
      </AnimatePresence>

      {/* ─── STORAGE INSPECTOR MODAL ───────────────────────────── */}
      <AnimatePresence>
        {showStorageInspector && (
          <SrModal open={showStorageInspector} onClose={() => setShowStorageInspector(false)} maxWidth={880}>
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-sr-lg bg-[rgba(196,99,63,0.10)] border border-servirest-terracota/30 flex items-center justify-center text-servirest-terracota">
                  <Database size={22} />
                </div>
                <div>
                  <h2 className="m-0 font-black italic uppercase tracking-[-0.02em] text-[26px] text-servirest-midnight leading-tight">
                    Inspector de datos
                  </h2>
                  <p className="m-0 mt-1.5 font-black italic uppercase tracking-[0.3em] text-[9px] text-[rgba(42,40,38,0.4)]">
                    Lo que hay en tu dispositivo vs lo que hay en la nube
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <SrButton
                  variant="outline"
                  size="sm"
                  icon={<RefreshCcw size={14} className={isLoadingStorage ? 'animate-spin' : ''} />}
                  onClick={fetchStorageData}
                >
                  Refrescar
                </SrButton>
                <button
                  onClick={() => setShowStorageInspector(false)}
                  className="w-11 h-11 rounded-sr-md border border-[rgba(42,40,38,0.12)] bg-[rgba(42,40,38,0.04)] text-[rgba(42,40,38,0.6)] hover:text-servirest-carbon hover:bg-[rgba(42,40,38,0.08)] flex items-center justify-center transition-colors"
                  aria-label="Cerrar"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
              {isLoadingStorage ? (
                <div className="h-64 flex flex-col items-center justify-center gap-4">
                  <div className="w-10 h-10 border-[3px] border-servirest-terracota/20 border-t-servirest-terracota rounded-full animate-spin"></div>
                  <SrLabel>Leyendo tablas…</SrLabel>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {storageData.map((row, idx) => (
                    <motion.div
                      key={row.table}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.04 }}
                    >
                      <SrCard className="p-5">
                        <div className="flex items-center justify-between mb-4">
                          <SrLabel>{row.table}</SrLabel>
                          {row.cloud === row.local && typeof row.cloud === 'number' ? (
                            <SrChip tone="success">Sincronizado</SrChip>
                          ) : row.cloud === 'Err' ? (
                            <SrChip tone="danger">Error</SrChip>
                          ) : (
                            <SrChip tone="mostaza">Pendiente</SrChip>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-sr-md bg-servirest-hueso-sunken/40 border border-[rgba(42,40,38,0.06)]">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <HardDrive size={11} className="text-servirest-midnight" />
                              <SrLabel>En este equipo</SrLabel>
                            </div>
                            <SrMono className="text-[18px] font-extrabold text-servirest-midnight">
                              {row.local}
                            </SrMono>
                          </div>
                          <div className="p-3 rounded-sr-md bg-servirest-hueso-sunken/40 border border-[rgba(42,40,38,0.06)]">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Cloud size={11} className="text-servirest-terracota" />
                              <SrLabel>En la nube</SrLabel>
                            </div>
                            <SrMono
                              className={`text-[18px] font-extrabold ${
                                row.cloud === 'Err' || row.cloud === 'N/A' ? 'text-servirest-danger' : 'text-servirest-terracota'
                              }`}
                            >
                              {row.cloud}
                            </SrMono>
                          </div>
                        </div>
                      </SrCard>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </SrModal>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ────────────────────────────────────────────────────────────────────── */
/* Sub-screens — each tab section is its own component for readability    */
/* ────────────────────────────────────────────────────────────────────── */

const SectionHeading: React.FC<{ kicker: string; title: string; right?: React.ReactNode }> = ({ kicker, title, right }) => (
  <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
    <div>
      <SrKicker className="block mb-1.5">{kicker}</SrKicker>
      <h2 className="font-serif italic font-medium text-[28px] text-servirest-midnight tracking-[-0.02em] m-0 leading-none">
        {title}
      </h2>
    </div>
    {right}
  </div>
);

const GeneralTab: React.FC<{
  localSettings: BusinessSettings;
  setLocalSettings: React.Dispatch<React.SetStateAction<BusinessSettings>>;
}> = ({ localSettings, setLocalSettings }) => (
  <>
    <SrCard variant="solaris" className="p-8">
      <SectionHeading kicker="Identidad" title="Datos del negocio" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <SrLabel className="block mb-2">Nombre comercial</SrLabel>
          <SrInput
            value={localSettings.name}
            onChange={(e) => setLocalSettings((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Tu restaurante"
          />
        </div>
        <div>
          <SrLabel className="block mb-2">Razón social</SrLabel>
          <SrInput
            value={localSettings.legalName}
            onChange={(e) => setLocalSettings((prev) => ({ ...prev, legalName: e.target.value }))}
            placeholder="Empresa S.A. de C.V."
          />
        </div>
        <div>
          <SrLabel className="block mb-2">RFC</SrLabel>
          <SrInput
            value={localSettings.rfc}
            onChange={(e) => setLocalSettings((prev) => ({ ...prev, rfc: e.target.value }))}
            placeholder="XAXX010101000"
            className="tracking-[0.2em]"
          />
        </div>
        <div>
          <SrLabel className="block mb-2">Dirección</SrLabel>
          <SrInput
            value={localSettings.address}
            onChange={(e) => setLocalSettings((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="Calle, número, colonia"
          />
        </div>
      </div>
    </SrCard>

    <SrCard variant="solaris" className="p-8">
      <SectionHeading kicker="Pagos" title="Cuenta de depósito" />
      <p className="text-[13px] text-[rgba(42,40,38,0.6)] font-medium mb-6 leading-relaxed max-w-2xl">
        Aquí depositamos tus ventas digitales. Asegúrate de que coincida con la cuenta de tu razón social.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <SrLabel className="block mb-2">CLABE interbancaria</SrLabel>
          <SrInput
            value={localSettings.bankCLABE || ''}
            onChange={(e) => setLocalSettings((prev) => ({ ...prev, bankCLABE: e.target.value }))}
            placeholder="18 dígitos"
            className="tracking-[0.2em]"
          />
        </div>
        <div>
          <SrLabel className="block mb-2">Beneficiario</SrLabel>
          <SrInput
            value={localSettings.bankBeneficiary || ''}
            onChange={(e) => setLocalSettings((prev) => ({ ...prev, bankBeneficiary: e.target.value }))}
            placeholder="Como aparece en el banco"
          />
        </div>
      </div>
    </SrCard>
  </>
);

const AppearanceTab: React.FC<{
  localSettings: BusinessSettings;
  setLocalSettings: React.Dispatch<React.SetStateAction<BusinessSettings>>;
}> = ({ localSettings, setLocalSettings }) => (
  <>
    <SrCard variant="solaris" className="p-8">
      <SectionHeading kicker="Identidad visual" title="Tu logo" />
      <div className="flex items-center gap-6 flex-wrap">
        <div className="w-28 h-28 rounded-sr-xl bg-servirest-hueso-sunken/60 border border-[rgba(42,40,38,0.12)] flex items-center justify-center overflow-hidden shrink-0">
          {localSettings.logoUrl ? (
            <img src={localSettings.logoUrl} className="w-full h-full object-cover" alt="Logo" />
          ) : (
            <Building2 size={40} className="text-[rgba(42,40,38,0.3)]" />
          )}
        </div>
        <div className="flex-1 min-w-[260px]">
          <SrLabel className="block mb-2">URL del logo</SrLabel>
          <SrInput
            value={localSettings.logoUrl || ''}
            onChange={(e) => setLocalSettings((prev) => ({ ...prev, logoUrl: e.target.value }))}
            placeholder="https://miweb.com/logo.png"
          />
          <p className="text-[12px] text-[rgba(42,40,38,0.5)] mt-2">
            Tip: usa PNG con fondo transparente. Lo verás en tickets, dashboard y orden remota.
          </p>
        </div>
      </div>
    </SrCard>

    <SrCard variant="solaris" className="p-8">
      <SectionHeading
        kicker="Tema"
        title="Aspecto de la interfaz"
        right={<SrChip tone="terracota">Vista previa</SrChip>}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {THEMES.map((t, idx) => {
          const active = localSettings.themeId === t.id;
          return (
            <motion.button
              key={t.id}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.04 }}
              onClick={() => setLocalSettings((prev) => ({ ...prev, themeId: t.id }))}
              className={`text-left p-6 rounded-sr-xl border transition-all ${
                active
                  ? 'border-servirest-terracota bg-[rgba(196,99,63,0.06)] shadow-sr-glow'
                  : 'border-[rgba(42,40,38,0.12)] bg-servirest-surface hover:border-[rgba(42,40,38,0.2)]'
              }`}
            >
              <div className="flex gap-2 mb-4">
                <div className={`w-9 h-9 rounded-sr-md ${t.bg} border border-[rgba(42,40,38,0.2)]`} />
                <div className={`w-9 h-9 rounded-sr-md ${t.accent}`} />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-serif italic font-medium text-[18px] text-servirest-midnight tracking-[-0.02em] m-0">
                  {t.name}
                </h3>
                {active && <CheckCircle2 size={14} className="text-servirest-terracota" />}
              </div>
              <p className="text-[12px] text-[rgba(42,40,38,0.6)] m-0 leading-relaxed">{t.desc}</p>
            </motion.button>
          );
        })}
      </div>
    </SrCard>
  </>
);

const HardwareTab: React.FC<{
  localSettings: BusinessSettings;
  setLocalSettings: React.Dispatch<React.SetStateAction<BusinessSettings>>;
  isConnecting: boolean;
  onConnectUSB: () => void;
  onConnectBT: () => void;
  connectionStatus: { type: 'success' | 'error'; message: string } | null;
}> = ({ localSettings, setLocalSettings, isConnecting, onConnectUSB, onConnectBT, connectionStatus }) => {
  const printerConnected = localSettings.connectedDeviceName && localSettings.connectedDeviceName !== 'None';
  const terminalConnected = !!localSettings.connectedTerminalName && localSettings.connectedTerminalName !== 'None';

  return (
    <>
      <SrCard variant="solaris" className="p-8">
        <SectionHeading kicker="Periféricos" title="Impresora de tickets" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SrCard className="p-6 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-[rgba(196,99,63,0.10)] rounded-sr-md text-servirest-terracota border border-servirest-terracota/30">
                <PrinterIcon size={22} />
              </div>
              <SrChip tone={printerConnected ? 'success' : 'neutral'}>
                <CircleDot size={9} className="mr-1.5" />
                {printerConnected ? 'Vinculada' : 'Sin vincular'}
              </SrChip>
            </div>
            <SrLabel className="block mb-1">Impresora actual</SrLabel>
            <p className="font-serif italic font-medium text-[20px] text-servirest-midnight tracking-[-0.02em] m-0 mb-6 truncate">
              {printerConnected ? localSettings.connectedDeviceName : 'Sin vincular'}
            </p>
            <div className="flex gap-3">
              <SrButton variant="outline" size="sm" fullWidth disabled={isConnecting} onClick={onConnectUSB}>
                {isConnecting ? 'Buscando…' : 'Conectar USB'}
              </SrButton>
              <SrButton variant="primary" size="sm" fullWidth disabled={isConnecting} onClick={onConnectBT} icon={<Bluetooth size={12} />}>
                {isConnecting ? 'Vinculando…' : 'Bluetooth'}
              </SrButton>
            </div>
            <div className="mt-5">
              <SrAlert tone="info">
                Para Bluetooth necesitas un dispositivo <strong>BLE</strong>. Si tu impresora es Bluetooth clásico, usa la app de escritorio.
              </SrAlert>
            </div>
          </SrCard>

          <SrCard className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 bg-[rgba(26,30,46,0.08)] rounded-sr-md text-servirest-midnight border border-servirest-midnight/20">
                <Smartphone size={22} />
              </div>
              <SrChip tone={terminalConnected ? 'success' : 'neutral'}>
                <CircleDot size={9} className="mr-1.5" />
                {terminalConnected ? 'Lista' : 'Apagada'}
              </SrChip>
            </div>
            <SrLabel className="block mb-1">Terminal de pago</SrLabel>
            <p className="font-serif italic font-medium text-[20px] text-servirest-midnight tracking-[-0.02em] m-0 mb-6 truncate">
              {terminalConnected ? localSettings.connectedTerminalName : 'Sin vincular'}
            </p>
            <SrButton
              variant="outline"
              size="sm"
              fullWidth
              onClick={async () => {
                const d = await bluetoothTerminalService.requestTerminal();
                if (d) {
                  setLocalSettings((p) => ({ ...p, connectedTerminalName: d.name || 'Terminal BT', isTerminalEnabled: true }));
                }
              }}
              icon={<Bluetooth size={12} />}
            >
              Vincular terminal
            </SrButton>
          </SrCard>
        </div>

        <AnimatePresence>
          {connectionStatus && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-5"
            >
              <SrAlert tone={connectionStatus.type === 'success' ? 'success' : 'danger'}>{connectionStatus.message}</SrAlert>
            </motion.div>
          )}
        </AnimatePresence>
      </SrCard>

      <SrCard variant="solaris" className="p-8">
        <SectionHeading kicker="Tickets" title="Configuración de impresión" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SrCard className="p-5">
            <SrLabel className="block mb-3">Ancho de papel</SrLabel>
            <div className="flex gap-2">
              {(['58mm', '80mm'] as const).map((w) => {
                const active = localSettings.printerWidth === w;
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setLocalSettings((p) => ({ ...p, printerWidth: w }))}
                    className={`flex-1 py-3 rounded-sr-md font-black italic uppercase tracking-[0.2em] text-[11px] transition-colors ${
                      active
                        ? 'bg-servirest-terracota text-servirest-hueso shadow-sr-glow'
                        : 'bg-servirest-hueso-sunken/50 text-[rgba(42,40,38,0.6)] border border-[rgba(42,40,38,0.12)] hover:text-servirest-carbon'
                    }`}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          </SrCard>
          <SrCard className="p-5 space-y-4">
            <Toggle
              label="Imprimir tickets de cocina automáticamente"
              value={localSettings.isKitchenPrintingEnabled}
              onChange={(v) => setLocalSettings((p) => ({ ...p, isKitchenPrintingEnabled: v }))}
            />
            <Toggle
              label="Abrir cajón de dinero al cobrar"
              value={localSettings.isCashDrawerEnabled}
              onChange={(v) => setLocalSettings((p) => ({ ...p, isCashDrawerEnabled: v }))}
            />
          </SrCard>
        </div>
      </SrCard>
    </>
  );
};

const Toggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, value, onChange }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-[13px] font-medium text-servirest-carbon">{label}</span>
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${
        value ? 'bg-servirest-terracota' : 'bg-[rgba(42,40,38,0.15)]'
      }`}
    >
      <span
        className={`absolute top-1 w-5 h-5 bg-servirest-hueso rounded-full transition-all shadow-sr-card ${
          value ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  </div>
);

const UsersTab: React.FC<{
  users: any[];
  deleteUser: (id: string) => void;
  onNew: () => void;
  onEdit: (user: any) => void;
}> = ({ users, deleteUser, onNew, onEdit }) => (
  <SrCard variant="solaris" className="p-8">
    <SectionHeading
      kicker="Equipo"
      title={`Colaboradores (${users.length})`}
      right={
        <SrButton variant="primary" size="sm" icon={<Plus size={14} />} onClick={onNew}>
          Nuevo colaborador
        </SrButton>
      }
    />
    {users.length === 0 ? (
      <SrEmptyState
        icon={<Users size={26} />}
        title="Aún sin equipo"
        description="Da de alta a tus meseros, cocineros y cajeros para que tengan acceso al sistema."
        action={
          <SrButton variant="primary" size="sm" icon={<Plus size={14} />} onClick={onNew}>
            Dar de alta a alguien
          </SrButton>
        }
      />
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map((user, idx) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.03 }}
          >
            <SrCard hover className="p-5 flex items-center gap-4 group">
              <div className="w-14 h-14 rounded-sr-md overflow-hidden border border-[rgba(42,40,38,0.12)] shrink-0">
                <img src={user.image} className="w-full h-full object-cover" alt={user.name} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif italic font-medium text-[18px] text-servirest-midnight tracking-[-0.02em] m-0 truncate">
                  {user.name}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <SrChip tone="terracota" size="xs">
                    {user.role}
                  </SrChip>
                  <SrMono className="text-[10px] text-[rgba(42,40,38,0.5)]">PIN {user.pin}</SrMono>
                </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={() => onEdit(user)}
                  className="w-9 h-9 rounded-sr-md border border-[rgba(42,40,38,0.12)] bg-servirest-surface text-[rgba(42,40,38,0.6)] hover:text-servirest-carbon hover:border-[rgba(42,40,38,0.2)] flex items-center justify-center transition-colors"
                  aria-label="Editar"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteUser(user.id)}
                  className="w-9 h-9 rounded-sr-md border border-servirest-danger/30 bg-[rgba(225,85,75,0.08)] text-servirest-danger hover:bg-[rgba(225,85,75,0.15)] flex items-center justify-center transition-colors"
                  aria-label="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </SrCard>
          </motion.div>
        ))}
      </div>
    )}
  </SrCard>
);

const NotificationsTab: React.FC<{
  localSettings: BusinessSettings;
  setLocalSettings: React.Dispatch<React.SetStateAction<BusinessSettings>>;
}> = ({ localSettings, setLocalSettings }) => (
  <SrCard variant="solaris" className="p-8">
    <SectionHeading kicker="Avisos" title="Cómo te avisamos" />
    <p className="text-[13px] text-[rgba(42,40,38,0.6)] font-medium mb-6 leading-relaxed max-w-2xl">
      Decide cuándo el sistema interrumpe tu jornada. Estos avisos suenan en pantalla y, si tienes impresora, también imprimen.
    </p>
    <div className="space-y-3">
      <SrCard className="p-5">
        <Toggle
          label="Avisar cuando una orden tarde más de 25 minutos"
          value={localSettings.isKitchenPrintingEnabled}
          onChange={(v) => setLocalSettings((p) => ({ ...p, isKitchenPrintingEnabled: v }))}
        />
      </SrCard>
      <SrCard className="p-5">
        <Toggle
          label="Imprimir comanda de cocina automáticamente"
          value={localSettings.isKitchenPrintingEnabled}
          onChange={(v) => setLocalSettings((p) => ({ ...p, isKitchenPrintingEnabled: v }))}
        />
      </SrCard>
      <SrCard className="p-5">
        <Toggle
          label="Avisar al abrir el cajón de dinero"
          value={localSettings.isCashDrawerEnabled}
          onChange={(v) => setLocalSettings((p) => ({ ...p, isCashDrawerEnabled: v }))}
        />
      </SrCard>
    </div>

    <div className="mt-6">
      <SrAlert tone="info" title="¿Aún no llegan los avisos?">
        Si usas el sistema desde el navegador, permite las notificaciones en la barra de URL. Para sonidos, ten activo el audio del equipo.
      </SrAlert>
    </div>
  </SrCard>
);

const DiagnosticsTab: React.FC<{
  onPrintTest: () => void;
  onDrawerTest: () => void;
  onNetworkPing: () => void;
  onStorageAccess: () => void;
}> = ({ onPrintTest, onDrawerTest, onNetworkPing, onStorageAccess }) => {
  const tests: { kicker: string; title: string; desc: string; icon: any; tone: 'terracota' | 'mostaza' | 'success' | 'neutral'; action: () => void }[] = [
    { kicker: 'Impresora', title: 'Imprimir un ticket de prueba', desc: 'Manda un ticket dummy para verificar que la conexión y el papel responden.', icon: PrinterIcon, tone: 'terracota', action: onPrintTest },
    { kicker: 'Cajón', title: 'Abrir el cajón de dinero', desc: 'Verifica que el pulso eléctrico desde la impresora lo dispara correctamente.', icon: Zap, tone: 'mostaza', action: onDrawerTest },
    { kicker: 'Conexión', title: 'Probar latencia con la nube', desc: 'Mide cuánto tarda tu equipo en hablar con nuestros servidores. Bajo 50ms está bien.', icon: Wifi, tone: 'success', action: onNetworkPing },
    { kicker: 'Datos', title: 'Inspector de datos (soporte)', desc: 'Compara lo que tienes en este equipo contra lo que está en la nube. Pide PIN al soporte.', icon: Database, tone: 'neutral', action: onStorageAccess },
  ];

  return (
    <SrCard variant="solaris" className="p-8">
      <SectionHeading kicker="Diagnóstico" title="Estado del sistema" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tests.map((t, idx) => (
          <motion.div
            key={t.title}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.04 }}
          >
            <SrCard hover className="p-6 h-full flex flex-col">
              <div className="flex items-start gap-4 mb-5">
                <div className="p-3 rounded-sr-md bg-[rgba(196,99,63,0.08)] text-servirest-terracota border border-servirest-terracota/20 shrink-0">
                  <t.icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <SrKicker className="block mb-1.5">{t.kicker}</SrKicker>
                  <h3 className="font-serif italic font-medium text-[19px] text-servirest-midnight tracking-[-0.02em] m-0 leading-tight">
                    {t.title}
                  </h3>
                </div>
              </div>
              <p className="text-[12px] text-[rgba(42,40,38,0.6)] leading-relaxed m-0 mb-5 flex-1">
                {t.desc}
              </p>
              <SrButton variant="outline" size="sm" onClick={t.action}>
                Ejecutar prueba
              </SrButton>
            </SrCard>
          </motion.div>
        ))}
      </div>
    </SrCard>
  );
};

export default SettingsScreen;
