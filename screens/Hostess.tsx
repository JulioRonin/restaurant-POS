import React, { useState } from 'react';
import { TABLES, MOCK_STAFF } from '../constants';
import { TableStatus } from '../types';

export const HostessScreen: React.FC = () => {
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    // Local state for assignments (In a real app, this would be in Context or Backend)
    const [assignments, setAssignments] = useState<{ [tableId: string]: string }>({});

    const handleAssign = (waiterId: string) => {
        if (selectedTable) {
            setAssignments(prev => ({ ...prev, [selectedTable]: waiterId }));
        }
    };

    const getStatusColor = (status: TableStatus) => {
        switch (status) {
            case TableStatus.AVAILABLE: return 'border-green-400 bg-white';
            case TableStatus.OCCUPIED: return 'border-red-400 bg-red-50';
            case TableStatus.RESERVED: return 'border-yellow-400 bg-yellow-50';
            default: return 'border-gray-200 bg-gray-100';
        }
    };

    const assignedWaiterId = selectedTable ? assignments[selectedTable] : null;
    const assignedWaiter = assignedWaiterId ? MOCK_STAFF.find(s => s.id === assignedWaiterId) : null;
    const availableWaiters = MOCK_STAFF.filter(s => s.area === 'Service' || s.role.includes('Mesero'));

    return (
        <div className="flex h-full w-full bg-[#F3F4F6] text-gray-800">
            {/* Map Area */}
            <div className="flex-1 p-8 relative overflow-hidden">
                <header className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Floor Plan</h1>
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

                <div className="w-full h-[600px] border-2 border-dashed border-gray-300 rounded-3xl relative bg-white shadow-soft">
                    {TABLES.map(table => {
                        const waiterId = assignments[table.id];
                        const waiter = waiterId ? MOCK_STAFF.find(s => s.id === waiterId) : null;

                        return (
                            <div
                                key={table.id}
                                onClick={() => setSelectedTable(table.id)}
                                style={{ left: `${table.x}%`, top: `${table.y}%` }}
                                className={`absolute w-32 h-24 border-2 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-110 shadow-lg ${getStatusColor(table.status)} ${selectedTable === table.id ? 'ring-4 ring-primary ring-opacity-30' : ''}`}
                            >
                                <span className="font-bold text-lg text-gray-900">{table.name}</span>
                                <span className="text-xs text-gray-500 font-medium">{table.seats} Seats</span>

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
            </div>

            {/* Side Panel */}
            <aside className="w-80 bg-white border-l border-gray-100 p-6 flex flex-col shadow-xl overflow-y-auto">
                <div className="mb-6 pb-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold mb-1 text-gray-900">{selectedTable ? TABLES.find(t => t.id === selectedTable)?.name : 'Select Table'}</h2>
                    <p className="text-gray-400 text-sm">Management Panel</p>
                </div>

                {selectedTable ? (
                    <div className="flex flex-col gap-6 animate-in fade-in">
                        <div className="bg-gray-50 p-4 rounded-xl">
                            <span className="text-xs text-gray-400 uppercase font-bold">Current Status</span>
                            <div className="text-lg font-bold text-primary mt-1">{TABLES.find(t => t.id === selectedTable)?.status}</div>
                        </div>

                        {/* Waiter Assignment Section */}
                        <div>
                            <span className="text-xs text-gray-400 uppercase font-bold block mb-3">Assigned Waiter</span>
                            <div className="grid grid-cols-3 gap-2">
                                {availableWaiters.map(waiter => (
                                    <button
                                        key={waiter.id}
                                        onClick={() => handleAssign(waiter.id)}
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
                            {assignedWaiter && (
                                <div className="mt-2 text-center">
                                    <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded-full">
                                        Active: {assignedWaiter.name}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-100 pt-6 space-y-3">
                            <button className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-500/20">
                                <span className="material-icons-round">check</span>
                                Check In
                            </button>
                            <button className="w-full py-3 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-bold transition-colors text-yellow-600">
                                Reserve Table
                            </button>
                            <button className="w-full py-3 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-bold transition-colors text-red-500">
                                Mark Dirty
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-300 text-center">
                        <span className="material-icons-round text-5xl mb-4">touch_app</span>
                        <p>Tap a table on the floor plan to view details and manage seating.</p>
                    </div>
                )}
            </aside>
        </div>
    );
};