import React, { useState } from 'react';
import { TABLES, MOCK_STAFF } from '../constants';
import { Table, TableStatus, WaitlistEntry } from '../types';

export const HostessScreen: React.FC = () => {
    // Table State
    const [activeTables, setActiveTables] = useState<Table[]>(TABLES);
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'floor' | 'list'>('floor');

    // Waitlist State (Kanban cards)
    const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([
        { id: 'W1', customerName: 'Juan Perez', partySize: 4, timestamp: '12:30', status: 'WAITING' },
        { id: 'W2', customerName: 'María García', partySize: 2, timestamp: '12:45', status: 'WAITING' }
    ]);

    // Assignments & Sessions
    const [waiterAssignments, setWaiterAssignments] = useState<{ [tableId: string]: string }>({});
    const [customerSessions, setCustomerSessions] = useState<{ [tableId: string]: { name: string; pax: number; time: string } }>({});
    const [reservations, setReservations] = useState<{ [tableId: string]: { name: string; pax: number; time: string; notes?: string } }>({
        'T3': { name: 'Familia Rodriguez', pax: 6, time: '19:00', notes: 'Birthday' }
    });

    // Form State
    const [customerName, setCustomerName] = useState('');
    const [partySize, setPartySize] = useState(2);
    const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
    const [newTableName, setNewTableName] = useState('');
    const [newTableSeats, setNewTableSeats] = useState(4);

    // Drag and Drop State
    const [isDraggingOver, setIsDraggingOver] = useState<string | null>(null);

    const handleAssignWaiter = (waiterId: string) => {
        if (selectedTableId) {
            setWaiterAssignments(prev => ({ ...prev, [selectedTableId]: waiterId }));
        }
    };

    const handleAddTable = () => {
        if (newTableName) {
            // Calculate next available position
            let row = 0;
            let col = 0;
            let newX = 10;
            let newY = 10;
            let isOccupied = true;

            while (isOccupied) {
                newX = 10 + (col * 30);
                newY = 10 + (row * 40);

                // Check collision with existing tables (allow small margin of error)
                isOccupied = activeTables.some(t => Math.abs(t.x - newX) < 5 && Math.abs(t.y - newY) < 5);

                if (isOccupied) {
                    col++;
                    if (col > 2) { // 3 columns max
                        col = 0;
                        row++;
                    }
                    if (row > 20) break; // Safety break
                }
            }

            const newTable: Table = {
                id: `T${Date.now()}`,
                name: newTableName,
                seats: newTableSeats,
                status: TableStatus.AVAILABLE,
                x: newX,
                y: newY
            };
            setActiveTables(prev => [...prev, newTable]);
            setIsAddTableModalOpen(false);
            setNewTableName('');
            setNewTableSeats(4);
        }
    };

    const handleAddToWaitlist = () => {
        if (customerName) {
            const newEntry: WaitlistEntry = {
                id: `W${Date.now()}`,
                customerName,
                partySize,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'WAITING'
            };
            setWaitlist(prev => [...prev, newEntry]);
            setCustomerName('');
            setPartySize(2);
        }
    };

    const handleDragStart = (e: React.DragEvent, entryId: string) => {
        e.dataTransfer.setData('entryId', entryId);
    };

    const handleDrop = (e: React.DragEvent, tableId: string) => {
        e.preventDefault();
        setIsDraggingOver(null);
        const entryId = e.dataTransfer.getData('entryId');
        const entry = waitlist.find(w => w.id === entryId);
        
        if (entry) {
            // Assign to table
            handleCheckIn(tableId, entry.customerName, entry.partySize);
            // Remove from waitlist
            setWaitlist(prev => prev.filter(w => w.id !== entryId));
        }
    };

    const handleCheckIn = (tableId?: string, forceName?: string, forcePax?: number) => {
        const tId = tableId || selectedTableId;
        if (tId) {
            const reservation = reservations[tId];
            const name = forceName || (reservation ? reservation.name : customerName);
            const pax = forcePax || (reservation ? reservation.pax : partySize);

            if (name) {
                // Update Table Status
                setActiveTables(prev => prev.map(t => t.id === tId ? { ...t, status: TableStatus.OCCUPIED } : t));

                // Create Session
                setCustomerSessions(prev => ({
                    ...prev,
                    [tId]: {
                        name: name,
                        pax: pax,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                }));

                // Remove from reservations if it was one
                if (reservation && !forceName) {
                    const newReservations = { ...reservations };
                    delete newReservations[tId];
                    setReservations(newReservations);
                }

                // Reset Form (if not forced from drag-drop)
                if (!forceName) {
                    setCustomerName('');
                    setPartySize(2);
                }
                
                // Select the table to show waiter assignment
                setSelectedTableId(tId);
            }
        }
    };

    const handleClearTable = () => {
        if (selectedTableId) {
            setActiveTables(prev => prev.map(t => t.id === selectedTableId ? { ...t, status: TableStatus.DIRTY } : t));

            // Optional: Keep session history? For now, just clear active session view or keep it until "Cleaned"
            // Let's remove the session when clearing
            const newSessions = { ...customerSessions };
            delete newSessions[selectedTableId];
            setCustomerSessions(newSessions);

            // Clear waiter?
            const newAssignments = { ...waiterAssignments };
            delete newAssignments[selectedTableId];
            setWaiterAssignments(newAssignments);
        }
    };

    const handleMakeAvailable = () => {
        if (selectedTableId) {
            setActiveTables(prev => prev.map(t => t.id === selectedTableId ? { ...t, status: TableStatus.AVAILABLE } : t));
        }
    };

    const handleReserveTable = () => {
        if (selectedTableId && customerName) {
            // Update Table Status
            setActiveTables(prev => prev.map(t => t.id === selectedTableId ? { ...t, status: TableStatus.RESERVED } : t));

            // Create Reservation
            setReservations(prev => ({
                ...prev,
                [selectedTableId]: {
                    name: customerName,
                    pax: partySize,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    notes: 'Mesa Apartada'
                }
            }));

            // Reset Form (Optional)
            setCustomerName('');
        }
    };

    const handleCancelReservation = () => {
        if (selectedTableId) {
            const newReservations = { ...reservations };
            delete newReservations[selectedTableId];
            setReservations(newReservations);
            handleMakeAvailable();
        }
    };

    const handleChangeReservationTime = () => {
        if (selectedTableId && reservations[selectedTableId]) {
            const current = reservations[selectedTableId];
            const newTime = window.prompt("Enter new time:", current.time);
            if (newTime) {
                setReservations(prev => ({
                    ...prev,
                    [selectedTableId]: { ...current, time: newTime }
                }));
            }
        }
    };

    const getStatusColor = (status: TableStatus) => {
        switch (status) {
            case TableStatus.AVAILABLE: return 'border-green-400 bg-white';
            case TableStatus.OCCUPIED: return 'border-red-400 bg-red-50';
            case TableStatus.RESERVED: return 'border-yellow-400 bg-yellow-50';
            case TableStatus.DIRTY: return 'border-gray-400 bg-gray-200';
            default: return 'border-gray-200 bg-gray-100';
        }
    };

    const selectedTable = activeTables.find(t => t.id === selectedTableId);
    const assignedWaiterId = selectedTableId ? waiterAssignments[selectedTableId] : null;
    const assignedWaiter = assignedWaiterId ? MOCK_STAFF.find(s => s.id === assignedWaiterId) : null;
    const currentSession = selectedTableId ? customerSessions[selectedTableId] : null;
    const currentReservation = selectedTableId ? reservations[selectedTableId] : null;
    const availableWaiters = MOCK_STAFF.filter(s => s.area === 'Service' || s.role.includes('Mesero'));

    return (
        <div className="flex h-full w-full bg-[#F3F4F6] text-gray-800">
            {/* Map Area */}
            <div className="flex-1 p-8 relative overflow-auto">
                <header className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold text-gray-900">Floor Plan</h1>
                        <button
                            onClick={() => setIsAddTableModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg shadow-md hover:bg-primary-dark transition-all"
                        >
                            <span className="material-icons-round text-sm">add</span>
                            Add Table
                        </button>
                    </div>

                    <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                        <button
                            onClick={() => setViewMode('floor')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'floor' ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <span className="material-icons-round text-base">layers</span>
                            Floor Plan
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <span className="material-icons-round text-base">format_list_bulleted</span>
                            List View
                        </button>
                    </div>

                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="text-xs text-gray-500 font-medium">Available</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span className="text-xs text-gray-500 font-medium">Occupied</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <span className="text-xs text-gray-500 font-medium">Reserved</span>
                        </div>
                    </div>
                </header>

                <div className="flex gap-8 h-[calc(100%-100px)]">
                    {/* WAITLIST KANBAN SIDEBAR */}
                    <div className="w-64 bg-gray-50/50 rounded-3xl p-6 border border-gray-200 border-dashed flex flex-col shrink-0 overflow-hidden">
                        <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest mb-6 flex items-center gap-2">
                             <span className="material-icons-round text-sm">hourglass_empty</span>
                             Lista de Espera
                             <span className="ml-auto bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded text-[8px]">{waitlist.length}</span>
                        </h3>
                        
                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                            {waitlist.length > 0 ? waitlist.map(entry => (
                                <div
                                    key={entry.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, entry.id)}
                                    className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all group border-l-4 border-l-primary"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-gray-900 text-sm leading-tight">{entry.customerName}</h4>
                                        <span className="text-[9px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full">{entry.timestamp}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
                                            <span className="material-icons-round text-xs">groups</span>
                                            {entry.partySize} PAX
                                        </div>
                                        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                             <span className="material-icons-round text-gray-300 text-sm">drag_indicator</span>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                                    <span className="material-icons-round text-3xl mb-2 text-gray-300">hourglass_disabled</span>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Sin Espera</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 min-h-[600px] border-2 border-dashed border-gray-300 rounded-3xl relative bg-white shadow-soft overflow-hidden">
                        {viewMode === 'floor' ? (
                            <div className="relative w-full h-full p-8" onDragOver={(e) => e.preventDefault()}>
                                {activeTables.map(table => {
                                    const waiterId = waiterAssignments[table.id];
                                    const waiter = waiterId ? MOCK_STAFF.find(s => s.id === waiterId) : null;
                                    const session = customerSessions[table.id];
                                    const reservation = reservations[table.id];

                                    return (
                                        <div
                                            key={table.id}
                                            onClick={() => setSelectedTableId(table.id)}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                if (table.status === TableStatus.AVAILABLE) setIsDraggingOver(table.id);
                                            }}
                                            onDragLeave={() => setIsDraggingOver(null)}
                                            onDrop={(e) => handleDrop(e, table.id)}
                                            style={{ left: `${table.x}%`, top: `${table.y}%` }}
                                            className={`absolute w-32 h-24 border-2 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110 shadow-lg ${getStatusColor(table.status)} ${selectedTableId === table.id ? 'ring-4 ring-primary ring-opacity-30' : ''} ${isDraggingOver === table.id ? 'ring-4 ring-green-400 scale-110 !border-green-400' : ''}`}
                                        >
                                            <span className="font-bold text-lg text-gray-900">{table.name}</span>
                                            {session ? (
                                                <div className="text-xs text-center">
                                                    <p className="font-bold text-gray-800 truncate w-28 px-1">{session.name}</p>
                                                    <p className="text-gray-500">{session.pax} Guests</p>
                                                </div>
                                            ) : reservation ? (
                                                <div className="text-xs text-center">
                                                    <div className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-[10px] font-bold mb-1">{reservation.time}</div>
                                                    <p className="font-bold text-gray-800 truncate w-28 px-1">{reservation.name}</p>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-500 font-medium">{table.seats} Seats</span>
                                            )}

                                            {/* Waiter Indicator */}
                                            {waiter && (
                                                <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full border-2 border-white shadow-md overflow-hidden" title={`Assigned to ${waiter.name}`}>
                                                    <img src={waiter.image} alt={waiter.name} className="w-full h-full object-cover" />
                                                </div>
                                            )}

                                            {/* Chairs (Visual Flourish) */}
                                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-2 h-12 bg-gray-200 rounded-l-md"></div>
                                            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-2 h-12 bg-gray-200 rounded-r-md"></div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-8 h-full overflow-y-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Mesa</th>
                                            <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Estado</th>
                                            <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Capacidad</th>
                                            <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Cliente</th>
                                            <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Mesero</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {activeTables.map(table => {
                                            const session = customerSessions[table.id];
                                            const waiterId = waiterAssignments[table.id];
                                            const waiter = waiterId ? MOCK_STAFF.find(s => s.id === waiterId) : null;
                                            
                                            return (
                                                <tr 
                                                    key={table.id} 
                                                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedTableId === table.id ? 'bg-primary/5' : ''}`}
                                                    onClick={() => setSelectedTableId(table.id)}
                                                >
                                                    <td className="py-4 font-bold text-gray-900">{table.name}</td>
                                                    <td className="py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                            table.status === TableStatus.AVAILABLE ? 'bg-green-50 text-green-600' :
                                                            table.status === TableStatus.OCCUPIED ? 'bg-red-50 text-red-600' :
                                                            table.status === TableStatus.RESERVED ? 'bg-yellow-50 text-yellow-600' :
                                                            'bg-gray-100 text-gray-600'
                                                        }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                                table.status === TableStatus.AVAILABLE ? 'bg-green-500' :
                                                                table.status === TableStatus.OCCUPIED ? 'bg-red-500' :
                                                                table.status === TableStatus.RESERVED ? 'bg-yellow-500' :
                                                                'bg-gray-400'
                                                            }`}></span>
                                                            {table.status}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 text-sm text-gray-500 font-medium">{table.seats} Pers.</td>
                                                    <td className="py-4">
                                                        {session ? (
                                                            <div>
                                                                <p className="text-sm font-bold text-gray-900">{session.name}</p>
                                                                <p className="text-[10px] text-gray-400 uppercase font-black tracking-tight">{session.pax} PAX • {session.time}</p>
                                                            </div>
                                                        ) : <span className="text-gray-300">—</span>}
                                                    </td>
                                                    <td className="py-4">
                                                        {waiter ? (
                                                            <div className="flex items-center gap-2">
                                                                <img src={waiter.image} className="w-6 h-6 rounded-full" alt="" />
                                                                <span className="text-sm font-medium text-gray-700">{waiter.name}</span>
                                                            </div>
                                                        ) : <span className="text-gray-300">—</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Side Panel */}
            <aside className="w-96 bg-white border-l border-gray-100 p-6 flex flex-col shadow-xl overflow-y-auto">
                <div className="mb-8 p-5 bg-primary/5 rounded-2xl border-2 border-primary/10 shadow-inner">
                    <h3 className="font-bold text-primary mb-4 flex items-center gap-2">
                        <span className="material-icons-round">person_add</span>
                        Cliente Actual / Walk-in
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Nombre del Cliente</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-bold text-gray-700"
                                placeholder="Escribe el nombre..."
                            />
                        </div>
                        <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-gray-100">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Personas</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setPartySize(Math.max(1, partySize - 1))} className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center font-bold text-gray-500 border border-gray-100 transition-colors">-</button>
                                <span className="font-bold text-lg w-6 text-center text-primary">{partySize}</span>
                                <button onClick={() => setPartySize(partySize + 1)} className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center font-bold text-gray-500 border border-gray-100 transition-colors">+</button>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 mt-4">
                        <button
                            onClick={handleAddToWaitlist}
                            disabled={!customerName}
                            className="w-full py-4 bg-primary text-white rounded-xl font-black text-sm shadow-lg shadow-primary/30 hover:bg-primary-dark transition-all transform active:scale-95 flex items-center justify-center gap-2"
                        >
                            <span className="material-icons-round">person_add_alt</span>
                            Registrar Cliente
                        </button>
                    </div>
                </div>

                <div className="mb-6 pb-6 border-b border-gray-100">
                    <h2 className="text-xl font-black mb-1 text-gray-900 tracking-tight">{selectedTable ? selectedTable.name : 'Selecciona una Mesa'}</h2>
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">Panel de Control</p>
                </div>

                {selectedTable ? (
                    <div className="flex flex-col gap-6 animate-in fade-in">
                        {/* Status Card */}
                        <div className="bg-gray-50 p-4 rounded-xl flex justify-between items-center">
                            <div>
                                <span className="text-xs text-gray-400 uppercase font-bold">Current Status</span>
                                <div className={`text-lg font-bold mt-1 ${selectedTable.status === TableStatus.AVAILABLE ? 'text-green-600' :
                                    selectedTable.status === TableStatus.OCCUPIED ? 'text-red-500' :
                                        selectedTable.status === TableStatus.RESERVED ? 'text-yellow-600' :
                                            'text-gray-700'}`}>
                                    {selectedTable.status}
                                </div>
                            </div>
                            {currentSession && (
                                <div className="text-right">
                                    <div className="text-xs text-gray-400 font-bold">Time</div>
                                    <div className="text-lg font-mono">{currentSession.time}</div>
                                </div>
                            )}
                        </div>

                        {/* RESERVATION DETAILS CARD */}
                        {currentReservation && selectedTable.status === TableStatus.RESERVED && (
                            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 shadow-sm">
                                <h3 className="font-bold text-yellow-800 mb-3 flex items-center gap-2">
                                    <span className="material-icons-round">event_seat</span>
                                    Reservation Info
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-yellow-700 text-sm">Guest</span>
                                        <span className="font-bold text-gray-900">{currentReservation.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-yellow-700 text-sm">Time</span>
                                        <span className="font-bold text-gray-900">{currentReservation.time}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-yellow-700 text-sm">Party Size</span>
                                        <span className="font-bold text-gray-900">{currentReservation.pax} Guests</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    <button
                                        onClick={handleChangeReservationTime}
                                        className="py-2 bg-white border border-yellow-200 text-yellow-700 rounded-lg text-sm font-bold hover:bg-yellow-50"
                                    >
                                        Edit Time
                                    </button>
                                    <button
                                        onClick={handleCancelReservation}
                                        className="py-2 bg-white border border-red-200 text-red-500 rounded-lg text-sm font-bold hover:bg-red-50"
                                    >
                                        Cancel Res.
                                    </button>
                                </div>
                                <button
                                    onClick={handleCheckIn}
                                    className="w-full mt-2 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-bold shadow-lg shadow-yellow-200 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-icons-round">check</span>
                                    Check In Guest
                                </button>
                            </div>
                        )}

                        {/* Check-In Action (Only if Available) */}
                        {selectedTable.status === TableStatus.AVAILABLE && !currentSession && (
                            <div className="space-y-3">
                                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                                    <p className="text-xs text-green-700 font-medium mb-3">Asignar mesa a <b>{customerName || 'Sin Nombre'}</b> con <b>{partySize}</b> personas.</p>
                                    <div className="grid grid-cols-1 gap-3">
                                        <button
                                            onClick={handleCheckIn}
                                            disabled={!customerName}
                                            className="w-full py-4 bg-primary text-white rounded-xl font-black text-sm shadow-lg shadow-primary/30 disabled:opacity-50 disabled:shadow-none hover:bg-primary-dark transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <span className="material-icons-round">event_seat</span>
                                            OCUPAR MESA (SEAT)
                                        </button>
                                        <button
                                            onClick={handleReserveTable}
                                            disabled={!customerName}
                                            className="w-full py-3 bg-yellow-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md shadow-yellow-100 disabled:opacity-50 hover:bg-yellow-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <span className="material-icons-round text-sm">bookmark</span>
                                            APARTAR MESA (RESERVE)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Active Session Info */}
                        {currentSession && (
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                <h3 className="font-bold text-blue-800 mb-2">Customer Details</h3>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-blue-600">Name</span>
                                    <span className="font-bold text-gray-800">{currentSession.name}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-blue-600">Guests</span>
                                    <span className="font-bold text-gray-800">{currentSession.pax} People</span>
                                </div>
                            </div>
                        )}

                        {/* Waiter Assignment Section */}
                        {selectedTable.status === TableStatus.OCCUPIED && (
                            <div>
                                <span className="text-xs text-gray-400 uppercase font-bold block mb-3">Assigned Waiter</span>
                                <div className="grid grid-cols-3 gap-2">
                                    {availableWaiters.map(waiter => (
                                        <button
                                            key={waiter.id}
                                            onClick={() => handleAssignWaiter(waiter.id)}
                                            className={`flex flex-col items-center p-2 rounded-xl border transition-all ${assignedWaiterId === waiter.id
                                                ? 'border-primary bg-primary/10'
                                                : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            <div className="w-10 h-10 rounded-full overflow-hidden mb-1">
                                                <img src={waiter.image} alt={waiter.name} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-700 text-center leading-tight">{waiter.name.split(' ')[0]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="border-t border-gray-100 pt-6 space-y-3">
                            {selectedTable.status === TableStatus.OCCUPIED && (
                                <button onClick={handleClearTable} className="w-full py-3 bg-white border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                                    <span className="material-icons-round">cleaning_services</span>
                                    Mark as Dirty / Clear
                                </button>
                            )}
                            {selectedTable.status === TableStatus.DIRTY && (
                                <button onClick={handleMakeAvailable} className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-200">
                                    Mark as Clean & Available
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300 text-center">
                        <span className="material-icons-round text-5xl mb-4">touch_app</span>
                        <p>Tap a table on the floor plan to view details and manage seating.</p>
                    </div>
                )}
            </aside>

            {/* Add Table Modal */}
            {isAddTableModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
                    <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Table</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Table Name</label>
                                <input
                                    type="text"
                                    value={newTableName}
                                    onChange={(e) => setNewTableName(e.target.value)}
                                    placeholder="e.g. Mesa 10"
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-primary transition-all"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Seats</label>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setNewTableSeats(Math.max(1, newTableSeats - 1))}
                                        className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600 transition-all"
                                    >
                                        -
                                    </button>
                                    <span className="font-bold text-2xl w-8 text-center">{newTableSeats}</span>
                                    <button
                                        onClick={() => setNewTableSeats(newTableSeats + 1)}
                                        className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center font-bold text-gray-600 transition-all"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setIsAddTableModalOpen(false)}
                                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddTable}
                                    disabled={!newTableName}
                                    className="flex-1 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold shadow-lg shadow-primary/30 disabled:opacity-50 disabled:shadow-none transition-all"
                                >
                                    Add Table
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};