import React, { useState, useEffect } from 'react';
import { useSettings, BusinessSettings } from '../contexts/SettingsContext';
import { useUser } from '../contexts/UserContext';
import { Ticket } from '../components/Ticket';
import { OrderStatus } from '../types';
import { printerService } from '../services/PrinterService';
import { bluetoothTerminalService } from '../services/BluetoothTerminalService';

export const SettingsScreen: React.FC = () => {
    const { settings, updateSettings } = useSettings();
    const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'hardware' | 'users' | 'notifications'>('general');
    const [virtualMode, setVirtualMode] = useState<boolean>(false);
    const [hardwareStatus, setHardwareStatus] = useState({
        printer: settings.connectedDeviceName && settings.connectedDeviceName !== 'None' ? 'connected' : 'disconnected',
        scanner: 'disconnected',
        drawer: settings.isCashDrawerEnabled ? 'connected' : 'disconnected',
        terminal: settings.connectedTerminalName && settings.connectedTerminalName !== 'None' ? 'connected' : 'disconnected'
    });

    // Wizard State
    const [showWizard, setShowWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState(1); // 1: Welcome, 2: Printer, 3: Scanner, 4: Terminal, 5: Success
    const [wizardConfig, setWizardConfig] = useState({
        pairingCode: '',
        isConnecting: false,
        error: null as string | null
    });

    const { employees: users, addEmployee: addUser, updateEmployee: updateUser, deleteEmployee: deleteUser, authProfile: currentUser } = useUser();
    const [localSettings, setLocalSettings] = useState<BusinessSettings>(settings);
    const [testOrderToPrint, setTestOrderToPrint] = useState<any>(null);
    const [showsSavedMessage, setShowsSavedMessage] = useState(false);

    // User Management State
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [newUserForm, setNewUserForm] = useState({
        name: '',
        role: 'Mesero',
        area: 'Service' as any,
        status: 'ON_SHIFT' as any,
        pin: '1111',
        image: 'https://i.pravatar.cc/150?u=' + Math.random()
    });

    // Sync local state when global settings change (e.g., first load)
    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handlePrintTest = async () => {
        const testOrder = {
            id: 'TEST-123',
            items: [
                { name: 'PRODUCTO DE PRUEBA 1', quantity: 1, price: 100 },
                { name: 'PRODUCTO DE PRUEBA 2', quantity: 2, price: 50 },
            ],
            total: 200,
            timestamp: new Date(),
            tableId: 'PRUEBA',
            waiterName: 'SISTEMA'
        };

        if (localSettings.isDirectPrintingEnabled) {
            const success = await printerService.printOrder(testOrder, localSettings);
            if (success) return;
        }

        setTestOrderToPrint(testOrder);
        setTimeout(() => {
            window.print();
            setTestOrderToPrint(null);
        }, 100);
    };

    const handleSave = () => {
        updateSettings(localSettings);
        setShowsSavedMessage(true);
        setTimeout(() => setShowsSavedMessage(false), 3000);
    };

    const handleConnectUSB = async () => {
        const device = await printerService.requestPrinter();
        if (device) {
            const success = await printerService.connect(device);
            if (success) {
                setLocalSettings(prev => ({
                    ...prev,
                    connectedDeviceName: device.productName || 'Unknown Printer',
                    isDirectPrintingEnabled: true
                }));
                // We don't call updateSettings here yet, user has to Save
                setHardwareStatus(prev => ({ ...prev, printer: 'connected' }));
            }
        }
    };

    const handleDisconnectUSB = async () => {
        await printerService.disconnect();
        setLocalSettings(prev => ({
            ...prev,
            connectedDeviceName: 'None',
            isDirectPrintingEnabled: false
        }));
        setHardwareStatus(prev => ({ ...prev, printer: 'disconnected' }));
    };

    const handleConnectTerminal = async () => {
        const device = await bluetoothTerminalService.requestTerminal();
        if (device) {
            setHardwareStatus(prev => ({ ...prev, terminal: 'connecting' }));
            const success = await bluetoothTerminalService.connect(device);
            if (success) {
                setLocalSettings(prev => ({
                    ...prev,
                    connectedTerminalName: device.name || 'Bluetooth Terminal',
                    isTerminalEnabled: true
                }));
                setHardwareStatus(prev => ({ ...prev, terminal: 'connected' }));
            } else {
                setHardwareStatus(prev => ({ ...prev, terminal: 'disconnected' }));
            }
        }
    };

    const handleDisconnectTerminal = () => {
        setLocalSettings(prev => ({
            ...prev,
            connectedTerminalName: 'None',
            isTerminalEnabled: false
        }));
        setHardwareStatus(prev => ({ ...prev, terminal: 'disconnected' }));
    };

    const toggleHardwareConnection = (device: keyof typeof hardwareStatus) => {
        if (device === 'terminal') {
            if (hardwareStatus.terminal === 'connected') {
                handleDisconnectTerminal();
            } else {
                handleConnectTerminal();
            }
            return;
        }

        // Simulate connection delay
        if (hardwareStatus[device] !== 'connected') {
            setTimeout(() => {
                setHardwareStatus(prev => ({ ...prev, [device]: 'connected' }));
            }, 1500);
        }
    };

    const runWizardDeviceConnection = (device: keyof typeof hardwareStatus) => {
        setWizardConfig(prev => ({ ...prev, isConnecting: true, error: '' }));

        // Simulate Search/Handshake
        setTimeout(() => {
            setHardwareStatus(prev => ({ ...prev, [device]: 'connected' }));
            setWizardConfig(prev => ({ ...prev, isConnecting: false }));
            setWizardStep(prev => prev + 1);
        }, 2000);
    };

    const handleTerminalPairing = () => {
        if (wizardConfig.pairingCode.length < 6) {
            setWizardConfig(prev => ({ ...prev, error: 'Enter a valid 6-digit pairing code' }));
            return;
        }

        setWizardConfig(prev => ({ ...prev, isConnecting: true, error: '' }));

        // Simulate Terminal Protocol Handshake
        setTimeout(() => {
            setHardwareStatus(prev => ({ ...prev, terminal: 'connected' }));
            setWizardConfig(prev => ({ ...prev, isConnecting: false }));
            setWizardStep(prev => prev + 1);
        }, 3000);
    };

    const tabs = [
        { id: 'general', label: 'General', icon: 'store' },
        { id: 'appearance', label: 'Appearance', icon: 'palette' },
        { id: 'hardware', label: 'Hardware & Devices', icon: 'devices' },
        { id: 'users', label: 'Users & Roles', icon: 'manage_accounts', adminOnly: true },
        { id: 'notifications', label: 'Notifications', icon: 'notifications' },
        { id: 'diagnostics', label: 'Diagnostico Pro', icon: 'health_and_safety', adminOnly: true },
    ];

    const filteredTabs = tabs.filter(tab => {
        if (!tab.adminOnly) return true;
        const role = currentUser?.role?.toLowerCase();
        // Solo el dueño (admin) puede gestionar usuarios y roles
        return role === 'admin' || role === 'owner';
    });

    return (
        <div className="flex-1 bg-[#F3F4F6] text-gray-800 p-8 overflow-y-auto h-full relative">
            {/* Hidden Ticket for Test Printing */}
            <div className="hidden print:block absolute inset-0 z-[9999] bg-white">
                {testOrderToPrint && <Ticket order={testOrderToPrint} settings={localSettings} isTest={true} />}
            </div>

            <div className="max-w-5xl mx-auto print:hidden">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                    <p className="text-gray-500 text-sm">Manage preferences, devices, and system configurations</p>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar Navigation */}
                    <div className="w-full lg:w-64 flex flex-col gap-2">
                        {filteredTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`text-left px-6 py-4 rounded-xl font-bold flex items-center gap-3 transition-all ${activeTab === tab.id
                                        ? 'bg-primary text-white shadow-lg shadow-primary/30'
                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <span className="material-icons-round">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 bg-white rounded-2xl shadow-soft p-8 min-h-[500px]">
                        {activeTab === 'general' && (
                            <div className="space-y-6 animate-fadeIn">
                                <h2 className="text-2xl font-bold text-gray-900 mb-6">Restaurant Information</h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Restaurant Name</label>
                                        <input type="text" value={localSettings.name} onChange={e => setLocalSettings(prev => ({ ...prev, name: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Legal Name</label>
                                        <input type="text" value={localSettings.legalName} onChange={e => setLocalSettings(prev => ({ ...prev, legalName: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">RFC</label>
                                        <input type="text" value={localSettings.rfc} onChange={e => setLocalSettings(prev => ({ ...prev, rfc: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Address</label>
                                        <input type="text" value={localSettings.address} onChange={e => setLocalSettings(prev => ({ ...prev, address: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Phone</label>
                                        <input type="text" value={localSettings.phone} onChange={e => setLocalSettings(prev => ({ ...prev, phone: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Printer Paper Width</label>
                                        <select 
                                            value={localSettings.printerWidth} 
                                            onChange={e => setLocalSettings(prev => ({ ...prev, printerWidth: e.target.value as any }))}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                                        >
                                            <option value="80mm">Standard (80mm)</option>
                                            <option value="58mm">Small (58mm)</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Ticket Footer Message</label>
                                    <textarea value={localSettings.footerMessage} onChange={e => setLocalSettings(prev => ({ ...prev, footerMessage: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all h-24" />
                                </div>

                                {/* Bank Information Section */}
                                <div className="pt-6 border-t border-gray-100">
                                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <span className="material-icons-round text-primary">account_balance</span>
                                        Información Bancaria (Transferencias)
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Nombre del Banco</label>
                                            <input type="text" value={localSettings.bankName || ''} onChange={e => setLocalSettings(prev => ({ ...prev, bankName: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" placeholder="Ej. BBVA, Santander..." />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Nombre del Beneficiario</label>
                                            <input type="text" value={localSettings.bankBeneficiary || ''} onChange={e => setLocalSettings(prev => ({ ...prev, bankBeneficiary: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" placeholder="Nombre completo" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Número de Cuenta / Tarjeta</label>
                                            <input type="text" value={localSettings.bankAccount || ''} onChange={e => setLocalSettings(prev => ({ ...prev, bankAccount: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" placeholder="0000 0000 0000 0000" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">CLABE Interbancaria</label>
                                            <input type="text" value={localSettings.bankCLABE || ''} onChange={e => setLocalSettings(prev => ({ ...prev, bankCLABE: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" placeholder="18 dígitos" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-bold text-gray-700 mb-2">WhatsApp para Comprobantes</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">+52</span>
                                                <input type="text" value={localSettings.bankWhatsapp || ''} onChange={e => setLocalSettings(prev => ({ ...prev, bankWhatsapp: e.target.value }))} className="w-full border border-gray-200 rounded-xl pl-12 pr-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" placeholder="10 dígitos" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Delivery Platforms Payout Section */}
                                <div className="pt-6 border-t border-gray-100">
                                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        <span className="material-icons-round text-primary">local_shipping</span>
                                        Días de Depósito (Delivery Apps)
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Uber Eats (Día de Pago)</label>
                                            <select value={localSettings.uberPayoutDay || 'Lunes'} onChange={e => setLocalSettings(prev => ({ ...prev, uberPayoutDay: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                                                <option value="Lunes">Lunes</option><option value="Martes">Martes</option><option value="Miércoles">Miércoles</option><option value="Jueves">Jueves</option><option value="Viernes">Viernes</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Didi Food (Día de Pago)</label>
                                            <select value={localSettings.didiPayoutDay || 'Martes'} onChange={e => setLocalSettings(prev => ({ ...prev, didiPayoutDay: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                                                <option value="Lunes">Lunes</option><option value="Martes">Martes</option><option value="Miércoles">Miércoles</option><option value="Jueves">Jueves</option><option value="Viernes">Viernes</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Rappi (Nota Promedio)</label>
                                            <input type="text" value={localSettings.rappiPayoutNotes || ''} onChange={e => setLocalSettings(prev => ({ ...prev, rappiPayoutNotes: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" placeholder="Ej. Al sumar $500" />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex items-center justify-between group hover:bg-blue-100/50 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                                            <span className="material-icons-round">restaurant</span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">Modo Orden Impresa (Cocina)</h3>
                                            <p className="text-xs text-gray-500">Generar automáticamente un ticket para cocina al enviar una orden</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setLocalSettings(prev => ({ ...prev, isKitchenPrintingEnabled: !prev.isKitchenPrintingEnabled }))}
                                        className={`w-14 h-7 rounded-full relative transition-all duration-300 ${localSettings.isKitchenPrintingEnabled ? 'bg-primary shadow-lg shadow-primary/30' : 'bg-gray-300'}`}
                                    >
                                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${localSettings.isKitchenPrintingEnabled ? 'left-8' : 'left-1'}`}></div>
                                    </button>
                                </div>

                                <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-4">
                                    {showsSavedMessage && (
                                        <div className="flex items-center gap-1 text-green-600 font-bold animate-in fade-in slide-in-from-right-2">
                                            <span className="material-icons-round text-sm">check_circle</span>
                                            ¡Configuración guardada!
                                        </div>
                                    )}
                                    <button 
                                        onClick={handleSave}
                                        className="bg-primary text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-blue-600 transition-colors"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'appearance' && (
                            <div className="space-y-8 animate-fadeIn">
                                <h2 className="text-2xl font-bold text-gray-900 mb-6 font-black uppercase tracking-tight">Personalización Visual</h2>

                                {/* Logo Section */}
                                <div className="space-y-4">
                                    <label className="block text-sm font-black text-gray-500 uppercase tracking-widest">Logo del Restaurante</label>
                                    <div className="flex items-center gap-6 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                                        <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center shadow-soft overflow-hidden border border-gray-100 group relative">
                                            {localSettings.logoUrl ? (
                                                <img src={localSettings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="material-icons-round text-gray-300 text-4xl">restaurant</span>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <input 
                                                type="text" 
                                                placeholder="https://tu-logo.com/imagen.png" 
                                                value={localSettings.logoUrl || ''} 
                                                onChange={e => setLocalSettings(prev => ({ ...prev, logoUrl: e.target.value }))}
                                                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all mb-2"
                                            />
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pega la URL de tu logotipo para mostrarlo en la pantalla de inicio.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Themes Section */}
                                <div className="space-y-4">
                                    <label className="block text-sm font-black text-gray-500 uppercase tracking-widest">Atmósfera y Temas</label>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {[
                                            { id: 'indigo', name: 'Indigo Classic', color: '#5D5FEF', desc: 'Standard & Professional' },
                                            { id: 'emerald', name: 'Emerald Grill', color: '#10B981', desc: 'Healthy & Organic' },
                                            { id: 'ruby', name: 'Ruby Steakhouse', color: '#EF4444', desc: 'Steak & Passion' },
                                            { id: 'amber', name: 'Amber Bakery', color: '#F59E0B', desc: 'Warm & Cozy' },
                                            { id: 'midnight', name: 'Midnight Lounge', color: '#334155', desc: 'Elegant & Modern' }
                                        ].map(theme => (
                                            <button
                                                key={theme.id}
                                                onClick={() => setLocalSettings(prev => ({ ...prev, themeId: theme.id as any }))}
                                                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-start gap-2 group ${localSettings.themeId === theme.id ? 'border-primary bg-primary/5 shadow-lg' : 'border-gray-100 bg-white hover:border-gray-300 shadow-sm'}`}
                                            >
                                                <div className="w-10 h-10 rounded-xl shadow-inner group-hover:scale-110 transition-transform" style={{ backgroundColor: theme.color }}></div>
                                                <div className="text-left">
                                                    <p className="font-black text-gray-900 text-sm leading-tight">{theme.name}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{theme.id}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-4">
                                    {showsSavedMessage && <div className="text-green-600 font-bold text-sm">¡Configuración guardada!</div>}
                                    <button onClick={handleSave} className="bg-primary text-white font-black px-8 py-3 rounded-xl shadow-lg hover:bg-blue-600 transition-all">Guardar Apariencia</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'hardware' && (
                            <div className="space-y-8 animate-fadeIn">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">Hardware & Devices</h2>
                                        <p className="text-sm text-gray-500">Connect POS peripherals or enable Virtual Mode</p>
                                    </div>

                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => { setShowWizard(true); setWizardStep(1); }}
                                            className="bg-gray-900 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg hover:bg-black transition-all"
                                        >
                                            <span className="material-icons-round text-yellow-500">auto_fix_high</span>
                                            Setup Wizard
                                        </button>

                                        {/* Virtual Mode Toggle */}
                                        <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all ${virtualMode ? 'bg-primary/5 border-primary/20' : 'bg-gray-50 border-gray-200'}`}>
                                            <div className="text-right">
                                                <p className={`text-sm font-bold ${virtualMode ? 'text-primary' : 'text-gray-600'}`}>Virtual Hardware</p>
                                                <p className="text-[10px] text-gray-400">{virtualMode ? 'Enabled' : 'Disabled'}</p>
                                            </div>
                                            <button
                                                onClick={() => setVirtualMode(!virtualMode)}
                                                className={`w-12 h-7 rounded-full relative transition-colors ${virtualMode ? 'bg-primary' : 'bg-gray-300'}`}
                                            >
                                                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${virtualMode ? 'left-6' : 'left-1'}`}></div>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {virtualMode ? (
                                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex items-start gap-4">
                                        <span className="material-icons-round text-primary text-3xl">cloud_queue</span>
                                        <div>
                                            <h3 className="font-bold text-primary text-lg">Virtual Mode Active</h3>
                                            <p className="text-sm text-gray-600 mt-1">
                                                The system is currently simulating hardware connections.
                                                Receipts will be generated as PDFs, and cash drawer actions will be onscreen prompts.
                                                This is ideal for businesses without specialized POS hardware.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                                        {/* Payment Terminal Card (New) */}
                                        <div className="border border-purple-100 bg-purple-50/30 rounded-2xl p-6 flex flex-col gap-4 hover:shadow-md transition-all col-span-1 md:col-span-2 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                                <span className="material-icons-round text-9xl">credit_card</span>
                                            </div>
                                            <div className="flex justify-between items-start z-10">
                                                <div className="flex items-center gap-4">
                                                    <div className="p-3 bg-white rounded-xl text-purple-600 shadow-sm">
                                                        <span className="material-icons-round text-2xl">point_of_sale</span>
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-gray-900 text-lg">Payment Terminal</h3>
                                                        <p className="text-xs text-blue-600 font-bold">{localSettings.connectedTerminalName}</p>
                                                        <p className="text-xs text-gray-500">Bluetooth Connection</p>
                                                    </div>
                                                </div>
                                                <div className={`px-3 py-1.5 rounded-lg text-xs font-bold ${hardwareStatus.terminal === 'connected' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                                                    }`}>
                                                    {hardwareStatus.terminal === 'connecting' ? 'Handshaking...' : hardwareStatus.terminal === 'connected' ? 'Ready to Process' : 'Not Paired'}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-4 mt-2 z-10">
                                                <button
                                                    onClick={() => toggleHardwareConnection('terminal')}
                                                    className={`py-2 px-6 rounded-xl font-bold text-sm transition-colors border ${hardwareStatus.terminal === 'connected'
                                                            ? 'bg-white border-red-200 text-red-500 hover:bg-red-50'
                                                            : 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                                                        }`}
                                                >
                                                    {hardwareStatus.terminal === 'connected' ? 'Disconnect Terminal' : 'Pair New Terminal'}
                                                </button>
                                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                                    <span className="material-icons-round text-sm">lock</span>
                                                    End-to-end Encrypted
                                                </div>
                                            </div>
                                        </div>

                                        {/* Printer Card */}
                                        <div className="border border-gray-200 rounded-2xl p-6 flex flex-col gap-4 hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start">
                                                <div className="p-3 bg-gray-100 rounded-xl text-gray-600">
                                                    <span className="material-icons-round text-2xl">print</span>
                                                </div>
                                                <div className={`px-2 py-1 rounded-lg text-xs font-bold ${hardwareStatus.printer === 'connected' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {hardwareStatus.printer === 'connecting' ? 'Connecting...' : hardwareStatus.printer === 'connected' ? 'Connected' : 'Disconnected'}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900">Thermal Printer</h3>
                                                <p className="text-xs text-blue-600 font-bold">{settings.connectedDeviceName}</p>
                                                <p className="text-[10px] text-gray-400">USB Direct Communication</p>
                                            </div>
                                            
                                                {localSettings.connectedDeviceName !== 'None' ? (
                                                    <div className="flex items-center gap-3 bg-green-50 p-3 rounded-2xl border border-green-100 animate-in fade-in zoom-in duration-300">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                                                <p className="text-[11px] font-black text-green-800 uppercase tracking-tight">Impresión en UN CLIC Activa</p>
                                                            </div>
                                                            <p className="text-[10px] text-green-600 font-bold leading-tight mt-0.5">La señal se enviará directamente al hardware.</p>
                                                        </div>
                                                        <button 
                                                            onClick={() => setLocalSettings(prev => ({ ...prev, isDirectPrintingEnabled: !prev.isDirectPrintingEnabled }))}
                                                            className={`w-12 h-6 rounded-full relative transition-all shadow-inner ${localSettings.isDirectPrintingEnabled ? 'bg-green-600' : 'bg-gray-300'}`}
                                                        >
                                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${localSettings.isDirectPrintingEnabled ? 'left-7' : 'left-1'}`}></div>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 flex items-start gap-3">
                                                       <span className="material-icons-round text-amber-600 text-lg">info</span>
                                                       <div>
                                                           <p className="text-[10px] font-black text-amber-800 uppercase">Sin Enlace Directo</p>
                                                           <p className="text-[9px] text-amber-600 leading-tight">Usa el botón "CONECTAR USB" abajo para habilitar la impresión de un clic.</p>
                                                       </div>
                                                    </div>
                                                )}

                                            <div className="mt-auto flex flex-col gap-3">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={localSettings.connectedDeviceName === 'None' ? handleConnectUSB : handleDisconnectUSB}
                                                        className={`flex-1 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${localSettings.connectedDeviceName !== 'None'
                                                                ? 'bg-white text-red-500 border-2 border-red-50'
                                                                : 'bg-primary text-white shadow-xl shadow-blue-900/10'
                                                            }`}
                                                    >
                                                        <span className="material-icons-round text-base">{localSettings.connectedDeviceName !== 'None' ? 'link_off' : 'usb'}</span>
                                                        {localSettings.connectedDeviceName !== 'None' ? 'DESVINCULAR' : 'CONECTAR USB'}
                                                    </button>
                                                </div>
                                                
                                                <div className="bg-slate-900 text-white p-4 rounded-2xl relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 p-2 opacity-5 scale-150 rotate-12 transition-transform group-hover:scale-[2] group-hover:rotate-0">
                                                        <span className="material-icons-round text-4xl">bolt</span>
                                                    </div>
                                                    <div className="relative z-10">
                                                        <p className="text-[9px] font-black uppercase text-blue-400 mb-1 tracking-widest">Truco Pro: Impresión Silenciosa</p>
                                                        <p className="text-[10px] leading-tight text-slate-300 font-medium italic">
                                                            "Añade --kiosk-printing a tu acceso directo de Chrome para ignorar la ventana de imprimir de Windows."
                                                        </p>
                                                    </div>
                                                </div>

                                                {localSettings.connectedDeviceName !== 'None' && (
                                                    <button onClick={handlePrintTest} className="py-3 bg-gray-50 hover:bg-gray-100 text-gray-400 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                                                        <span className="material-icons-round text-sm">print</span> Probar Impresora
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Scanner Card */}
                                        <div className="border border-gray-200 rounded-2xl p-6 flex flex-col gap-4 hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start">
                                                <div className="p-3 bg-gray-100 rounded-xl text-gray-600">
                                                    <span className="material-icons-round text-2xl">qr_code_scanner</span>
                                                </div>
                                                <div className={`px-2 py-1 rounded-lg text-xs font-bold ${hardwareStatus.scanner === 'connected' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {hardwareStatus.scanner === 'connecting' ? 'Connecting...' : hardwareStatus.scanner === 'connected' ? 'Connected' : 'Disconnected'}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900">Barcode Scanner</h3>
                                                <p className="text-xs text-gray-500">Honeywell Voyager (BT)</p>
                                            </div>
                                            <button
                                                onClick={() => toggleHardwareConnection('scanner')}
                                                className={`mt-auto py-2 rounded-xl font-bold text-sm transition-colors ${hardwareStatus.scanner === 'connected'
                                                        ? 'bg-red-50 text-red-500 hover:bg-red-100'
                                                        : 'bg-primary text-white hover:bg-blue-600'
                                                    }`}
                                            >
                                                {hardwareStatus.scanner === 'connected' ? 'Disconnect' : 'Connect'}
                                            </button>
                                        </div>

                                        {/* Cash Drawer Card */}
                                        <div className="border border-gray-200 rounded-2xl p-6 flex flex-col gap-4 hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start">
                                                <div className="p-3 bg-gray-100 rounded-xl text-gray-600">
                                                    <span className="material-icons-round text-2xl">point_of_sale</span>
                                                </div>
                                                <div className={`px-2 py-1 rounded-lg text-xs font-bold ${localSettings.isCashDrawerEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {localSettings.isCashDrawerEnabled ? 'Enabled' : 'Disabled'}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900">Cash Drawer</h3>
                                                <p className="text-xs text-gray-500">APG Cash Drawer (RJ11)</p>
                                            </div>
                                            <button
                                                onClick={() => setLocalSettings(prev => ({ ...prev, isCashDrawerEnabled: !prev.isCashDrawerEnabled }))}
                                                className={`mt-auto py-2 rounded-xl font-bold text-sm transition-colors ${localSettings.isCashDrawerEnabled
                                                        ? 'bg-red-50 text-red-500 hover:bg-red-100'
                                                        : 'bg-primary text-white hover:bg-blue-600'
                                                    }`}
                                            >
                                                {localSettings.isCashDrawerEnabled ? 'Disable' : 'Enable & Connect'}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300 flex justify-center items-center gap-4 cursor-pointer hover:bg-gray-100 transition-colors">
                                    <span className="material-icons-round text-gray-400">add_circle</span>
                                    <span className="text-gray-500 font-bold">Add Generic Device</span>
                                </div>
                            </div>
                        )}

                        {activeTab === 'diagnostics' && (
                            <div className="space-y-8 animate-fadeIn">
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900 font-black uppercase tracking-tight">Diagnóstico de Salud POS</h2>
                                    <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mt-1">Valida la conexión y el estado físico de tus periféricos</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Test Printer */}
                                    <div className="p-6 bg-white border border-gray-100 rounded-3xl shadow-soft hover:shadow-lg transition-all group">
                                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <span className="material-icons-round text-2xl">print</span>
                                        </div>
                                        <h3 className="font-black text-gray-900 mb-2 uppercase text-xs tracking-widest">Prueba de Impresión</h3>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-4 leading-relaxed">Imprime un ticket de cortesía para validar alineación y corte.</p>
                                        <button 
                                            onClick={handlePrintTest}
                                            className="w-full py-3 bg-blue-600 text-white font-black rounded-xl text-[10px] uppercase tracking-[0.15em] shadow-lg shadow-blue-200 active:scale-95 transition-all"
                                        >
                                            Mandar Ticket de Prueba
                                        </button>
                                    </div>

                                    {/* Test Cash Drawer */}
                                    <div className="p-6 bg-white border border-gray-100 rounded-3xl shadow-soft hover:shadow-lg transition-all group">
                                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <span className="material-icons-round text-2xl">point_of_sale</span>
                                        </div>
                                        <h3 className="font-black text-gray-900 mb-2 uppercase text-xs tracking-widest">Apertura de Cajón</h3>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-4 leading-relaxed">Envía pulsos electrónicos a ambos pines para validar apertura física.</p>
                                        <button 
                                            onClick={async () => {
                                                const success = await printerService.openCashDrawer();
                                                if (!success) alert("La impresora debe estar conectada para abrir el cajón vía cable RJ11.");
                                            }}
                                            className="w-full py-3 bg-amber-600 text-white font-black rounded-xl text-[10px] uppercase tracking-[0.15em] shadow-lg shadow-amber-200 active:scale-95 transition-all"
                                        >
                                            Abrir Cajón Ahora
                                        </button>
                                    </div>

                                    {/* Test Scanner */}
                                    <div className="p-6 bg-white border border-gray-100 rounded-3xl shadow-soft hover:shadow-lg transition-all group">
                                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <span className="material-icons-round text-2xl">qr_code_scanner</span>
                                        </div>
                                        <h3 className="font-black text-gray-900 mb-2 uppercase text-xs tracking-widest">Monitor de Scanner</h3>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-4 leading-relaxed">Escanea cualquier código de barras para probar la entrada HID/BT.</p>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                placeholder="ESCANEA AQUÍ..." 
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:border-emerald-500 transition-all text-center"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const target = e.target as HTMLInputElement;
                                                        if (target.value) {
                                                            alert(`SCAN EXITOSO: ${target.value}`);
                                                            target.value = '';
                                                        }
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 p-8 bg-slate-900 rounded-[32px] text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-8 opacity-10">
                                        <span className="material-icons-round text-[120px]">verified</span>
                                    </div>
                                    <div className="relative z-10">
                                        <h3 className="text-xl font-black uppercase tracking-tight mb-4">Certificación de Estación</h3>
                                        <p className="text-slate-400 text-sm leading-relaxed mb-6 max-w-lg">
                                            Si las tres pruebas anteriores son exitosas, el equipo está listo para operar. 
                                            Recuerda que la persistencia de datos (con o sin internet) está asegurada por el motor de sincronización de Culinex.
                                        </p>
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/10">
                                                <span className="material-icons-round text-emerald-400 text-sm">security</span>
                                                <span className="text-[10px] font-black uppercase tracking-widest">Cifrado Local</span>
                                            </div>
                                            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/10">
                                                <span className="material-icons-round text-blue-400 text-sm">cloud_sync</span>
                                                <span className="text-[10px] font-black uppercase tracking-widest">Auto-Backup</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'users' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900 font-black uppercase tracking-tight">Gestión de Personal</h2>
                                    <button 
                                        onClick={() => { setEditingUser(null); setNewUserForm({ name: '', role: 'Mesero', area: 'Service', status: 'ON_SHIFT' as any, pin: '', image: 'https://i.pravatar.cc/150?u=' + Math.random() }); setShowUserModal(true); }}
                                        className="bg-primary text-white font-black px-6 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                                    >
                                        <span className="material-icons-round">person_add</span>
                                        Nuevo Usuario
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    {users.map((user) => (
                                        <div key={user.id} className="flex items-center justify-between p-5 bg-white border border-gray-100 rounded-3xl hover:shadow-lg transition-all group">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-soft border-2 border-white group-hover:scale-105 transition-transform">
                                                    <img src={user.image} alt="" className="w-full h-full object-cover" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-black text-gray-900">{user.name}</h3>
                                                        <span className="text-[10px] font-black px-2 py-0.5 bg-gray-100 text-gray-400 rounded-md uppercase tracking-wider">{user.area}</span>
                                                    </div>
                                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{user.role}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right flex flex-col items-end">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                                                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${user.status === 'ON_SHIFT' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                                        {user.status}
                                                    </span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button 
                                                        onClick={() => { setEditingUser(user); setNewUserForm(user as any); setShowUserModal(true); }}
                                                        className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:bg-primary hover:text-white transition-all flex items-center justify-center"
                                                    >
                                                        <span className="material-icons-round text-lg">edit</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => deleteUser(user.id)}
                                                        className="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
                                                    >
                                                        <span className="material-icons-round text-lg">delete</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* User Modal */}
                                {showUserModal && (
                                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                                        <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                                            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{editingUser ? 'Editar Usuario' : 'Crear Usuario'}</h3>
                                                <button onClick={() => setShowUserModal(false)} className="text-gray-400 hover:text-gray-600 font-bold uppercase text-xs tracking-widest">Cerrar</button>
                                            </div>
                                            <div className="p-8 space-y-5">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="col-span-2">
                                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Nombre Completo</label>
                                                        <input type="text" value={newUserForm.name} onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Rol</label>
                                                        <select value={newUserForm.role} onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold">
                                                            <option>Admin</option>
                                                            <option>Gerente</option>
                                                            <option>Cajero</option>
                                                            <option>Mesero</option>
                                                            <option>Mesera</option>
                                                            <option>Chef Principal</option>
                                                            <option>Cocinero</option>
                                                            <option>Barra</option>
                                                            <option>Ayudante</option>
                                                            <option>Limpieza</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">PIN Acceso (4 dígitos)</label>
                                                        <input type="text" maxLength={4} value={newUserForm.pin} onChange={e => setNewUserForm({ ...newUserForm, pin: e.target.value.replace(/\D/g, '') })} placeholder="1234" className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono font-black" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Área</label>
                                                        <select value={newUserForm.area} onChange={e => setNewUserForm({ ...newUserForm, area: e.target.value as any })} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold">
                                                            <option value="Management">Gerencia</option>
                                                            <option value="Service">Servicio</option>
                                                            <option value="Kitchen">Cocina</option>
                                                            <option value="Bar">Barra</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Status</label>
                                                        <select value={newUserForm.status} onChange={e => setNewUserForm({ ...newUserForm, status: e.target.value as any })} className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold">
                                                            <option value="ON_SHIFT">Activo</option>
                                                            <option value="OFF_SHIFT">Inactivo</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <button 
                                                    onClick={() => {
                                                        if (editingUser) {
                                                            updateUser(editingUser.id, newUserForm);
                                                        } else {
                                                            addUser(newUserForm as any);
                                                        }
                                                        setShowUserModal(false);
                                                    }}
                                                    className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all text-lg"
                                                >
                                                    {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Installation Wizard Modal */}
            {showWizard && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden relative animate-[fadeIn_0.5s_ease-out] flex flex-col max-h-[90vh]">
                        {/* Wizard Header */}
                        <div className="bg-gray-900 text-white p-8">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4">
                                    <span className="material-icons-round text-3xl text-yellow-500">auto_fix_high</span>
                                </div>
                                <button onClick={() => setShowWizard(false)} className="text-gray-400 hover:text-white">
                                    <span className="material-icons-round">close</span>
                                </button>
                            </div>
                            <h2 className="text-3xl font-bold mb-2">Hardware Setup Wizard</h2>
                            <p className="text-gray-400">Step {wizardStep} of 5</p>
                            {/* Progress Bar */}
                            <div className="w-full bg-white/10 h-2 rounded-full mt-6 overflow-hidden">
                                <div
                                    className="bg-yellow-500 h-full transition-all duration-500 ease-out"
                                    style={{ width: `${(wizardStep / 5) * 100}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Wizard Content */}
                        <div className="p-8 flex-1 overflow-y-auto">
                            {wizardStep === 1 && (
                                <div className="text-center py-8">
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Culinex Setup</h3>
                                    <p className="text-gray-500 mb-8 max-w-md mx-auto">
                                        This wizard will guide you through connecting your essential hardware: Printers, Scanners, and Payment Terminals.
                                    </p>
                                    <div className="flex justify-center gap-8 mb-8">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-primary">
                                                <span className="material-icons-round text-3xl">print</span>
                                            </div>
                                            <span className="text-xs font-bold text-gray-500">Printer</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center text-purple-500">
                                                <span className="material-icons-round text-3xl">point_of_sale</span>
                                            </div>
                                            <span className="text-xs font-bold text-gray-500">Terminal</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center text-orange-500">
                                                <span className="material-icons-round text-3xl">qr_code_scanner</span>
                                            </div>
                                            <span className="text-xs font-bold text-gray-500">Scanner</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setWizardStep(2)}
                                        className="bg-primary text-white font-bold py-4 px-12 rounded-2xl shadow-xl hover:bg-blue-600 transition-all text-lg"
                                    >
                                        Start Setup
                                    </button>
                                </div>
                            )}

                            {wizardStep === 2 && (
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Connect Receipt Printer</h3>
                                    <p className="text-gray-500 mb-8">Make sure your printer is turned on and connected via USB or Network.</p>

                                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-8 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-4 bg-white rounded-xl shadow-sm">
                                                <span className="material-icons-round text-3xl text-gray-600">print</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900">EPSON TM-T Models</h4>
                                                <p className="text-sm text-gray-500">USB / Ethernet Interface</p>
                                            </div>
                                        </div>
                                        {hardwareStatus.printer === 'connected' ? (
                                            <span className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-3 py-1 rounded-lg">
                                                <span className="material-icons-round">check_circle</span> Connected
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => runWizardDeviceConnection('printer')}
                                                disabled={wizardConfig.isConnecting}
                                                className="bg-gray-900 text-white font-bold px-6 py-2 rounded-xl hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-wait"
                                            >
                                                {wizardConfig.isConnecting ? 'Searching...' : 'Scan & Connect'}
                                            </button>
                                        )}
                                    </div>

                                    {hardwareStatus.printer === 'connected' && (
                                        <div className="flex justify-end">
                                            <button onClick={() => setWizardStep(3)} className="text-primary font-bold hover:underline flex items-center gap-1">
                                                Next Step <span className="material-icons-round">arrow_forward</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {wizardStep === 3 && (
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Connect Barcode Scanner</h3>
                                    <p className="text-gray-500 mb-8">Scan the pairing barcode below or connect via Bluetooth.</p>

                                    <div className="flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-2xl p-8 mb-8">
                                        <span className="material-icons-round text-6xl text-gray-300 mb-4">qr_code_2</span>
                                        <p className="text-sm font-bold text-gray-400 mb-6">SCAN TO PAIR</p>

                                        {hardwareStatus.scanner === 'connected' ? (
                                            <span className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-4 py-2 rounded-lg">
                                                <span className="material-icons-round">check_circle</span> Scanner Paired Successfully
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => runWizardDeviceConnection('scanner')}
                                                disabled={wizardConfig.isConnecting}
                                                className="bg-gray-900 text-white font-bold px-8 py-3 rounded-xl hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-wait animate-pulse"
                                            >
                                                {wizardConfig.isConnecting ? 'Pairing...' : 'Simulate Scan'}
                                            </button>
                                        )}
                                    </div>

                                    {hardwareStatus.scanner === 'connected' && (
                                        <div className="flex justify-end">
                                            <button onClick={() => setWizardStep(4)} className="text-primary font-bold hover:underline flex items-center gap-1">
                                                Next Step <span className="material-icons-round">arrow_forward</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {wizardStep === 4 && (
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-2xl font-bold text-gray-900">Payment Terminal Setup</h3>
                                        <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-md">SECURE</span>
                                    </div>
                                    <p className="text-gray-500 mb-8">Enter the 6-digit pairing code displayed on your terminal screen.</p>

                                    <div className="max-w-md mx-auto">
                                        <div className="mb-6">
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Pairing Code</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    maxLength={6}
                                                    placeholder="000-000"
                                                    value={wizardConfig.pairingCode}
                                                    onChange={(e) => setWizardConfig({ ...wizardConfig, pairingCode: e.target.value.replace(/\D/g, '') })}
                                                    className="flex-1 text-center text-3xl tracking-[0.5em] font-mono border-2 border-gray-200 rounded-xl py-3 focus:border-purple-500 outline-none transition-colors"
                                                />
                                            </div>
                                            {wizardConfig.error && <p className="text-red-500 text-sm mt-2 font-bold">{wizardConfig.error}</p>}
                                        </div>

                                        {hardwareStatus.terminal === 'connected' ? (
                                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 mb-6">
                                                <div className="bg-green-100 p-2 rounded-full">
                                                    <span className="material-icons-round text-green-600">verified</span>
                                                </div>
                                                <div>
                                                    <p className="font-bold text-green-800">Terminal Verified</p>
                                                    <p className="text-xs text-green-600">Ready to accept payments</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={handleTerminalPairing}
                                                disabled={wizardConfig.isConnecting}
                                                className="w-full bg-purple-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all disabled:opacity-70 disabled:cursor-wait flex justify-center items-center gap-2"
                                            >
                                                {wizardConfig.isConnecting ? (
                                                    <>
                                                        <span className="material-icons-round animate-spin">refresh</span>
                                                        Verifying Keys...
                                                    </>
                                                ) : 'Connect Terminal'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {wizardStep === 5 && (
                                <div className="text-center py-8">
                                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-500 mx-auto mb-6 animate-bounce">
                                        <span className="material-icons-round text-5xl">check_circle</span>
                                    </div>
                                    <h3 className="text-3xl font-bold text-gray-900 mb-4">Setup Complete!</h3>
                                    <p className="text-gray-500 mb-8 max-w-md mx-auto">
                                        All your hardware is connected and ready to go. You can manage these connections anytime in the Settings menu.
                                    </p>

                                    <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <span className="material-icons-round text-green-500">print</span>
                                            <p className="text-xs font-bold mt-1 text-gray-600">Printer</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <span className="material-icons-round text-green-500">qr_code_scanner</span>
                                            <p className="text-xs font-bold mt-1 text-gray-600">Scanner</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <span className="material-icons-round text-green-500">point_of_sale</span>
                                            <p className="text-xs font-bold mt-1 text-gray-600">Terminal</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowWizard(false)}
                                        className="bg-gray-900 text-white font-bold py-4 px-12 rounded-2xl shadow-xl hover:bg-black transition-all text-lg"
                                    >
                                        Finish & Close
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
