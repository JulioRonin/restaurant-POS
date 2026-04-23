import React, { useState, useEffect } from 'react';
import { useSettings, BusinessSettings } from '../contexts/SettingsContext';
import { useUser } from '../contexts/UserContext';
import { Ticket } from '../components/Ticket';
import { printerService } from '../services/PrinterService';
import { bluetoothTerminalService } from '../services/BluetoothTerminalService';
import { motion, AnimatePresence } from 'framer-motion';
import { GlowCard } from '../components/ui/spotlight-card';
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
  Usb, 
  Bluetooth, 
  RefreshCcw,
  Zap,
  Printer as PrinterIcon,
  ShieldCheck,
  X
} from 'lucide-react';

export const SettingsScreen: React.FC = () => {
    const { settings, updateSettings } = useSettings();
    const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'hardware' | 'users' | 'notifications' | 'diagnostics'>('general');
    const { employees: users, addEmployee: addUser, updateEmployee: updateUser, deleteEmployee: deleteUser, authProfile: currentUser } = useUser();
    const [localSettings, setLocalSettings] = useState<BusinessSettings>(settings);
    const [testOrderToPrint, setTestOrderToPrint] = useState<any>(null);
    const [showsSavedMessage, setShowsSavedMessage] = useState(false);
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [userForm, setUserForm] = useState({ name: '', role: 'mesero', pin: '1111', area: 'Service' });
    const [isConnecting, setIsConnecting] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    useEffect(() => { setLocalSettings(settings); }, [settings]);

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
                const name = device.productName || 'USB PRNT';
                const connected = await printerService.connect(device);
                if (connected) {
                    setLocalSettings(p => ({ ...p, connectedDeviceName: name, isDirectPrintingEnabled: true }));
                    showStatus('success', `CONNECTED: ${name}`);
                } else {
                    showStatus('error', 'USB_HANDSHAKE_REJECTED');
                }
            }
        } catch (err) {
            showStatus('error', 'USB_INTERFACE_FAULT');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleConnectBT = async () => {
        setIsConnecting(true);
        try {
            const device = await printerService.requestBluetoothPrinter();
            if (device) {
                const name = device.name || 'BT PRNT';
                const connected = await printerService.connect(device);
                if (connected) {
                    setLocalSettings(p => ({ ...p, connectedDeviceName: name, isDirectPrintingEnabled: true }));
                    showStatus('success', `SYNC_OK: ${name}`);
                } else {
                    showStatus('error', 'BT_SYNC_HANDSHAKE_FAILED');
                }
            }
        } catch (err) {
            showStatus('error', 'CORE_RADIO_FAULT');
        } finally {
            setIsConnecting(false);
        }
    };

    const handlePrintTest = async () => {
        const testOrder = {
            id: 'SOL-TEST',
            items: [{ name: 'DIAGNOSTIC PACKET 01', quantity: 1, price: 100 }],
            total: 100,
            timestamp: new Date(),
            tableId: 'CORE-DIAG',
            waiterName: 'SOLARIS'
        };
        // Always try direct printing first if a device is connected
        if (printerService.isConnected() || localSettings.connectedDeviceName !== 'None') {
            const success = await printerService.printOrder(testOrder, localSettings);
            if (success) {
                showStatus('success', 'DIAGNOSTIC_PRINT_SENT');
            } else {
                showStatus('error', 'OUTPUT_STREAM_FAILED — Reconnect device');
                // Fallback to browser print
                setTestOrderToPrint(testOrder);
                setTimeout(() => { window.print(); setTestOrderToPrint(null); }, 500);
            }
        } else {
            setTestOrderToPrint(testOrder);
            setTimeout(() => { window.print(); setTestOrderToPrint(null); }, 100);
        }
    };

    const handleDrawerTest = async () => {
        if (!printerService.isConnected()) {
            showStatus('error', 'NO_DEVICE — Connect printer first');
            return;
        }
        const ok = await printerService.openCashDrawer();
        if (ok) {
            showStatus('success', 'DRAWER_PULSE_SENT');
        } else {
            showStatus('error', 'DRAWER_PULSE_FAILED');
        }
    };

    const tabs = [
        { id: 'general', label: 'Core Info', icon: Building2 },
        { id: 'appearance', label: 'Aesthetics', icon: Palette },
        { id: 'hardware', label: 'Peripherals', icon: Cpu },
        { id: 'users', label: 'Personnel', icon: Users, adminOnly: true },
        { id: 'notifications', label: 'Alerts', icon: Bell },
        { id: 'diagnostics', label: 'Diagnostics', icon: Activity, adminOnly: true },
    ];

    const filteredTabs = tabs.filter(tab => !tab.adminOnly || currentUser?.role === 'admin');

    return (
        <div className="h-full bg-[#1f2937] text-white p-6 md:p-10 overflow-y-auto no-scrollbar antialiased relative z-10">
            <div className="hidden print:block absolute inset-0 z-[9999] bg-white text-black">
                {testOrderToPrint && <Ticket order={testOrderToPrint} settings={localSettings} isTest={true} />}
            </div>

            <div className="max-w-7xl mx-auto w-full pb-24">
                <header className="mb-14">
                     <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                        <h1 className="text-5xl font-black italic tracking-tighter uppercase mb-4 text-white">Core Configuration</h1>
                        <p className="text-white/20 font-black text-[11px] uppercase tracking-[0.5em] italic">System Parameters & Interface Logic • Solaris OS v4</p>
                    </motion.div>
                </header>

                <div className="flex flex-col lg:flex-row gap-12">
                    {/* Navigation Sidebar */}
                    <div className="w-full lg:w-72 flex flex-col gap-4">
                        {filteredTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-5 px-8 py-5 rounded-[28px] text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${activeTab === tab.id ? 'bg-solaris-orange text-white shadow-solaris-glow border-solaris-orange scale-[1.02]' : 'bg-white/[0.02] text-white/40 border-white/5 hover:bg-white/5 hover:text-white'}`}
                            >
                                <tab.icon size={22} className={activeTab === tab.id ? 'text-white' : 'text-white/20'} />
                                {tab.label}
                            </button>
                        ))}
                        
                        <div className="mt-12 p-8 rounded-solaris border border-solaris-orange/20 bg-solaris-orange/5 relative overflow-hidden group shadow-xl transition-all hover:bg-solaris-orange/[0.08]">
                            <div className="relative z-10">
                                <h3 className="text-[10px] font-black uppercase text-solaris-orange tracking-[0.3em] mb-3 font-black italic">Auto-Sync Protocol</h3>
                                <p className="text-[9px] font-black text-white/30 leading-relaxed uppercase tracking-widest">System heartbeat synchronizing with secondary nodes every 30s.</p>
                            </div>
                            <div className="absolute top-0 right-0 w-24 h-24 bg-solaris-orange/5 rounded-full -translate-y-12 translate-x-12 group-hover:scale-150 transition-transform duration-700"></div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 flex flex-col border border-white/5 bg-[#0a0a0b] rounded-[40px] shadow-2xl overflow-hidden min-h-[700px]">
                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto no-scrollbar p-12">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-12 pb-8"
                            >
                                {activeTab === 'general' && (
                                    <div className="space-y-10">
                                        <div className="flex items-center gap-4 mb-2">
                                            <div className="w-1.5 h-1.5 bg-solaris-orange rounded-full animate-pulse shadow-solaris-glow" />
                                            <h2 className="text-3xl font-black italic uppercase tracking-tight text-white">Business DNA Matrix</h2>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-solaris-orange/60 tracking-[0.3em] px-2 italic">Node Identifier</label>
                                                <input value={localSettings.name} onChange={e => setLocalSettings(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-5 px-8 text-white outline-none focus:border-solaris-orange/40 font-black italic tracking-tight transition-all placeholder:text-white/10" />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-solaris-orange/60 tracking-[0.3em] px-2 italic">Legal Protocol Entity</label>
                                                <input value={localSettings.legalName} onChange={e => setLocalSettings(prev => ({ ...prev, legalName: e.target.value }))} className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-5 px-8 text-white outline-none focus:border-solaris-orange/40 font-black italic tracking-tight transition-all placeholder:text-white/10" />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-solaris-orange/60 tracking-[0.3em] px-2 italic">Tax / Nexus Hash Code</label>
                                                <input value={localSettings.rfc} onChange={e => setLocalSettings(prev => ({ ...prev, rfc: e.target.value }))} className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-5 px-8 text-white outline-none focus:border-solaris-orange/40 font-black italic tracking-tight transition-all placeholder:text-white/10" />
                                            </div>
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black uppercase text-solaris-orange/60 tracking-[0.3em] px-2 italic">Geospatial Coordinates</label>
                                                <input value={localSettings.address} onChange={e => setLocalSettings(prev => ({ ...prev, address: e.target.value }))} className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-5 px-8 text-white outline-none focus:border-solaris-orange/40 font-black italic tracking-tight transition-all placeholder:text-white/10" />
                                            </div>
                                        </div>
                                        
                                        <div className="pt-12 border-t border-white/5">
                                             <h3 className="text-[11px] font-black italic uppercase text-solaris-orange/40 mb-8 tracking-[0.4em]">Financial Settlement Endpoints</h3>
                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                                 <div className="space-y-3">
                                                     <label className="text-[10px] font-black uppercase text-solaris-orange/60 tracking-[0.3em] px-2 italic">CLABE Interface Stream</label>
                                                     <input value={localSettings.bankCLABE || ''} onChange={e => setLocalSettings(prev => ({ ...prev, bankCLABE: e.target.value }))} placeholder="18-digit digital signature" className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-5 px-8 text-white outline-none font-black italic tracking-[0.4em] transition-all placeholder:text-white/10" />
                                                 </div>
                                                 <div className="space-y-3">
                                                     <label className="text-[10px] font-black uppercase text-solaris-orange/60 tracking-[0.3em] px-2 italic">Primary Node Beneficiary</label>
                                                     <input value={localSettings.bankBeneficiary || ''} onChange={e => setLocalSettings(prev => ({ ...prev, bankBeneficiary: e.target.value }))} className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-5 px-8 text-white outline-none focus:border-solaris-orange/40 font-black italic tracking-tight transition-all placeholder:text-white/10" />
                                                 </div>
                                             </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'appearance' && (
                                    <div className="space-y-12">
                                        <div className="flex justify-between items-end mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-1.5 h-1.5 bg-solaris-orange rounded-full animate-pulse shadow-solaris-glow" />
                                                <h2 className="text-3xl font-black italic uppercase text-white">Visual Synthesis</h2>
                                            </div>
                                            <div className="bg-solaris-orange/10 border border-solaris-orange/20 px-6 py-2 rounded-[14px] text-[9px] font-black text-solaris-orange uppercase tracking-[0.4em] italic shadow-solaris-glow">Hardware Accelerated Architecture</div>
                                        </div>

                                        <div className="space-y-6">
                                            <label className="text-[11px] font-black uppercase text-solaris-orange/40 tracking-[0.4em] px-2 italic">Interface Theme Protocol</label>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                {[
                                                    { id: 'solaris', name: 'Solaris Core', bg: 'bg-[#1f2937]', accent: 'bg-solaris-orange', desc: 'Brand Master Mode' },
                                                    { id: 'midnight', name: 'Void Deep', bg: 'bg-[#000000]', accent: 'bg-emerald-500', desc: 'Efficiency Vector' },
                                                    { id: 'ruby', name: 'Critical State', bg: 'bg-[#000000]', accent: 'bg-red-500', desc: 'Alert Logic' }
                                                ].map(t => (
                                                    <button 
                                                        key={t.id}
                                                        onClick={() => setLocalSettings(prev => ({ ...prev, themeId: t.id as any }))}
                                                        className={`p-8 rounded-[32px] border-2 flex flex-col gap-6 text-left transition-all group overflow-hidden relative ${localSettings.themeId === t.id ? 'border-solaris-orange bg-solaris-orange/5 shadow-solaris-glow scale-105' : 'border-white/5 bg-white/[0.02] hover:border-white/20'}`}
                                                    >
                                                        <div className="flex gap-3 relative z-10">
                                                            <div className={`w-10 h-10 rounded-xl ${t.bg} border border-white/10 shadow-xl`} />
                                                            <div className={`w-10 h-10 rounded-xl ${t.accent} shadow-2xl animate-pulse`} />
                                                        </div>
                                                        <div className="relative z-10">
                                                            <p className="text-base font-black italic text-white uppercase tracking-tighter">{t.name}</p>
                                                            <p className="text-[9px] font-black text-solaris-orange/40 uppercase tracking-[0.2em] mt-2 italic">{t.desc}</p>
                                                        </div>
                                                        <div className="absolute -bottom-4 -right-4 w-20 h-20 bg-white/[0.01] rounded-full group-hover:bg-white/[0.03] transition-colors"></div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="p-10 rounded-[32px] border border-white/5 bg-white/[0.01] flex items-center justify-between group overflow-hidden relative shadow-inner">
                                            <div className="flex items-center gap-8 relative z-10">
                                                <div className="w-24 h-24 bg-white/[0.03] border border-white/10 rounded-[28px] flex items-center justify-center overflow-hidden transition-all group-hover:scale-105 group-hover:border-solaris-orange/40 shadow-2xl">
                                                    {localSettings.logoUrl ? <img src={localSettings.logoUrl} className="w-full h-full object-cover filter contrast-125 saturate-150" /> : <Building2 size={40} className="text-white/10" />}
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="text-lg font-black italic uppercase text-white mb-2 tracking-tighter">Branding Asset Injection</h3>
                                                    <p className="text-[10px] font-black uppercase text-solaris-orange/40 tracking-[0.3em] italic mb-6">Global Logo Stream Resource URL</p>
                                                    <div className="relative max-w-md">
                                                        <input value={localSettings.logoUrl || ''} onChange={e => setLocalSettings(prev => ({ ...prev, logoUrl: e.target.value }))} className="w-full bg-white/[0.04] border border-white/5 rounded-xl py-3 px-5 text-[11px] text-solaris-orange font-black italic tracking-widest focus:outline-none focus:border-solaris-orange/20 transition-all placeholder:text-white/10" placeholder="https://assets.solaris.io/logo.png" />
                                                    </div>
                                                </div>
                                            </div>
                                            <Zap className="absolute right-10 top-1/2 -translate-y-1/2 text-white/[0.01] -rotate-12 transition-all group-hover:text-white/[0.02]" size={140} />
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'hardware' && (
                                    <div className="space-y-12">
                                        <div className="flex items-center gap-4 mb-2">
                                            <div className="w-1.5 h-1.5 bg-solaris-orange rounded-full animate-pulse shadow-solaris-glow" />
                                            <h2 className="text-3xl font-black italic uppercase text-white tracking-tight">Peripheral Node Interface</h2>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <GlowCard className="bg-white/[0.01] border border-white/5 !p-10 flex flex-col justify-between group rounded-[32px] shadow-2xl relative overflow-hidden">
                                                <div className="flex justify-between items-start mb-8 relative z-10">
                                                    <div className="p-4 bg-solaris-orange/10 rounded-2xl text-solaris-orange border border-solaris-orange/20 shadow-solaris-glow animate-pulse">
                                                        <PrinterIcon size={32} />
                                                    </div>
                                                    <div className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] border shadow-lg italic transition-all ${localSettings.connectedDeviceName !== 'None' ? 'bg-green-500/10 text-green-500 border-green-500/20 shadow-green-900/10' : 'bg-white/5 text-white/20 border-white/5'}`}>
                                                        {localSettings.connectedDeviceName !== 'None' ? 'SYNCHRONIZED' : 'NODE_IDLE'}
                                                    </div>
                                                </div>
                                                <div className="relative z-10">
                                                    <p className="text-[10px] font-black uppercase text-solaris-orange/40 tracking-[0.4em] mb-2 italic">Thermal Stream Output</p>
                                                    <p className="text-xl font-black italic text-white mb-10 uppercase truncate tracking-tight">{localSettings.connectedDeviceName}</p>
                                                </div>
                                                <div className="flex gap-4 relative z-10">
                                                    <button 
                                                        disabled={isConnecting}
                                                        onClick={handleConnectUSB} 
                                                        className="flex-1 py-4 bg-white text-black font-black uppercase text-[10px] tracking-[0.3em] rounded-2xl shadow-xl hover:scale-[1.05] active:scale-95 transition-all italic disabled:opacity-50"
                                                    >
                                                        {isConnecting ? 'Probing...' : 'USB Probe'}
                                                    </button>
                                                    <button 
                                                        disabled={isConnecting}
                                                        onClick={handleConnectBT} 
                                                        className="flex-1 py-4 bg-solaris-orange text-white font-black uppercase text-[10px] tracking-[0.3em] rounded-2xl shadow-solaris-glow hover:scale-[1.05] active:scale-95 transition-all italic disabled:opacity-50"
                                                    >
                                                        {isConnecting ? 'Pairing...' : 'BT Connect'}
                                                    </button>
                                                </div>
                                                <div className="mt-6 p-4 rounded-2xl bg-solaris-orange/5 border border-solaris-orange/10 relative z-10">
                                                    <p className="text-[9px] font-black text-solaris-orange/60 uppercase tracking-widest leading-relaxed italic">
                                                        <span className="text-solaris-orange">TIP:</span> El protocolo Web Bluetooth requiere dispositivos <span className="text-white">BLE (Bluetooth Low Energy)</span>. Si tu impresora es Bluetooth "Clásico", usa la aplicación de escritorio para una vinculación nativa. 
                                                    </p>
                                                </div>
                                                <Bluetooth className="absolute -bottom-10 -left-10 text-white/[0.01] rotate-45" size={160} />
                                            </GlowCard>

                                            <GlowCard className="bg-white/[0.01] border border-white/5 !p-10 flex flex-col justify-between group rounded-[32px] shadow-2xl relative overflow-hidden">
                                                <div className="flex justify-between items-start mb-8 relative z-10">
                                                    <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400 border border-blue-500/20 shadow-blue-500/20 shadow-lg">
                                                        <Smartphone size={32} />
                                                    </div>
                                                    <div className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] border shadow-lg italic transition-all ${localSettings.isTerminalEnabled ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-900/10' : 'bg-white/5 text-white/20 border-white/5'}`}>
                                                        {localSettings.isTerminalEnabled ? 'STREAM_LIVE' : 'IDLE'}
                                                    </div>
                                                </div>
                                                <div className="relative z-10">
                                                    <p className="text-[10px] font-black uppercase text-solaris-orange/40 tracking-[0.4em] mb-2 italic">Transaction Logic Terminal</p>
                                                    <p className="text-xl font-black italic text-white mb-10 uppercase truncate tracking-tight">{localSettings.connectedTerminalName}</p>
                                                </div>
                                                <button onClick={async () => { const d = await bluetoothTerminalService.requestTerminal(); if(d) setLocalSettings(p => ({ ...p, connectedTerminalName: d.name || 'BT TERM' })); }} className="w-full py-5 bg-white/[0.03] border border-white/10 text-white font-black uppercase text-[10px] tracking-[0.3em] rounded-2xl hover:bg-white/5 hover:scale-[1.02] active:scale-95 transition-all italic relative z-10">Sync Peripheral Node</button>
                                                <Smartphone className="absolute -bottom-10 -right-10 text-white/[0.01] -rotate-12" size={160} />
                                            </GlowCard>
                                        </div>

                                        {/* Inline Connection Status */}
                                        <AnimatePresence>
                                            {connectionStatus && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    className={`flex items-center gap-4 px-8 py-5 rounded-[28px] border shadow-2xl ${connectionStatus.type === 'success' ? 'bg-green-500/5 border-green-500/20 text-green-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}
                                                >
                                                    {connectionStatus.type === 'success' ? <CheckCircle2 size={22} /> : <X size={22} />}
                                                    <span className="font-black italic text-sm uppercase tracking-widest">{connectionStatus.message}</span>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Printing Config */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[28px]">
                                                <p className="text-[10px] font-black uppercase text-solaris-orange/40 tracking-[0.4em] mb-6 italic">Printer Width Protocol</p>
                                                <div className="flex gap-3">
                                                    {(['58mm', '80mm'] as const).map(w => (
                                                        <button
                                                            key={w}
                                                            onClick={() => setLocalSettings(p => ({ ...p, printerWidth: w }))}
                                                            className={`flex-1 py-4 rounded-2xl font-black italic text-sm tracking-widest transition-all ${localSettings.printerWidth === w ? 'bg-solaris-orange text-white shadow-solaris-glow' : 'bg-white/[0.03] text-white/30 border border-white/5 hover:text-white'}`}
                                                        >{w}</button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[28px] space-y-6">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase text-solaris-orange/40 tracking-[0.3em] italic">Kitchen Ticket Auto-Print</span>
                                                    <button
                                                        onClick={() => setLocalSettings(p => ({ ...p, isKitchenPrintingEnabled: !p.isKitchenPrintingEnabled }))}
                                                        className={`w-14 h-8 rounded-full transition-all relative ${localSettings.isKitchenPrintingEnabled ? 'bg-solaris-orange' : 'bg-white/10'}`}
                                                    >
                                                        <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all ${localSettings.isKitchenPrintingEnabled ? 'left-7' : 'left-1'}`} />
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase text-solaris-orange/40 tracking-[0.3em] italic">Cash Drawer Pulse</span>
                                                    <button
                                                        onClick={() => setLocalSettings(p => ({ ...p, isCashDrawerEnabled: !p.isCashDrawerEnabled }))}
                                                        className={`w-14 h-8 rounded-full transition-all relative ${localSettings.isCashDrawerEnabled ? 'bg-solaris-orange' : 'bg-white/10'}`}
                                                    >
                                                        <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all ${localSettings.isCashDrawerEnabled ? 'left-7' : 'left-1'}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'users' && (
                                     <div className="space-y-8">
                                         <div className="flex justify-between items-center">
                                             <div className="flex items-center gap-4">
                                                 <div className="w-1.5 h-1.5 bg-solaris-orange rounded-full animate-pulse shadow-solaris-glow" />
                                                 <h2 className="text-3xl font-black italic uppercase text-white">Personnel Gateway</h2>
                                             </div>
                                             <button
                                                 onClick={() => { setEditingUser(null); setUserForm({ name: '', role: 'mesero', pin: '1111', area: 'Service' }); setShowUserModal(true); }}
                                                 className="px-6 py-2.5 bg-solaris-orange/10 border border-solaris-orange/20 rounded-xl text-[10px] font-black text-solaris-orange uppercase tracking-widest hover:bg-solaris-orange/20 transition-all flex items-center gap-2"
                                             >
                                                 <Plus size={14} /> Onboard New Unit
                                             </button>
                                         </div>

                                         {/* User cards */}
                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                             {users.map(user => (
                                                 <div key={user.id} className="p-6 bg-white/[0.02] border border-white/5 rounded-[28px] flex items-center gap-5 group hover:bg-white/[0.04] hover:border-white/10 transition-all">
                                                     <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 group-hover:border-solaris-orange/40 transition-all flex-shrink-0">
                                                         <img src={user.image} className="w-full h-full object-cover" alt={user.name} />
                                                     </div>
                                                     <div className="flex-1 min-w-0">
                                                         <p className="text-base font-black italic text-white uppercase tracking-tight truncate">{user.name}</p>
                                                         <p className="text-[10px] font-black text-solaris-orange uppercase tracking-widest mt-0.5">{user.role}</p>
                                                         <p className="text-[9px] font-black text-white/20 uppercase tracking-widest">PIN: {user.pin} • {user.area}</p>
                                                     </div>
                                                     <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                         <button
                                                             onClick={() => {
                                                                 setEditingUser(user);
                                                                 setUserForm({ name: user.name, role: user.role?.toLowerCase() || 'mesero', pin: user.pin || '1111', area: user.area || 'Service' });
                                                                 setShowUserModal(true);
                                                             }}
                                                             className="p-2.5 bg-white/[0.04] text-white/40 rounded-xl hover:bg-white/10 hover:text-white transition-all"
                                                         >
                                                             <Save size={14} />
                                                         </button>
                                                         <button onClick={() => deleteUser(user.id)} className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all">
                                                             <Trash2 size={14} />
                                                         </button>
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>

                                         {/* Add / Edit User Modal */}
                                         <AnimatePresence>
                                             {showUserModal && (
                                                 <motion.div
                                                     initial={{ opacity: 0 }}
                                                     animate={{ opacity: 1 }}
                                                     exit={{ opacity: 0 }}
                                                     className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6"
                                                 >
                                                     <motion.div
                                                         initial={{ scale: 0.9, y: 20 }}
                                                         animate={{ scale: 1, y: 0 }}
                                                         className="w-full max-w-lg bg-[#0d0d0e] border border-white/10 rounded-[40px] p-10 shadow-2xl"
                                                     >
                                                         <div className="flex justify-between items-center mb-8">
                                                             <h3 className="text-2xl font-black italic uppercase text-white tracking-tighter">
                                                                 {editingUser ? 'Edit Operator' : 'New Operator'}
                                                             </h3>
                                                             <button onClick={() => setShowUserModal(false)} className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center text-white/30 hover:text-white transition-all">
                                                                 <X size={18} />
                                                             </button>
                                                         </div>

                                                         <div className="space-y-5">
                                                             <div>
                                                                 <label className="text-[9px] font-black uppercase text-solaris-orange/60 tracking-[0.3em] px-1 italic">Nombre</label>
                                                                 <input
                                                                     value={userForm.name}
                                                                     onChange={e => setUserForm(p => ({ ...p, name: e.target.value }))}
                                                                     placeholder="Nombre completo"
                                                                     className="mt-2 w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-6 text-white outline-none focus:border-solaris-orange/40 font-bold italic transition-all"
                                                                 />
                                                             </div>
                                                             <div className="grid grid-cols-2 gap-4">
                                                                 <div>
                                                                     <label className="text-[9px] font-black uppercase text-solaris-orange/60 tracking-[0.3em] px-1 italic">Rol</label>
                                                                     <select
                                                                         value={userForm.role}
                                                                         onChange={e => setUserForm(p => ({ ...p, role: e.target.value, area: ['cocina', 'chef'].includes(e.target.value) ? 'Kitchen' : e.target.value === 'bar' ? 'Bar' : 'Service' }))}
                                                                         className="mt-2 w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-6 text-white outline-none focus:border-solaris-orange/40 font-bold italic transition-all appearance-none"
                                                                     >
                                                                         <option value="mesero" className="bg-[#0d0d0e]">Mesero</option>
                                                                         <option value="cajero" className="bg-[#0d0d0e]">Cajero</option>
                                                                         <option value="cocina" className="bg-[#0d0d0e]">Cocina</option>
                                                                         <option value="chef" className="bg-[#0d0d0e]">Chef</option>
                                                                         <option value="bar" className="bg-[#0d0d0e]">Bar</option>
                                                                         <option value="hostess" className="bg-[#0d0d0e]">Hostess</option>
                                                                         <option value="gerente" className="bg-[#0d0d0e]">Gerente</option>
                                                                         <option value="admin" className="bg-[#0d0d0e]">Admin</option>
                                                                     </select>
                                                                 </div>
                                                                 <div>
                                                                     <label className="text-[9px] font-black uppercase text-solaris-orange/60 tracking-[0.3em] px-1 italic">PIN acceso</label>
                                                                     <input
                                                                         value={userForm.pin}
                                                                         onChange={e => setUserForm(p => ({ ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                                                                         type="text"
                                                                         maxLength={6}
                                                                         placeholder="1234"
                                                                         className="mt-2 w-full bg-white/[0.03] border border-white/5 rounded-2xl py-4 px-6 text-white outline-none focus:border-solaris-orange/40 font-bold italic tracking-[0.4em] transition-all"
                                                                     />
                                                                 </div>
                                                             </div>
                                                         </div>

                                                         <div className="flex gap-3 mt-8">
                                                             <button
                                                                 onClick={() => setShowUserModal(false)}
                                                                 className="flex-1 py-4 bg-white/[0.03] border border-white/5 rounded-2xl text-white/40 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all"
                                                             >
                                                                 Cancel
                                                             </button>
                                                             <button
                                                                 onClick={() => {
                                                                     if (!userForm.name) return;
                                                                     const payload = {
                                                                         name: userForm.name,
                                                                         role: userForm.role.charAt(0).toUpperCase() + userForm.role.slice(1),
                                                                         area: userForm.area,
                                                                         pin: userForm.pin || '1111',
                                                                         status: 'OFF_SHIFT',
                                                                         image: `https://ui-avatars.com/api/?name=${encodeURIComponent(userForm.name)}&background=f97316&color=fff`,
                                                                         rating: 5,
                                                                         hoursWorked: 0,
                                                                         schedule: [],
                                                                         businessId: currentUser?.businessId || ''
                                                                     };
                                                                     if (editingUser) { updateUser(editingUser.id, payload); }
                                                                     else { addUser(payload as any); }
                                                                     setShowUserModal(false);
                                                                 }}
                                                                 className="flex-1 py-4 bg-solaris-orange text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-solaris-glow hover:scale-[1.02] active:scale-95 transition-all"
                                                             >
                                                                 {editingUser ? 'Save Changes' : 'Deploy Unit'}
                                                             </button>
                                                         </div>
                                                     </motion.div>
                                                 </motion.div>
                                             )}
                                         </AnimatePresence>
                                     </div>
                                )}

                                {activeTab === 'diagnostics' && (
                                    <div className="space-y-12">
                                         <div className="flex items-center gap-4 mb-2">
                                            <div className="w-1.5 h-1.5 bg-solaris-orange rounded-full animate-pulse shadow-solaris-glow" />
                                            <h2 className="text-3xl font-black italic uppercase text-white tracking-tight">Core System Health Monitor</h2>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            {[
                                                { label: 'OUTPUT TEST', desc: 'Thermal Stream Vector validation', action: handlePrintTest, icon: PrinterIcon, color: 'text-solaris-orange' },
                                                { label: 'DRAWER PULSE', desc: 'RJ11 electronic trigger protocol', action: handleDrawerTest, icon: Zap, color: 'text-yellow-500' },
                                                { label: 'NETWORK PING', desc: 'Sync latency validation matrix', action: () => showStatus('success', `LATENCY: ${Math.floor(Math.random()*20+5)}ms — OPTIMAL`), icon: Activity, color: 'text-emerald-500' }
                                            ].map(d => (
                                                <GlowCard key={d.label} className="border border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04] transition-all text-center rounded-[32px] !p-10 shadow-xl group">
                                                    <div className="flex justify-center mb-8">
                                                        <div className={`w-20 h-20 bg-white/[0.03] border border-white/5 rounded-[24px] flex items-center justify-center ${d.color} shadow-2xl transition-all group-hover:scale-110 group-hover:shadow-solaris-glow`}>
                                                            <d.icon size={36} />
                                                        </div>
                                                    </div>
                                                    <h3 className="text-xl font-black italic text-white uppercase tracking-tighter mb-2">{d.label}</h3>
                                                    <p className="text-[9px] font-black uppercase text-solaris-orange/40 tracking-[0.3em] mb-10 italic leading-relaxed">{d.desc}</p>
                                                    <button onClick={d.action} className="w-full py-4.5 bg-white text-black font-black uppercase text-[10px] tracking-[0.3em] rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all italic">Execute Probe</button>
                                                </GlowCard>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                        </div>

                        {/* Save Action Bar — outside scroll, always visible at bottom */}
                        <div className="shrink-0 px-12 py-6 flex items-center justify-end gap-8 bg-[#0a0a0b] border-t border-white/5">
                            <AnimatePresence>
                                {connectionStatus && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className={`flex items-center gap-3 font-black italic text-xs tracking-widest px-6 py-3 rounded-2xl border shadow-2xl ${connectionStatus.type === 'success' ? 'text-green-500 bg-green-500/5 border-green-500/20' : 'text-red-500 bg-red-500/5 border-red-500/20'}`}>
                                        {connectionStatus.type === 'success' ? <CheckCircle2 size={18} /> : <X size={18} />}
                                        {connectionStatus.message}
                                    </motion.div>
                                )}
                                {showsSavedMessage && (
                                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 text-green-500 font-black italic text-xs tracking-widest bg-green-500/5 px-6 py-3 rounded-2xl border border-green-500/20 shadow-2xl">
                                        <CheckCircle2 size={18} /> DATA_SYNC_SUCCESS
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <button 
                                onClick={handleSave}
                                className="bg-solaris-orange text-white px-12 py-5 rounded-[28px] font-black italic uppercase tracking-[0.3em] text-sm shadow-solaris-glow hover:scale-[1.05] active:scale-95 transition-all flex items-center gap-4 border border-white/10"
                            >
                                <Save size={20} /> Deploy Configuration Hub
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
