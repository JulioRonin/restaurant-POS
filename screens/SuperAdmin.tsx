import React, { useState, useEffect, useMemo } from 'react';
import { getSupabase } from '../services/auth';
import { useUser } from '../contexts/UserContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Building2, CheckCircle2, XCircle, ChevronRight, LayoutGrid,
  ShieldCheck, Search, Mail, CreditCard, Trash2, Calendar, Zap,
  TrendingUp, DollarSign, Package, ChefHat, LogOut, Plus, AlertTriangle,
} from 'lucide-react';
import {
  SrCard, SrButton, SrChip, SrInput, SrLabel, SrKicker, SrMono,
  SrModal, SrModalHeader, SrEmptyState, SrTabs,
} from '../components/ui/servirest';

interface Business {
  id: string;
  name: string;
  plan: 'basic' | 'premium' | 'enterprise' | 'demo';
  demo_until?: string | null;
  subscription_expiry?: string | null;
  is_active: boolean;
  created_at: string;
  custom_price?: number | null;
  profiles?: any[];
}

interface Feature {
  id: string;
  key: string;
  name: string;
  description: string;
}

const DEFAULT_FEATURES = [
  { key: 'dashboard',          name: 'Dashboard',                  description: 'Panel de métricas y resumen de ventas' },
  { key: 'pos',                name: 'Punto de Venta',             description: 'Toma de pedidos principal' },
  { key: 'tables',             name: 'Gestión de mesas',           description: 'Mapa de mesas y estados' },
  { key: 'hostess',            name: 'Hostess y reservas',         description: 'Recepción y waitlist (Profesional+)' },
  { key: 'cashier',            name: 'Caja y gastos',              description: 'Cortes de caja y egresos' },
  { key: 'kitchen',            name: 'Monitor de cocina',          description: 'Pedidos para el área de cocina (Profesional+)' },
  { key: 'bar',                name: 'Monitor de barra',           description: 'Pedidos para el área de barra (Profesional+)' },
  { key: 'remote_order',       name: 'Comandero remoto',           description: 'Tablets para meseros (Profesional+)' },
  { key: 'inventory',          name: 'Inventario simple',          description: 'Stock básico con alertas (todos los planes)' },
  { key: 'inventory_advanced', name: 'Inventario profesional',     description: 'Proveedores, food cost, pedidos (Profesional+)' },
  { key: 'staff',              name: 'Personal',                   description: 'Gestión de empleados y roles' },
  { key: 'menu_admin',         name: 'Catálogo de menú',           description: 'Edición de platillos y precios' },
  { key: 'cfdi',               name: 'Facturación CFDI 4.0',       description: 'Timbrado fiscal con Facturama (Profesional+)' },
  { key: 'reservations',       name: 'Reservaciones',              description: 'Confirmación WhatsApp + email (Prestige+)' },
  { key: 'digital_menu',       name: 'Carta digital pública',      description: 'URL propia + QR (Prestige+)' },
  { key: 'wine_list',          name: 'Wine list y coctelera',     description: 'Maridajes y costeo (Prestige+)' },
  { key: 'online_ordering',    name: 'Pedidos online + Kiosko',    description: 'Canal digital de auto-servicio, pago con terminal o Stripe (Prestige+)' },
  { key: 'online_reservations',name: 'Reservas online',            description: 'Cliente reserva desde el web sin llamar (Prestige+)' },
  { key: 'kiosk_mode',         name: 'Modo Kiosko',                description: 'Tablet o pantalla física en el local para auto-orden (Prestige+)' },
  { key: 'online_payments',    name: 'Cobro digital',              description: 'Terminal BT + Stripe QR + OXXO desde el canal digital (Prestige+)' },
];

export default function SuperAdminScreen() {
  const { isSuperAdmin, signOut } = useUser();
  const { refreshFeatures, membershipPrice } = useSubscription();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [businessFeatures, setBusinessFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: 850, method: 'Transferencia' });
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    if (isSuperAdmin) loadData();
  }, [isSuperAdmin]);

  const loadData = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: bData } = await supabase
        .from('businesses')
        .select('*, profiles!profiles_business_id_fkey(full_name, role)')
        .order('created_at', { ascending: false });
      const { data: fData } = await supabase.from('features').select('*');
      const { data: pData } = await supabase.from('subscription_payments').select('amount, period_start');
      setBusinesses(bData || []);
      setFeatures(fData || []);
      setPayments(pData || []);
    } catch (err) {
      console.error('Error loading super admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBusinessFeatures = async (businessId: string) => {
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from('business_features')
        .select('feature_id, enabled')
        .eq('business_id', businessId);
      const mapping: Record<string, boolean> = {};
      data?.forEach((bf: any) => { mapping[bf.feature_id] = bf.enabled; });
      setBusinessFeatures(mapping);
    } catch (err) {
      console.error('Error loading business features:', err);
    }
  };

  const toggleFeature = async (featureId: string, currentState: boolean) => {
    if (!selectedBusiness) return;
    const supabase = getSupabase();
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('business_features')
        .upsert({ business_id: selectedBusiness.id, feature_id: featureId, enabled: !currentState }, { onConflict: 'business_id,feature_id' });
      if (error) throw error;
      setBusinessFeatures((prev) => ({ ...prev, [featureId]: !currentState }));
      await refreshFeatures();
    } catch (err) {
      console.error('Error toggling feature:', err);
    }
  };

  const updateBusinessPlan = async (plan: 'basic' | 'premium' | 'enterprise' | 'demo') => {
    if (!selectedBusiness) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    try {
      const updates: any = { plan };
      if (plan === 'demo') {
        const demoUntil = new Date();
        demoUntil.setDate(demoUntil.getDate() + 20);
        updates.demo_until = demoUntil.toISOString();
      } else {
        updates.demo_until = null;
        updates.is_active = true;
        if (selectedBusiness.plan === 'demo') {
          const newExpiry = new Date();
          newExpiry.setDate(newExpiry.getDate() + 30);
          updates.subscription_expiry = newExpiry.toISOString();
        }
      }
      const { error } = await supabase.from('businesses').update(updates).eq('id', selectedBusiness.id);
      if (error) throw error;
      const updatedBusiness = { ...selectedBusiness, ...updates };
      setSelectedBusiness(updatedBusiness);
      setBusinesses((prev) => prev.map((b) => (b.id === selectedBusiness.id ? updatedBusiness : b)));
    } catch (err) {
      console.error('Error updating plan:', err);
      alert('Error al actualizar el plan');
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBusiness) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    try {
      const newExpiry = selectedBusiness.subscription_expiry ? new Date(selectedBusiness.subscription_expiry) : new Date();
      if (newExpiry < new Date()) newExpiry.setTime(new Date().getTime());
      newExpiry.setMonth(newExpiry.getMonth() + 1);
      const { error: pError } = await supabase.from('subscription_payments').insert({
        business_id: selectedBusiness.id,
        amount: paymentForm.amount,
        method: paymentForm.method,
        period_start: new Date().toISOString(),
        period_end: newExpiry.toISOString(),
      });
      if (pError) throw pError;
      const { error: bError } = await supabase
        .from('businesses')
        .update({ subscription_expiry: newExpiry.toISOString(), is_active: true })
        .eq('id', selectedBusiness.id);
      if (bError) throw bError;
      const updatedBusiness = { ...selectedBusiness, subscription_expiry: newExpiry.toISOString(), is_active: true };
      setSelectedBusiness(updatedBusiness);
      setBusinesses((prev) => prev.map((b) => (b.id === selectedBusiness.id ? updatedBusiness : b)));
      setShowPaymentModal(false);
    } catch (err) {
      console.error(err);
      alert('Error al registrar el pago. Asegúrate de tener los permisos.');
    } finally {
      setSaving(false);
    }
  };

  const toggleBusinessStatus = async () => {
    if (!selectedBusiness) return;
    const newStatus = !selectedBusiness.is_active;
    const action = newStatus ? 'activar' : 'bloquear';
    if (!window.confirm(`¿Seguro que deseas ${action} el negocio "${selectedBusiness.name}"?`)) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('businesses').update({ is_active: newStatus }).eq('id', selectedBusiness.id);
      if (error) throw error;
      const updated = { ...selectedBusiness, is_active: newStatus };
      setSelectedBusiness(updated);
      setBusinesses((prev) => prev.map((b) => (b.id === selectedBusiness.id ? updated : b)));
    } catch (err) {
      console.error('Error toggling status:', err);
      alert('Error al cambiar el estado del negocio.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBusiness = async () => {
    if (!selectedBusiness) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('businesses').delete().eq('id', selectedBusiness.id);
      if (error) throw error;
      setSelectedBusiness(null);
      setShowDeleteModal(false);
      loadData();
    } catch (err) {
      console.error('Error deleting business:', err);
      alert('Error al eliminar. Verifica que no tenga dependencias pendientes.');
    } finally {
      setSaving(false);
    }
  };

  const seedDefaultFeatures = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: existing } = await supabase.from('features').select('key');
    const existingKeys = (existing || []).map((f: any) => f.key);
    const toCreate = DEFAULT_FEATURES.filter((f) => !existingKeys.includes(f.key));
    if (toCreate.length > 0) {
      await supabase.from('features').insert(toCreate);
    }
    loadData();
  };

  const enableAllForBusiness = async () => {
    if (!selectedBusiness) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const updates = features.map((f) => ({ business_id: selectedBusiness.id, feature_id: f.id, enabled: true }));
    await supabase.from('business_features').upsert(updates, { onConflict: 'business_id,feature_id' });
    loadBusinessFeatures(selectedBusiness.id);
    await refreshFeatures();
  };

  const filteredBusinesses = useMemo(
    () => businesses.filter((b) => b.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [businesses, searchTerm]
  );

  const selectedBusinessAdmin = selectedBusiness?.profiles?.find(
    (p: any) => p.role === 'admin' || p.role === 'super_admin'
  );

  if (!isSuperAdmin) {
    return (
      <div className="h-full w-full bg-servirest-hueso flex flex-col items-center justify-center px-8 text-center">
        <div className="w-20 h-20 rounded-full bg-[rgba(225,85,75,0.10)] text-servirest-danger flex items-center justify-center mb-6 border border-servirest-danger/30">
          <ShieldCheck size={32} />
        </div>
        <h1 className="font-serif italic font-medium text-[40px] text-servirest-midnight tracking-[-0.02em] m-0 mb-2 leading-tight">
          Acceso restringido
        </h1>
        <p className="text-[14px] text-[rgba(42,40,38,0.6)] max-w-md">
          Esta zona es solo para administradores de ServiRest.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-servirest-hueso text-servirest-carbon antialiased">
      <div className="px-[38px] py-10 max-w-[1480px] mx-auto pb-32 lg:pb-12">
        {/* HEADER */}
        <div className="flex justify-between items-start flex-wrap gap-6 mb-10">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <SrKicker className="block mb-2">Plataforma ServiRest</SrKicker>
            <h1 className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0">
              Centro de control
            </h1>
            <p className="text-[14px] text-[rgba(42,40,38,0.6)] font-medium mt-2 max-w-[520px] leading-relaxed">
              Gestión global del ecosistema. Activa demos, ajusta planes, registra pagos y habilita módulos por cliente.
            </p>
          </motion.div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-[260px]">
              <SrInput
                shape="pill"
                placeholder="Buscar negocio…"
                value={searchTerm}
                icon={<Search size={14} />}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <SrButton variant="outline" size="md" icon={<LogOut size={14} />} onClick={signOut}>
              Cerrar sesión
            </SrButton>
          </div>
        </div>

        <GlobalConfigPanel />
        <div className="mt-5">
          <PaymentsDashboard businesses={businesses} payments={payments} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-10">
          <div className="lg:col-span-4">
            <SrCard variant="solaris" className="p-7 sticky top-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <SrKicker className="block mb-1">Cartera</SrKicker>
                  <h3 className="sr-h-brutal text-[18px] m-0">
                    {businesses.length} cliente{businesses.length === 1 ? '' : 's'}
                  </h3>
                </div>
                <SrChip tone="neutral">
                  <Building2 size={9} className="mr-1.5" /> {filteredBusinesses.length} en lista
                </SrChip>
              </div>

              <div className="space-y-2 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
                {loading ? (
                  [1, 2, 3].map((i) => (
                    <div key={i} className="h-[68px] rounded-sr-md bg-servirest-hueso-sunken/60 animate-pulse" />
                  ))
                ) : filteredBusinesses.length === 0 ? (
                  <SrEmptyState
                    icon={<Building2 size={22} />}
                    title="Sin clientes"
                    description={
                      searchTerm
                        ? 'Ningún negocio coincide con tu búsqueda.'
                        : 'Cuando los negocios se registren aparecerán aquí.'
                    }
                  />
                ) : (
                  filteredBusinesses.map((business, idx) => {
                    const sel = selectedBusiness?.id === business.id;
                    const planLabel =
                      business.plan === 'demo'
                        ? 'Demo'
                        : business.plan === 'premium'
                        ? 'Pro'
                        : business.plan === 'enterprise'
                        ? 'Enterprise'
                        : 'Básico';
                    return (
                      <motion.button
                        key={business.id}
                        type="button"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: idx * 0.02 }}
                        onClick={() => {
                          setSelectedBusiness(business);
                          loadBusinessFeatures(business.id);
                        }}
                        className={`w-full flex items-center gap-3 p-4 rounded-sr-md border transition-all text-left ${
                          sel
                            ? 'bg-[rgba(196,99,63,0.06)] border-servirest-terracota shadow-sr-glow'
                            : 'bg-servirest-surface border-[rgba(42,40,38,0.10)] hover:border-[rgba(42,40,38,0.20)]'
                        }`}
                      >
                        <div
                          className={`w-11 h-11 rounded-sr-md flex items-center justify-center font-serif italic font-medium text-[18px] shrink-0 ${
                            sel
                              ? 'bg-servirest-terracota text-servirest-hueso'
                              : business.plan === 'demo'
                              ? 'bg-[rgba(201,162,74,0.12)] text-servirest-mostaza'
                              : !business.is_active
                              ? 'bg-[rgba(225,85,75,0.10)] text-servirest-danger'
                              : 'bg-servirest-hueso-sunken text-[rgba(42,40,38,0.6)]'
                          }`}
                        >
                          {business.name.substring(0, 1).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-extrabold text-[14px] text-servirest-midnight tracking-tight truncate">
                            {business.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-[rgba(42,40,38,0.5)]">
                              Plan {planLabel}
                            </span>
                            {!business.is_active && (
                              <SrChip tone="danger" size="xs">Inactivo</SrChip>
                            )}
                          </div>
                        </div>
                        <ChevronRight
                          size={14}
                          className={`shrink-0 transition-transform ${sel ? 'text-servirest-terracota translate-x-1' : 'text-[rgba(42,40,38,0.3)]'}`}
                        />
                      </motion.button>
                    );
                  })
                )}
              </div>
            </SrCard>
          </div>

          <div className="lg:col-span-8">
            {selectedBusiness ? (
              <motion.div
                key={selectedBusiness.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                <SrCard variant="solaris" className="p-7">
                  <div className="flex items-start justify-between flex-wrap gap-5">
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 rounded-sr-xl bg-servirest-midnight text-servirest-mostaza flex items-center justify-center font-serif italic font-medium text-[28px] shrink-0">
                        {selectedBusiness.name.substring(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <SrKicker className="block mb-1">Negocio</SrKicker>
                        <h2 className="font-serif italic font-medium text-[36px] text-servirest-midnight tracking-[-0.02em] m-0 mb-2 leading-none">
                          {selectedBusiness.name}
                        </h2>
                        <div className="flex items-center gap-3 flex-wrap">
                          <SrMono className="text-[10px] text-[rgba(42,40,38,0.4)]">
                            {selectedBusiness.id.slice(0, 13)}…
                          </SrMono>
                          <span className="text-[10px] font-bold text-[rgba(42,40,38,0.4)]">·</span>
                          <span className="text-[11px] font-medium text-[rgba(42,40,38,0.6)] flex items-center gap-1.5">
                            <Calendar size={11} /> Unido{' '}
                            {new Date(selectedBusiness.created_at).toLocaleDateString('es-MX', {
                              day: '2-digit', month: 'short', year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 items-end">
                      <div className="flex gap-2.5">
                        <SrButton
                          variant="primary"
                          size="sm"
                          icon={<CreditCard size={12} />}
                          onClick={() => {
                            setPaymentForm({
                              amount: selectedBusiness.custom_price || membershipPrice || 850,
                              method: 'Transferencia',
                            });
                            setShowPaymentModal(true);
                          }}
                        >
                          Registrar pago
                        </SrButton>
                        <SrChip
                          tone={
                            !selectedBusiness.is_active
                              ? 'danger'
                              : selectedBusiness.plan === 'demo'
                              ? 'mostaza'
                              : 'success'
                          }
                          size="sm"
                        >
                          {!selectedBusiness.is_active
                            ? 'Inactivo'
                            : selectedBusiness.plan === 'demo'
                            ? 'Demo'
                            : 'Activo'}
                        </SrChip>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] font-medium text-[rgba(42,40,38,0.6)] flex items-center gap-1.5 justify-end">
                          <Calendar size={10} /> Vence{' '}
                          <span
                            className={
                              selectedBusiness.subscription_expiry &&
                              new Date(selectedBusiness.subscription_expiry) < new Date()
                                ? 'text-servirest-danger font-bold'
                                : 'text-servirest-success font-bold'
                            }
                          >
                            {selectedBusiness.subscription_expiry
                              ? new Date(selectedBusiness.subscription_expiry).toLocaleDateString('es-MX')
                              : 'Sin fecha'}
                          </span>
                        </div>
                        <div className="text-[10px] font-medium text-[rgba(42,40,38,0.6)] flex items-center gap-1.5 justify-end mt-1">
                          <Mail size={10} /> Admin{' '}
                          <span className="text-servirest-midnight font-bold">
                            {selectedBusinessAdmin?.full_name || 'Sin asignar'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </SrCard>

                <SrCard variant="solaris" className="p-7">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <SrKicker className="block mb-1">Plan</SrKicker>
                      <h3 className="sr-h-brutal text-[18px] m-0">Modalidad y precio</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-6">
                    {(['demo', 'basic', 'premium', 'enterprise'] as const).map((p) => {
                      const isSelected = selectedBusiness.plan === p;
                      const label =
                        p === 'demo'
                          ? 'Demo (20 días)'
                          : p === 'basic'
                          ? 'Básico'
                          : p === 'premium'
                          ? 'Pro'
                          : 'Enterprise';
                      const sub =
                        p === 'demo'
                          ? 'Prueba gratuita temporal'
                          : p === 'basic'
                          ? '$549 MXN / mes'
                          : p === 'premium'
                          ? '$899 MXN / mes'
                          : 'Precio a medida';
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => updateBusinessPlan(p)}
                          disabled={saving}
                          className={`flex items-center justify-between p-4 rounded-sr-md border transition-all text-left ${
                            isSelected
                              ? p === 'demo'
                                ? 'bg-[rgba(201,162,74,0.08)] border-servirest-mostaza shadow-[0_0_18px_rgba(201,162,74,0.15)]'
                                : 'bg-[rgba(196,99,63,0.06)] border-servirest-terracota shadow-sr-glow'
                              : 'bg-servirest-surface border-[rgba(42,40,38,0.12)] hover:border-[rgba(42,40,38,0.20)]'
                          } disabled:opacity-60`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-sr-md flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? p === 'demo'
                                    ? 'bg-servirest-mostaza text-servirest-midnight'
                                    : 'bg-servirest-terracota text-servirest-hueso'
                                  : 'bg-servirest-hueso-sunken text-[rgba(42,40,38,0.5)]'
                              }`}
                            >
                              <Zap size={14} />
                            </div>
                            <div>
                              <div className="font-extrabold text-[13px] text-servirest-midnight tracking-tight">
                                {label}
                              </div>
                              <div className="text-[10px] text-[rgba(42,40,38,0.5)] font-medium mt-0.5">{sub}</div>
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 size={16} className={p === 'demo' ? 'text-servirest-mostaza' : 'text-servirest-terracota'} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-5 border-t border-[rgba(42,40,38,0.08)]">
                    <SrLabel className="block mb-2">Precio personalizado · MXN / mes</SrLabel>
                    <div className="flex gap-2 flex-wrap">
                      <div className="flex-1 min-w-[180px]">
                        <SrInput
                          shape="box"
                          placeholder={`${membershipPrice} (global)`}
                          value={selectedBusiness.custom_price?.toString() || ''}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : null;
                            setSelectedBusiness({ ...selectedBusiness, custom_price: val });
                          }}
                        />
                      </div>
                      <SrButton
                        variant="primary"
                        size="md"
                        onClick={async () => {
                          setSaving(true);
                          const supabase = getSupabase();
                          if (supabase) {
                            await supabase
                              .from('businesses')
                              .update({ custom_price: selectedBusiness.custom_price })
                              .eq('id', selectedBusiness.id);
                            setBusinesses((prev) =>
                              prev.map((b) =>
                                b.id === selectedBusiness.id ? { ...b, custom_price: selectedBusiness.custom_price } : b
                              )
                            );
                          }
                          setSaving(false);
                        }}
                        disabled={saving}
                      >
                        {saving ? 'Guardando…' : 'Guardar precio'}
                      </SrButton>
                    </div>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {[10, 20, 50].map((discount) => (
                        <button
                          key={discount}
                          type="button"
                          onClick={() => {
                            const newPrice = Math.round((membershipPrice || 850) * (1 - discount / 100));
                            setSelectedBusiness({ ...selectedBusiness, custom_price: newPrice });
                          }}
                          className="px-3 py-1.5 rounded-sr-sm bg-servirest-hueso-sunken text-[rgba(42,40,38,0.6)] hover:bg-[rgba(42,40,38,0.10)] text-[10px] font-black uppercase tracking-[0.12em] transition-colors"
                        >
                          −{discount}%
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSelectedBusiness({ ...selectedBusiness, custom_price: null })}
                        className="px-3 py-1.5 rounded-sr-sm bg-servirest-hueso-sunken text-[rgba(42,40,38,0.6)] hover:bg-[rgba(42,40,38,0.10)] text-[10px] font-black uppercase tracking-[0.12em] transition-colors"
                      >
                        Usar global
                      </button>
                    </div>
                    <p className="text-[11px] text-[rgba(42,40,38,0.5)] mt-2 italic">
                      Si lo dejas vacío se aplica el precio global del sistema (${membershipPrice}).
                    </p>
                  </div>
                </SrCard>

                <SrCard variant="solaris" className="p-7">
                  <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                    <div>
                      <SrKicker className="block mb-1">Módulos</SrKicker>
                      <h3 className="sr-h-brutal text-[18px] m-0">Funciones habilitadas</h3>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <SrButton variant="ghost" size="sm" onClick={seedDefaultFeatures}>
                        Sincronizar catálogo
                      </SrButton>
                      {features.length > 0 && (
                        <SrButton variant="outline" size="sm" onClick={enableAllForBusiness}>
                          Habilitar todos
                        </SrButton>
                      )}
                    </div>
                  </div>

                  {features.length === 0 ? (
                    <SrEmptyState
                      icon={<LayoutGrid size={22} />}
                      title="Sin módulos registrados"
                      description="Sincroniza el catálogo para crear los módulos por defecto del sistema."
                      action={
                        <SrButton variant="primary" size="md" icon={<Plus size={12} />} onClick={seedDefaultFeatures}>
                          Iniciar módulos
                        </SrButton>
                      }
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
                      {features.map((feature, idx) => {
                        const isEnabled = businessFeatures[feature.id] || false;
                        return (
                          <motion.div
                            key={feature.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: idx * 0.02 }}
                            className={`flex items-center justify-between p-3.5 rounded-sr-md border transition-all ${
                              isEnabled
                                ? 'bg-servirest-surface border-[rgba(42,40,38,0.12)]'
                                : 'bg-servirest-hueso-sunken/40 border-[rgba(42,40,38,0.06)] opacity-60'
                            }`}
                          >
                            <div className="min-w-0 flex-1 mr-3">
                              <p className="text-[12px] font-extrabold text-servirest-midnight tracking-tight truncate">
                                {feature.name}
                              </p>
                              <SrMono className="text-[9px] text-[rgba(42,40,38,0.4)] mt-0.5">{feature.key}</SrMono>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleFeature(feature.id, isEnabled)}
                              className={`relative w-10 h-5 rounded-full transition-colors ${
                                isEnabled ? 'bg-servirest-terracota' : 'bg-[rgba(42,40,38,0.15)]'
                              }`}
                              aria-pressed={isEnabled}
                            >
                              <span
                                className={`absolute top-0.5 w-4 h-4 rounded-full bg-servirest-surface shadow-sm transition-all ${
                                  isEnabled ? 'left-[22px]' : 'left-0.5'
                                }`}
                              />
                            </button>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </SrCard>

                {selectedBusiness.profiles && selectedBusiness.profiles.length > 0 && (
                  <SrCard variant="solaris" className="p-7">
                    <div className="mb-5">
                      <SrKicker className="block mb-1">Personas</SrKicker>
                      <h3 className="sr-h-brutal text-[18px] m-0">
                        {selectedBusiness.profiles.length} cuenta
                        {selectedBusiness.profiles.length === 1 ? '' : 's'} vinculada
                        {selectedBusiness.profiles.length === 1 ? '' : 's'}
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {selectedBusiness.profiles.map((profile: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 rounded-sr-md bg-servirest-surface border border-[rgba(42,40,38,0.10)]"
                        >
                          <div className="w-10 h-10 rounded-full bg-servirest-hueso-sunken flex items-center justify-center font-extrabold text-[12px] text-servirest-midnight">
                            {profile.full_name?.substring(0, 2).toUpperCase() || '??'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-extrabold text-servirest-midnight m-0 truncate">
                              {profile.full_name || 'Sin nombre'}
                            </p>
                            <p className="text-[10px] text-[rgba(42,40,38,0.5)] font-bold uppercase tracking-[0.16em] m-0">
                              {profile.role}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SrCard>
                )}

                <SrCard variant="solaris" className="p-7 border-2 border-[rgba(225,85,75,0.20)] bg-[rgba(225,85,75,0.02)]">
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-sr-md bg-[rgba(225,85,75,0.10)] text-servirest-danger flex items-center justify-center shrink-0">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <SrKicker className="block mb-1 !text-servirest-danger">Zona de riesgo</SrKicker>
                      <h3 className="sr-h-brutal text-[16px] m-0 mb-1">Acciones permanentes</h3>
                      <p className="text-[12px] text-[rgba(42,40,38,0.6)] leading-relaxed">
                        Bloquear suspende el acceso del negocio inmediatamente. Eliminar borra TODOS los datos
                        (empleados, menús, pedidos, pagos) y no se puede revertir.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex gap-3 flex-wrap">
                    <SrButton
                      variant={selectedBusiness.is_active ? 'outline' : 'midnight'}
                      size="md"
                      icon={selectedBusiness.is_active ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                      onClick={toggleBusinessStatus}
                      disabled={saving}
                    >
                      {selectedBusiness.is_active ? 'Bloquear cuenta' : 'Desbloquear cuenta'}
                    </SrButton>
                    <SrButton
                      variant="danger"
                      size="md"
                      icon={<Trash2 size={14} />}
                      onClick={() => setShowDeleteModal(true)}
                      disabled={saving}
                    >
                      Eliminar permanente
                    </SrButton>
                  </div>
                </SrCard>
              </motion.div>
            ) : (
              <SrCard variant="solaris" className="p-12">
                <SrEmptyState
                  icon={<Package size={28} />}
                  title="Escoge un cliente"
                  description="Selecciona un negocio del panel izquierdo para gestionar su plan, módulos, pagos y estado de cuenta."
                />
              </SrCard>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPaymentModal && selectedBusiness && (
          <SrModal open onClose={() => !saving && setShowPaymentModal(false)} maxWidth={460}>
            <SrModalHeader
              title="Registrar pago"
              kicker={`Para ${selectedBusiness.name}`}
              onClose={() => !saving && setShowPaymentModal(false)}
            />
            <form onSubmit={handleRegisterPayment} className="space-y-4">
              <div>
                <SrLabel className="block mb-2">Monto · MXN</SrLabel>
                <SrInput
                  type="number"
                  required
                  value={paymentForm.amount.toString()}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })}
                />
              </div>
              <div>
                <SrLabel className="block mb-2">Método</SrLabel>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.20)] rounded-sr-lg px-4 py-3 text-[13px] font-medium text-servirest-carbon outline-none focus:border-servirest-terracota"
                >
                  <option value="Transferencia">Transferencia</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Stripe">Stripe (manual)</option>
                </select>
              </div>
              <div className="pt-2">
                <SrButton type="submit" variant="primary" size="lg" fullWidth disabled={saving}>
                  {saving ? 'Registrando…' : 'Confirmar pago · extender 1 mes'}
                </SrButton>
              </div>
            </form>
          </SrModal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteModal && selectedBusiness && (
          <SrModal open onClose={() => !saving && setShowDeleteModal(false)} maxWidth={480}>
            <SrModalHeader
              title="Eliminar negocio"
              kicker="Acción permanente"
              onClose={() => !saving && setShowDeleteModal(false)}
            />
            <p className="text-[14px] text-servirest-carbon leading-relaxed mb-2">
              Vas a eliminar <strong className="text-servirest-midnight">{selectedBusiness.name}</strong> de forma permanente.
            </p>
            <p className="text-[13px] text-[rgba(42,40,38,0.6)] leading-relaxed mb-6">
              Se borrarán empleados, menús, pedidos, inventario y pagos asociados. Esta acción no se puede revertir.
            </p>
            <div className="flex gap-3">
              <SrButton variant="outline" size="md" fullWidth onClick={() => setShowDeleteModal(false)}>
                Cancelar
              </SrButton>
              <SrButton variant="danger" size="md" fullWidth icon={<Trash2 size={14} />} onClick={handleDeleteBusiness} disabled={saving}>
                {saving ? 'Eliminando…' : 'Sí, eliminar'}
              </SrButton>
            </div>
          </SrModal>
        )}
      </AnimatePresence>
    </div>
  );
}

const GlobalConfigPanel: React.FC = () => {
  const { membershipPrice, updateMembershipPrice } = useSubscription();
  const [price, setPrice] = useState(membershipPrice);
  const [saving, setSaving] = useState(false);

  useEffect(() => setPrice(membershipPrice), [membershipPrice]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMembershipPrice(price);
    } catch {
      alert('Error al guardar. Asegúrate de que la tabla app_config exista.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SrCard variant="solaris" className="p-7">
      <div className="flex items-center justify-between gap-5 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-sr-md bg-servirest-midnight text-servirest-mostaza flex items-center justify-center shrink-0">
            <DollarSign size={20} />
          </div>
          <div>
            <SrKicker className="block mb-1">Estrategia global</SrKicker>
            <h3 className="font-serif italic font-medium text-[24px] text-servirest-midnight tracking-[-0.02em] m-0 leading-tight">
              Costo de membresía mensual
            </h3>
            <p className="text-[12px] text-[rgba(42,40,38,0.6)] font-medium mt-1">
              Precio base que aplica a todos los clientes sin precio personalizado.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(42,40,38,0.4)] font-mono font-bold pointer-events-none">$</span>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="bg-servirest-surface border border-[rgba(42,40,38,0.20)] rounded-sr-lg pl-8 pr-4 py-3 text-[15px] font-extrabold text-servirest-midnight font-mono w-32 outline-none focus:border-servirest-terracota"
            />
          </div>
          <SrButton variant="primary" size="md" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Aplicar cambio'}
          </SrButton>
        </div>
      </div>
    </SrCard>
  );
};

const PaymentsDashboard: React.FC<{ businesses: Business[]; payments?: any[] }> = ({ businesses, payments = [] }) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const activePro = businesses.filter((b) => b.is_active && b.plan !== 'demo').length;
  const activeDemo = businesses.filter((b) => b.is_active && b.plan === 'demo').length;
  const inactive = businesses.filter((b) => !b.is_active).length;
  const mrr = businesses
    .filter((b) => b.is_active && b.plan !== 'demo')
    .reduce((acc, curr) => acc + (curr.custom_price ? curr.custom_price : 850), 0);

  const incomeForMonth = payments
    .filter((p) => {
      const d = new Date(p.period_start);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    })
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const KPIS: { label: string; value: string | number; icon: any; tone: 'terracota' | 'mostaza' | 'danger' | 'success' | 'midnight'; sub: string }[] = [
    { label: 'Cuentas activas', value: activePro,        icon: CheckCircle2, tone: 'success',   sub: 'Planes de pago' },
    { label: 'En demo',         value: activeDemo,       icon: Zap,          tone: 'mostaza',   sub: 'Pruebas gratuitas' },
    { label: 'Inactivas',       value: inactive,         icon: XCircle,      tone: 'danger',    sub: 'Suspendidas / onboarding' },
    { label: 'MRR proyectado',  value: `$${mrr.toLocaleString()}`, icon: TrendingUp, tone: 'terracota', sub: 'Ingreso recurrente' },
    { label: 'Cobrado en mes',  value: `$${incomeForMonth.toLocaleString()}`, icon: Calendar, tone: 'midnight', sub: 'Pagos registrados' },
  ];

  const toneClasses: Record<'terracota' | 'mostaza' | 'danger' | 'success' | 'midnight', { bg: string; text: string }> = {
    terracota: { bg: 'bg-[rgba(196,99,63,0.10)]', text: 'text-servirest-terracota' },
    mostaza:   { bg: 'bg-[rgba(201,162,74,0.12)]', text: 'text-servirest-mostaza' },
    danger:    { bg: 'bg-[rgba(225,85,75,0.08)]', text: 'text-servirest-danger' },
    success:   { bg: 'bg-[rgba(34,160,107,0.08)]', text: 'text-servirest-success' },
    midnight:  { bg: 'bg-servirest-midnight',     text: 'text-servirest-mostaza' },
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <SrKicker className="block mb-1">Tablero</SrKicker>
          <h2 className="font-serif italic font-medium text-[28px] text-servirest-midnight tracking-[-0.02em] m-0 leading-tight">
            Salud del portafolio
          </h2>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-sr-md text-[11px] font-black uppercase tracking-[0.14em] px-3 py-2 text-servirest-carbon outline-none cursor-pointer hover:border-servirest-terracota transition-colors"
          >
            {months.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-servirest-surface border border-[rgba(42,40,38,0.12)] rounded-sr-md text-[11px] font-black uppercase tracking-[0.14em] px-3 py-2 text-servirest-carbon outline-none cursor-pointer hover:border-servirest-terracota transition-colors"
          >
            {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {KPIS.map((k, i) => {
          const t = toneClasses[k.tone];
          const Icon = k.icon;
          return (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
            >
              <SrCard hover className="p-5 h-full">
                <div className={`inline-flex w-9 h-9 rounded-sr-md ${t.bg} ${t.text} items-center justify-center mb-3`}>
                  <Icon size={16} />
                </div>
                <SrLabel className="block mb-1.5">{k.label}</SrLabel>
                <div className="font-black italic text-[26px] text-servirest-midnight tracking-[-0.03em] leading-none mb-1">
                  {k.value}
                </div>
                <p className="text-[10px] text-[rgba(42,40,38,0.5)] font-medium uppercase tracking-[0.12em] m-0">
                  {k.sub}
                </p>
              </SrCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
