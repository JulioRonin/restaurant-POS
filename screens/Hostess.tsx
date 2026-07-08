import React, { useState, useMemo } from 'react';
import { MOCK_STAFF } from '../constants';
import { Table, TableStatus, WaitlistEntry, OrderStatus } from '../types';
import { useTables } from '../contexts/TableContext';
import { useOrders } from '../contexts/OrderContext';
import { useSubscription, TIER_PRICING } from '../contexts/SubscriptionContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Minus, UserPlus, Hourglass, Users, GripVertical,
  Bookmark, Check, Edit3, Trash2, XCircle,
  RotateCw, Layers, AlertTriangle, Clock,
} from 'lucide-react';
import {
  SrCard, SrButton, SrChip, SrInput, SrLabel, SrKicker, SrMono,
  SrModal, SrModalHeader, SrEmptyState, SrTabs, SrTierUpgradeModal,
} from '../components/ui/servirest';

type ViewMode = 'plano' | 'lista';

const STATUS_LABEL: Record<TableStatus, string> = {
  [TableStatus.AVAILABLE]: 'Libre',
  [TableStatus.OCCUPIED]:  'Ocupada',
  [TableStatus.RESERVED]:  'Apartada',
  [TableStatus.DIRTY]:     'Por limpiar',
};

const STATUS_TONE: Record<TableStatus, 'success' | 'terracota' | 'mostaza' | 'neutral'> = {
  [TableStatus.AVAILABLE]: 'success',
  [TableStatus.OCCUPIED]:  'terracota',
  [TableStatus.RESERVED]:  'mostaza',
  [TableStatus.DIRTY]:     'neutral',
};

export const HostessScreen: React.FC = () => {
  // ── Contexts ─────────────────────────────────────────────────────────────
  const { tables: activeTables, addTable, updateTableStatus, deleteTable, updateTable } = useTables();
  const { orders, updateOrderStatus } = useOrders();
  const { planLimits, tier, isWithinLimit } = useSubscription();
  const [showLimitModal, setShowLimitModal] = useState(false);

  // ── Local state ──────────────────────────────────────────────────────────
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('plano');

  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([
    { id: 'W1', customerName: 'Juan Pérez',   partySize: 4, timestamp: '12:30', status: 'WAITING' },
    { id: 'W2', customerName: 'María García', partySize: 2, timestamp: '12:45', status: 'WAITING' },
  ]);

  const [waiterAssignments, setWaiterAssignments] = useState<{ [tableId: string]: string }>({});
  const [customerSessions, setCustomerSessions] = useState<{ [tableId: string]: { name: string; pax: number; time: string } }>({});
  const [reservations, setReservations] = useState<{ [tableId: string]: { name: string; pax: number; time: string; notes?: string } }>({
    'T3': { name: 'Familia Rodríguez', pax: 6, time: '19:00', notes: 'Cumpleaños' },
  });

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [isAddTableModalOpen, setIsAddTableModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableSeats, setNewTableSeats] = useState(4);

  // ── Visual table placement ──────────────────────────────────────────────
  // When `pendingTable` is set, the operator is in "place mode": the next
  // click on the floor plan drops the table at that position. We also let
  // them drag existing tables to reposition (snap to grid).
  const [pendingTable, setPendingTable] = useState<{ name: string; seats: number } | null>(null);
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const floorRef = React.useRef<HTMLDivElement | null>(null);

  // Snap to a 5% grid so floor plans look orderly and reflow predictably.
  const SNAP_PCT = 5;
  const snap = (v: number) => Math.round(v / SNAP_PCT) * SNAP_PCT;

  // Drag-drop state
  const [isDraggingOver, setIsDraggingOver] = useState<string | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const occupied = activeTables.filter((t) => t.status === TableStatus.OCCUPIED).length;
    const free     = activeTables.filter((t) => t.status === TableStatus.AVAILABLE).length;
    const reserved = activeTables.filter((t) => t.status === TableStatus.RESERVED).length;
    return { occupied, free, reserved, waiting: waitlist.length };
  }, [activeTables, waitlist.length]);

  const selectedTable = activeTables.find((t) => t.id === selectedTableId);
  const assignedWaiterId = selectedTableId ? waiterAssignments[selectedTableId] : null;
  const assignedWaiter = assignedWaiterId ? MOCK_STAFF.find((s) => s.id === assignedWaiterId) : null;
  const currentSession = selectedTableId ? customerSessions[selectedTableId] : null;
  const currentReservation = selectedTableId ? reservations[selectedTableId] : null;
  const availableWaiters = MOCK_STAFF.filter((s) => s.area === 'Service' || s.role.includes('Mesero'));

  // ── Handlers (logic intact) ──────────────────────────────────────────────
  const handleAssignWaiter = (waiterId: string) => {
    if (selectedTableId) setWaiterAssignments((p) => ({ ...p, [selectedTableId]: waiterId }));
  };

  const handleAddTable = () => {
    if (!newTableName) return;
    // Tier limit check
    if (!isWithinLimit('maxTables', activeTables.length + 1)) {
      setIsAddTableModalOpen(false);
      setShowLimitModal(true);
      return;
    }
    // Enter visual-placement mode instead of dropping the table on a guessed
    // coordinate. The next click on the floor plan locks the position.
    setPendingTable({ name: newTableName, seats: newTableSeats });
    setIsAddTableModalOpen(false);
    setNewTableName('');
    setNewTableSeats(4);
  };

  /** Read coordinates from a mouse/touch event relative to the floor container,
   *  return them as percentages snapped to the grid. */
  const eventToPct = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const el = floorRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const ev = 'touches' in e ? e.touches[0] : (e as React.MouseEvent);
    const x = ((ev.clientX - rect.left) / rect.width) * 100;
    const y = ((ev.clientY - rect.top) / rect.height) * 100;
    // Clamp so the table stays fully inside the canvas (it has its own width).
    const clamped = (v: number) => Math.max(2, Math.min(78, v));
    return { x: snap(clamped(x)), y: snap(clamped(y)) };
  };

  /** Click on the floor while in place mode → drop the pending table. */
  const handleFloorClick = (e: React.MouseEvent) => {
    if (!pendingTable) return;
    const pos = eventToPct(e);
    if (!pos) return;
    addTable({
      name: pendingTable.name,
      seats: pendingTable.seats,
      status: TableStatus.AVAILABLE,
      x: pos.x,
      y: pos.y,
    });
    setPendingTable(null);
    setHoverPos(null);
  };

  /** Live preview while in place mode — ghost table follows the cursor. */
  const handleFloorMouseMove = (e: React.MouseEvent) => {
    if (!pendingTable && !draggingTableId) return;
    const pos = eventToPct(e);
    if (pos) setHoverPos(pos);
  };

  /** Drag-to-reposition: while user holds a table and moves the cursor,
   *  update the table's stored position so it snaps on release. */
  const handleTablePointerDown = (e: React.MouseEvent, tableId: string) => {
    if (pendingTable) return; // don't conflict with placement
    e.stopPropagation();
    setDraggingTableId(tableId);
    setSelectedTableId(tableId);
  };

  const handleFloorPointerUp = () => {
    if (draggingTableId && hoverPos) {
      updateTable(draggingTableId, { x: hoverPos.x, y: hoverPos.y } as any);
    }
    setDraggingTableId(null);
    setHoverPos(null);
  };

  const handleUpdateTable = () => {
    if (selectedTableId && newTableName) {
      updateTable(selectedTableId, { name: newTableName, seats: newTableSeats });
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
    if (!customerName) return;
    const newEntry: WaitlistEntry = {
      id: `W${Date.now()}`,
      customerName,
      partySize,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'WAITING',
    };
    setWaitlist((p) => [...p, newEntry]);
    setCustomerName('');
    setPartySize(2);
  };

  const handleDragStart = (e: React.DragEvent, entryId: string) => {
    e.dataTransfer.setData('entryId', entryId);
  };

  const handleDrop = (e: React.DragEvent, tableId: string) => {
    e.preventDefault();
    setIsDraggingOver(null);
    const entryId = e.dataTransfer.getData('entryId');
    const entry = waitlist.find((w) => w.id === entryId);
    if (entry) {
      handleCheckIn(tableId, entry.customerName, entry.partySize);
      setWaitlist((p) => p.filter((w) => w.id !== entryId));
    }
  };

  const handleCheckIn = (tableId?: string, forceName?: string, forcePax?: number) => {
    const tId = tableId || selectedTableId;
    if (!tId) return;
    const reservation = reservations[tId];
    const name = forceName || (reservation ? reservation.name : customerName);
    const pax  = forcePax  || (reservation ? reservation.pax  : partySize);
    if (!name) return;

    updateTableStatus(tId, TableStatus.OCCUPIED);
    setCustomerSessions((p) => ({
      ...p,
      [tId]: {
        name,
        pax,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    }));

    if (reservation && !forceName) {
      const next = { ...reservations };
      delete next[tId];
      setReservations(next);
    }

    if (!forceName) {
      setCustomerName('');
      setPartySize(2);
    }
    setSelectedTableId(tId);
  };

  const handleClearTable = () => {
    if (!selectedTableId) return;
    updateTableStatus(selectedTableId, TableStatus.DIRTY);
    const ns = { ...customerSessions };  delete ns[selectedTableId]; setCustomerSessions(ns);
    const na = { ...waiterAssignments }; delete na[selectedTableId]; setWaiterAssignments(na);
  };

  const handleMakeAvailable = () => {
    if (selectedTableId) updateTableStatus(selectedTableId, TableStatus.AVAILABLE);
  };

  const handleCancelOrder = () => {
    if (selectedTableId && window.confirm('¿Cancelamos esta cuenta? No hay vuelta atrás.')) {
      const active = orders.find((o) =>
        (o.tableId === selectedTableId || (o as any).tableName === selectedTable?.name) &&
        ['PENDING', 'COOKING', 'READY', 'SERVED'].includes(o.status)
      );
      if (active) updateOrderStatus(active.id, OrderStatus.CANCELLED);
      handleClearTable();
      handleMakeAvailable();
    }
  };

  const handleReserveTable = () => {
    if (!selectedTableId || !customerName) return;
    updateTableStatus(selectedTableId, TableStatus.RESERVED);
    setReservations((p) => ({
      ...p,
      [selectedTableId]: {
        name: customerName,
        pax: partySize,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        notes: 'Mesa apartada',
      },
    }));
    setCustomerName('');
  };

  const handleCancelReservation = () => {
    if (!selectedTableId) return;
    const next = { ...reservations };
    delete next[selectedTableId];
    setReservations(next);
    handleMakeAvailable();
  };

  const handleChangeReservationTime = () => {
    if (!selectedTableId || !reservations[selectedTableId]) return;
    const current = reservations[selectedTableId];
    const newTime = window.prompt('Nueva hora:', current.time);
    if (newTime) {
      setReservations((p) => ({ ...p, [selectedTableId]: { ...current, time: newTime } }));
    }
  };

  const TABS = [
    { id: 'plano' as ViewMode, label: 'Plano', count: activeTables.length },
    { id: 'lista' as ViewMode, label: 'Lista', count: activeTables.length },
  ] as const;

  // ── Render ───────────────────────────────────────────────────────────────
  // El root es fila en desktop (contenido + aside 420px a la derecha) y
  // columna en móvil. Antes era flex-col siempre → el aside se apilaba
  // DEBAJO robándole 300px de alto al plano de mesas, que quedaba aplastado.
  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-servirest-hueso text-servirest-carbon antialiased overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* ─── HEADER ─────────────────────────────────────────────────── */}
        <div className="px-[38px] pt-10 pb-6 shrink-0">
          <div className="flex justify-between items-start flex-wrap gap-6 mb-7">
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <SrKicker className="block mb-2">Coordinación del piso</SrKicker>
              <h1 className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0">
                Salón
              </h1>
              <p className="text-[14px] text-[rgba(42,40,38,0.6)] font-medium mt-2 max-w-[480px] leading-relaxed">
                El plano del comedor en tiempo real. Sienta a la gente, mueve la lista de espera y avisa al mesero correcto.
              </p>
            </motion.div>

            {/* Mini-stats rail */}
            <div className="flex gap-3 flex-wrap">
              <SrCard className="px-5 py-4">
                <SrLabel className="block mb-1.5">Ocupadas</SrLabel>
                <div className="font-black italic text-[32px] text-servirest-terracota tracking-[-0.03em] leading-none">
                  {counts.occupied}
                </div>
              </SrCard>
              <SrCard className="px-5 py-4">
                <SrLabel className="block mb-1.5">Libres</SrLabel>
                <div className="font-black italic text-[32px] text-servirest-success tracking-[-0.03em] leading-none">
                  {counts.free}
                </div>
              </SrCard>
              <SrCard className="px-5 py-4">
                <SrLabel className="block mb-1.5">En espera</SrLabel>
                <div className="font-black italic text-[32px] text-servirest-mostaza tracking-[-0.03em] leading-none">
                  {counts.waiting}
                </div>
              </SrCard>
            </div>
          </div>

          {/* Tabs + Add table CTA */}
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <SrTabs<ViewMode> tabs={TABS} active={viewMode} onChange={setViewMode} className="flex-1 min-w-[240px]" />
            <SrButton
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setIsAddTableModalOpen(true)}
              className="mb-3"
            >
              Nueva mesa
            </SrButton>
          </div>
        </div>

        {/* ─── BODY: waitlist + map / list + side panel ───────────────── */}
        <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0 overflow-hidden px-[38px] pb-6">
          {/* WAITLIST COLUMN */}
          <SrCard variant="solaris" className="lg:w-72 p-5 flex flex-col shrink-0 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div>
                <SrKicker className="block mb-1.5">Lista de espera</SrKicker>
                <h3 className="font-serif italic font-medium text-[22px] text-servirest-midnight tracking-[-0.02em] leading-none m-0">
                  Por sentar
                </h3>
              </div>
              <SrChip tone="mostaza">{waitlist.length}</SrChip>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar -mx-1 px-1">
              {waitlist.length === 0 ? (
                <SrEmptyState
                  icon={<Hourglass size={24} />}
                  title="Nadie esperando"
                  description="Cuando llegue gente sin reservación, agrégala desde la consola y arrástrala a una mesa libre."
                />
              ) : (
                <div className="space-y-3 pt-1">
                  <AnimatePresence mode="popLayout">
                    {waitlist.map((entry, idx) => (
                      <motion.div
                        key={entry.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3, delay: idx * 0.03, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, entry.id)}
                          className="group cursor-grab active:cursor-grabbing"
                        >
                          <SrCard hover className="p-4 relative">
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="min-w-0">
                                <div className="font-serif italic font-medium text-[18px] text-servirest-midnight tracking-[-0.02em] leading-tight truncate">
                                  {entry.customerName}
                                </div>
                              </div>
                              <SrChip tone="neutral" size="xs">
                                <Clock size={9} className="mr-1" />
                                {entry.timestamp}
                              </SrChip>
                            </div>
                            <div className="flex items-center gap-2">
                              <SrChip tone="terracota" size="xs">
                                <Users size={9} className="mr-1" />
                                {entry.partySize} pax
                              </SrChip>
                            </div>
                            <GripVertical
                              size={18}
                              className="absolute top-3 right-3 text-[rgba(42,40,38,0.15)] opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                          </SrCard>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </SrCard>

          {/* MAP / LIST */}
          <SrCard
            variant="solaris"
            className="flex-1 relative overflow-hidden"
            style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
          >
            {viewMode === 'plano' ? (
              <div
                ref={floorRef}
                className={`relative w-full p-6 min-w-[600px] min-h-[520px] ${pendingTable ? 'cursor-crosshair' : draggingTableId ? 'cursor-grabbing' : ''}`}
                onDragOver={(e) => e.preventDefault()}
                onClick={handleFloorClick}
                onMouseMove={handleFloorMouseMove}
                onMouseUp={handleFloorPointerUp}
                onMouseLeave={() => { setHoverPos(null); setDraggingTableId(null); }}
              >
                {/* Dot grid — visible (8% vs 4%) while in placement mode for orientation */}
                <div
                  className={`absolute inset-0 pointer-events-none transition-opacity ${pendingTable ? 'opacity-[0.10]' : 'opacity-[0.04]'}`}
                  style={{
                    backgroundImage: 'radial-gradient(circle, #2A2826 1px, transparent 1px)',
                    backgroundSize: '36px 36px',
                  }}
                />

                {/* Placement-mode banner — sticky tip strip */}
                {pendingTable && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-servirest-terracota text-servirest-hueso px-5 py-2.5 rounded-sr-pill shadow-sr-glow flex items-center gap-3">
                    <Plus size={16} />
                    <span className="font-black italic uppercase tracking-[0.18em] text-[10px]">
                      Toca donde quieras la {pendingTable.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPendingTable(null); setHoverPos(null); }}
                      className="ml-2 w-6 h-6 rounded-full bg-servirest-hueso/20 hover:bg-servirest-hueso/30 flex items-center justify-center transition-colors"
                      title="Cancelar"
                    >
                      <XCircle size={12} />
                    </button>
                  </div>
                )}

                {/* Ghost preview while placing or dragging */}
                {(pendingTable || draggingTableId) && hoverPos && (
                  <div
                    className="absolute pointer-events-none z-10"
                    style={{
                      left: `${hoverPos.x}%`,
                      top: `${hoverPos.y}%`,
                      width: 160,
                      height: 112,
                    }}
                  >
                    <div className="w-full h-full rounded-sr-xl border-2 border-dashed border-servirest-terracota bg-[rgba(196,99,63,0.10)] flex flex-col items-center justify-center">
                      <div className="font-serif italic font-medium text-[20px] text-servirest-terracota tracking-[-0.02em] leading-none">
                        {pendingTable?.name || activeTables.find(t => t.id === draggingTableId)?.name}
                      </div>
                      <SrMono className="text-[10px] text-servirest-terracota mt-1">
                        {hoverPos.x}, {hoverPos.y}
                      </SrMono>
                    </div>
                  </div>
                )}

                {activeTables.length === 0 ? (
                  <div className="h-[480px] flex items-center justify-center">
                    <SrEmptyState
                      icon={<Layers size={28} />}
                      title="Plano vacío"
                      description="Toca «Crear mesa», pónle nombre y luego toca el plano donde la quieres. Después la arrastras si la necesitas mover."
                      action={
                        <SrButton variant="primary" icon={<Plus size={14} />} onClick={() => setIsAddTableModalOpen(true)}>
                          Crear mesa
                        </SrButton>
                      }
                    />
                  </div>
                ) : (
                  activeTables.map((table) => {
                    const waiterId   = waiterAssignments[table.id];
                    const waiter     = waiterId ? MOCK_STAFF.find((s) => s.id === waiterId) : null;
                    const session    = customerSessions[table.id];
                    const reservation = reservations[table.id];
                    const isSelected = selectedTableId === table.id;
                    const isOccupied = table.status === TableStatus.OCCUPIED;
                    const isReserved = table.status === TableStatus.RESERVED;
                    const isAvail    = table.status === TableStatus.AVAILABLE;
                    const isDragOver = isDraggingOver === table.id;

                    const stateClasses = isSelected
                      ? 'border-servirest-terracota bg-[rgba(196,99,63,0.10)] shadow-sr-glow scale-105 z-20'
                      : isDragOver
                      ? 'border-servirest-success bg-[rgba(34,160,107,0.10)] scale-105'
                      : isOccupied
                      ? 'border-servirest-terracota/40 bg-[rgba(196,99,63,0.06)]'
                      : isReserved
                      ? 'border-servirest-mostaza/40 bg-[rgba(201,162,74,0.08)]'
                      : 'border-[rgba(42,40,38,0.12)] bg-servirest-hueso-sunken hover:border-[rgba(42,40,38,0.24)]';

                    return (
                      <motion.div
                        key={table.id}
                        layout
                        initial={false}
                        onClick={(e) => { e.stopPropagation(); if (!pendingTable) setSelectedTableId(table.id); }}
                        onMouseDown={(e) => handleTablePointerDown(e, table.id)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (isAvail) setIsDraggingOver(table.id);
                        }}
                        onDragLeave={() => setIsDraggingOver(null)}
                        onDrop={(e) => handleDrop(e, table.id)}
                        style={{
                          left: `${table.x}%`,
                          top: `${table.y}%`,
                          opacity: draggingTableId === table.id ? 0.4 : 1,
                        }}
                        className={`absolute w-40 h-28 rounded-sr-xl flex flex-col items-center justify-center transition-all duration-300 border-2 shadow-sr-card p-3 select-none ${pendingTable ? 'cursor-crosshair pointer-events-none' : draggingTableId === table.id ? 'cursor-grabbing' : 'cursor-grab hover:cursor-grab'} ${stateClasses}`}
                      >
                        <div className="font-serif italic font-medium text-[22px] text-servirest-midnight tracking-[-0.02em] leading-none mb-1">
                          {table.name}
                        </div>

                        {session ? (
                          <div className="text-center w-full px-1 mt-1">
                            <div className="font-extrabold text-[11px] text-servirest-midnight truncate leading-tight">
                              {session.name}
                            </div>
                            <div className="font-mono text-[9px] text-servirest-terracota mt-0.5">
                              {session.pax} pax
                            </div>
                          </div>
                        ) : reservation ? (
                          <div className="text-center w-full px-1 mt-1">
                            <SrChip tone="mostaza" size="xs">{reservation.time}</SrChip>
                            <div className="font-extrabold text-[11px] text-servirest-midnight truncate leading-tight mt-1">
                              {reservation.name}
                            </div>
                          </div>
                        ) : (
                          <SrLabel className="mt-1">{table.seats} personas</SrLabel>
                        )}

                        {waiter && (
                          <div
                            className="absolute -top-3 -right-3 w-9 h-9 rounded-full border-2 border-servirest-surface shadow-sr-card overflow-hidden"
                            title={`A cargo: ${waiter.name}`}
                          >
                            <img src={waiter.image} alt={waiter.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="p-7">
                {activeTables.length === 0 ? (
                  <SrEmptyState
                    icon={<Layers size={28} />}
                    title="Sin mesas registradas"
                    description="Crea tu primera mesa para empezar a coordinar el piso."
                    action={
                      <SrButton variant="primary" icon={<Plus size={14} />} onClick={() => setIsAddTableModalOpen(true)}>
                        Crear mesa
                      </SrButton>
                    }
                  />
                ) : (
                  <div className="space-y-2.5">
                    {activeTables.map((table, idx) => {
                      const session  = customerSessions[table.id];
                      const waiterId = waiterAssignments[table.id];
                      const waiter   = waiterId ? MOCK_STAFF.find((s) => s.id === waiterId) : null;
                      const isSelected = selectedTableId === table.id;

                      return (
                        <motion.div
                          key={table.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: idx * 0.03 }}
                        >
                          <SrCard
                            hover
                            onClick={() => setSelectedTableId(table.id)}
                            className={`p-5 cursor-pointer ${isSelected ? 'border-servirest-terracota shadow-sr-glow' : ''}`}
                          >
                            <div className="grid grid-cols-12 gap-4 items-center">
                              <div className="col-span-3 md:col-span-2">
                                <SrLabel className="block mb-1">Mesa</SrLabel>
                                <div className="font-serif italic font-medium text-[22px] text-servirest-midnight tracking-[-0.02em] leading-none">
                                  {table.name}
                                </div>
                              </div>
                              <div className="col-span-3 md:col-span-2">
                                <SrChip tone={STATUS_TONE[table.status]}>{STATUS_LABEL[table.status]}</SrChip>
                              </div>
                              <div className="col-span-3 md:col-span-2">
                                <SrLabel className="block mb-1">Capacidad</SrLabel>
                                <SrMono className="text-[13px] text-servirest-midnight font-extrabold">
                                  {table.seats} pax
                                </SrMono>
                              </div>
                              <div className="col-span-12 md:col-span-3">
                                {session ? (
                                  <>
                                    <SrLabel className="block mb-1">Cliente</SrLabel>
                                    <div className="font-extrabold text-[13px] text-servirest-midnight truncate">{session.name}</div>
                                    <div className="font-mono text-[10px] text-[rgba(42,40,38,0.5)] mt-0.5">
                                      {session.pax} pax · {session.time}
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-[12px] text-[rgba(42,40,38,0.35)] font-medium italic">
                                    Sin asignar
                                  </span>
                                )}
                              </div>
                              <div className="col-span-12 md:col-span-3">
                                {waiter ? (
                                  <div className="flex items-center gap-2.5">
                                    <img src={waiter.image} className="w-8 h-8 rounded-full border border-[rgba(42,40,38,0.12)]" alt="" />
                                    <span className="text-[12px] font-extrabold text-servirest-midnight truncate">{waiter.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-[12px] text-[rgba(42,40,38,0.35)] font-medium italic">
                                    Sin mesero
                                  </span>
                                )}
                              </div>
                            </div>
                          </SrCard>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </SrCard>
        </div>
      </div>

      {/* ─── SIDE PANEL ─────────────────────────────────────────────── */}
      {/* En desktop es columna fija a la derecha con alto completo; el
          max-height solo aplica en móvil (donde se apila abajo). */}
      <aside
        className={`w-full lg:w-[420px] lg:h-full bg-servirest-hueso-sunken/40 border-t lg:border-t-0 lg:border-l border-[rgba(42,40,38,0.12)] flex flex-col shrink-0 overflow-y-auto lg:max-h-none ${selectedTableId ? 'max-h-[60vh]' : 'max-h-[300px]'}`}
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <div className="p-7 flex flex-col gap-5">
          {/* WALK-IN CONSOLE */}
          <SrCard variant="solaris" className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus size={14} className="text-servirest-terracota" />
              <SrKicker>Walk-in</SrKicker>
            </div>
            <div className="space-y-3">
              <SrInput
                shape="box"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nombre del cliente"
              />
              <div className="flex items-center justify-between gap-3 px-4 py-3 bg-servirest-hueso-sunken/40 rounded-sr-lg border border-[rgba(42,40,38,0.12)]">
                <SrLabel>Personas</SrLabel>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPartySize(Math.max(1, partySize - 1))}
                    className="w-8 h-8 rounded-sr-sm bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-servirest-midnight flex items-center justify-center font-black hover:border-servirest-terracota transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="font-serif italic font-medium text-[26px] text-servirest-terracota w-8 text-center leading-none">
                    {partySize}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPartySize(partySize + 1)}
                    className="w-8 h-8 rounded-sr-sm bg-servirest-surface border border-[rgba(42,40,38,0.12)] text-servirest-midnight flex items-center justify-center font-black hover:border-servirest-terracota transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <SrButton
                variant="midnight"
                size="md"
                fullWidth
                icon={<Hourglass size={14} />}
                disabled={!customerName}
                onClick={handleAddToWaitlist}
              >
                Sumar a la espera
              </SrButton>
            </div>
          </SrCard>

          {/* SELECTED TABLE PANEL */}
          <div className="pb-3 border-b border-[rgba(42,40,38,0.12)]">
            <SrKicker className="block mb-1.5">Mesa seleccionada</SrKicker>
            <h2 className="font-serif italic font-medium text-[28px] text-servirest-midnight tracking-[-0.02em] leading-none m-0">
              {selectedTable ? selectedTable.name : 'Sin selección'}
            </h2>
          </div>

          {selectedTable ? (
            <div className="flex flex-col gap-5">
              {/* Status */}
              <SrCard className="p-5 flex justify-between items-center">
                <div>
                  <SrLabel className="block mb-1.5">Estado</SrLabel>
                  <SrChip tone={STATUS_TONE[selectedTable.status]}>{STATUS_LABEL[selectedTable.status]}</SrChip>
                </div>
                {currentSession && (
                  <div className="text-right">
                    <SrLabel className="block mb-1.5">Desde</SrLabel>
                    <SrMono className="text-[18px] text-servirest-midnight font-extrabold">{currentSession.time}</SrMono>
                  </div>
                )}
              </SrCard>

              {/* RESERVATION */}
              {currentReservation && selectedTable.status === TableStatus.RESERVED && (
                <SrCard className="p-6 border-servirest-mostaza/40">
                  <div className="flex items-center gap-2 mb-4">
                    <Bookmark size={14} className="text-servirest-mostaza" />
                    <SrKicker className="text-servirest-mostaza">Reservación</SrKicker>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-[rgba(42,40,38,0.08)]">
                      <SrLabel>Cliente</SrLabel>
                      <span className="font-extrabold text-[14px] text-servirest-midnight">{currentReservation.name}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-[rgba(42,40,38,0.08)]">
                      <SrLabel>Hora</SrLabel>
                      <SrMono className="text-[14px] text-servirest-midnight font-extrabold">{currentReservation.time}</SrMono>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <SrLabel>Pax</SrLabel>
                      <span className="font-extrabold text-[14px] text-servirest-midnight">{currentReservation.pax}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 mt-6">
                    <SrButton variant="outline" size="sm" onClick={handleChangeReservationTime}>Cambiar hora</SrButton>
                    <SrButton variant="danger" size="sm" onClick={handleCancelReservation}>Soltar reserva</SrButton>
                  </div>
                  <SrButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    icon={<Check size={16} />}
                    className="mt-3"
                    onClick={() => handleCheckIn()}
                  >
                    Sentar al cliente
                  </SrButton>
                </SrCard>
              )}

              {/* AVAILABLE — check-in / reserve */}
              {selectedTable.status === TableStatus.AVAILABLE && !currentSession && (
                <SrCard className="p-6">
                  <p className="text-[13px] text-[rgba(42,40,38,0.6)] font-medium mb-5 leading-relaxed">
                    Sentar a <b className="text-servirest-terracota">{customerName || '— escribe arriba —'}</b> con{' '}
                    <b className="text-servirest-midnight">{partySize}</b> persona{partySize !== 1 ? 's' : ''}.
                  </p>
                  <div className="space-y-2.5">
                    <SrButton
                      variant="primary"
                      size="lg"
                      fullWidth
                      icon={<Users size={16} />}
                      disabled={!customerName}
                      onClick={() => handleCheckIn()}
                    >
                      Sentar ahora
                    </SrButton>
                    <SrButton
                      variant="outline"
                      size="md"
                      fullWidth
                      icon={<Bookmark size={14} />}
                      disabled={!customerName}
                      onClick={handleReserveTable}
                    >
                      Apartar mesa
                    </SrButton>
                  </div>
                </SrCard>
              )}

              {/* SESSION */}
              {currentSession && (
                <SrCard className="p-6">
                  <SrKicker className="block mb-4">Cliente en mesa</SrKicker>
                  <div className="flex justify-between items-center py-2 border-b border-[rgba(42,40,38,0.08)]">
                    <SrLabel>Nombre</SrLabel>
                    <span className="font-extrabold text-[14px] text-servirest-midnight">{currentSession.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <SrLabel>Personas</SrLabel>
                    <span className="font-extrabold text-[14px] text-servirest-midnight">{currentSession.pax}</span>
                  </div>
                </SrCard>
              )}

              {/* WAITER ASSIGNMENT */}
              {selectedTable.status === TableStatus.OCCUPIED && availableWaiters.length > 0 && (
                <div>
                  <SrKicker className="block mb-3">Asigna mesero</SrKicker>
                  <div className="grid grid-cols-3 gap-2.5">
                    {availableWaiters.map((waiter) => {
                      const on = assignedWaiterId === waiter.id;
                      return (
                        <button
                          key={waiter.id}
                          type="button"
                          onClick={() => handleAssignWaiter(waiter.id)}
                          className={`flex flex-col items-center p-3 rounded-sr-lg border-2 transition-all ${
                            on
                              ? 'border-servirest-terracota bg-[rgba(196,99,63,0.08)]'
                              : 'border-[rgba(42,40,38,0.12)] bg-servirest-surface hover:border-[rgba(42,40,38,0.24)]'
                          }`}
                        >
                          <div className="w-11 h-11 rounded-full overflow-hidden mb-2 border border-[rgba(42,40,38,0.12)]">
                            <img src={waiter.image} alt={waiter.name} className="w-full h-full object-cover" />
                          </div>
                          <span className="text-[10px] font-extrabold text-servirest-midnight text-center leading-tight truncate w-full">
                            {waiter.name.split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ACTIONS */}
              <div className="border-t border-[rgba(42,40,38,0.12)] pt-5 space-y-3">
                <div className="flex gap-2.5">
                  <SrButton variant="outline" size="md" icon={<Edit3 size={14} />} onClick={handleOpenEditModal} className="flex-1">
                    Editar
                  </SrButton>
                  <SrButton variant="danger" size="md" icon={<Trash2 size={14} />} onClick={() => setIsDeleteConfirmOpen(true)} className="flex-1">
                    Eliminar
                  </SrButton>
                </div>

                {selectedTable.status === TableStatus.OCCUPIED && (
                  <>
                    <SrButton variant="danger" size="lg" fullWidth icon={<XCircle size={16} />} onClick={handleCancelOrder}>
                      Cancelar cuenta
                    </SrButton>
                    <SrButton variant="midnight" size="md" fullWidth icon={<RotateCw size={14} />} onClick={handleClearTable}>
                      Liberar — por limpiar
                    </SrButton>
                  </>
                )}
                {selectedTable.status === TableStatus.DIRTY && (
                  <SrButton variant="primary" size="lg" fullWidth icon={<Check size={16} />} onClick={handleMakeAvailable}>
                    Mesa lista
                  </SrButton>
                )}
              </div>
            </div>
          ) : (
            <SrEmptyState
              icon={<Layers size={26} />}
              title="Elige una mesa"
              description="Toca una mesa del plano para sentar gente, asignar mesero o cerrar la cuenta."
            />
          )}
        </div>
      </aside>

      {/* ─── MODALS ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isAddTableModalOpen && (
          <SrModal open onClose={() => setIsAddTableModalOpen(false)} maxWidth={460}>
            <SrModalHeader
              title="Nueva mesa"
              kicker="Agrégala al plano"
              onClose={() => setIsAddTableModalOpen(false)}
            />
            <div className="space-y-6">
              <div>
                <SrLabel className="block mb-2">Nombre / identificador</SrLabel>
                <SrInput
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="ej. Mesa 24"
                  autoFocus
                />
              </div>
              <SrCard className="p-6">
                <SrLabel className="block mb-4 text-center">Capacidad</SrLabel>
                <div className="flex items-center justify-center gap-8">
                  <button
                    type="button"
                    onClick={() => setNewTableSeats(Math.max(1, newTableSeats - 1))}
                    className="w-12 h-12 rounded-sr-md bg-servirest-hueso-sunken border border-[rgba(42,40,38,0.12)] text-servirest-midnight font-black text-xl hover:border-servirest-terracota transition-colors"
                  >
                    −
                  </button>
                  <span className="font-serif italic font-medium text-[52px] text-servirest-terracota w-20 text-center leading-none">
                    {newTableSeats}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewTableSeats(newTableSeats + 1)}
                    className="w-12 h-12 rounded-sr-md bg-servirest-hueso-sunken border border-[rgba(42,40,38,0.12)] text-servirest-midnight font-black text-xl hover:border-servirest-terracota transition-colors"
                  >
                    +
                  </button>
                </div>
              </SrCard>
              <div className="flex gap-3">
                <SrButton variant="outline" size="md" fullWidth onClick={() => setIsAddTableModalOpen(false)}>
                  Cancelar
                </SrButton>
                <SrButton variant="primary" size="md" fullWidth disabled={!newTableName} onClick={handleAddTable}>
                  Crear mesa
                </SrButton>
              </div>
            </div>
          </SrModal>
        )}

        {isEditModalOpen && (
          <SrModal open onClose={() => setIsEditModalOpen(false)} maxWidth={460}>
            <SrModalHeader
              title="Editar mesa"
              kicker="Ajusta nombre y capacidad"
              onClose={() => setIsEditModalOpen(false)}
            />
            <div className="space-y-6">
              <div>
                <SrLabel className="block mb-2">Nombre</SrLabel>
                <SrInput
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  autoFocus
                />
              </div>
              <SrCard className="p-6">
                <SrLabel className="block mb-4 text-center">Capacidad</SrLabel>
                <div className="flex items-center justify-center gap-8">
                  <button
                    type="button"
                    onClick={() => setNewTableSeats(Math.max(1, newTableSeats - 1))}
                    className="w-12 h-12 rounded-sr-md bg-servirest-hueso-sunken border border-[rgba(42,40,38,0.12)] text-servirest-midnight font-black text-xl hover:border-servirest-terracota transition-colors"
                  >
                    −
                  </button>
                  <span className="font-serif italic font-medium text-[52px] text-servirest-terracota w-20 text-center leading-none">
                    {newTableSeats}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewTableSeats(newTableSeats + 1)}
                    className="w-12 h-12 rounded-sr-md bg-servirest-hueso-sunken border border-[rgba(42,40,38,0.12)] text-servirest-midnight font-black text-xl hover:border-servirest-terracota transition-colors"
                  >
                    +
                  </button>
                </div>
              </SrCard>
              <div className="flex gap-3">
                <SrButton variant="outline" size="md" fullWidth onClick={() => setIsEditModalOpen(false)}>
                  Descartar
                </SrButton>
                <SrButton variant="primary" size="md" fullWidth disabled={!newTableName} onClick={handleUpdateTable}>
                  Guardar
                </SrButton>
              </div>
            </div>
          </SrModal>
        )}

        {isDeleteConfirmOpen && (
          <SrModal open onClose={() => setIsDeleteConfirmOpen(false)} maxWidth={420}>
            <div className="flex flex-col items-center text-center py-3">
              <div className="w-16 h-16 rounded-full bg-[rgba(225,85,75,0.10)] text-servirest-danger flex items-center justify-center mb-5">
                <AlertTriangle size={28} />
              </div>
              <h2 className="font-serif italic font-medium text-[28px] text-servirest-midnight tracking-[-0.02em] leading-tight m-0 mb-2">
                ¿Eliminar mesa?
              </h2>
              <p className="text-[13px] text-[rgba(42,40,38,0.6)] font-medium m-0 mb-7 max-w-sm leading-relaxed">
                Vas a quitar la mesa <b className="text-servirest-midnight">{selectedTable?.name}</b> del plano. No la podrás
                recuperar.
              </p>
              <div className="w-full space-y-2.5">
                <SrButton variant="danger" size="lg" fullWidth onClick={handleDeleteTableAction}>
                  Sí, eliminar
                </SrButton>
                <SrButton variant="ghost" size="md" fullWidth onClick={() => setIsDeleteConfirmOpen(false)}>
                  Mejor no
                </SrButton>
              </div>
            </div>
          </SrModal>
        )}
      </AnimatePresence>

      {/* Tier limit modal — contextual upsell when adding the (max+1)th mesa */}
      <SrTierUpgradeModal
        open={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limit="maxTables"
        currentTier={tier}
      />
    </div>
  );
};

export default HostessScreen;
