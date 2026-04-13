import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  Package,
  Plus,
  Trash2,
  Search,
  Wifi,
  Monitor,
  Usb,
  Smartphone,
  Check,
  Zap
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useMenu } from '../contexts/MenuContext';
import { useInventory } from '../contexts/InventoryContext';
import { useSubscription } from '../contexts/SubscriptionContext';

type OnboardingStep = 'PLAN' | 'INFO' | 'MENU' | 'TABLES' | 'STAFF' | 'HARDWARE' | 'COMPLETE';

export default function OnboardingScreen() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('PLAN');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { authProfile, completeOnboarding, addEmployee, updateBusiness } = useUser();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const { addItem: addMenuItem } = useMenu();
  const { paySubscription, payEquipment } = useSubscription();

  // Step Data States
  const [restaurantInfo, setRestaurantInfo] = useState({
    name: authProfile?.businessName || '',
    legalName: '',
    rfc: '',
    address: '',
    phone: '',
    ticketFooter: '¡Gracias por su visita!'
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
    scanning: false
  });

  const steps: OnboardingStep[] = ['PLAN', 'INFO', 'MENU', 'TABLES', 'STAFF', 'HARDWARE', 'COMPLETE'];
  const progress = (steps.indexOf(currentStep) / (steps.length - 1)) * 100;

  const nextStep = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
        setRestaurantInfo(prev => ({ ...prev, logo: reader.result as string }));
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
              inventoryLevel: 4
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
              area: (member.role.toLowerCase() === 'cocina' || member.role.toLowerCase() === 'chef') ? 'Kitchen' : 'Service',
              image: `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`,
              pin: member.pin || '1234'
            });
          }
        }
      }

      // 2.1 Always ensure the current user (owner/admin) has an employee profile
      const hasAdmin = staff.some(s => s.role.toLowerCase() === 'admin');
      if (!hasAdmin && authProfile) {
          console.log('[Onboarding] Auto-creating admin profile for owner:', authProfile.fullName);
          addEmployee({
              name: authProfile.fullName || 'Admin',
              role: 'admin',
              area: 'Management',
              image: `https://ui-avatars.com/api/?name=${encodeURIComponent(authProfile.fullName || 'Admin')}&background=5d5fef&color=fff&size=128`,
              pin: '0000'
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
            updated_at: new Date().toISOString()
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
          ticket_footer: (restaurantInfo as any).ticketFooter
        }
      });

      // 5. Mark as completed
      console.log('[Onboarding] Marking onboarding as completed in Supabase...');
      await completeOnboarding();
      
      console.log('[Onboarding] Success! Redirecting...');
      // Force a slight delay to ensure state updates propagate
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
    setHardware(prev => ({ ...prev, scanning: true }));
    // Simulate auto-detection
    setTimeout(() => {
      setHardware(prev => ({
        ...prev,
        scanning: false,
        printers: [
          { id: 'p1', name: 'Epson TM-T88VI (Auto-detected)', connection: 'IP: 192.168.1.50', status: 'Online' }
        ],
        scanners: [
          { id: 's1', name: 'HID Scanner (USB)', status: 'Connected' }
        ],
        drawer: true
      }));
    }, 2000);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 sm:p-12">
        <div className="max-w-md w-full bg-gray-800 rounded-3xl p-8 border border-white/5 text-center shadow-2xl">
          <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-icons-round text-4xl text-emerald-500">check_circle</span>
          </div>
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">¡Configuración Completa!</h2>
          <p className="text-gray-400 mb-8">Tu restaurante "{restaurantInfo.name}" ha sido creado con éxito. Todos tus platillos, personal y mesas están listos.</p>
          <button 
            onClick={() => window.location.hash = '/dashboard'}
            className="w-full py-4 bg-primary hover:bg-primary-dark text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
          >
            Entrar al Sistema
            <span className="material-icons-round">rocket_launch</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col font-sans text-white">
      {/* Header */}
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <ChefHat size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Configuración Solaris</h1>
            <p className="text-sm text-slate-500">Paso {steps.indexOf(currentStep) + 1} de {steps.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={handleFinish}
            className="text-sm text-slate-400 hover:text-slate-600 font-medium"
          >
            Configurar después
          </button>
          <div className="w-48 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className="max-w-4xl w-full bg-white rounded-3xl shadow-xl shadow-indigo-100/50 border border-indigo-50/50 overflow-hidden flex min-h-[600px]">
          
          {/* Sidebar Info */}
          <div className="w-1/3 bg-slate-900 p-8 text-white flex flex-col justify-between">
            <div>
              <div className="mb-8">
                {currentStep === 'PLAN' && <CreditCard size={48} className="text-indigo-400 mb-4" />}
                {currentStep === 'INFO' && <Store size={48} className="text-indigo-400 mb-4" />}
                {currentStep === 'MENU' && <ChefHat size={48} className="text-indigo-400 mb-4" />}
                {currentStep === 'TABLES' && <Rows size={48} className="text-indigo-400 mb-4" />}
                {currentStep === 'STAFF' && <Users size={48} className="text-indigo-400 mb-4" />}
                {currentStep === 'HARDWARE' && <Printer size={48} className="text-indigo-400 mb-4" />}
                {currentStep === 'COMPLETE' && <CheckCircle2 size={48} className="text-emerald-400 mb-4" />}
                
                <h2 className="text-2xl font-bold mb-2">
                  {currentStep === 'PLAN' && 'Selecciona tu Plan'}
                  {currentStep === 'INFO' && 'Tu Restaurante'}
                  {currentStep === 'MENU' && 'Tu Menú Inicial'}
                  {currentStep === 'TABLES' && 'Distribución'}
                  {currentStep === 'STAFF' && 'Tu Equipo'}
                  {currentStep === 'HARDWARE' && 'Dispositivos'}
                  {currentStep === 'COMPLETE' && '¡Todo listo!'}
                </h2>
                <p className="text-slate-400 leading-relaxed">
                  {currentStep === 'PLAN' && 'Elige la mensualidad y el equipo necesario para operar.'}
                  {currentStep === 'INFO' && 'Completa los datos fiscales y de contacto de tu negocio.'}
                  {currentStep === 'MENU' && 'Agrega tus primeros platillos o importa un archivo CSV.'}
                  {currentStep === 'TABLES' && 'Define cuántas mesas tienes y su capacidad básica.'}
                  {currentStep === 'STAFF' && 'Registra a tus empleados y asígnales un PIN de acceso.'}
                  {currentStep === 'HARDWARE' && 'Conecta tus impresoras de tickets, scanners y cajones.'}
                  {currentStep === 'COMPLETE' && 'Tu restaurante está configurado y listo para recibir clientes.'}
                </p>
              </div>

              <div className="space-y-4">
                {steps.slice(0, -1).map((s, idx) => (
                  <div key={s} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${steps.indexOf(currentStep) >= idx ? 'bg-indigo-400' : 'bg-slate-700'}`} />
                    <span className={`text-sm ${steps.indexOf(currentStep) === idx ? 'text-white font-medium' : 'text-slate-500'}`}>
                      {idx + 1}. {s.charAt(0) + s.slice(1).toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-500">
              © 2026 Solaris POS - Todos los derechos reservados.
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-10 flex flex-col">
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              
              {/* Step 1: PLAN */}
              {currentStep === 'PLAN' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setSelectedPlan('basic')}
                      className={`p-6 rounded-2xl border-2 text-left transition-all ${selectedPlan === 'basic' ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                    >
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 mb-4">
                        <Package size={20} />
                      </div>
                      <h3 className="font-bold text-slate-900 mb-1">Plan Básico</h3>
                      <p className="text-xs text-slate-500 mb-4">Ideal para cafeterías pequeñas o food trucks.</p>
                      <div className="text-xl font-bold text-indigo-600">$850<span className="text-sm font-normal text-slate-400">/mes</span></div>
                    </button>

                    <button 
                      onClick={() => setSelectedPlan('pro')}
                      className={`p-6 rounded-2xl border-2 text-left transition-all ${selectedPlan === 'pro' ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                    >
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 mb-4">
                        <Zap size={20} />
                      </div>
                      <h3 className="font-bold text-slate-900 mb-1">Plan Pro</h3>
                      <p className="text-xs text-slate-500 mb-4">Múltiples estaciones, orden remota e inventario avanzado.</p>
                      <div className="text-xl font-bold text-purple-600">$1,450<span className="text-sm font-normal text-slate-400">/mes</span></div>
                    </button>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
                       <Monitor size={16} /> Equipo de Hardware
                    </h4>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer">
                        <input type="radio" name="equip" checked={selectedEquipment === 'rent'} onChange={() => setSelectedEquipment('rent')} className="w-4 h-4 text-indigo-600" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">Renta de Equipo Pro ($500/mes)</p>
                          <p className="text-xs text-slate-500">Incluye Tablet 10", Impresora de Tickets y Soporte.</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer">
                        <input type="radio" name="equip" checked={selectedEquipment === 'buy'} onChange={() => setSelectedEquipment('buy')} className="w-4 h-4 text-indigo-600" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">Compra de Equipo ($5,000 pago único)</p>
                          <p className="text-xs text-slate-500">Equipo 100% tuyo con 1 año de garantía.</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 cursor-pointer">
                        <input type="radio" name="equip" checked={selectedEquipment === 'none'} onChange={() => setSelectedEquipment('none')} className="w-4 h-4 text-indigo-600" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">Ya tengo mi equipo</p>
                          <p className="text-xs text-slate-500">Solo contrataré el software.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <AlertCircle className="text-amber-600 shrink-0" size={18} />
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Al continuar, integraremos el pago vía Stripe para habilitar tu cuenta inmediatamente.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: INFO */}
              {currentStep === 'INFO' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex flex-col items-center mb-4">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleLogoChange}
                      className="hidden"
                      accept="image/*"
                    />
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 cursor-pointer mb-2 overflow-hidden"
                    >
                       {logoPreview ? (
                         <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                       ) : (
                         <>
                            <Plus size={24} />
                            <span className="text-[10px] font-bold">LOGO</span>
                         </>
                       )}
                    </div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Subir Logo (.png, .jpg)</p>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Nombre Comercial</label>
                    <input 
                      type="text" 
                      value={restaurantInfo.name}
                      onChange={e => setRestaurantInfo({...restaurantInfo, name: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Ej. Sushi Solaris"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Razón Social</label>
                    <input 
                      type="text" 
                      value={(restaurantInfo as any).legalName}
                      onChange={e => setRestaurantInfo({...restaurantInfo, legalName: e.target.value} as any)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Ej. Gastronómica S.A. de C.V."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">RFC</label>
                    <input 
                      type="text" 
                      value={(restaurantInfo as any).rfc}
                      onChange={e => setRestaurantInfo({...restaurantInfo, rfc: e.target.value} as any)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="RFC123456789"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</label>
                    <input 
                      type="text" 
                      value={(restaurantInfo as any).phone}
                      onChange={e => setRestaurantInfo({...restaurantInfo, phone: e.target.value} as any)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="33 1234 5678"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Dirección Completa</label>
                    <input 
                      type="text" 
                      value={(restaurantInfo as any).address}
                      onChange={e => setRestaurantInfo({...restaurantInfo, address: e.target.value} as any)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Av. Libertad #123, Col. Americana..."
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Mensaje al Final del Ticket</label>
                    <textarea 
                      value={(restaurantInfo as any).ticketFooter}
                      onChange={e => setRestaurantInfo({...restaurantInfo, ticketFooter: e.target.value} as any)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-20 resize-none"
                      placeholder="¡Vuelve pronto!"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: MENU */}
              {currentStep === 'MENU' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-600 shadow-sm">
                        <Package size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">¿Tienes un catálogo en CSV?</p>
                        <p className="text-xs text-slate-500">Impórtalo rápidamente para no empezar de cero.</p>
                      </div>
                    </div>
                    <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors">
                      IMPORTAR CSV
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Tus Platillos ({menuItems.length})</h4>
                      <button 
                        onClick={() => setMenuItems([...menuItems, { id: Date.now(), name: '', price: 0, category: 'General' }])}
                        className="text-xs text-indigo-600 font-bold flex items-center gap-1 hover:text-indigo-700"
                      >
                        <Plus size={14} /> AGREGAR PLATILLO
                      </button>
                    </div>

                    <div className="space-y-2">
                       {menuItems.length === 0 ? (
                         <div className="py-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                            <ChefHat size={32} className="mb-2 opacity-20" />
                            <p className="text-sm">No has agregado platillos aún.</p>
                         </div>
                       ) : (
                         menuItems.map((item, idx) => (
                           <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                             <div className="w-10 h-10 bg-white rounded-lg border border-slate-200" />
                             <input 
                               type="text" 
                               placeholder="Nombre del plato"
                               className="flex-1 bg-transparent border-none focus:outline-none text-sm font-medium"
                               autoFocus
                             />
                             <div className="flex items-center gap-1 text-slate-400 bg-white border border-slate-200 rounded-lg px-2 py-1">
                               <span className="text-xs">$</span>
                               <input type="number" className="w-16 bg-transparent border-none focus:outline-none text-xs text-slate-900" placeholder="0" />
                             </div>
                             <button onClick={() => setMenuItems(menuItems.filter(i => i.id !== item.id))} className="text-slate-300 hover:text-red-500 transition-colors">
                               <Trash2 size={16} />
                             </button>
                           </div>
                         ))
                       )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: TABLES */}
              {currentStep === 'TABLES' && (
                <div className="space-y-6">
                  <div className="bg-slate-900 rounded-2xl p-8 text-center text-white relative overflow-hidden">
                    <div className="relative z-10">
                      <Rows size={48} className="mx-auto mb-4 text-indigo-400 opacity-50" />
                      <h3 className="text-lg font-bold mb-2">Editor de Piso de Ventas</h3>
                      <p className="text-sm text-slate-400 mb-6">Podrás arrastrar y acomodar tus mesas en el Dashboard.<br/>Por ahora, dinos cuántas tienes.</p>
                      
                      <div className="flex items-center justify-center gap-6">
                        <div className="space-y-2 text-center">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Mesas</label>
                          <div className="flex items-center gap-3">
                             <button 
                               onClick={() => setTables(prev => prev.length > 0 ? prev.slice(0, -1) : [])}
                               className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white hover:bg-slate-700 transition-colors"
                             >-</button>
                             <span className="text-3xl font-bold w-12">{tables.length}</span>
                             <button 
                               onClick={() => setTables(prev => [...prev, { id: `T${prev.length + 1}`, name: `Mesa ${prev.length + 1}`, seats: 4 }])}
                               className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white hover:bg-indigo-700 transition-colors"
                             >+</button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Background Grid Decoration */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {tables.map(table => (
                      <div key={table.id} className="p-4 bg-white border border-slate-100 rounded-xl text-center shadow-sm">
                        <div className="text-[10px] font-bold text-indigo-600 mb-1">{table.id}</div>
                        <div className="text-xs font-bold text-slate-900">{table.name}</div>
                        <div className="text-[10px] text-slate-400">4 Sillas</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 5: STAFF */}
              {currentStep === 'STAFF' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Tu Personal ({staff.length + 1})</h4>
                    <button 
                      onClick={() => setStaff([...staff, { name: '', role: 'Waiter', pin: '' }])}
                      className="text-xs text-indigo-600 font-bold flex items-center gap-1 hover:text-indigo-700"
                    >
                      <Plus size={14} /> AGREGAR EMPLEADO
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Owner - Always there */}
                    <div className="p-4 bg-indigo-50/50 rounded-2xl border-2 border-indigo-200 flex items-center gap-4 relative">
                      <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">
                        {authProfile?.fullName?.charAt(0) || 'A'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{authProfile?.fullName} (Tú)</p>
                        <p className="text-xs text-indigo-600 font-medium">Administrador</p>
                      </div>
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        <span className="text-[8px] font-bold bg-indigo-600 text-white px-1.5 rounded-full">PIN 0000</span>
                      </div>
                    </div>

                    {staff.map((member, idx) => (
                      <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-100 flex flex-col gap-3 group relative">
                        <button onClick={() => setStaff(staff.filter((_, i) => i !== idx))} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={14} />
                        </button>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl border border-slate-200" />
                          <input 
                            type="text" 
                            placeholder="Nombre del empleado"
                            className="bg-transparent border-none focus:outline-none text-sm font-bold text-slate-900 flex-1"
                            autoFocus
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <select className="bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold px-2 py-1 focus:outline-none text-slate-600">
                            <option>Mesero</option>
                            <option>Cajero</option>
                            <option>Cocina</option>
                            <option>Manager</option>
                          </select>
                          <input 
                            type="text" 
                            placeholder="PIN (4 dígitos)"
                            maxLength={4}
                            className="bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold px-2 py-1 focus:outline-none text-slate-900 w-24"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 6: HARDWARE */}
              {currentStep === 'HARDWARE' && (
                <div className="space-y-6">
                  <div className="bg-slate-50 rounded-2xl p-6 border-2 border-dashed border-slate-200 text-center">
                    {hardware.scanning ? (
                      <div className="py-10 space-y-4">
                        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-sm font-bold text-slate-900 animate-pulse">Buscando dispositivos en la red...</p>
                        <p className="text-xs text-slate-500">Asegúrate de que tus impresoras estén encendidas y en el mismo WiFi.</p>
                      </div>
                    ) : (
                      <div className="py-6 space-y-4">
                        <Wifi size={48} className="text-slate-300 mx-auto" />
                        <div>
                          <p className="text-sm font-bold text-slate-900">¿Quieres autodetectar tus dispositivos?</p>
                          <p className="text-xs text-slate-500">Escanearemos impresoras IP y dispositivos USB/Bluetooth conectados.</p>
                        </div>
                        <button 
                          onClick={scanHardware}
                          className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
                        >
                          COMENZAR ESCANEO (RECOMENDADO)
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Dispositivos Encontrados</h4>
                      <button className="text-xs text-indigo-600 font-bold flex items-center gap-1 opacity-50 cursor-not-allowed">
                        <Plus size={14} /> AGREGAR MANUALMENTE
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {hardware.printers.length === 0 && !hardware.scanning && (
                        <div className="col-span-2 py-8 text-center bg-white rounded-xl border border-slate-100 text-slate-400">
                          <p className="text-xs italic">No hay dispositivos detectados. Inicia el escaneo.</p>
                        </div>
                      )}
                      
                      {hardware.printers.map(printer => (
                        <div key={printer.id} className="p-4 bg-white rounded-2xl border-2 border-indigo-100 flex items-center gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                            <Printer size={20} />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-900">{printer.name}</p>
                            <p className="text-[10px] text-slate-500">{printer.connection}</p>
                          </div>
                          <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                            <Check size={14} />
                          </div>
                        </div>
                      ))}

                      {hardware.scanners.map(scanner => (
                        <div key={scanner.id} className="p-4 bg-white rounded-2xl border-2 border-indigo-100 flex items-center gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                            <Usb size={20} />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-900">{scanner.name}</p>
                            <p className="text-[10px] text-slate-500">{scanner.status}</p>
                          </div>
                          <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                            <Check size={14} />
                          </div>
                        </div>
                      ))}

                      {hardware.drawer && (
                        <div className="p-4 bg-white rounded-2xl border-2 border-indigo-100 flex items-center gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                            <Smartphone size={20} />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-900">Cajón de Dinero</p>
                            <p className="text-[10px] text-slate-500">Conectado vía Impresora</p>
                          </div>
                          <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                            <Check size={14} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 7: COMPLETE */}
              {currentStep === 'COMPLETE' && (
                <div className="flex flex-col items-center justify-center text-center h-full space-y-6 animate-in zoom-in-95 duration-500">
                   <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 relative">
                      <Check size={48} strokeWidth={3} />
                      <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-25" />
                   </div>
                   
                   <div>
                      <h3 className="text-3xl font-bold text-slate-900 mb-2">¡Todo Listo, {authProfile?.fullName}!</h3>
                      <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">
                        Hemos configurado tu restaurante con éxito. Ahora puedes empezar a vender, controlar tus mesas y gestionar tu inventario.
                      </p>
                   </div>

                   <div className="w-full bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold uppercase tracking-widest">Resumen de Configuración</span>
                        <span className="text-emerald-600 font-bold px-2 py-0.5 bg-emerald-50 rounded-full border border-emerald-100">EXITOSO</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-left">
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                           <span className="text-xs font-bold text-slate-700">{selectedPlan === 'basic' ? 'Plan Básico' : 'Plan Pro'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                           <span className="text-xs font-bold text-slate-700">{tables.length} Mesas registradas</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                           <span className="text-xs font-bold text-slate-700">{staff.length + 1} Colaboradores</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                           <span className="text-xs font-bold text-slate-700">Hardware vinculado</span>
                        </div>
                      </div>
                   </div>
                </div>
              )}

            </div>

            {/* Footer Navigation */}
            <div className="pt-8 mt-auto flex justify-between items-center bg-white border-t border-slate-50">
              <button 
                onClick={prevStep}
                disabled={currentStep === 'PLAN'}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${currentStep === 'PLAN' ? 'text-slate-300 pointer-events-none' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                <ChevronLeft size={20} /> ATRÁS
              </button>

              {currentStep === 'COMPLETE' ? (
                <button 
                  onClick={handleFinish}
                  disabled={loading}
                  className="bg-indigo-600 text-white px-10 py-4 rounded-3xl text-sm font-bold shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:translate-y-[-2px] active:translate-y-0 transition-all flex items-center justify-center gap-3 ring-4 ring-white min-w-[220px]"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      GUARDANDO...
                    </>
                  ) : (
                    <>ENTRAR AL SISTEMA <ChevronRight size={20} /></>
                  )}
                </button>
              ) : (
                <button 
                  onClick={nextStep}
                  className="bg-slate-900 text-white px-10 py-4 rounded-3xl text-sm font-bold shadow-xl shadow-slate-200 hover:bg-slate-800 hover:translate-y-[-2px] active:translate-y-0 transition-all flex items-center gap-2"
                >
                  CONTINUAR <ChevronRight size={20} />
                </button>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
