import React, { useState } from 'react';
import { TABLES, MOCK_STAFF } from '../constants';
import { Table, TableStatus, WaitlistEntry, OrderStatus } from '../types';
import { useTables } from '../contexts/TableContext';
import { useOrders } from '../contexts/OrderContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Plus, UserPlus, Hourglass, Users, GripVertical, 
    Bookmark, Check, Edit3, Trash2, XCircle, 
    RotateCw, Monitor, Layers, List as ListIcon, AlertTriangle
} from 'lucide-react';

export const HostessScreen: React.FC = () => {
    // Table State
    const { tables: activeTables, addTable, updateTableStatus, deleteTable, updateTable } = useTables();
    const { orders, updateOrderStatus } = useOrders();
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
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
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

            const newTable: Omit<Table, 'id'> = {
                name: newTableName,
                seats: newTableSeats,
                status: TableStatus.AVAILABLE,
                x: newX,
                y: newY
            };
            addTable(newTable);
            setIsAddTableModalOpen(false);
            setNewTableName('');
            setNewTableSeats(4);
        }
    };

    const handleUpdateTable = () => {
        if (selectedTableId && newTableName) {
            updateTable(selectedTableId, {
                name: newTableName,
                seats: newTableSeats
            });
            setIsEditModalOpen(false);
            setNewTableName('');
            setNewTableSeats(4);
        }
    };

    const handleOpenEditModal = () => {
        if (selectedTable) {
            setNewTableName(selectedTable.name);
            setNewTableSeats(selectedTable.seats);
            setIsEditModalOpen(true);
        }
    };

    const handleDeleteTableAction = () => {
        if (selectedTableId) {
            deleteTable(selectedTableId);
            setIsDeleteConfirmOpen(false);
            setSelectedTableId(null);
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
                updateTableStatus(tId, TableStatus.OCCUPIED);

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
            updateTableStatus(selectedTableId, TableStatus.DIRTY);

            const newSessions = { ...customerSessions };
            delete newSessions[selectedTableId];
            setCustomerSessions(newSessions);

            const newAssignments = { ...waiterAssignments };
            delete newAssignments[selectedTableId];
            setWaiterAssignments(newAssignments);
        }
    };

    const handleMakeAvailable = () => {
        if (selectedTableId) {
            updateTableStatus(selectedTableId, TableStatus.AVAILABLE);
        }
    };

    const handleCancelOrder = () => {
        if (selectedTableId && window.confirm('¿Estás seguro de que deseas CANCELAR esta comanda? Esta acción no se puede deshacer.')) {
            const activeOrder = orders.find(o => 
                (o.tableId === selectedTableId || o.tableName === selectedTable?.name) && 
                ['PENDING', 'COOKING', 'READY', 'SERVED'].includes(o.status)
            );

            if (activeOrder) {
                updateOrderStatus(activeOrder.id, OrderStatus.CANCELLED);
            }

            handleClearTable();
            handleMakeAvailable();
        }
    };

    const handleReserveTable = () => {
        if (selectedTableId && customerName) {
            updateTableStatus(selectedTableId, TableStatus.RESERVED);

            setReservations(prev => ({
                ...prev,
                [selectedTableId]: {
                    name: customerName,
                    pax: partySize,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    notes: 'Mesa Apartada'
                }
            }));

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

    const selectedTable = activeTables.find(t => t.id === selectedTableId);
    const assignedWaiterId = selectedTableId ? waiterAssignments[selectedTableId] : null;
    const assignedWaiter = assignedWaiterId ? MOCK_STAFF.find(s => s.id === assignedWaiterId) : null;
    const currentSession = selectedTableId ? customerSessions[selectedTableId] : null;
    const currentReservation = selectedTableId ? reservations[selectedTableId] : null;
    const availableWaiters = MOCK_STAFF.filter(s => s.area === 'Service' || s.role.includes('Mesero'));

    return (
        <div className="flex flex-col h-full w-full bg-[#F0F0E8] text-[#505530]/70 font-sans antialiased overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Header */}
                <header className="flex flex-wrap justify-between items-center gap-3 p-4 md:p-8 shrink-0">
                    <div className="flex items-center gap-4">
                        <div>
                            <h1 className="text-2xl md:text-4xl font-black italic tracking-tighter uppercase text-[#1a1c14]">Floor Plan</h1>
                            <p className="text-solaris-orange/40 font-bold text-[9px] md:text-[10px] uppercase tracking-[0.4em]">Active Node Orchestration</p>
                        </div>
                        <button
                            onClick={() => setIsAddTableModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-3 bg-solaris-orange text-[#1a1c14] rounded-xl shadow-solaris-glow hover:scale-105 transition-all text-[9px] font-black uppercase tracking-widest"
                        >
                            <Plus size={14} />
                            Mesa
                        </button>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex bg-white/[0.03] border border-white/5 p-1 rounded-[20px]">
                            <button
                                onClick={() => setViewMode('floor')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'floor' ? 'bg-white/10 text-[#1a1c14] shadow-xl' : 'text-[#505530]/30 hover:text-[#1a1c14]'}`}
                            >
                                Floor
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white/10 text-[#1a1c14] shadow-xl' : 'text-[#505530]/30 hover:text-[#1a1c14]'}`}
                            >
                                Lista
                            </button>
                        </div>

                        <div className="hidden md:flex gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-[9px] text-solaris-orange/40 font-black uppercase tracking-widest italic">Libre</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-[9px] text-solaris-orange/40 font-black uppercase tracking-widest italic">Ocupada</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                <span className="text-[9px] text-solaris-orange/40 font-black uppercase tracking-widest italic">Reservada</span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Map + Waitlist area */}
                <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0 overflow-hidden px-4 md:px-8 pb-4">
                    {/* WAITLIST KANBAN SIDEBAR — hidden on mobile, drawer on tablet+ */}
                    <div className="hidden md:flex w-64 bg-white/[0.02] rounded-2xl p-5 border border-white/5 flex-col shrink-0 overflow-hidden shadow-2xl">
                        <h3 className="font-black text-solaris-orange/40 text-[9px] uppercase tracking-[0.4em] mb-5 flex items-center gap-2 italic">
                             <Hourglass size={12} />
                             Waitlist
                             <span className="ml-auto bg-solaris-orange text-[#1a1c14] px-2 py-0.5 rounded-lg text-[8px] font-black">{waitlist.length}</span>
                        </h3>
                        
                        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
                            {waitlist.length > 0 ? waitlist.map(entry => (
                                <div
                                    key={entry.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, entry.id)}
                                    className="bg-white p-6 rounded-2xl border border-white/5 shadow-xl cursor-grab active:cursor-grabbing hover:border-solaris-orange/20 transition-all group relative overflow-hidden"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="font-black italic text-[#1a1c14] text-sm uppercase tracking-tight leading-tight">{entry.customerName}</h4>
                                        <span className="text-[8px] font-black text-solaris-orange bg-solaris-orange/10 px-2 py-1 rounded-lg border border-solaris-orange/20">{entry.timestamp}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2 text-[10px] text-[#505530]/55 font-black italic">
                                            <Users size={12} />
                                            {entry.partySize} PAX
                                        </div>
                                    </div>
                                    <div className="absolute right-2 bottom-6 opacity-0 group-hover:opacity-10 transition-opacity">
                                         <GripVertical size={24} className="text-[#1a1c14]" />
                                    </div>
                                </div>
                            )) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-10">
                                    <Hourglass size={48} className="mb-4 text-[#1a1c14]" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#1a1c14]">Zero Queue</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Table Map / List */}
                    <div
                        className="flex-1 border border-white/5 rounded-2xl relative bg-white/30 shadow-2xl"
                        style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
                    >
                        {viewMode === 'floor' ? (
                            <div className="relative w-full p-6 min-w-[600px] min-h-[500px]" onDragOver={(e) => e.preventDefault()}>
                                <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
                                {activeTables.map(table => {
                                    const waiterId = waiterAssignments[table.id];
                                    const waiter = waiterId ? MOCK_STAFF.find(s => s.id === waiterId) : null;
                                    const session = customerSessions[table.id];
                                    const reservation = reservations[table.id];
                                    const isSelected = selectedTableId === table.id;
                                    const isOccupied = table.status === TableStatus.OCCUPIED;
                                    const isReserved = table.status === TableStatus.RESERVED;

                                    return (
                                        <motion.div
                                            key={table.id}
                                            layout
                                            initial={false}
                                            onClick={() => setSelectedTableId(table.id)}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                if (table.status === TableStatus.AVAILABLE) setIsDraggingOver(table.id);
                                            }}
                                            onDragLeave={() => setIsDraggingOver(null)}
                                            onDrop={(e) => handleDrop(e, table.id)}
                                            style={{ left: `${table.x}%`, top: `${table.y}%` }}
                                            className={`absolute w-36 h-28 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 shadow-2xl border-2 ${
                                                isSelected ? 'border-solaris-orange shadow-solaris-glow scale-110 z-20' : 
                                                isDraggingOver === table.id ? 'border-green-500 bg-green-500/10 scale-110' :
                                                isOccupied ? 'border-red-500/20 bg-red-500/5' :
                                                isReserved ? 'border-yellow-500/20 bg-yellow-500/5' :
                                                'border-white/10 bg-white/[0.02] hover:border-white/30'
                                            }`}
                                        >
                                            <span className={`font-black italic text-xl uppercase tracking-tighter transition-colors ${isSelected ? 'text-[#1a1c14]' : 'text-[#505530]/60'}`}>{table.name}</span>
                                            {session ? (
                                                <div className="text-center mt-2 px-3">
                                                    <p className="font-black italic text-[10px] text-[#1a1c14] uppercase tracking-tight truncate w-full">{session.name}</p>
                                                    <p className="text-[8px] font-black text-solaris-orange/60 uppercase tracking-widest italic">{session.pax} Guests</p>
                                                </div>
                                            ) : reservation ? (
                                                <div className="text-center mt-2 px-3">
                                                    <div className="bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest mb-1 border border-yellow-500/20">{reservation.time}</div>
                                                    <p className="font-black italic text-[10px] text-[#1a1c14] uppercase tracking-tight truncate w-full">{reservation.name}</p>
                                                </div>
                                            ) : (
                                                <span className="text-[9px] font-black text-[#505530]/30 uppercase tracking-widest mt-2">{table.seats} Seats</span>
                                            )}

                                            {/* Waiter Indicator */}
                                            {waiter && (
                                                <div className="absolute -top-4 -right-4 w-10 h-10 rounded-full border-2 border-white/20 shadow-2xl overflow-hidden ring-4 ring-black/50" title={`Assigned to ${waiter.name}`}>
                                                    <img src={waiter.image} alt={waiter.name} className="w-full h-full object-cover" />
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-12 h-full overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left border-separate border-spacing-y-4">
                                    <thead>
                                        <tr>
                                            <th className="pb-4 px-6 text-[10px] font-black text-solaris-orange/40 uppercase tracking-[0.4em] italic">Designación Nodo</th>
                                            <th className="pb-4 px-6 text-[10px] font-black text-solaris-orange/40 uppercase tracking-[0.4em] italic">Protocolo Estado</th>
                                            <th className="pb-4 px-6 text-[10px] font-black text-solaris-orange/40 uppercase tracking-[0.4em] italic">Métrica Pax</th>
                                            <th className="pb-4 px-6 text-[10px] font-black text-solaris-orange/40 uppercase tracking-[0.4em] italic">Asignación Cliente</th>
                                            <th className="pb-4 px-6 text-[10px] font-black text-solaris-orange/40 uppercase tracking-[0.4em] italic">Unidad de Servicio</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeTables.map(table => {
                                            const session = customerSessions[table.id];
                                            const waiterId = waiterAssignments[table.id];
                                            const waiter = waiterId ? MOCK_STAFF.find(s => s.id === waiterId) : null;
                                            const isSelected = selectedTableId === table.id;
                                            
                                            return (
                                                <tr 
                                                    key={table.id} 
                                                    className={`transition-all cursor-pointer group ${isSelected ? 'scale-[1.01]' : ''}`}
                                                    onClick={() => setSelectedTableId(table.id)}
                                                >
                                                    <td className={`py-6 px-6 bg-white/[0.02] border-y border-l border-white/5 rounded-l-[24px] font-black italic text-[#1a1c14] uppercase tracking-tight group-hover:bg-white/[0.05] ${isSelected ? '!border-solaris-orange/40 !bg-solaris-orange/10' : ''}`}>{table.name}</td>
                                                    <td className={`py-6 px-6 bg-white/[0.02] border-y border-white/5 group-hover:bg-white/[0.05] ${isSelected ? '!border-solaris-orange/40 !bg-solaris-orange/10' : ''}`}>
                                                        <span className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                                            table.status === TableStatus.AVAILABLE ? 'bg-green-500/10 text-green-500' :
                                                            table.status === TableStatus.OCCUPIED ? 'bg-red-500/10 text-red-500' :
                                                            table.status === TableStatus.RESERVED ? 'bg-yellow-500/10 text-yellow-500' :
                                                            'bg-white/5 text-[#505530]/55'
                                                        }`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${
                                                                table.status === TableStatus.AVAILABLE ? 'bg-green-500' :
                                                                table.status === TableStatus.OCCUPIED ? 'bg-red-500' :
                                                                table.status === TableStatus.RESERVED ? 'bg-yellow-500' :
                                                                'bg-white/40'
                                                            }`}></div>
                                                            {table.status}
                                                        </span>
                                                    </td>
                                                    <td className={`py-6 px-6 bg-white/[0.02] border-y border-white/5 font-black italic text-[#505530]/60 text-xs tracking-widest group-hover:bg-white/[0.05] ${isSelected ? '!border-solaris-orange/40 !bg-solaris-orange/10' : ''}`}>{table.seats} PERS.</td>
                                                    <td className={`py-6 px-6 bg-white/[0.02] border-y border-white/5 group-hover:bg-white/[0.05] ${isSelected ? '!border-solaris-orange/40 !bg-solaris-orange/10' : ''}`}>
                                                        {session ? (
                                                            <div>
                                                                <p className="text-xs font-black italic text-[#1a1c14] uppercase tracking-tight">{session.name}</p>
                                                                <p className="text-[9px] text-solaris-orange/40 uppercase font-black tracking-widest mt-1 italic">{session.pax} PAX • {session.time}</p>
                                                            </div>
                                                        ) : <span className="text-[#505530]/10 font-black tracking-widest opacity-20">---</span>}
                                                    </td>
                                                    <td className={`py-6 px-6 bg-white/[0.02] border-y border-r border-white/5 rounded-r-[24px] group-hover:bg-white/[0.05] ${isSelected ? '!border-solaris-orange/40 !bg-solaris-orange/10' : ''}`}>
                                                        {waiter ? (
                                                            <div className="flex items-center gap-3">
                                                                <img src={waiter.image} className="w-8 h-8 rounded-full border border-white/10" alt="" />
                                                                <span className="text-[10px] font-black italic text-[#505530]/60 uppercase tracking-widest">{waiter.name}</span>
                                                            </div>
                                                        ) : <span className="text-[#505530]/10 font-black tracking-widest opacity-20">---</span>}
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

            {/* Side Panel — Full width below on mobile, fixed right column on desktop */}
            <aside
                className="w-full md:w-[380px] lg:w-[420px] bg-[#F0F0E8] border-t md:border-t-0 md:border-l border-white/10 flex flex-col shadow-2xl shrink-0"
                style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', maxHeight: selectedTableId ? '55vh' : '220px' }}
            >
                <div className="p-5 md:p-8 flex flex-col gap-5 flex-1">
                {/* Walk-in terminal — compact on mobile */}
                <div className="mb-5 p-5 bg-white/[0.02] rounded-2xl border border-white/5 shadow-inner relative overflow-hidden">
                    <h3 className="font-black italic text-[#1a1c14] text-xs uppercase tracking-tight mb-4 flex items-center gap-2">
                        <UserPlus size={14} className="text-solaris-orange" />
                        Walk-in
                    </h3>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="flex-1 p-3 bg-white/[0.03] border border-white/10 rounded-xl outline-none focus:border-solaris-orange/40 text-[#1a1c14] font-bold transition-all text-sm placeholder:text-[#505530]/30 shadow-inner"
                            placeholder="Nombre cliente..."
                        />
                        <div className="flex items-center gap-2 bg-white/[0.02] px-3 rounded-xl border border-white/5">
                            <button onClick={() => setPartySize(Math.max(1, partySize - 1))} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center font-black text-[#1a1c14] text-lg">-</button>
                            <span className="font-black italic text-lg text-solaris-orange w-6 text-center">{partySize}</span>
                            <button onClick={() => setPartySize(partySize + 1)} className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center font-black text-[#1a1c14] text-lg">+</button>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={handleAddToWaitlist}
                            disabled={!customerName}
                            className="flex-1 py-3 bg-solaris-orange text-[#1a1c14] rounded-xl font-black italic uppercase text-[9px] tracking-widest shadow-solaris-glow hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-20"
                        >
                            <Hourglass size={14} />
                            En Espera
                        </button>
                    </div>
                </div>

                <div className="mb-4 pb-4 border-b border-white/10">
                    <h2 className="text-xl font-black italic text-[#1a1c14] tracking-tighter uppercase">{selectedTable ? selectedTable.name : 'Sin selección'}</h2>
                    <p className="text-solaris-orange/40 text-[8px] font-black uppercase tracking-[0.4em] italic">Consola de Mesa</p>
                </div>

                {selectedTable ? (
                    <div className="flex flex-col gap-6 animate-in fade-in">
                        {/* Status Card */}
                        <div className="bg-white/[0.03] p-6 rounded-2xl border border-white/5 flex justify-between items-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-solaris-orange"></div>
                            <div>
                                <span className="text-[9px] text-solaris-orange/40 uppercase font-black tracking-widest block mb-2 italic">Vector de Estado</span>
                                <div className={`text-xl font-black italic uppercase tracking-tight ${selectedTable.status === TableStatus.AVAILABLE ? 'text-green-500' :
                                    selectedTable.status === TableStatus.OCCUPIED ? 'text-red-500' :
                                        selectedTable.status === TableStatus.RESERVED ? 'text-yellow-500' :
                                            'text-[#1a1c14]'}`}>
                                    {selectedTable.status}
                                </div>
                            </div>
                            {currentSession && (
                                <div className="text-right">
                                    <div className="text-[9px] text-solaris-orange/40 font-black uppercase tracking-widest mb-2 italic">Tiempo de Sesión</div>
                                    <div className="text-xl font-mono text-[#1a1c14] font-black">{currentSession.time}</div>
                                </div>
                            )}
                        </div>

                        {/* RESERVATION DETAILS CARD */}
                        {currentReservation && selectedTable.status === TableStatus.RESERVED && (
                            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-6 shadow-2xl">
                                <h3 className="font-black italic text-yellow-500 mb-6 flex items-center gap-3 uppercase text-xs tracking-widest">
                                    <Bookmark size={16} />
                                    Reservación Detalle
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <span className="text-solaris-orange/40 text-[10px] uppercase font-black tracking-widest italic">Huésped</span>
                                        <span className="font-black italic text-[#1a1c14] uppercase text-sm tracking-tight">{currentReservation.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <span className="text-solaris-orange/40 text-[10px] uppercase font-black tracking-widest italic">Cronograma</span>
                                        <span className="font-black italic text-[#1a1c14] uppercase text-sm tracking-tight">{currentReservation.time}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                                        <span className="text-solaris-orange/40 text-[10px] uppercase font-black tracking-widest italic">Métrica Pax</span>
                                        <span className="font-black italic text-[#1a1c14] uppercase text-sm tracking-tight">{currentReservation.pax} PAX</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mt-8">
                                    <button
                                        onClick={handleChangeReservationTime}
                                        className="py-4 bg-white/5 border border-white/10 text-[#1a1c14] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all italic"
                                    >
                                        Edit Time
                                    </button>
                                    <button
                                        onClick={handleCancelReservation}
                                        className="py-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all italic"
                                    >
                                        Drop Res.
                                    </button>
                                </div>
                                <button
                                    onClick={handleCheckIn}
                                    className="w-full mt-3 py-5 bg-white text-black rounded-[24px] font-black italic uppercase text-[11px] tracking-[0.2em] shadow-2xl hover:scale-[1.02] transition-all flex items-center justify-center gap-4"
                                >
                                    <Check size={18} />
                                    Sincronizar Check-In
                                </button>
                            </div>
                        )}

                        {/* Check-In Action (Only if Available) */}
                        {selectedTable.status === TableStatus.AVAILABLE && !currentSession && (
                            <div className="space-y-4">
                                <div className="p-6 bg-white/[0.02] rounded-2xl border border-white/10">
                                    <p className="text-[10px] text-solaris-orange/40 font-black uppercase tracking-widest mb-6 italic">Asignar mesa a <b className="text-solaris-orange underline decoration-orange-500/30 underline-offset-4">{customerName || 'Designación Vacía'}</b> con <b className="text-[#1a1c14]">{partySize}</b> personas.</p>
                                    <div className="grid grid-cols-1 gap-4">
                                        <button
                                            onClick={handleCheckIn}
                                            disabled={!customerName}
                                            className="w-full py-5 bg-solaris-orange text-[#1a1c14] rounded-[24px] font-black italic uppercase text-[11px] tracking-[0.3em] shadow-solaris-glow hover:scale-[1.02] transition-all transform active:scale-95 flex items-center justify-center gap-4 disabled:opacity-20 disabled:grayscale"
                                        >
                                            <Users size={18} />
                                            Ocupar Mesa (Seat)
                                        </button>
                                        <button
                                            onClick={handleReserveTable}
                                            disabled={!customerName}
                                            className="w-full py-4 bg-white/5 border border-white/10 text-[#1a1c14] rounded-xl font-black italic uppercase text-[9px] tracking-widest hover:bg-white/10 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-20"
                                        >
                                            <Bookmark size={14} className="text-yellow-500" />
                                            Apartar Mesa (Reserve)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Active Session Info */}
                        {currentSession && (
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6">
                                <h3 className="font-black italic text-blue-500 mb-4 uppercase text-[10px] tracking-widest">Log de Sesión</h3>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-solaris-orange/40 text-[10px] font-black uppercase tracking-widest italic">Huésped</span>
                                    <span className="font-black italic text-[#1a1c14] uppercase text-sm tracking-tight">{currentSession.name}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-solaris-orange/40 text-[10px] font-black uppercase tracking-widest italic">Métrica Pax</span>
                                    <span className="font-black italic text-[#1a1c14] uppercase text-sm tracking-tight">{currentSession.pax} Guests</span>
                                </div>
                            </div>
                        )}

                        {/* Waiter Assignment Section */}
                        {selectedTable.status === TableStatus.OCCUPIED && (
                            <div>
                                <span className="text-[9px] text-solaris-orange/40 uppercase font-black tracking-[0.4em] block mb-4 italic">Asignación de Unidad</span>
                                <div className="grid grid-cols-3 gap-3">
                                    {availableWaiters.map(waiter => (
                                        <button
                                            key={waiter.id}
                                            onClick={() => handleAssignWaiter(waiter.id)}
                                            className={`flex flex-col items-center p-3 rounded-2xl border transition-all ${assignedWaiterId === waiter.id
                                                ? 'border-solaris-orange bg-solaris-orange/10'
                                                : 'border-white/5 bg-white/[0.02] hover:border-white/20'
                                                }`}
                                        >
                                            <div className="w-12 h-12 rounded-full overflow-hidden mb-2 border border-white/10">
                                                <img src={waiter.image} alt={waiter.name} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="text-[9px] font-black text-[#505530]/60 text-center leading-tight uppercase tracking-tighter truncate w-full">{waiter.name.split(' ')[0]}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="border-t border-white/10 pt-8 space-y-4">
                            <div className="flex gap-3 mb-4">
                                <button 
                                    onClick={handleOpenEditModal}
                                    className="flex-1 py-4 bg-white/5 border border-white/10 text-[#505530]/60 rounded-xl font-black uppercase italic text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-white/10 transition-all"
                                >
                                    <Edit3 size={14} />
                                    Ajustes
                                </button>
                                <button 
                                    onClick={() => setIsDeleteConfirmOpen(true)}
                                    className="flex-1 py-4 bg-red-500/5 border border-red-500/10 text-red-500/60 rounded-xl font-black uppercase italic text-[10px] tracking-widest flex items-center justify-center gap-3 hover:bg-red-500/10 transition-all"
                                >
                                    <Trash2 size={14} />
                                    Remover
                                </button>
                            </div>

                            {selectedTable.status === TableStatus.OCCUPIED && (
                                <>
                                    <button onClick={handleCancelOrder} className="w-full py-5 bg-red-600 text-[#1a1c14] rounded-[24px] font-black italic uppercase text-[11px] tracking-[0.3em] shadow-[0_15px_30px_rgba(220,38,38,0.3)] hover:scale-[1.02] transition-all flex items-center justify-center gap-4 mb-4">
                                        <XCircle size={18} />
                                        Abortar Comanda
                                    </button>
                                    <button onClick={handleClearTable} className="w-full py-4 bg-white/[0.03] border border-white/10 hover:bg-white/10 text-[#1a1c14] rounded-xl font-black italic uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-3">
                                        <RotateCw size={14} />
                                        Estatus Post-Servicio
                                    </button>
                                </>
                            )}
                            {selectedTable.status === TableStatus.DIRTY && (
                                <button onClick={handleMakeAvailable} className="w-full py-5 bg-white text-black rounded-[24px] font-black italic uppercase text-[11px] tracking-[0.3em] shadow-2xl hover:scale-[1.02] transition-all">
                                    Sincronizar Disponibilidad
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-[#505530]/10 text-center px-12">
                        <Monitor size={64} strokeWidth={1} className="mb-6 opacity-20" />
                        <h4 className="text-[#505530]/55 font-black italic uppercase text-xs tracking-widest mb-2">Escaneo de Red Requerido</h4>
                        <p className="text-[10px] font-bold text-[#505530]/30 uppercase tracking-[0.2em] leading-relaxed">Selecciona un nodo de mesa para iniciar la secuencia de control táctico operacional.</p>
                    </div>
                )}
                </div>
            </aside>

            {/* Modals Container */}
            <AnimatePresence>
                {isAddTableModalOpen && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-6">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white border border-white/10 rounded-[32px] p-10 w-full max-w-[420px] shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-solaris-orange"></div>
                            <div className="flex justify-between items-center mb-10">
                                <h2 className="text-2xl font-black italic text-[#1a1c14] uppercase tracking-tighter">Desplegar Nuevo Nodo</h2>
                                <button onClick={() => setIsAddTableModalOpen(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-[#505530]/30 hover:text-[#1a1c14] hover:bg-white/10 transition-all">
                                    <span className="text-lg font-black">✕</span>
                                </button>
                            </div>
                            <div className="space-y-8">
                                <div>
                                    <label className="text-[9px] font-black text-[#505530]/30 uppercase tracking-[0.5em] block mb-3">Identificador de Mesa</label>
                                    <input
                                        type="text"
                                        value={newTableName}
                                        onChange={(e) => setNewTableName(e.target.value)}
                                        placeholder="ej. MESA 24"
                                        className="w-full p-5 bg-white/[0.03] border border-white/10 rounded-2xl outline-none focus:border-solaris-orange font-black italic text-[#1a1c14] transition-all text-lg placeholder:text-[#505530]/5 uppercase tracking-tight"
                                        autoFocus
                                    />
                                </div>
                                <div className="bg-white/[0.02] p-8 rounded-2xl border border-white/5">
                                    <label className="text-[9px] font-black text-[#505530]/30 uppercase tracking-[0.5em] block mb-6 text-center">Capacidad Máxima PAX</label>
                                    <div className="flex items-center justify-center gap-10">
                                        <button onClick={() => setNewTableSeats(Math.max(1, newTableSeats - 1))} className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center font-black text-2xl text-[#1a1c14] transition-all border border-white/5">-</button>
                                        <span className="font-black italic text-5xl text-solaris-orange w-16 text-center">{newTableSeats}</span>
                                        <button onClick={() => setNewTableSeats(newTableSeats + 1)} className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center font-black text-2xl text-[#1a1c14] transition-all border border-white/5">+</button>
                                    </div>
                                </div>
                                <div className="flex gap-4 mt-10">
                                    <button onClick={() => setIsAddTableModalOpen(false)} className="flex-1 py-5 bg-white/5 text-[#505530]/30 rounded-[20px] font-black italic uppercase text-[10px] tracking-widest hover:text-[#1a1c14] transition-all">Cancelar</button>
                                    <button onClick={handleAddTable} disabled={!newTableName} className="flex-1 py-5 bg-solaris-orange text-[#1a1c14] rounded-[20px] font-black italic uppercase text-[10px] tracking-widest shadow-solaris-glow hover:scale-[1.05] transition-all disabled:opacity-20">Confirmar Nodo</button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {isEditModalOpen && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-6">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white border border-white/10 rounded-[32px] p-10 w-full max-w-[420px] shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                            <div className="flex justify-between items-center mb-10">
                                <h2 className="text-2xl font-black italic text-[#1a1c14] uppercase tracking-tighter">Ajuste de Nodo</h2>
                                <button onClick={() => setIsEditModalOpen(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-[#505530]/30 hover:text-[#1a1c14] hover:bg-white/10 transition-all">
                                    <span className="text-lg font-black">✕</span>
                                </button>
                            </div>
                            <div className="space-y-8">
                                <div>
                                    <label className="text-[9px] font-black text-[#505530]/30 uppercase tracking-[0.5em] block mb-3">Identificador</label>
                                    <input type="text" value={newTableName} onChange={(e) => setNewTableName(e.target.value)} className="w-full p-5 bg-white/[0.03] border border-white/10 rounded-2xl outline-none focus:border-blue-500 font-black italic text-[#1a1c14] transition-all text-lg placeholder:text-[#505530]/5 uppercase tracking-tight" autoFocus />
                                </div>
                                <div className="bg-white/[0.02] p-8 rounded-2xl border border-white/5">
                                    <label className="text-[9px] font-black text-[#505530]/30 uppercase tracking-[0.5em] block mb-6 text-center">Protocolo Pax</label>
                                    <div className="flex items-center justify-center gap-10">
                                        <button onClick={() => setNewTableSeats(Math.max(1, newTableSeats - 1))} className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center font-black text-2xl text-[#1a1c14] transition-all border border-white/5">-</button>
                                        <span className="font-black italic text-5xl text-blue-500 w-16 text-center">{newTableSeats}</span>
                                        <button onClick={() => setNewTableSeats(newTableSeats + 1)} className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center font-black text-2xl text-[#1a1c14] transition-all border border-white/5">+</button>
                                    </div>
                                </div>
                                <div className="flex gap-4 mt-10">
                                    <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-5 bg-white/5 text-[#505530]/30 rounded-[20px] font-black italic uppercase text-[10px] tracking-widest hover:text-[#1a1c14] transition-all">Descartar</button>
                                    <button onClick={handleUpdateTable} disabled={!newTableName} className="flex-1 py-5 bg-blue-600 text-[#1a1c14] rounded-[20px] font-black italic uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 hover:scale-[1.05] transition-all">Guardar Cambios</button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {isDeleteConfirmOpen && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[110] p-6">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white border border-red-500/20 rounded-[32px] p-10 w-full max-w-[380px] shadow-2xl text-center"
                        >
                            <AlertTriangle size={52} className="text-red-500 mx-auto mb-6" />
                            <h2 className="text-2xl font-black italic text-[#1a1c14] mb-2 uppercase tracking-tighter">¿Purgar Nodo?</h2>
                            <p className="text-[#505530]/55 mb-10 font-bold text-[10px] uppercase tracking-[0.2em] leading-relaxed px-4">Esta acción eliminará la mesa <b className="text-[#1a1c14]">{selectedTable?.name}</b> permanentemente del sistema KOSO.</p>
                            <div className="flex flex-col gap-4">
                                <button onClick={handleDeleteTableAction} className="w-full py-5 bg-red-600 text-[#1a1c14] rounded-[24px] font-black italic uppercase text-[11px] tracking-[0.3em] shadow-[0_15px_30px_rgba(220,38,38,0.3)] hover:scale-[1.05] transition-all">Confirmar Purga</button>
                                <button onClick={() => setIsDeleteConfirmOpen(false)} className="w-full py-4 bg-white/5 text-[#505530]/30 rounded-xl font-black italic uppercase text-[10px] tracking-widest hover:text-[#1a1c14] transition-all">Abortar Procedimiento</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
