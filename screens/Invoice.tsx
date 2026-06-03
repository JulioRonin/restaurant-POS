import React, { useState, useMemo } from 'react';
import { useOrders } from '../contexts/OrderContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useUser } from '../contexts/UserContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt, FileText, Download, ExternalLink, AlertTriangle, CheckCircle2,
  Search, Lock, Sparkles, Crown,
} from 'lucide-react';
import {
  SrCard, SrButton, SrChip, SrInput, SrLabel, SrKicker, SrMono,
  SrModal, SrModalHeader, SrEmptyState, SrTabs, SrAlert, SrSpinner,
} from '../components/ui/servirest';
import { OrderStatus } from '../types';

/**
 * InvoiceScreen — facturación CFDI 4.0 (Profesional+).
 *
 * Backend pendiente: las acciones de timbrado llaman a /api/cfdi/issue (a
 * implementar contra Facturama). Ver docs/business-plan/koso-pos/
 * CFDI_IMPLEMENTATION.md para el contrato, las tablas Supabase
 * (cfdi_issued, RPC increment_cfdi_counter) y el price card.
 */
type InvoiceTab = 'pending' | 'history';

export const InvoiceScreen: React.FC = () => {
  const { orders } = useOrders();
  const { authProfile } = useUser();
  const { meetsTier, isFeatureEnabled, planLimits, tier } = useSubscription();

  // Tier gate — Esencial NO factura.
  const tierAllows = meetsTier('profesional') && isFeatureEnabled('cfdi');

  const [activeTab, setActiveTab] = useState<InvoiceTab>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [orderToInvoice, setOrderToInvoice] = useState<any | null>(null);
  const [form, setForm] = useState({
    rfc: '',
    legalName: '',
    email: '',
    postalCode: '',
    cfdiUse: 'G03',
    fiscalRegime: '612',
  });
  const [issuing, setIssuing] = useState(false);
  const [successCfdi, setSuccessCfdi] = useState<{ uuid: string; pdf: string; xml: string } | null>(null);

  // TODO(backend): pull from cfdi_issued + counter from businesses table.
  // Placeholder values until /api/cfdi endpoints exist.
  const stampsUsed = 0;
  const stampsLimit = planLimits.cfdiStampsPerMonth;
  const stampsPct = stampsLimit > 0 ? (stampsUsed / stampsLimit) * 100 : 0;
  const overuseRate = tier === 'prestige' ? 1.5 : tier === 'enterprise' ? 0 : 2.5;

  const pendingOrders = useMemo(
    () =>
      orders.filter(
        (o) => (o.status === OrderStatus.COMPLETED || (o as any).paymentMethod) && !(o as any).cfdiUuid
      ),
    [orders]
  );

  const filtered = useMemo(
    () =>
      pendingOrders.filter(
        (o) =>
          (o.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (o.tableId || '').toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [pendingOrders, searchTerm]
  );

  // TODO(backend): swap with real call to /api/cfdi/issue
  const handleIssueInvoice = async () => {
    if (!orderToInvoice) return;
    setIssuing(true);
    try {
      // Pending integration: POST /api/cfdi/issue with form + orderId + items
      await new Promise((r) => setTimeout(r, 1200));
      setSuccessCfdi({
        uuid: '00000000-0000-0000-0000-000000000000',
        pdf: '#',
        xml: '#',
      });
      setOrderToInvoice(null);
    } catch (err) {
      alert('Aún no implementado: configura Facturama antes de timbrar.');
    } finally {
      setIssuing(false);
    }
  };

  /* ─── Gated state — usuario en Esencial ─────────────────────────── */
  if (!tierAllows) {
    return (
      <div className="h-full w-full overflow-y-auto custom-scrollbar bg-servirest-hueso text-servirest-carbon antialiased">
        <div className="px-[38px] py-10 max-w-[900px] mx-auto pb-32 lg:pb-12">
          {/* Editorial header */}
          <div className="mb-10">
            <SrKicker className="block mb-2">Facturación CFDI 4.0</SrKicker>
            <h1 className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0 mb-3">
              Factura como un grande
            </h1>
            <p className="text-[14px] text-[rgba(42,40,38,0.6)] font-medium leading-relaxed max-w-[520px]">
              Timbrado fiscal CFDI 4.0 con Facturama, integrado al cobro. Tus clientes reciben PDF + XML automáticos
              cuando piden factura.
            </p>
          </div>

          {/* Lock card */}
          <SrCard variant="solaris" className="p-10 text-center mb-6">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-servirest-midnight text-servirest-mostaza flex items-center justify-center border border-servirest-mostaza/40">
              <Lock size={28} />
            </div>
            <SrKicker className="block mb-2">Solo Profesional+</SrKicker>
            <h2 className="font-serif italic font-medium text-[34px] text-servirest-midnight tracking-[-0.02em] m-0 mb-3 leading-tight">
              CFDI no está en tu plan
            </h2>
            <p className="text-[14px] text-[rgba(42,40,38,0.7)] font-medium leading-relaxed m-0 mb-8 max-w-[480px] mx-auto">
              Esencial está pensado para fondas y cafés que cobran ticket simple. Si necesitas facturar a tus clientes,
              sube a Profesional y obtén 200 timbres incluidos cada mes.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-[520px] mx-auto">
              <SrCard className="p-5 text-left">
                <SrLabel className="block mb-2">Profesional</SrLabel>
                <div className="font-black italic text-[28px] text-servirest-midnight tracking-[-0.02em] leading-none mb-1">
                  $899
                </div>
                <p className="text-[11px] text-[rgba(42,40,38,0.5)] font-medium m-0 mb-3">MXN / mes</p>
                <ul className="space-y-1.5 text-[12px] text-servirest-carbon">
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-servirest-success" /> 200 timbres/mes incluidos</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-servirest-success" /> Sobreuso a $2.50</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-servirest-success" /> PDF y XML automáticos</li>
                </ul>
              </SrCard>
              <SrCard className="p-5 text-left border-servirest-mostaza/40 bg-[rgba(201,162,74,0.04)]">
                <SrLabel className="block mb-2 !text-servirest-mostaza">Prestige</SrLabel>
                <div className="font-black italic text-[28px] text-servirest-midnight tracking-[-0.02em] leading-none mb-1">
                  $2,499
                </div>
                <p className="text-[11px] text-[rgba(42,40,38,0.5)] font-medium m-0 mb-3">MXN / mes</p>
                <ul className="space-y-1.5 text-[12px] text-servirest-carbon">
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-servirest-success" /> 1,000 timbres/mes</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-servirest-success" /> Sobreuso a $1.50</li>
                  <li className="flex items-center gap-2"><CheckCircle2 size={12} className="text-servirest-success" /> Cuenta dedicada</li>
                </ul>
              </SrCard>
            </div>
            <div className="mt-7">
              <a
                href="#/billing"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-sr-lg bg-servirest-terracota text-servirest-hueso font-black italic uppercase tracking-[0.2em] text-[11px] shadow-sr-glow hover:scale-[1.02] active:scale-95 transition-transform"
              >
                <Sparkles size={14} />
                Subir mi plan
              </a>
            </div>
          </SrCard>

          <SrAlert tone="info" title="¿Por qué Esencial no incluye CFDI?">
            La gran mayoría de fondas, taquerías y cafés bajo RIF/RESICO no facturan al consumidor final — entregan
            ticket simple. Si tus clientes empiezan a pedir factura, ese es el momento natural para subir a Profesional.
          </SrAlert>
        </div>
      </div>
    );
  }

  /* ─── Allowed state — Profesional+ ──────────────────────────────── */
  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar bg-servirest-hueso text-servirest-carbon antialiased">
      <div className="px-[38px] py-10 max-w-[1480px] mx-auto pb-32 lg:pb-12">
        {/* ─── HEADER ────────────────────────────────────────────── */}
        <div className="flex justify-between items-start flex-wrap gap-6 mb-10">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <SrKicker className="block mb-2">Facturación CFDI 4.0</SrKicker>
            <h1 className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0">
              Tus facturas
            </h1>
            <p className="text-[14px] text-[rgba(42,40,38,0.6)] font-medium mt-2 max-w-[520px] leading-relaxed">
              Timbra CFDI 4.0 al instante con Facturama. Tus clientes reciben PDF + XML por correo en cuanto confirmas.
            </p>
          </motion.div>

          <div className="flex gap-3 flex-wrap">
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Timbres usados</SrLabel>
              <div className="font-black italic text-[28px] text-servirest-midnight tracking-[-0.03em] leading-none mb-1.5">
                {stampsUsed} <span className="text-[14px] text-[rgba(42,40,38,0.4)] font-medium">/ {stampsLimit >= 999999 ? '∞' : stampsLimit}</span>
              </div>
              <div className="h-1 bg-[rgba(42,40,38,0.06)] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, stampsPct)}%` }}
                  transition={{ duration: 0.6 }}
                  className={`h-full rounded-full ${stampsPct >= 90 ? 'bg-servirest-danger' : stampsPct >= 70 ? 'bg-servirest-mostaza' : 'bg-servirest-terracota'}`}
                />
              </div>
            </SrCard>
            <SrCard className="px-5 py-4">
              <SrLabel className="block mb-1.5">Costo extra</SrLabel>
              <SrMono className="text-[18px] text-servirest-midnight font-extrabold">
                ${overuseRate.toFixed(2)} <span className="text-[11px] text-[rgba(42,40,38,0.4)] font-medium font-sans">/timbre</span>
              </SrMono>
            </SrCard>
          </div>
        </div>

        {/* Sobreuso warning */}
        {stampsPct >= 90 && stampsLimit < 999999 && (
          <SrAlert tone="warning" title={`Llevas ${stampsUsed} de ${stampsLimit} timbres este mes`} className="mb-6">
            Los timbres adicionales se cobran a ${overuseRate.toFixed(2)} MXN cada uno. Sube a un plan superior si tu
            consumo se mantiene alto.
          </SrAlert>
        )}

        {/* ─── TABS ──────────────────────────────────────────────── */}
        <div className="mb-7">
          <SrTabs<InvoiceTab>
            tabs={[
              { id: 'pending', label: 'Por facturar', count: filtered.length },
              { id: 'history', label: 'Historial' },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* Search */}
        <div className="mb-6 max-w-md">
          <SrInput
            shape="pill"
            placeholder="Buscar por folio o mesa…"
            value={searchTerm}
            icon={<Search size={14} />}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* ─── PENDING TAB ───────────────────────────────────────── */}
        {activeTab === 'pending' && (
          <SrCard variant="solaris" className="p-7">
            {filtered.length === 0 ? (
              <SrEmptyState
                icon={<Receipt size={26} />}
                title="Nada por facturar"
                description="Las órdenes completadas que aún no se facturen aparecerán aquí. Cuando un cliente pida factura, la timbras en un click."
              />
            ) : (
              <div className="space-y-2.5">
                {filtered.map((order, idx) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.03 }}
                  >
                    <SrCard className="p-4 flex items-center gap-4 hover:border-servirest-terracota/40 transition-colors">
                      <div className="w-10 h-10 rounded-sr-md bg-[rgba(196,99,63,0.10)] text-servirest-terracota flex items-center justify-center shrink-0">
                        <Receipt size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <SrMono className="text-[11px] text-servirest-terracota mb-0.5 block">
                          #{(order.id || '').slice(0, 9).toUpperCase()}
                        </SrMono>
                        <div className="font-extrabold text-[13px] text-servirest-midnight tracking-tight">
                          Mesa {order.tableId} · {order.items?.length || 0} platillos
                        </div>
                        <SrMono className="text-[10px] text-[rgba(42,40,38,0.5)]">
                          {new Date(order.timestamp).toLocaleString('es-MX')}
                        </SrMono>
                      </div>
                      <div className="text-right shrink-0">
                        <SrLabel className="block mb-0.5">Total</SrLabel>
                        <SrMono className="text-[16px] text-servirest-midnight font-extrabold">
                          ${order.total?.toFixed(2)}
                        </SrMono>
                      </div>
                      <SrButton
                        variant="primary"
                        size="sm"
                        icon={<FileText size={12} />}
                        onClick={() => setOrderToInvoice(order)}
                      >
                        Facturar
                      </SrButton>
                    </SrCard>
                  </motion.div>
                ))}
              </div>
            )}
          </SrCard>
        )}

        {/* ─── HISTORY TAB (placeholder) ─────────────────────────── */}
        {activeTab === 'history' && (
          <SrCard variant="solaris" className="p-7">
            <SrEmptyState
              icon={<FileText size={26} />}
              title="Historial vacío"
              description="Cuando timbres tu primer CFDI, aparecerá aquí con PDF y XML descargables. Por ahora la integración con Facturama está pendiente."
            />
          </SrCard>
        )}
      </div>

      {/* ─── ISSUE INVOICE MODAL ─────────────────────────────────── */}
      <AnimatePresence>
        {orderToInvoice && (
          <SrModal open onClose={() => !issuing && setOrderToInvoice(null)} maxWidth={520}>
            <SrModalHeader
              title="Timbrar factura"
              kicker={`Orden ${(orderToInvoice.id || '').slice(0, 8).toUpperCase()}`}
              onClose={() => !issuing && setOrderToInvoice(null)}
            />

            <div className="space-y-4">
              <div>
                <SrLabel className="block mb-2">RFC del receptor</SrLabel>
                <SrInput
                  value={form.rfc}
                  onChange={(e) => setForm({ ...form, rfc: e.target.value.toUpperCase() })}
                  placeholder="XAXX010101000"
                  maxLength={13}
                />
              </div>
              <div>
                <SrLabel className="block mb-2">Razón social</SrLabel>
                <SrInput
                  value={form.legalName}
                  onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  placeholder="EMPRESA EJEMPLO SA DE CV"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <SrLabel className="block mb-2">Código postal</SrLabel>
                  <SrInput
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                    placeholder="06700"
                    maxLength={5}
                  />
                </div>
                <div>
                  <SrLabel className="block mb-2">Uso CFDI</SrLabel>
                  <select
                    value={form.cfdiUse}
                    onChange={(e) => setForm({ ...form, cfdiUse: e.target.value })}
                    className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.20)] rounded-sr-lg px-4 py-3 text-[13px] font-medium text-servirest-carbon outline-none focus:border-servirest-terracota"
                  >
                    <option value="G03">G03 · Gastos en general</option>
                    <option value="G01">G01 · Adquisición de mercancías</option>
                    <option value="P01">P01 · Por definir</option>
                  </select>
                </div>
              </div>
              <div>
                <SrLabel className="block mb-2">Email del receptor (para envío)</SrLabel>
                <SrInput
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="cliente@correo.com"
                />
              </div>

              <SrAlert tone="info">
                Integración con Facturama pendiente. Cuando esté lista, este botón timbrará el CFDI y enviará el PDF +
                XML al correo del receptor. Ver <SrMono>docs/business-plan/koso-pos/CFDI_IMPLEMENTATION.md</SrMono>.
              </SrAlert>

              <SrButton
                variant="primary"
                size="lg"
                fullWidth
                icon={issuing ? <SrSpinner size={14} /> : <FileText size={14} />}
                onClick={handleIssueInvoice}
                disabled={issuing || !form.rfc || form.rfc.length < 12}
              >
                {issuing ? 'Timbrando…' : 'Timbrar CFDI'}
              </SrButton>
            </div>
          </SrModal>
        )}
      </AnimatePresence>

      {/* ─── SUCCESS ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {successCfdi && (
          <SrModal open onClose={() => setSuccessCfdi(null)} maxWidth={480} closeOnBackdrop={false}>
            <div className="text-center py-4">
              <div className="w-20 h-20 rounded-full bg-servirest-success/10 text-servirest-success flex items-center justify-center mx-auto mb-5 border border-servirest-success/30">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="font-serif italic font-medium text-[26px] text-servirest-midnight tracking-[-0.02em] m-0 mb-2 leading-tight">
                CFDI timbrado
              </h3>
              <p className="text-[12px] text-[rgba(42,40,38,0.6)] font-medium m-0 mb-2">UUID fiscal</p>
              <SrMono className="block text-[11px] text-servirest-carbon mb-7 break-all">
                {successCfdi.uuid}
              </SrMono>
              <div className="grid grid-cols-2 gap-3">
                <SrButton variant="outline" size="md" icon={<Download size={12} />}>
                  PDF
                </SrButton>
                <SrButton variant="outline" size="md" icon={<ExternalLink size={12} />}>
                  XML
                </SrButton>
              </div>
              <button
                type="button"
                onClick={() => setSuccessCfdi(null)}
                className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-[rgba(42,40,38,0.5)] hover:text-servirest-carbon"
              >
                Cerrar
              </button>
            </div>
          </SrModal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InvoiceScreen;
