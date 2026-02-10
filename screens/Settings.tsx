import React, { useState } from 'react';

export const SettingsScreen: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'general' | 'hardware' | 'users' | 'notifications'>('general');
    const [virtualMode, setVirtualMode] = useState<boolean>(false);
    const [hardwareStatus, setHardwareStatus] = useState({
        printer: 'disconnected',
        scanner: 'disconnected',
        drawer: 'disconnected',
        terminal: 'disconnected'
    });

    // Wizard State
    const [showWizard, setShowWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState(1); // 1: Welcome, 2: Printer, 3: Scanner, 4: Terminal, 5: Success
    const [wizardConfig, setWizardConfig] = useState({
        pairingCode: '',
        isConnecting: false,
        error: ''
    });

    const toggleHardwareConnection = (device: keyof typeof hardwareStatus) => {
        setHardwareStatus(prev => ({
            ...prev,
            [device]: prev[device] === 'connected' ? 'disconnected' : 'connecting'
        }));

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
        { id: 'hardware', label: 'Hardware & Devices', icon: 'devices' },
        { id: 'users', label: 'Users & Roles', icon: 'manage_accounts' },
        { id: 'notifications', label: 'Notifications', icon: 'notifications' },
    ];

    return (
        <div className="flex-1 bg-[#F3F4F6] text-gray-800 p-8 overflow-y-auto h-full relative">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                    <p className="text-gray-500 text-sm">Manage preferences, devices, and system configurations</p>
                </div>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar Navigation */}
                    <div className="w-full lg:w-64 flex flex-col gap-2">
                        {tabs.map(tab => (
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
                                        <input type="text" defaultValue="Culinex Demo Restaurant" className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Branch / Location</label>
                                        <input type="text" defaultValue="Downtown Main" className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Currency</label>
                                        <select className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                                            <option>MXN ($)</option>
                                            <option>USD ($)</option>
                                            <option>EUR (€)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Language</label>
                                        <select className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
                                            <option>Español (MX)</option>
                                            <option>English (US)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-100 flex justify-end">
                                    <button className="bg-primary text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-blue-600 transition-colors">
                                        Save Changes
                                    </button>
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
                                                        <p className="text-xs text-gray-500">Stripe Terminal / Verifone P400</p>
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
                                                <p className="text-xs text-gray-500">EPSON TM-T88V (USB)</p>
                                            </div>
                                            <button
                                                onClick={() => toggleHardwareConnection('printer')}
                                                className={`mt-auto py-2 rounded-xl font-bold text-sm transition-colors ${hardwareStatus.printer === 'connected'
                                                        ? 'bg-red-50 text-red-500 hover:bg-red-100'
                                                        : 'bg-primary text-white hover:bg-blue-600'
                                                    }`}
                                            >
                                                {hardwareStatus.printer === 'connected' ? 'Disconnect' : 'Connect'}
                                            </button>
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
                                                <div className={`px-2 py-1 rounded-lg text-xs font-bold ${hardwareStatus.drawer === 'connected' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {hardwareStatus.drawer === 'connecting' ? 'Connecting...' : hardwareStatus.drawer === 'connected' ? 'Connected' : 'Disconnected'}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900">Cash Drawer</h3>
                                                <p className="text-xs text-gray-500">APG Cash Drawer (RJ11)</p>
                                            </div>
                                            <button
                                                onClick={() => toggleHardwareConnection('drawer')}
                                                className={`mt-auto py-2 rounded-xl font-bold text-sm transition-colors ${hardwareStatus.drawer === 'connected'
                                                        ? 'bg-red-50 text-red-500 hover:bg-red-100'
                                                        : 'bg-primary text-white hover:bg-blue-600'
                                                    }`}
                                            >
                                                {hardwareStatus.drawer === 'connected' ? 'Disconnect' : 'Connect'}
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

                        {activeTab === 'users' && (
                            <div className="space-y-6 animate-fadeIn">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
                                    <button className="bg-primary text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-2">
                                        <span className="material-icons-round text-lg">person_add</span>
                                        Invite User
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {[
                                        { name: 'Julio (You)', role: 'Owner', email: 'julio@culinex.app', status: 'Active' },
                                        { name: 'Maria Gonzalez', role: 'Manager', email: 'maria@culinex.app', status: 'Active' },
                                        { name: 'Carlos Ruiz', role: 'Chef', email: 'carlos@kitchen.com', status: 'Inactive' },
                                    ].map((user, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                    {user.name[0]}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900">{user.name}</h3>
                                                    <p className="text-xs text-gray-500">{user.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${user.status === 'Active' ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                                                    {user.status}
                                                </span>
                                                <select defaultValue={user.role} className="bg-white border border-gray-200 rounded-lg text-sm px-2 py-1 outline-none">
                                                    <option>Owner</option>
                                                    <option>Manager</option>
                                                    <option>Chef</option>
                                                    <option>Waiter</option>
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
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
