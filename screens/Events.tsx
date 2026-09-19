/**
 * Módulo Eventos — banquetes y catering.
 *
 * Tres vistas:
 *  · Panel    — scoreboard de gestión: vendido / cotizado / programado,
 *               próximos eventos y saldos por cobrar.
 *  · Agenda   — todos los eventos (cliente, fecha, paquete, anticipo,
 *               estatus) con alta/edición/transiciones de estatus.
 *  · Paquetes — catálogo: costos (base + por invitado), qué incluye,
 *               mínimo de invitados y disponibilidad.
 *
 * Persistencia: services/events.ts (local-first + Supabase directo).
 * Requiere MIGRATION_EVENTS.sql.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useUser } from '../contexts/UserContext';
import {
  PartyPopper, CalendarDays, Users, Phone, MapPin, Plus, Pencil, Trash2,
  Package, CheckCircle2, Clock, Wallet, TrendingUp, TrendingDown, FileText, X, Sparkles,
} from 'lucide-react';
import {
  SrCard, SrButton, SrSeg, SrChip, SrLabel, SrKicker, SrMono, SrInput,
  SrModal, SrModalHeader, SrSectionHeading, SrEmptyState,
} from '../components/ui/servirest';
import {
  EventPackage, CateringEvent, CateringEventStatus, EVENT_STATUS_META,
  getCachedPackages, getCachedEvents, refreshEventsData,
  saveEventPackage, deleteEventPackage, saveCateringEvent, deleteCateringEvent,
  suggestedTotal, eventCosts, eventProfit,
} from '../services/events';

/* ─── Helpers ────────────────────────────────────────────────────────── */

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const money = (n: number) =>
  `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** "2026-09-14" → { day: '14', month: 'SEP' } sin pasar por Date/UTC. */
const dateParts = (ymd: string) => {
  const [, m, d] = (ymd || '').split('-');
  const mi = Math.max(0, Math.min(11, parseInt(m || '1', 10) - 1));
  return { day: d || '--', month: MONTHS_SHORT[mi] };
};

const emptyPackage = (): EventPackage => ({
  id: crypto.randomUUID(),
  name: '',
  description: '',
  basePrice: 0,
  pricePerPerson: 0,
  minGuests: 0,
  includes: [],
  active: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const emptyEvent = (): CateringEvent => ({
  id: crypto.randomUUID(),
  clientName: '',
  clientPhone: '',
  eventDate: localToday(),
  eventTime: '',
  venue: '',
  guests: 0,
  packageId: null,
  packageName: '',
  status: 'QUOTED',
  quotedTotal: 0,
  deposit: 0,
  expenses: [],
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const TABS = ['Panel', 'Agenda', 'Paquetes'] as const;
type Tab = typeof TABS[number];

const STATUS_FILTERS = ['Todos', 'Cotizado', 'Confirmado', 'Realizado', 'Cancelado'] as const;
const FILTER_TO_STATUS: Record<string, CateringEventStatus | null> = {
  Todos: null, Cotizado: 'QUOTED', Confirmado: 'CONFIRMED', Realizado: 'COMPLETED', Cancelado: 'CANCELLED',
};

/* ─── Pantalla ───────────────────────────────────────────────────────── */

export const EventsScreen: React.FC = () => {
  const { authProfile } = useUser();
  const bizId = authProfile?.businessId || '';

  const [tab, setTab] = useState<Tab>('Panel');
  const [packages, setPackages] = useState<EventPackage[]>(() => getCachedPackages(bizId));
  const [events, setEvents] = useState<CateringEvent[]>(() => getCachedEvents(bizId));
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('Todos');

  // Modales de edición (null = cerrado)
  const [pkgDraft, setPkgDraft] = useState<EventPackage | null>(null);
  const [evtDraft, setEvtDraft] = useState<CateringEvent | null>(null);
  const [includeInput, setIncludeInput] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');

  useEffect(() => {
    if (!bizId) return;
    setPackages(getCachedPackages(bizId));
    setEvents(getCachedEvents(bizId));
    refreshEventsData(bizId).then(({ packages, events }) => {
      setPackages(packages.filter(p => !p._deleted));
      setEvents(events.filter(e => !e._deleted));
    });
  }, [bizId]);

  const today = localToday();

  /* ── Derivados para el Panel ── */
  const kpis = useMemo(() => {
    const sum = (rows: CateringEvent[]) => rows.reduce((s, e) => s + (e.quotedTotal || 0), 0);
    const quoted = events.filter(e => e.status === 'QUOTED');
    const confirmedUpcoming = events.filter(e => e.status === 'CONFIRMED' && e.eventDate >= today);
    const completed = events.filter(e => e.status === 'COMPLETED');
    const depositsPending = confirmedUpcoming.reduce((s, e) => s + Math.max(0, (e.quotedTotal || 0) - (e.deposit || 0)), 0);
    const soldTotal = sum(completed);
    const soldCosts = completed.reduce((s, e) => s + eventCosts(e), 0);
    const soldProfit = soldTotal - soldCosts;
    return {
      quoted, confirmedUpcoming, completed,
      quotedTotal: sum(quoted),
      scheduledTotal: sum(confirmedUpcoming),
      soldTotal,
      soldCosts,
      soldProfit,
      soldMarginPct: soldTotal > 0 ? (soldProfit / soldTotal) * 100 : 0,
      depositsReceived: confirmedUpcoming.reduce((s, e) => s + (e.deposit || 0), 0),
      depositsPending,
    };
  }, [events, today]);

  const upcoming = useMemo(
    () => events
      .filter(e => (e.status === 'CONFIRMED' || e.status === 'QUOTED') && e.eventDate >= today)
      .sort((a, b) => (a.eventDate + a.eventTime).localeCompare(b.eventDate + b.eventTime)),
    [events, today]
  );

  const topPackages = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    events.forEach(e => {
      if (e.status === 'CANCELLED' || !e.packageName) return;
      if (!map[e.packageName]) map[e.packageName] = { count: 0, total: 0 };
      map[e.packageName].count += 1;
      map[e.packageName].total += e.quotedTotal || 0;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  }, [events]);

  const agendaRows = useMemo(() => {
    const want = FILTER_TO_STATUS[statusFilter];
    return events
      .filter(e => !want || e.status === want)
      .sort((a, b) => (b.eventDate + b.eventTime).localeCompare(a.eventDate + a.eventTime))
      // Próximos primero, historial después
      .sort((a, b) => {
        const aUp = a.eventDate >= today ? 0 : 1;
        const bUp = b.eventDate >= today ? 0 : 1;
        if (aUp !== bUp) return aUp - bUp;
        return aUp === 0
          ? (a.eventDate + a.eventTime).localeCompare(b.eventDate + b.eventTime)
          : (b.eventDate + b.eventTime).localeCompare(a.eventDate + a.eventTime);
      });
  }, [events, statusFilter, today]);

  /* ── Acciones ── */
  const persistEvent = (evt: CateringEvent) => {
    const saved = saveCateringEvent(bizId, evt);
    setEvents(prev => {
      const idx = prev.findIndex(e => e.id === saved.id);
      const next = [...prev];
      if (idx >= 0) next[idx] = saved; else next.push(saved);
      return next;
    });
  };

  const changeStatus = (evt: CateringEvent, status: CateringEventStatus) =>
    persistEvent({ ...evt, status });

  const removeEvent = (evt: CateringEvent) => {
    if (!window.confirm(`¿Eliminar el evento de ${evt.clientName || 'sin nombre'} (${evt.eventDate})?\nSe borra de este equipo y de la nube.`)) return;
    deleteCateringEvent(bizId, evt.id);
    setEvents(prev => prev.filter(e => e.id !== evt.id));
  };

  const persistPackage = (pkg: EventPackage) => {
    const saved = saveEventPackage(bizId, pkg);
    setPackages(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      const next = [...prev];
      if (idx >= 0) next[idx] = saved; else next.push(saved);
      return next;
    });
  };

  const removePackage = (pkg: EventPackage) => {
    if (!window.confirm(`¿Eliminar el paquete "${pkg.name}"?\nLos eventos ya cotizados con él conservan su nombre y precio.`)) return;
    deleteEventPackage(bizId, pkg.id);
    setPackages(prev => prev.filter(p => p.id !== pkg.id));
  };

  const statusChip = (s: CateringEventStatus) => (
    <SrChip tone={EVENT_STATUS_META[s].tone as any} size="xs">{EVENT_STATUS_META[s].label}</SrChip>
  );

  /* ─────────────────────────────────────────────────────────────────── */

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-servirest-hueso">
      <div className="max-w-[1400px] mx-auto px-8 py-10 pb-24">

        <SrSectionHeading
          kicker="Banquetes & Catering"
          title="Eventos"
          right={
            <div className="flex items-center gap-3 flex-wrap">
              <SrSeg options={TABS} value={tab} onChange={setTab} />
              <SrButton size="sm" icon={<Plus size={14} />} onClick={() => { setExpDesc(''); setExpAmount(''); setEvtDraft(emptyEvent()); }}>
                Nuevo evento
              </SrButton>
            </div>
          }
        />

        {/* ════════════════ PANEL ════════════════ */}
        {tab === 'Panel' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-10 space-y-10">

            {/* Scoreboard principal */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Vendido (realizados)', value: kpis.soldTotal, sub: `${kpis.completed.length} evento${kpis.completed.length === 1 ? '' : 's'} realizados`, icon: TrendingUp, tone: 'text-servirest-success' },
                { label: 'Programado (confirmados)', value: kpis.scheduledTotal, sub: `${kpis.confirmedUpcoming.length} por realizar · anticipos ${money(kpis.depositsReceived)}`, icon: CalendarDays, tone: 'text-servirest-terracota' },
                { label: 'Cotizado (pipeline)', value: kpis.quotedTotal, sub: `${kpis.quoted.length} cotización${kpis.quoted.length === 1 ? '' : 'es'} sin cerrar`, icon: FileText, tone: 'text-servirest-mostaza' },
              ].map((k, i) => (
                <SrCard key={i} variant="solaris" className="p-8">
                  <div className="flex items-center gap-2.5 mb-4 opacity-60">
                    <k.icon size={15} className="text-servirest-terracota" />
                    <SrLabel>{k.label}</SrLabel>
                  </div>
                  <div className={`font-black italic text-[40px] tracking-[-0.02em] leading-none ${k.tone}`}>
                    {money(k.value)}
                  </div>
                  <p className="text-[11px] font-bold text-[rgba(42,40,38,0.45)] mt-3 uppercase tracking-wider">{k.sub}</p>
                </SrCard>
              ))}
            </div>

            {/* Utilidad neta de eventos realizados */}
            {kpis.completed.length > 0 && (
              <SrCard className="p-8">
                <div className="flex items-center gap-2.5 mb-6 opacity-60">
                  <Wallet size={15} className="text-servirest-terracota" />
                  <SrLabel>Rentabilidad de eventos realizados</SrLabel>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <SrLabel className="block mb-2">Vendido</SrLabel>
                    <SrMono className="text-[26px] font-black text-servirest-carbon">{money(kpis.soldTotal)}</SrMono>
                  </div>
                  <div>
                    <SrLabel className="block mb-2">Gastos</SrLabel>
                    <SrMono className="text-[26px] font-black text-servirest-danger">-{money(kpis.soldCosts)}</SrMono>
                  </div>
                  <div>
                    <SrLabel className="block mb-2">Utilidad neta</SrLabel>
                    <SrMono className={`text-[26px] font-black ${kpis.soldProfit >= 0 ? 'text-servirest-success' : 'text-servirest-danger'}`}>{money(kpis.soldProfit)}</SrMono>
                  </div>
                  <div>
                    <SrLabel className="block mb-2">Margen</SrLabel>
                    <div className="flex items-center gap-2">
                      <SrMono className={`text-[26px] font-black ${kpis.soldMarginPct >= 0 ? 'text-servirest-success' : 'text-servirest-danger'}`}>{kpis.soldMarginPct.toFixed(1)}%</SrMono>
                      {kpis.soldMarginPct >= 0 ? <TrendingUp size={18} className="text-servirest-success" /> : <TrendingDown size={18} className="text-servirest-danger" />}
                    </div>
                  </div>
                </div>
                {kpis.soldCosts === 0 && (
                  <p className="text-[10px] font-black uppercase tracking-wider text-servirest-mostaza mt-5">
                    Aún no registras gastos en tus eventos realizados — edita el evento y captúralos para ver la utilidad real.
                  </p>
                )}
              </SrCard>
            )}

            {/* Por cobrar */}
            {kpis.depositsPending > 0 && (
              <SrCard className="p-6 flex items-center justify-between flex-wrap gap-4 border-servirest-mostaza/40">
                <div className="flex items-center gap-3">
                  <Wallet size={18} className="text-servirest-mostaza" />
                  <div>
                    <SrLabel>Saldo por cobrar de eventos confirmados</SrLabel>
                    <p className="text-[11px] text-[rgba(42,40,38,0.5)] font-medium mt-1">Total pactado menos anticipos recibidos.</p>
                  </div>
                </div>
                <SrMono className="text-[26px] font-black text-servirest-mostaza">{money(kpis.depositsPending)}</SrMono>
              </SrCard>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-8 items-start">
              {/* Próximos eventos */}
              <SrCard className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <SrKicker className="block mb-1.5">Agenda</SrKicker>
                    <h3 className="font-serif italic text-[22px] text-servirest-midnight m-0">Próximos eventos</h3>
                  </div>
                  <SrButton variant="ghost" size="sm" onClick={() => setTab('Agenda')}>Ver todo</SrButton>
                </div>
                {upcoming.length === 0 ? (
                  <SrEmptyState
                    icon={<PartyPopper size={26} />}
                    title="Sin eventos en puerta"
                    description="Cuando cotices o confirmes un evento con fecha futura aparecerá aquí."
                    action={<SrButton size="sm" icon={<Plus size={14} />} onClick={() => setEvtDraft(emptyEvent())}>Cotizar evento</SrButton>}
                  />
                ) : (
                  <div className="space-y-3">
                    {upcoming.slice(0, 6).map(e => {
                      const { day, month } = dateParts(e.eventDate);
                      return (
                        <button
                          key={e.id}
                          onClick={() => setEvtDraft({ ...e })}
                          className="w-full text-left flex items-center gap-5 p-4 rounded-sr-lg border border-[rgba(42,40,38,0.10)] bg-servirest-surface hover:border-servirest-terracota/50 transition-colors group"
                        >
                          <div className="w-14 h-14 shrink-0 rounded-sr-md bg-servirest-midnight text-servirest-hueso flex flex-col items-center justify-center leading-none">
                            <span className="font-black italic text-[20px]">{day}</span>
                            <span className="text-[8px] font-black tracking-[0.2em] opacity-70 mt-1">{month}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="font-black italic uppercase tracking-tight text-servirest-carbon text-[14px] truncate">{e.clientName || 'Sin nombre'}</span>
                              {statusChip(e.status)}
                            </div>
                            <p className="text-[11px] text-[rgba(42,40,38,0.5)] font-bold uppercase tracking-wider mt-1 truncate">
                              {e.packageName || 'Paquete personalizado'} · {e.guests} inv.{e.eventTime ? ` · ${e.eventTime}` : ''}{e.venue ? ` · ${e.venue}` : ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <SrMono className="block text-[16px] font-black text-servirest-carbon">{money(e.quotedTotal)}</SrMono>
                            {e.deposit > 0 && (
                              <span className="text-[9px] font-black uppercase tracking-wider text-servirest-success">Anticipo {money(e.deposit)}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </SrCard>

              {/* Paquetes más vendidos */}
              <SrCard className="p-8">
                <SrKicker className="block mb-1.5">Catálogo</SrKicker>
                <h3 className="font-serif italic text-[22px] text-servirest-midnight m-0 mb-6">Paquetes top</h3>
                {topPackages.length === 0 ? (
                  <SrEmptyState
                    icon={<Package size={26} />}
                    title="Aún sin datos"
                    description="Cuando registres eventos con paquete verás aquí cuáles se venden más."
                  />
                ) : (
                  <div className="space-y-4">
                    {topPackages.map(([name, v]) => {
                      const max = topPackages[0][1].total || 1;
                      return (
                        <div key={name}>
                          <div className="flex justify-between items-baseline mb-1.5">
                            <span className="text-[11px] font-black uppercase tracking-wider text-[rgba(42,40,38,0.7)] italic truncate pr-3">{name}</span>
                            <SrMono className="text-[13px] font-black text-servirest-carbon shrink-0">{money(v.total)}</SrMono>
                          </div>
                          <div className="h-1.5 w-full bg-[rgba(42,40,38,0.06)] rounded-full overflow-hidden">
                            <div className="h-full bg-servirest-terracota rounded-full" style={{ width: `${(v.total / max) * 100}%` }} />
                          </div>
                          <p className="text-[9px] font-black uppercase tracking-wider text-[rgba(42,40,38,0.35)] mt-1">{v.count} evento{v.count === 1 ? '' : 's'}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SrCard>
            </div>
          </motion.div>
        )}

        {/* ════════════════ AGENDA ════════════════ */}
        {tab === 'Agenda' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-10 space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-4 py-2 rounded-sr-pill text-[9px] font-black uppercase tracking-[0.16em] border transition-colors ${
                    statusFilter === f
                      ? 'bg-servirest-midnight text-servirest-hueso border-servirest-midnight'
                      : 'bg-servirest-surface text-[rgba(42,40,38,0.5)] border-[rgba(42,40,38,0.15)] hover:border-servirest-terracota/50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {agendaRows.length === 0 ? (
              <SrCard className="p-4">
                <SrEmptyState
                  icon={<CalendarDays size={26} />}
                  title="Nada por aquí"
                  description={statusFilter === 'Todos'
                    ? 'Registra tu primer evento: cliente, fecha, paquete y precio.'
                    : `No hay eventos con estatus "${statusFilter}".`}
                  action={<SrButton size="sm" icon={<Plus size={14} />} onClick={() => setEvtDraft(emptyEvent())}>Nuevo evento</SrButton>}
                />
              </SrCard>
            ) : (
              <div className="space-y-3">
                {agendaRows.map(e => {
                  const { day, month } = dateParts(e.eventDate);
                  const past = e.eventDate < today;
                  const balance = Math.max(0, (e.quotedTotal || 0) - (e.deposit || 0));
                  return (
                    <SrCard key={e.id} className={`p-5 ${past && e.status !== 'COMPLETED' ? 'opacity-70' : ''}`}>
                      <div className="flex items-center gap-5 flex-wrap">
                        <div className={`w-16 h-16 shrink-0 rounded-sr-md flex flex-col items-center justify-center leading-none ${past ? 'bg-[rgba(42,40,38,0.08)] text-[rgba(42,40,38,0.5)]' : 'bg-servirest-midnight text-servirest-hueso'}`}>
                          <span className="font-black italic text-[22px]">{day}</span>
                          <span className="text-[8px] font-black tracking-[0.2em] opacity-70 mt-1">{month}</span>
                        </div>

                        <div className="flex-1 min-w-[220px]">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-black italic uppercase tracking-tight text-servirest-carbon text-[15px]">{e.clientName || 'Sin nombre'}</span>
                            {statusChip(e.status)}
                          </div>
                          <div className="flex items-center gap-4 flex-wrap mt-1.5 text-[10px] font-black uppercase tracking-wider text-[rgba(42,40,38,0.45)]">
                            <span className="inline-flex items-center gap-1.5"><Package size={11} /> {e.packageName || 'Personalizado'}</span>
                            <span className="inline-flex items-center gap-1.5"><Users size={11} /> {e.guests} inv.</span>
                            {e.eventTime && <span className="inline-flex items-center gap-1.5"><Clock size={11} /> {e.eventTime}</span>}
                            {e.venue && <span className="inline-flex items-center gap-1.5"><MapPin size={11} /> {e.venue}</span>}
                            {e.clientPhone && <span className="inline-flex items-center gap-1.5"><Phone size={11} /> {e.clientPhone}</span>}
                          </div>
                          {e.notes && <p className="text-[11px] text-[rgba(42,40,38,0.5)] italic mt-1.5 line-clamp-1">{e.notes}</p>}
                        </div>

                        <div className="text-right shrink-0 min-w-[130px]">
                          <SrMono className="block text-[19px] font-black text-servirest-carbon">{money(e.quotedTotal)}</SrMono>
                          {e.status === 'CONFIRMED' && (
                            balance > 0
                              ? <span className="block text-[9px] font-black uppercase tracking-wider text-servirest-mostaza">Resta {money(balance)}</span>
                              : <span className="block text-[9px] font-black uppercase tracking-wider text-servirest-success">Liquidado</span>
                          )}
                          {eventCosts(e) > 0 && (
                            <span className={`block text-[9px] font-black uppercase tracking-wider ${eventProfit(e) >= 0 ? 'text-servirest-success' : 'text-servirest-danger'}`}>
                              Utilidad {money(eventProfit(e))} · {e.quotedTotal > 0 ? `${((eventProfit(e) / e.quotedTotal) * 100).toFixed(0)}%` : '—'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {e.status === 'QUOTED' && (
                            <SrButton size="sm" variant="outline" icon={<CheckCircle2 size={13} />} onClick={() => changeStatus(e, 'CONFIRMED')}>Confirmar</SrButton>
                          )}
                          {e.status === 'CONFIRMED' && (
                            <SrButton size="sm" variant="outline" icon={<Sparkles size={13} />} onClick={() => changeStatus(e, 'COMPLETED')}>Realizado</SrButton>
                          )}
                          <button onClick={() => setEvtDraft({ ...e })} title="Editar"
                            className="w-9 h-9 rounded-sr-md border border-[rgba(42,40,38,0.12)] text-[rgba(42,40,38,0.5)] hover:text-servirest-terracota hover:border-servirest-terracota/50 flex items-center justify-center transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => removeEvent(e)} title="Eliminar"
                            className="w-9 h-9 rounded-sr-md border border-[rgba(42,40,38,0.12)] text-[rgba(42,40,38,0.35)] hover:text-servirest-danger hover:border-servirest-danger/50 flex items-center justify-center transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </SrCard>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ════════════════ PAQUETES ════════════════ */}
        {tab === 'Paquetes' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {packages.map(p => (
                <SrCard key={p.id} className={`p-7 flex flex-col ${p.active ? '' : 'opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-black italic uppercase tracking-tight text-[18px] text-servirest-midnight m-0 leading-tight">{p.name}</h3>
                    <SrChip tone={p.active ? 'success' : 'neutral'} size="xs">{p.active ? 'Activo' : 'Pausado'}</SrChip>
                  </div>
                  {p.description && <p className="text-[12px] text-[rgba(42,40,38,0.55)] font-medium leading-relaxed mb-4">{p.description}</p>}

                  <div className="flex items-end gap-6 mb-4">
                    <div>
                      <SrLabel className="block mb-1">Base</SrLabel>
                      <SrMono className="text-[20px] font-black text-servirest-carbon">{money(p.basePrice)}</SrMono>
                    </div>
                    <div>
                      <SrLabel className="block mb-1">Por invitado</SrLabel>
                      <SrMono className="text-[20px] font-black text-servirest-terracota">{money(p.pricePerPerson)}</SrMono>
                    </div>
                    {p.minGuests > 0 && (
                      <div>
                        <SrLabel className="block mb-1">Mínimo</SrLabel>
                        <SrMono className="text-[20px] font-black text-servirest-carbon">{p.minGuests}</SrMono>
                      </div>
                    )}
                  </div>

                  {p.includes.length > 0 && (
                    <ul className="space-y-1.5 mb-5">
                      {p.includes.map((inc, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] font-bold text-[rgba(42,40,38,0.6)] uppercase tracking-wide">
                          <CheckCircle2 size={13} className="text-servirest-success shrink-0 mt-[1px]" /> {inc}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto pt-4 border-t border-[rgba(42,40,38,0.08)] flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[rgba(42,40,38,0.35)]">
                      100 inv. ≈ {money(suggestedTotal(p, 100))}
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => setPkgDraft({ ...p })} title="Editar"
                        className="w-9 h-9 rounded-sr-md border border-[rgba(42,40,38,0.12)] text-[rgba(42,40,38,0.5)] hover:text-servirest-terracota hover:border-servirest-terracota/50 flex items-center justify-center transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => removePackage(p)} title="Eliminar"
                        className="w-9 h-9 rounded-sr-md border border-[rgba(42,40,38,0.12)] text-[rgba(42,40,38,0.35)] hover:text-servirest-danger hover:border-servirest-danger/50 flex items-center justify-center transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </SrCard>
              ))}

              {/* Alta de paquete */}
              <button
                onClick={() => { setIncludeInput(''); setPkgDraft(emptyPackage()); }}
                className="min-h-[220px] rounded-sr-xl border-2 border-dashed border-[rgba(42,40,38,0.15)] text-[rgba(42,40,38,0.4)] hover:border-servirest-terracota/60 hover:text-servirest-terracota transition-colors flex flex-col items-center justify-center gap-3"
              >
                <Plus size={26} />
                <span className="text-[10px] font-black uppercase tracking-[0.25em]">Nuevo paquete</span>
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ════════════════ MODAL: PAQUETE ════════════════ */}
      <SrModal open={!!pkgDraft} onClose={() => setPkgDraft(null)} maxWidth={640}>
        {pkgDraft && (
          <>
            <SrModalHeader
              title={pkgDraft.name ? 'Editar paquete' : 'Nuevo paquete'}
              kicker="Catálogo de eventos"
              onClose={() => setPkgDraft(null)}
            />
            <div className="space-y-4">
              <div>
                <SrLabel className="block mb-2">Nombre del paquete</SrLabel>
                <SrInput value={pkgDraft.name} placeholder="Taquiza premium, Parrillada, 3 tiempos…"
                  onChange={e => setPkgDraft(p => p && { ...p, name: e.target.value })} />
              </div>
              <div>
                <SrLabel className="block mb-2">Descripción</SrLabel>
                <SrInput value={pkgDraft.description} placeholder="Para bodas, XV años, posadas…"
                  onChange={e => setPkgDraft(p => p && { ...p, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <SrLabel className="block mb-2">Costo base ($)</SrLabel>
                  <SrInput type="number" min={0} value={pkgDraft.basePrice || ''}
                    onChange={e => setPkgDraft(p => p && { ...p, basePrice: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <SrLabel className="block mb-2">Por invitado ($)</SrLabel>
                  <SrInput type="number" min={0} value={pkgDraft.pricePerPerson || ''}
                    onChange={e => setPkgDraft(p => p && { ...p, pricePerPerson: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <SrLabel className="block mb-2">Mín. invitados</SrLabel>
                  <SrInput type="number" min={0} value={pkgDraft.minGuests || ''}
                    onChange={e => setPkgDraft(p => p && { ...p, minGuests: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <div>
                <SrLabel className="block mb-2">Qué incluye</SrLabel>
                <div className="flex gap-2">
                  <SrInput value={includeInput} placeholder="Mobiliario, meseros, postre…"
                    onChange={e => setIncludeInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && includeInput.trim()) {
                        setPkgDraft(p => p && { ...p, includes: [...p.includes, includeInput.trim()] });
                        setIncludeInput('');
                      }
                    }} />
                  <SrButton variant="outline" size="sm" className="shrink-0" onClick={() => {
                    if (!includeInput.trim()) return;
                    setPkgDraft(p => p && { ...p, includes: [...p.includes, includeInput.trim()] });
                    setIncludeInput('');
                  }}>Agregar</SrButton>
                </div>
                {pkgDraft.includes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {pkgDraft.includes.map((inc, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 bg-[rgba(196,99,63,0.08)] border border-servirest-terracota/30 text-servirest-terracota rounded-sr-pill px-3 py-1.5 text-[10px] font-black uppercase tracking-wider">
                        {inc}
                        <button onClick={() => setPkgDraft(p => p && { ...p, includes: p.includes.filter((_, j) => j !== i) })}
                          className="hover:text-servirest-danger transition-colors"><X size={11} /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-3 cursor-pointer pt-1">
                <input type="checkbox" checked={pkgDraft.active}
                  onChange={e => setPkgDraft(p => p && { ...p, active: e.target.checked })}
                  className="w-4 h-4 accent-[#C4633F]" />
                <span className="text-[11px] font-black uppercase tracking-wider text-[rgba(42,40,38,0.6)]">Disponible para cotizar</span>
              </label>

              <div className="flex justify-end gap-3 pt-4">
                <SrButton variant="ghost" onClick={() => setPkgDraft(null)}>Cancelar</SrButton>
                <SrButton
                  disabled={!pkgDraft.name.trim()}
                  onClick={() => { persistPackage(pkgDraft); setPkgDraft(null); }}
                >
                  Guardar paquete
                </SrButton>
              </div>
            </div>
          </>
        )}
      </SrModal>

      {/* ════════════════ MODAL: EVENTO ════════════════ */}
      <SrModal open={!!evtDraft} onClose={() => setEvtDraft(null)} maxWidth={720}>
        {evtDraft && (() => {
          const pkg = packages.find(p => p.id === evtDraft.packageId);
          const suggested = suggestedTotal(pkg, evtDraft.guests);
          return (
            <>
              <SrModalHeader
                title={events.some(e => e.id === evtDraft.id) ? 'Editar evento' : 'Nuevo evento'}
                kicker="Cliente · fecha · paquete"
                onClose={() => setEvtDraft(null)}
              />
              <div className="space-y-4 max-h-[62vh] overflow-y-auto custom-scrollbar pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <SrLabel className="block mb-2">Cliente</SrLabel>
                    <SrInput value={evtDraft.clientName} placeholder="Nombre del cliente"
                      onChange={e => setEvtDraft(d => d && { ...d, clientName: e.target.value })} />
                  </div>
                  <div>
                    <SrLabel className="block mb-2">Teléfono</SrLabel>
                    <SrInput value={evtDraft.clientPhone} placeholder="WhatsApp / celular"
                      onChange={e => setEvtDraft(d => d && { ...d, clientPhone: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <SrLabel className="block mb-2">Fecha</SrLabel>
                    <SrInput type="date" value={evtDraft.eventDate}
                      onChange={e => setEvtDraft(d => d && { ...d, eventDate: e.target.value })} />
                  </div>
                  <div>
                    <SrLabel className="block mb-2">Hora</SrLabel>
                    <SrInput type="time" value={evtDraft.eventTime}
                      onChange={e => setEvtDraft(d => d && { ...d, eventTime: e.target.value })} />
                  </div>
                  <div>
                    <SrLabel className="block mb-2">Invitados</SrLabel>
                    <SrInput type="number" min={0} value={evtDraft.guests || ''}
                      onChange={e => setEvtDraft(d => d && { ...d, guests: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>

                <div>
                  <SrLabel className="block mb-2">Lugar / domicilio del evento</SrLabel>
                  <SrInput value={evtDraft.venue} placeholder="Salón, jardín, domicilio…"
                    onChange={e => setEvtDraft(d => d && { ...d, venue: e.target.value })} />
                </div>

                <div>
                  <SrLabel className="block mb-2">Paquete</SrLabel>
                  <select
                    value={evtDraft.packageId || ''}
                    onChange={e => {
                      const sel = packages.find(p => p.id === e.target.value) || null;
                      setEvtDraft(d => d && {
                        ...d,
                        packageId: sel?.id || null,
                        packageName: sel?.name || d.packageName,
                        // Si aún no se ha pactado precio, precarga el sugerido.
                        quotedTotal: d.quotedTotal > 0 ? d.quotedTotal : suggestedTotal(sel || undefined, d.guests),
                      });
                    }}
                    className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.20)] rounded-sr-lg px-4 py-3 text-[13px] font-medium text-servirest-carbon outline-none focus:border-servirest-terracota"
                  >
                    <option value="">Personalizado (sin paquete)</option>
                    {packages.filter(p => p.active).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — base {money(p.basePrice)} + {money(p.pricePerPerson)}/inv.
                      </option>
                    ))}
                  </select>
                  {pkg && evtDraft.guests > 0 && evtDraft.guests < pkg.minGuests && (
                    <p className="text-[10px] font-black uppercase tracking-wider text-servirest-danger mt-2">
                      Este paquete pide mínimo {pkg.minGuests} invitados.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <SrLabel>Precio pactado ($)</SrLabel>
                      {pkg && suggested > 0 && (
                        <button
                          onClick={() => setEvtDraft(d => d && { ...d, quotedTotal: suggested })}
                          className="text-[9px] font-black uppercase tracking-wider text-servirest-terracota hover:underline"
                        >
                          Usar sugerido {money(suggested)}
                        </button>
                      )}
                    </div>
                    <SrInput type="number" min={0} value={evtDraft.quotedTotal || ''}
                      onChange={e => setEvtDraft(d => d && { ...d, quotedTotal: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <SrLabel className="block mb-2">Anticipo recibido ($)</SrLabel>
                    <SrInput type="number" min={0} value={evtDraft.deposit || ''}
                      onChange={e => setEvtDraft(d => d && { ...d, deposit: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>

                <div>
                  <SrLabel className="block mb-2">Estatus</SrLabel>
                  <div className="flex gap-2 flex-wrap">
                    {(Object.keys(EVENT_STATUS_META) as CateringEventStatus[]).map(s => (
                      <button key={s} onClick={() => setEvtDraft(d => d && { ...d, status: s })}
                        className={`px-4 py-2 rounded-sr-pill text-[9px] font-black uppercase tracking-[0.16em] border transition-colors ${
                          evtDraft.status === s
                            ? 'bg-servirest-midnight text-servirest-hueso border-servirest-midnight'
                            : 'bg-servirest-surface text-[rgba(42,40,38,0.5)] border-[rgba(42,40,38,0.15)]'
                        }`}>
                        {EVENT_STATUS_META[s].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gastos del evento → utilidad neta y margen */}
                <div className="pt-2 border-t border-[rgba(42,40,38,0.08)]">
                  <SrLabel className="block mb-2">Gastos del evento</SrLabel>
                  <div className="flex gap-2">
                    <SrInput value={expDesc} placeholder="Insumos, renta, personal extra…"
                      onChange={e => setExpDesc(e.target.value)} />
                    <SrInput type="number" min={0} value={expAmount} placeholder="$"
                      className="!w-32 shrink-0" onChange={e => setExpAmount(e.target.value)} />
                    <SrButton variant="outline" size="sm" className="shrink-0" onClick={() => {
                      const amt = parseFloat(expAmount) || 0;
                      if (!expDesc.trim() || amt <= 0) return;
                      setEvtDraft(d => d && {
                        ...d,
                        expenses: [...(d.expenses || []), { id: crypto.randomUUID(), description: expDesc.trim(), amount: amt }],
                      });
                      setExpDesc(''); setExpAmount('');
                    }}>Agregar</SrButton>
                  </div>

                  {(evtDraft.expenses || []).length > 0 && (
                    <div className="mt-3 space-y-2">
                      {(evtDraft.expenses || []).map(x => (
                        <div key={x.id} className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-sr-md bg-[rgba(42,40,38,0.03)] border border-[rgba(42,40,38,0.08)]">
                          <span className="text-[11px] font-black uppercase tracking-wide text-[rgba(42,40,38,0.65)] truncate">{x.description}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <SrMono className="text-[13px] font-black text-servirest-danger">-{money(x.amount)}</SrMono>
                            <button onClick={() => setEvtDraft(d => d && { ...d, expenses: (d.expenses || []).filter(y => y.id !== x.id) })}
                              className="text-[rgba(42,40,38,0.3)] hover:text-servirest-danger transition-colors"><X size={13} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(() => {
                    const costs = eventCosts(evtDraft);
                    const profit = eventProfit(evtDraft);
                    const pct = evtDraft.quotedTotal > 0 ? (profit / evtDraft.quotedTotal) * 100 : 0;
                    if (costs <= 0) return null;
                    return (
                      <div className="mt-3 flex items-center justify-between px-4 py-3 rounded-sr-md bg-servirest-midnight text-servirest-hueso">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-70">Gastos {money(costs)}</span>
                        <span className={`text-[12px] font-black uppercase tracking-wider ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          Utilidad {money(profit)} · {pct.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <SrLabel className="block mb-2">Notas</SrLabel>
                  <SrInput value={evtDraft.notes} placeholder="Alergias, montaje, restricciones, pendientes…"
                    onChange={e => setEvtDraft(d => d && { ...d, notes: e.target.value })} />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <SrButton variant="ghost" onClick={() => setEvtDraft(null)}>Cancelar</SrButton>
                <SrButton
                  disabled={!evtDraft.clientName.trim() || !evtDraft.eventDate}
                  onClick={() => { persistEvent(evtDraft); setEvtDraft(null); }}
                >
                  Guardar evento
                </SrButton>
              </div>
            </>
          );
        })()}
      </SrModal>
    </div>
  );
};
