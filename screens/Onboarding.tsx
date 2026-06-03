import React, { useState } from 'react';
import {
  CreditCard,
  Store,
  ChefHat,
  Rows,
  Users,
  Printer,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Package,
  Plus,
  Trash2,
  Wifi,
  Monitor,
  Usb,
  Smartphone,
  Check,
  Zap,
  ImagePlus,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../contexts/UserContext';
import { useMenu } from '../contexts/MenuContext';
import { useInventory } from '../contexts/InventoryContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import {
  SrCard,
  SrButton,
  SrChip,
  SrInput,
  SrLabel,
  SrKicker,
  SrMono,
  SrEmptyState,
  SrAlert,
  SrProgressRing,
} from '../components/ui/servirest';

type OnboardingStep = 'PLAN' | 'INFO' | 'MENU' | 'TABLES' | 'STAFF' | 'HARDWARE' | 'COMPLETE';

const STEP_META: Record<OnboardingStep, { kicker: string; title: string; subtitle: string; icon: any }> = {
  PLAN: {
    kicker: 'Tu plan',
    title: 'Elige cómo arrancamos',
    subtitle: 'Pago mensual y, si lo necesitas, el equipo de hardware. Lo que escojas hoy lo puedes cambiar después.',
    icon: CreditCard,
  },
  INFO: {
    kicker: 'Tu negocio',
    title: 'Cuéntanos de tu lugar',
    subtitle: 'Datos fiscales y de contacto. Esto aparecerá en tus tickets y reportes.',
    icon: Store,
  },
  MENU: {
    kicker: 'Tu menú',
    title: 'Carga tus platillos',
    subtitle: 'Agrega los primeros para empezar a vender hoy. Después puedes importar más desde el panel.',
    icon: ChefHat,
  },
  TABLES: {
    kicker: 'Tu piso',
    title: 'Define tus mesas',
    subtitle: 'Dinos cuántas mesas tienes para preparar el salón. Su acomodo lo haces luego, en vivo.',
    icon: Rows,
  },
  STAFF: {
    kicker: 'Tu equipo',
    title: 'Da de alta al personal',
    subtitle: 'Asigna roles y PIN para cada persona. Tú ya estás dentro como administrador.',
    icon: Users,
  },
  HARDWARE: {
    kicker: 'Tus equipos',
    title: 'Conecta los aparatos',
    subtitle: 'Impresoras, scanners y cajón de dinero. Si no los tienes a mano, lo conectas después en Ajustes.',
    icon: Printer,
  },
  COMPLETE: {
    kicker: 'Listo',
    title: '¡Todo en su sitio!',
    subtitle: 'Tu ServiRest quedó armado. Es hora de abrir caja y vender.',
    icon: CheckCircle2,
  },
};

const STEPS: OnboardingStep[] = ['PLAN', 'INFO', 'MENU', 'TABLES', 'STAFF', 'HARDWARE', 'COMPLETE'];

export default function OnboardingScreen() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('PLAN');
  const [loading, setLoading] = useState(false);
  const { authProfile, completeOnboarding, addEmployee, updateBusiness } = useUser();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const { addItem: addMenuItem } = useMenu();
  // preserved hook (subscription flows reserved for future steps)
  useSubscription();
  useInventory();

  // Step Data States
  const [restaurantInfo, setRestaurantInfo] = useState({
    name: authProfile?.businessName || '',
    legalName: '',
    rfc: '',
    address: '',
    phone: '',
    ticketFooter: '¡Gracias por su visita!',
  });

  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro'>('basic');
  const [selectedEquipment, setSelectedEquipment] = useState<'buy' | 'rent' | 'none'>('rent');

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [tables, setTables] = useState<{ id: string; name: string; seats: number }[]>([]);
  const [staff, setStaff] = useState<{ name: string; role: string; pin: string }[]>([]);

  const [hardware, setHardware] = useState({
    printers: [] as any[],
    scanners: [] as any[],
    drawer: false,
    scanning: false,
  });

  const stepIndex = STEPS.indexOf(currentStep);
  const progressPct = (stepIndex / (STEPS.length - 1)) * 100;
  const meta = STEP_META[currentStep];

  const nextStep = () => {
    if (stepIndex < STEPS.length - 1) setCurrentStep(STEPS[stepIndex + 1]);
  };

  const prevStep = () => {
    if (stepIndex > 0) setCurrentStep(STEPS[stepIndex - 1]);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
        setRestaurantInfo((prev) => ({ ...prev, logo: reader.result as string } as any));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFinish = async () => {
    if (loading) return;
    setLoading(true);
    console.log('[Onboarding] Starting finalization...');

    try {
      // 1. Save Menu Items
      if (menuItems.length > 0) {
        console.log(`[Onboarding] Saving ${menuItems.length} menu items...`);
        for (const item of menuItems) {
          if (item.name) {
            addMenuItem({
              name: item.name,
              price: item.price,
              category: item.category,
              status: 'ACTIVE',
              image: `https://picsum.photos/seed/${item.name}/200`,
              inventoryLevel: 4,
            });
          }
        }
      }

      // 2. Save Staff Members
      if (staff.length > 0) {
        console.log(`[Onboarding] Saving ${staff.length} staff members...`);
        for (const member of staff) {
          if (member.name) {
            addEmployee({
              name: member.name,
              role: member.role.toLowerCase(),
              area:
                member.role.toLowerCase() === 'cocina' || member.role.toLowerCase() === 'chef'
                  ? 'Kitchen'
                  : 'Service',
              image: `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`,
              pin: member.pin || '1234',
            });
          }
        }
      }

      // 2.1 Always ensure the current user (owner/admin) has an employee profile
      const hasAdmin = staff.some((s) => s.role.toLowerCase() === 'admin');
      if (!hasAdmin && authProfile) {
        console.log('[Onboarding] Auto-creating admin profile for owner:', authProfile.fullName);
        addEmployee({
          name: authProfile.fullName || 'Admin',
          role: 'admin',
          area: 'Management',
          image: `https://ui-avatars.com/api/?name=${encodeURIComponent(authProfile.fullName || 'Admin')}&background=C4633F&color=fff&size=128`,
          pin: '0000',
        });
      }

      // 3. Save Tables (Basic logic)
      if (tables.length > 0) {
        console.log(`[Onboarding] Saving ${tables.length} tables...`);
        const { put: idbPut } = await import('../services/db');
        const { trackChange: tc } = await import('../services/SyncService');
        for (const table of tables) {
          const idbRecord = {
            ...table,
            businessId: authProfile?.businessId,
            x: Math.random() * 500,
            y: Math.random() * 500,
            synced: false,
            updated_at: new Date().toISOString(),
          };
          await idbPut('tables' as any, idbRecord as any);
          await tc('tables', 'INSERT', table.id, idbRecord);
        }
      }

      // 4. Update Business Settings (Logo, RFC, Address)
      console.log('[Onboarding] Updating business settings...');
      await updateBusiness({
        name: restaurantInfo.name,
        legal_name: (restaurantInfo as any).legalName,
        rfc: (restaurantInfo as any).rfc,
        settings: {
          logo: logoPreview,
          address: (restaurantInfo as any).address,
          phone: (restaurantInfo as any).phone,
          ticket_footer: (restaurantInfo as any).ticketFooter,
        },
      });

      // 5. Mark as completed
      console.log('[Onboarding] Marking onboarding as completed in Supabase...');
      await completeOnboarding();

      console.log('[Onboarding] Success! Redirecting...');
      setTimeout(() => {
        window.location.hash = '/dashboard';
      }, 500);
    } catch (err) {
      console.error('[Onboarding] Error in handleFinish:', err);
      alert('Hubo un problema al guardar la configuración. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const scanHardware = () => {
    setHardware((prev) => ({ ...prev, scanning: true }));
    setTimeout(() => {
      setHardware((prev) => ({
        ...prev,
        scanning: false,
        printers: [{ id: 'p1', name: 'Epson TM-T88VI', connection: 'IP 192.168.1.50', status: 'En línea' }],
        scanners: [{ id: 's1', name: 'Scanner HID', status: 'Conectado por USB' }],
        drawer: true,
      }));
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-servirest-hueso text-servirest-carbon flex flex-col antialiased">
      {/* ─── HEADER (sticky) ───────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-servirest-surface/95 backdrop-blur-md border-b border-[rgba(42,40,38,0.10)]">
        <div className="max-w-[1280px] mx-auto px-8 py-5 flex justify-between items-center gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-servirest-terracota text-servirest-hueso rounded-sr-md flex items-center justify-center shadow-sr-glow">
              <ChefHat size={22} />
            </div>
            <div>
              <SrKicker className="block">Bienvenido a ServiRest</SrKicker>
              <h1 className="font-serif italic font-medium text-[20px] text-servirest-midnight tracking-[-0.02em] leading-none m-0 mt-1">
                Vamos a armar tu negocio
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-5">
            {/* Step dots */}
            <div className="hidden md:flex items-center gap-2">
              {STEPS.slice(0, -1).map((s, idx) => (
                <span
                  key={s}
                  className={`block rounded-full transition-all ${
                    idx === stepIndex
                      ? 'w-8 h-2 bg-servirest-terracota'
                      : idx < stepIndex
                      ? 'w-2 h-2 bg-servirest-terracota'
                      : 'w-2 h-2 bg-[rgba(42,40,38,0.15)]'
                  }`}
                />
              ))}
            </div>

            {/* Progress ring */}
            <div className="flex items-center gap-3">
              <SrProgressRing pct={progressPct} size={40} stroke={4} />
              <button
                type="button"
                onClick={handleFinish}
                disabled={loading}
                className="text-[11px] font-bold text-[rgba(42,40,38,0.5)] hover:text-servirest-terracota transition-colors tracking-wide"
              >
                Configurar después
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── MAIN ────────────────────────────────────────────────── */}
      <main className="flex-1 px-8 py-10">
        <div className="max-w-[1280px] mx-auto">
          {/* ─── EDITORIAL STEP HEADER ───────────────────────────── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`head-${currentStep}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
              className="mb-10"
            >
              <SrKicker className="block mb-2">
                Paso {stepIndex + 1} de {STEPS.length} · {meta.kicker}
              </SrKicker>
              <h2 className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0">
                {meta.title}
              </h2>
              <p className="text-[14px] text-[rgba(42,40,38,0.6)] font-medium mt-3 max-w-[640px] leading-relaxed">
                {meta.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* ─── CONTENT GRID: side rail + step body ─────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
            {/* Side rail with step list */}
            <SrCard variant="solaris" className="p-6 lg:sticky lg:top-[120px]">
              <SrLabel className="block mb-4">Tu camino</SrLabel>
              <div className="space-y-1">
                {STEPS.slice(0, -1).map((s, idx) => {
                  const isActive = idx === stepIndex;
                  const isDone = idx < stepIndex;
                  const StepIcon = STEP_META[s].icon;
                  return (
                    <div
                      key={s}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-sr-md transition-colors ${
                        isActive
                          ? 'bg-[rgba(196,99,63,0.08)] border border-servirest-terracota/30'
                          : 'border border-transparent'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          isDone
                            ? 'bg-servirest-terracota text-servirest-hueso'
                            : isActive
                            ? 'bg-servirest-terracota/20 text-servirest-terracota border border-servirest-terracota'
                            : 'bg-servirest-hueso-sunken/60 text-[rgba(42,40,38,0.4)]'
                        }`}
                      >
                        {isDone ? <Check size={12} strokeWidth={3} /> : <StepIcon size={12} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-[12px] font-bold tracking-tight ${
                            isActive
                              ? 'text-servirest-terracota'
                              : isDone
                              ? 'text-servirest-midnight'
                              : 'text-[rgba(42,40,38,0.5)]'
                          }`}
                        >
                          {STEP_META[s].kicker}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-6 border-t border-[rgba(42,40,38,0.08)]">
                <p className="text-[11px] text-[rgba(42,40,38,0.5)] leading-relaxed">
                  Tranquilo — todo lo que guardes aquí lo puedes cambiar después desde Ajustes.
                </p>
              </div>
            </SrCard>

            {/* Step body */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                {currentStep === 'PLAN' && (
                  <PlanStep
                    selectedPlan={selectedPlan}
                    setSelectedPlan={setSelectedPlan}
                    selectedEquipment={selectedEquipment}
                    setSelectedEquipment={setSelectedEquipment}
                  />
                )}

                {currentStep === 'INFO' && (
                  <InfoStep
                    restaurantInfo={restaurantInfo}
                    setRestaurantInfo={setRestaurantInfo}
                    logoPreview={logoPreview}
                    fileInputRef={fileInputRef}
                    onLogoChange={handleLogoChange}
                  />
                )}

                {currentStep === 'MENU' && (
                  <MenuStep menuItems={menuItems} setMenuItems={setMenuItems} />
                )}

                {currentStep === 'TABLES' && <TablesStep tables={tables} setTables={setTables} />}

                {currentStep === 'STAFF' && (
                  <StaffStep staff={staff} setStaff={setStaff} authProfile={authProfile} />
                )}

                {currentStep === 'HARDWARE' && (
                  <HardwareStep hardware={hardware} onScan={scanHardware} />
                )}

                {currentStep === 'COMPLETE' && (
                  <CompleteStep
                    fullName={authProfile?.fullName || 'Bienvenido'}
                    selectedPlan={selectedPlan}
                    tablesCount={tables.length}
                    staffCount={staff.length}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* ─── FOOTER NAV ──────────────────────────────────────────── */}
      <footer className="sticky bottom-0 z-20 bg-servirest-surface/95 backdrop-blur-md border-t border-[rgba(42,40,38,0.10)]">
        <div className="max-w-[1280px] mx-auto px-8 py-5 flex justify-between items-center gap-4">
          <SrButton
            variant="ghost"
            size="md"
            icon={<ChevronLeft size={16} />}
            onClick={prevStep}
            disabled={currentStep === 'PLAN'}
          >
            Atrás
          </SrButton>

          {currentStep === 'COMPLETE' ? (
            <SrButton
              variant="primary"
              size="lg"
              iconRight={<ChevronRight size={18} />}
              onClick={handleFinish}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin mr-2" />
                  Guardando…
                </>
              ) : (
                'Abrir mi POS'
              )}
            </SrButton>
          ) : (
            <SrButton variant="primary" size="md" iconRight={<ChevronRight size={16} />} onClick={nextStep}>
              Continuar
            </SrButton>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Step components                                                         */
/* ────────────────────────────────────────────────────────────────────── */

const PlanStep: React.FC<{
  selectedPlan: 'basic' | 'pro';
  setSelectedPlan: (p: 'basic' | 'pro') => void;
  selectedEquipment: 'buy' | 'rent' | 'none';
  setSelectedEquipment: (p: 'buy' | 'rent' | 'none') => void;
}> = ({ selectedPlan, setSelectedPlan, selectedEquipment, setSelectedEquipment }) => {
  const plans = [
    {
      id: 'basic' as const,
      name: 'Esencial',
      price: '$850',
      desc: 'Para cafeterías chicas, foodtrucks y barras pequeñas.',
      bullets: ['Hasta 2 estaciones', 'Inventario básico', 'Soporte por chat'],
      icon: Package,
      tone: 'terracota' as const,
    },
    {
      id: 'pro' as const,
      name: 'Profesional',
      price: '$1,450',
      desc: 'Para restaurantes con cocina, mesas y delivery propio.',
      bullets: ['Estaciones ilimitadas', 'Orden remota + inventario avanzado', 'Soporte prioritario'],
      icon: Zap,
      tone: 'mostaza' as const,
    },
  ];

  const equipment = [
    { id: 'rent' as const, label: 'Renta del equipo Pro', price: '$500/mes', desc: 'Incluye tablet 10", impresora de tickets y soporte en sitio.' },
    { id: 'buy' as const, label: 'Compra del equipo', price: '$5,000 único', desc: 'Equipo 100% tuyo con un año de garantía completa.' },
    { id: 'none' as const, label: 'Ya tengo mi equipo', price: 'Sin costo extra', desc: 'Solo contratas el software de ServiRest.' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((p, idx) => {
          const active = selectedPlan === p.id;
          return (
            <motion.button
              key={p.id}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              onClick={() => setSelectedPlan(p.id)}
              className={`text-left p-7 rounded-sr-2xl border transition-all ${
                active
                  ? 'border-servirest-terracota bg-[rgba(196,99,63,0.06)] shadow-sr-glow'
                  : 'border-[rgba(42,40,38,0.12)] bg-servirest-surface hover:border-[rgba(42,40,38,0.2)] shadow-sr-card'
              }`}
            >
              <div className="flex items-start justify-between mb-5">
                <div className="p-3 rounded-sr-md bg-[rgba(196,99,63,0.10)] text-servirest-terracota border border-servirest-terracota/30">
                  <p.icon size={22} />
                </div>
                {active && <SrChip tone="terracota">Elegido</SrChip>}
              </div>
              <SrKicker className="block mb-1.5">Plan {p.name}</SrKicker>
              <h3 className="font-serif italic font-medium text-[26px] text-servirest-midnight tracking-[-0.02em] m-0 leading-tight mb-2">
                {p.name}
              </h3>
              <p className="text-[13px] text-[rgba(42,40,38,0.6)] m-0 mb-5 leading-relaxed">{p.desc}</p>
              <div className="flex items-baseline gap-1 mb-5">
                <SrMono className="text-[28px] font-extrabold text-servirest-terracota tracking-tight">
                  {p.price}
                </SrMono>
                <span className="text-[12px] font-medium text-[rgba(42,40,38,0.5)]">/mes</span>
              </div>
              <ul className="space-y-2 list-none p-0 m-0">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-[12px] text-servirest-carbon font-medium">
                    <Check size={12} className="text-servirest-terracota shrink-0" strokeWidth={3} />
                    {b}
                  </li>
                ))}
              </ul>
            </motion.button>
          );
        })}
      </div>

      <SrCard variant="solaris" className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Monitor size={14} className="text-servirest-terracota" />
          <SrLabel>Hardware</SrLabel>
        </div>
        <h3 className="font-serif italic font-medium text-[22px] text-servirest-midnight tracking-[-0.02em] m-0 mb-2 leading-tight">
          ¿Cómo quieres tu equipo?
        </h3>
        <p className="text-[13px] text-[rgba(42,40,38,0.6)] m-0 mb-5 leading-relaxed">
          Si rentas, lo cambiamos cuando se descompone. Si lo compras, es tuyo.
        </p>
        <div className="space-y-2">
          {equipment.map((e, idx) => {
            const active = selectedEquipment === e.id;
            return (
              <motion.label
                key={e.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                className={`flex items-center gap-4 p-4 rounded-sr-md border cursor-pointer transition-colors ${
                  active
                    ? 'bg-[rgba(196,99,63,0.06)] border-servirest-terracota/40'
                    : 'bg-servirest-surface border-[rgba(42,40,38,0.12)] hover:border-[rgba(42,40,38,0.2)]'
                }`}
              >
                <input
                  type="radio"
                  name="equip"
                  checked={active}
                  onChange={() => setSelectedEquipment(e.id)}
                  className="w-4 h-4 accent-servirest-terracota"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-bold text-servirest-midnight tracking-tight">{e.label}</span>
                    <SrChip tone={active ? 'terracota' : 'neutral'} size="xs">
                      {e.price}
                    </SrChip>
                  </div>
                  <p className="text-[11px] text-[rgba(42,40,38,0.6)] m-0">{e.desc}</p>
                </div>
              </motion.label>
            );
          })}
        </div>
      </SrCard>

      <SrAlert tone="warning" title="Activamos tu cuenta al cerrar">
        Al continuar, tomamos el cobro vía Stripe para habilitarte el sistema en minutos. Sin sorpresas — el monto lo ves antes de pagar.
      </SrAlert>
    </div>
  );
};

const InfoStep: React.FC<{
  restaurantInfo: any;
  setRestaurantInfo: React.Dispatch<React.SetStateAction<any>>;
  logoPreview: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ restaurantInfo, setRestaurantInfo, logoPreview, fileInputRef, onLogoChange }) => (
  <SrCard variant="solaris" className="p-8">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Logo */}
      <div className="md:col-span-2">
        <SrLabel className="block mb-3">Logo del negocio</SrLabel>
        <div className="flex items-center gap-5 flex-wrap">
          <input type="file" ref={fileInputRef} onChange={onLogoChange} className="hidden" accept="image/*" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-24 h-24 bg-servirest-hueso-sunken/40 rounded-sr-xl border-2 border-dashed border-[rgba(42,40,38,0.2)] flex flex-col items-center justify-center text-[rgba(42,40,38,0.5)] hover:text-servirest-terracota hover:border-servirest-terracota/60 cursor-pointer overflow-hidden transition-colors"
          >
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <>
                <ImagePlus size={22} />
                <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">Logo</span>
              </>
            )}
          </button>
          <div className="flex-1 min-w-[200px]">
            <p className="text-[13px] font-medium text-servirest-carbon leading-relaxed mb-2">
              Súbelo en PNG con fondo transparente para que se vea bien en tickets y reportes.
            </p>
            <SrButton variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
              {logoPreview ? 'Cambiar logo' : 'Subir logo'}
            </SrButton>
          </div>
        </div>
      </div>

      <div>
        <SrLabel className="block mb-2">Nombre comercial</SrLabel>
        <SrInput
          value={restaurantInfo.name}
          onChange={(e) => setRestaurantInfo({ ...restaurantInfo, name: e.target.value })}
          placeholder="Mi restaurante"
        />
      </div>
      <div>
        <SrLabel className="block mb-2">Razón social</SrLabel>
        <SrInput
          value={restaurantInfo.legalName}
          onChange={(e) => setRestaurantInfo({ ...restaurantInfo, legalName: e.target.value })}
          placeholder="Gastronómica S.A. de C.V."
        />
      </div>
      <div>
        <SrLabel className="block mb-2">RFC</SrLabel>
        <SrInput
          value={restaurantInfo.rfc}
          onChange={(e) => setRestaurantInfo({ ...restaurantInfo, rfc: e.target.value })}
          placeholder="XAXX010101000"
          className="tracking-[0.2em]"
        />
      </div>
      <div>
        <SrLabel className="block mb-2">Teléfono</SrLabel>
        <SrInput
          value={restaurantInfo.phone}
          onChange={(e) => setRestaurantInfo({ ...restaurantInfo, phone: e.target.value })}
          placeholder="33 1234 5678"
        />
      </div>
      <div className="md:col-span-2">
        <SrLabel className="block mb-2">Dirección completa</SrLabel>
        <SrInput
          value={restaurantInfo.address}
          onChange={(e) => setRestaurantInfo({ ...restaurantInfo, address: e.target.value })}
          placeholder="Av. Libertad #123, Col. Americana, Guadalajara"
        />
      </div>
      <div className="md:col-span-2">
        <SrLabel className="block mb-2">Mensaje al pie del ticket</SrLabel>
        <textarea
          value={restaurantInfo.ticketFooter}
          onChange={(e) => setRestaurantInfo({ ...restaurantInfo, ticketFooter: e.target.value })}
          className="w-full bg-servirest-surface border border-[rgba(42,40,38,0.20)] rounded-sr-lg px-4 py-3 text-[13px] font-medium text-servirest-carbon placeholder:text-[rgba(42,40,38,0.4)] outline-none focus:border-servirest-terracota h-24 resize-none transition-colors"
          placeholder="¡Vuelve pronto!"
        />
      </div>
    </div>
  </SrCard>
);

const MenuStep: React.FC<{
  menuItems: any[];
  setMenuItems: React.Dispatch<React.SetStateAction<any[]>>;
}> = ({ menuItems, setMenuItems }) => (
  <div className="space-y-5">
    <SrCard variant="solaris" className="p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-sr-md bg-[rgba(196,99,63,0.10)] text-servirest-terracota border border-servirest-terracota/30">
            <Package size={20} />
          </div>
          <div>
            <SrLabel className="block mb-0.5">Importar</SrLabel>
            <p className="font-serif italic font-medium text-[18px] text-servirest-midnight tracking-[-0.02em] m-0 leading-tight">
              ¿Ya tienes tu menú en un CSV?
            </p>
            <p className="text-[12px] text-[rgba(42,40,38,0.6)] m-0 mt-1">Súbelo de un jalón para no empezar desde cero.</p>
          </div>
        </div>
        <SrButton variant="primary" size="sm">
          Importar CSV
        </SrButton>
      </div>
    </SrCard>

    <SrCard variant="solaris" className="p-7">
      <div className="flex items-center justify-between mb-5">
        <div>
          <SrLabel className="block mb-1">Tus platillos</SrLabel>
          <h3 className="font-serif italic font-medium text-[22px] text-servirest-midnight tracking-[-0.02em] m-0 leading-tight">
            {menuItems.length === 0 ? 'Aún no agregas nada' : `${menuItems.length} platillos`}
          </h3>
        </div>
        <SrButton
          variant="outline"
          size="sm"
          icon={<Plus size={14} />}
          onClick={() => setMenuItems([...menuItems, { id: Date.now(), name: '', price: 0, category: 'General' }])}
        >
          Agregar platillo
        </SrButton>
      </div>

      {menuItems.length === 0 ? (
        <SrEmptyState
          icon={<ChefHat size={26} />}
          title="Tu carta empieza aquí"
          description="Agrega tus primeros platillos para empezar a vender. Después puedes editar precios, fotos y categorías."
          action={
            <SrButton
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setMenuItems([{ id: Date.now(), name: '', price: 0, category: 'General' }])}
            >
              Agregar el primero
            </SrButton>
          }
        />
      ) : (
        <div className="space-y-2">
          {menuItems.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.03 }}
            >
              <SrCard className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-sr-md bg-servirest-hueso-sunken/50 border border-[rgba(42,40,38,0.12)] flex items-center justify-center text-[rgba(42,40,38,0.4)] shrink-0">
                  <ChefHat size={16} />
                </div>
                <input
                  type="text"
                  placeholder="Nombre del platillo"
                  value={item.name}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMenuItems((prev) => prev.map((m) => (m.id === item.id ? { ...m, name: v } : m)));
                  }}
                  className="flex-1 bg-transparent border-none focus:outline-none text-[13px] font-bold text-servirest-midnight placeholder:text-[rgba(42,40,38,0.4)]"
                  autoFocus
                />
                <div className="flex items-center gap-1 bg-servirest-hueso-sunken/50 border border-[rgba(42,40,38,0.12)] rounded-sr-md px-3 py-1.5">
                  <span className="text-[12px] font-bold text-[rgba(42,40,38,0.5)]">$</span>
                  <input
                    type="number"
                    value={item.price || ''}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 0;
                      setMenuItems((prev) => prev.map((m) => (m.id === item.id ? { ...m, price: v } : m)));
                    }}
                    className="w-16 bg-transparent border-none focus:outline-none text-[13px] font-bold text-servirest-midnight"
                    placeholder="0"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setMenuItems(menuItems.filter((i) => i.id !== item.id))}
                  className="w-9 h-9 rounded-sr-md border border-servirest-danger/30 bg-[rgba(225,85,75,0.06)] text-servirest-danger hover:bg-[rgba(225,85,75,0.12)] flex items-center justify-center transition-colors"
                  aria-label="Eliminar"
                >
                  <Trash2 size={13} />
                </button>
              </SrCard>
            </motion.div>
          ))}
        </div>
      )}
    </SrCard>
  </div>
);

const TablesStep: React.FC<{
  tables: { id: string; name: string; seats: number }[];
  setTables: React.Dispatch<React.SetStateAction<{ id: string; name: string; seats: number }[]>>;
}> = ({ tables, setTables }) => (
  <div className="space-y-5">
    <SrCard variant="solaris" className="p-10 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#C4633F 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}
      />
      <div className="relative text-center max-w-md mx-auto">
        <div className="inline-flex p-4 rounded-sr-xl bg-[rgba(196,99,63,0.08)] text-servirest-terracota border border-servirest-terracota/30 mb-5">
          <Rows size={28} />
        </div>
        <SrKicker className="block mb-2">Tu salón</SrKicker>
        <h3 className="font-serif italic font-medium text-[28px] text-servirest-midnight tracking-[-0.02em] m-0 mb-2 leading-tight">
          ¿Cuántas mesas hay?
        </h3>
        <p className="text-[13px] text-[rgba(42,40,38,0.6)] m-0 mb-7 leading-relaxed">
          Las acomodas a tu gusto desde el panel después. Por ahora solo dinos el número total.
        </p>

        <div className="flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={() => setTables((prev) => (prev.length > 0 ? prev.slice(0, -1) : []))}
            className="w-11 h-11 rounded-full bg-servirest-hueso-sunken/60 border border-[rgba(42,40,38,0.12)] flex items-center justify-center text-servirest-midnight hover:bg-servirest-hueso-sunken transition-colors text-xl font-bold"
          >
            −
          </button>
          <div className="text-center">
            <SrMono className="block text-[64px] font-extrabold text-servirest-midnight leading-none tracking-tight">
              {tables.length}
            </SrMono>
            <SrLabel className="block mt-2">Mesas</SrLabel>
          </div>
          <button
            type="button"
            onClick={() =>
              setTables((prev) => [...prev, { id: `T${prev.length + 1}`, name: `Mesa ${prev.length + 1}`, seats: 4 }])
            }
            className="w-11 h-11 rounded-full bg-servirest-terracota text-servirest-hueso flex items-center justify-center shadow-sr-glow hover:scale-105 transition-transform text-xl font-bold"
          >
            +
          </button>
        </div>
      </div>
    </SrCard>

    {tables.length > 0 && (
      <SrCard variant="solaris" className="p-6">
        <SrLabel className="block mb-4">Previsualización</SrLabel>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {tables.map((table, idx) => (
            <motion.div
              key={table.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: idx * 0.02 }}
            >
              <SrCard className="p-3 text-center">
                <SrMono className="block text-[10px] text-servirest-terracota tracking-widest mb-1">{table.id}</SrMono>
                <div className="font-serif italic font-medium text-[14px] text-servirest-midnight tracking-tight leading-tight">
                  {table.name}
                </div>
                <SrLabel className="block mt-1.5">4 sillas</SrLabel>
              </SrCard>
            </motion.div>
          ))}
        </div>
      </SrCard>
    )}
  </div>
);

const StaffStep: React.FC<{
  staff: { name: string; role: string; pin: string }[];
  setStaff: React.Dispatch<React.SetStateAction<{ name: string; role: string; pin: string }[]>>;
  authProfile: any;
}> = ({ staff, setStaff, authProfile }) => (
  <SrCard variant="solaris" className="p-7">
    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
      <div>
        <SrLabel className="block mb-1">Tu equipo</SrLabel>
        <h3 className="font-serif italic font-medium text-[22px] text-servirest-midnight tracking-[-0.02em] m-0 leading-tight">
          {staff.length + 1} colaboradores
        </h3>
      </div>
      <SrButton
        variant="outline"
        size="sm"
        icon={<Plus size={14} />}
        onClick={() => setStaff([...staff, { name: '', role: 'Mesero', pin: '' }])}
      >
        Agregar colaborador
      </SrButton>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Owner card */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <SrCard className="p-5 flex items-center gap-4 border border-servirest-terracota/40 bg-[rgba(196,99,63,0.04)]">
          <div className="w-12 h-12 bg-servirest-terracota rounded-sr-md flex items-center justify-center text-servirest-hueso font-black italic text-[20px]">
            {authProfile?.fullName?.charAt(0) || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-serif italic font-medium text-[16px] text-servirest-midnight tracking-[-0.02em] m-0 truncate">
              {authProfile?.fullName || 'Tú'} (tú)
            </p>
            <div className="flex items-center gap-2 mt-1">
              <SrChip tone="terracota" size="xs">
                Administrador
              </SrChip>
              <SrMono className="text-[10px] text-[rgba(42,40,38,0.5)]">PIN 0000</SrMono>
            </div>
          </div>
        </SrCard>
      </motion.div>

      {staff.map((member, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: (idx + 1) * 0.04 }}
        >
          <SrCard className="p-5 group relative">
            <button
              type="button"
              onClick={() => setStaff(staff.filter((_, i) => i !== idx))}
              className="absolute top-3 right-3 w-7 h-7 rounded-sr-sm text-[rgba(42,40,38,0.4)] hover:text-servirest-danger hover:bg-[rgba(225,85,75,0.08)] flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Eliminar"
            >
              <Trash2 size={13} />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-servirest-hueso-sunken/50 rounded-sr-md border border-[rgba(42,40,38,0.12)] flex items-center justify-center text-[rgba(42,40,38,0.3)]">
                <Users size={18} />
              </div>
              <input
                type="text"
                value={member.name}
                placeholder="Nombre completo"
                onChange={(e) => {
                  const v = e.target.value;
                  setStaff((prev) => prev.map((s, i) => (i === idx ? { ...s, name: v } : s)));
                }}
                className="flex-1 bg-transparent border-none focus:outline-none text-[14px] font-bold text-servirest-midnight placeholder:text-[rgba(42,40,38,0.4)]"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={member.role}
                onChange={(e) => {
                  const v = e.target.value;
                  setStaff((prev) => prev.map((s, i) => (i === idx ? { ...s, role: v } : s)));
                }}
                className="flex-1 bg-servirest-hueso-sunken/40 border border-[rgba(42,40,38,0.12)] rounded-sr-md text-[11px] font-bold px-3 py-2 focus:outline-none text-servirest-carbon"
              >
                <option>Mesero</option>
                <option>Cajero</option>
                <option>Cocina</option>
                <option>Chef</option>
                <option>Bar</option>
                <option>Gerente</option>
              </select>
              <input
                type="text"
                placeholder="PIN"
                maxLength={4}
                value={member.pin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setStaff((prev) => prev.map((s, i) => (i === idx ? { ...s, pin: v } : s)));
                }}
                className="w-24 bg-servirest-hueso-sunken/40 border border-[rgba(42,40,38,0.12)] rounded-sr-md text-center text-[12px] font-bold tracking-[0.3em] px-3 py-2 focus:outline-none text-servirest-midnight focus:border-servirest-terracota"
              />
            </div>
          </SrCard>
        </motion.div>
      ))}
    </div>
  </SrCard>
);

const HardwareStep: React.FC<{
  hardware: any;
  onScan: () => void;
}> = ({ hardware, onScan }) => (
  <div className="space-y-5">
    <SrCard variant="solaris" className="p-8 text-center">
      {hardware.scanning ? (
        <div className="py-6 space-y-5">
          <div className="w-14 h-14 mx-auto border-[3px] border-servirest-terracota/20 border-t-servirest-terracota rounded-full animate-spin" />
          <div>
            <h3 className="font-serif italic font-medium text-[22px] text-servirest-midnight tracking-[-0.02em] m-0 leading-tight">
              Buscando aparatos en la red
            </h3>
            <p className="text-[13px] text-[rgba(42,40,38,0.6)] mt-2 leading-relaxed">
              Verifica que tus impresoras estén encendidas y en la misma red WiFi.
            </p>
          </div>
        </div>
      ) : (
        <div className="py-4 space-y-5">
          <div className="inline-flex p-4 rounded-sr-xl bg-[rgba(196,99,63,0.08)] text-servirest-terracota border border-servirest-terracota/30">
            <Wifi size={28} />
          </div>
          <div>
            <SrKicker className="block mb-1.5">Detección automática</SrKicker>
            <h3 className="font-serif italic font-medium text-[26px] text-servirest-midnight tracking-[-0.02em] m-0 leading-tight">
              Vamos a buscar tus aparatos
            </h3>
            <p className="text-[13px] text-[rgba(42,40,38,0.6)] mt-2 max-w-md mx-auto leading-relaxed">
              Escanearemos impresoras en IP, scanners por USB y dispositivos Bluetooth. Si no aparecen, los puedes agregar manualmente.
            </p>
          </div>
          <SrButton variant="primary" size="md" icon={<Sparkles size={14} />} onClick={onScan}>
            Empezar escaneo
          </SrButton>
        </div>
      )}
    </SrCard>

    <SrCard variant="solaris" className="p-7">
      <div className="flex items-center justify-between mb-5">
        <div>
          <SrLabel className="block mb-1">Encontrados</SrLabel>
          <h3 className="font-serif italic font-medium text-[20px] text-servirest-midnight tracking-[-0.02em] m-0 leading-tight">
            {hardware.printers.length + hardware.scanners.length + (hardware.drawer ? 1 : 0) > 0
              ? `${hardware.printers.length + hardware.scanners.length + (hardware.drawer ? 1 : 0)} aparatos vinculados`
              : 'Aún nada'}
          </h3>
        </div>
        <SrButton variant="ghost" size="sm" icon={<Plus size={14} />} disabled>
          Agregar manual
        </SrButton>
      </div>

      {hardware.printers.length === 0 && hardware.scanners.length === 0 && !hardware.drawer && !hardware.scanning && (
        <SrEmptyState
          icon={<Printer size={26} />}
          title="Sin aparatos detectados"
          description="Inicia el escaneo arriba o agrégalos a mano. También puedes hacerlo después desde Ajustes."
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {hardware.printers.map((printer: any, idx: number) => (
          <motion.div
            key={printer.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.04 }}
          >
            <SrCard className="p-4 flex items-center gap-3 border border-servirest-success/30 bg-[rgba(34,160,107,0.04)]">
              <div className="w-10 h-10 bg-[rgba(196,99,63,0.10)] rounded-sr-md flex items-center justify-center text-servirest-terracota">
                <Printer size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-servirest-midnight m-0 truncate">{printer.name}</p>
                <SrMono className="text-[10px] text-[rgba(42,40,38,0.6)]">{printer.connection}</SrMono>
              </div>
              <SrChip tone="success" size="xs">
                <Check size={9} className="mr-1" /> En línea
              </SrChip>
            </SrCard>
          </motion.div>
        ))}

        {hardware.scanners.map((scanner: any, idx: number) => (
          <motion.div
            key={scanner.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: (hardware.printers.length + idx) * 0.04 }}
          >
            <SrCard className="p-4 flex items-center gap-3 border border-servirest-success/30 bg-[rgba(34,160,107,0.04)]">
              <div className="w-10 h-10 bg-[rgba(201,162,74,0.15)] rounded-sr-md flex items-center justify-center text-servirest-mostaza">
                <Usb size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-servirest-midnight m-0 truncate">{scanner.name}</p>
                <SrMono className="text-[10px] text-[rgba(42,40,38,0.6)]">{scanner.status}</SrMono>
              </div>
              <SrChip tone="success" size="xs">
                <Check size={9} className="mr-1" /> Listo
              </SrChip>
            </SrCard>
          </motion.div>
        ))}

        {hardware.drawer && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
            <SrCard className="p-4 flex items-center gap-3 border border-servirest-success/30 bg-[rgba(34,160,107,0.04)]">
              <div className="w-10 h-10 bg-[rgba(201,162,74,0.15)] rounded-sr-md flex items-center justify-center text-servirest-mostaza">
                <Smartphone size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-servirest-midnight m-0">Cajón de dinero</p>
                <SrMono className="text-[10px] text-[rgba(42,40,38,0.6)]">Conectado vía impresora</SrMono>
              </div>
              <SrChip tone="success" size="xs">
                <Check size={9} className="mr-1" /> Vinculado
              </SrChip>
            </SrCard>
          </motion.div>
        )}
      </div>
    </SrCard>
  </div>
);

const CompleteStep: React.FC<{
  fullName: string;
  selectedPlan: 'basic' | 'pro';
  tablesCount: number;
  staffCount: number;
}> = ({ fullName, selectedPlan, tablesCount, staffCount }) => (
  <SrCard variant="solaris" className="p-12 text-center relative overflow-hidden">
    <div
      className="absolute inset-0 opacity-[0.04] pointer-events-none"
      style={{ background: 'radial-gradient(circle at 50% 30%, #C4633F 0%, transparent 60%)' }}
    />
    <motion.div
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative inline-flex w-24 h-24 rounded-full bg-servirest-terracota text-servirest-hueso items-center justify-center shadow-sr-glow mb-6"
    >
      <CheckCircle2 size={48} strokeWidth={2.5} />
      <span className="absolute inset-0 rounded-full border-2 border-servirest-terracota animate-ping opacity-30" />
    </motion.div>

    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
      <SrKicker className="block mb-2">Listo</SrKicker>
      <h2 className="font-serif italic font-medium text-[56px] text-servirest-midnight tracking-[-0.025em] leading-[0.95] m-0 mb-4">
        ¡Listo, {fullName.split(' ')[0]}!
      </h2>
      <p className="text-[14px] text-[rgba(42,40,38,0.6)] font-medium max-w-md mx-auto leading-relaxed">
        Armamos tu ServiRest. Cuando abras caja, todo arranca a vender.
      </p>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto"
    >
      {[
        { label: 'Plan', value: selectedPlan === 'basic' ? 'Esencial' : 'Profesional' },
        { label: 'Mesas', value: `${tablesCount}` },
        { label: 'Equipo', value: `${staffCount + 1}` },
        { label: 'Hardware', value: 'Vinculado' },
      ].map((s, idx) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 + idx * 0.05 }}
        >
          <SrCard className="px-4 py-4 text-left">
            <SrLabel className="block mb-1.5">{s.label}</SrLabel>
            <div className="font-serif italic font-medium text-[20px] text-servirest-midnight tracking-[-0.02em] leading-none">
              {s.value}
            </div>
          </SrCard>
        </motion.div>
      ))}
    </motion.div>
  </SrCard>
);
