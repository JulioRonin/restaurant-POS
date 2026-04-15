import React, { useState, useEffect } from 'react';
import { getSupabase } from '../services/auth';
import { useUser } from '../contexts/UserContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { 
  Users, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Settings2, 
  ChevronRight,
  LayoutGrid,
  ShieldCheck,
  Search,
  Plus,
  Mail,
  CreditCard,
  Trash2,
  Calendar,
  Zap
} from 'lucide-react';

interface Business {
  id: string;
  name: string;
  plan: 'basic' | 'premium' | 'enterprise';
  is_active: boolean;
  created_at: string;
  profiles?: any[];
}

interface Feature {
  id: string;
  key: string;
  name: string;
  description: string;
}

export default function SuperAdminScreen() {
  console.log('[SuperAdminScreen] Component Mounted');
  const { isSuperAdmin, signOut } = useUser();
  const { refreshFeatures } = useSubscription();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [businessFeatures, setBusinessFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      loadData();
    }
  }, [isSuperAdmin]);

  const loadData = async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    setLoading(true);
    try {
      // Fetch businesses with their admin profile
      const { data: bData } = await supabase
        .from('businesses')
        .select('*, profiles!profiles_business_id_fkey(full_name, role)')
        .order('created_at', { ascending: false });
        
      const { data: fData } = await supabase.from('features').select('*');
      
      setBusinesses(bData || []);
      setFeatures(fData || []);
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
      data?.forEach((bf: any) => {
        mapping[bf.feature_id] = bf.enabled;
      });
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
        .upsert({
          business_id: selectedBusiness.id,
          feature_id: featureId,
          enabled: !currentState
        }, { onConflict: 'business_id,feature_id' });

      if (error) throw error;
      
      setBusinessFeatures(prev => ({
        ...prev,
        [featureId]: !currentState
      }));
      
      await refreshFeatures();
    } catch (err) {
      console.error('Error toggling feature:', err);
    }
  };

  const updateBusinessPlan = async (plan: 'basic' | 'premium' | 'enterprise') => {
    if (!selectedBusiness) return;
    const supabase = getSupabase();
    if (!supabase) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ plan })
        .eq('id', selectedBusiness.id);

      if (error) throw error;
      
      setSelectedBusiness({ ...selectedBusiness, plan });
      setBusinesses(prev => prev.map(b => b.id === selectedBusiness.id ? { ...b, plan } : b));
      alert('Plan actualizado correctamente');
    } catch (err) {
      console.error('Error updating plan:', err);
      alert('Error al actualizar el plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBusiness = async () => {
    if (!selectedBusiness) return;
    if (!window.confirm(`¿Estás SEGURO de eliminar a "${selectedBusiness.name}"? Esta acción borrará todos sus datos, empleados, menús y pedidos de forma permanente.`)) return;

    const supabase = getSupabase();
    if (!supabase) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .delete()
        .eq('id', selectedBusiness.id);

      if (error) throw error;
      
      alert('Negocio eliminado correctamente');
      setSelectedBusiness(null);
      loadData();
    } catch (err) {
      console.error('Error deleting business:', err);
      alert('Error al eliminar el negocio. Verifica que no tenga dependencias pendientes.');
    } finally {
      setSaving(false);
    }
  };

  const filteredBusinesses = businesses.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white bg-slate-900 p-8">
        <ShieldCheck className="w-20 h-20 text-red-500 mb-4 animate-pulse" />
        <h1 className="text-3xl font-bold mb-2">Acceso Restringido</h1>
        <p className="text-slate-400">Esta área es solo para administradores de Solaris POS.</p>
      </div>
    );
  }

  const selectedBusinessAdmin = selectedBusiness?.profiles?.find(p => p.role === 'admin' || p.role === 'super_admin');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 lg:p-10">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="bg-blue-600 p-2 rounded-lg">
                <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white">
              Solaris Control <span className="text-blue-500">Center</span>
            </h1>
          </div>
          <p className="text-slate-500 text-sm font-medium">Gestión Global de Ecosistema Multi-Tenant</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Buscar negocio..."
              className="pl-10 pr-4 py-2.5 bg-slate-900/50 border border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-64 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button 
            onClick={signOut}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl transition-all font-bold text-sm"
          >
            <ShieldCheck className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Business List */}
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4" />
            Clientes Registrados ({businesses.length})
          </h2>
          
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {loading ? (
              [1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-slate-900/50 rounded-2xl animate-pulse border border-slate-800" />
              ))
            ) : filteredBusinesses.length === 0 ? (
              <div className="p-10 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl">
                No se encontraron negocios.
              </div>
            ) : (
              filteredBusinesses.map(business => (
                <button
                  key={business.id}
                  onClick={() => {
                    setSelectedBusiness(business);
                    loadBusinessFeatures(business.id);
                  }}
                  className={`w-full group flex items-center justify-between p-4 rounded-2xl transition-all border ${
                    selectedBusiness?.id === business.id 
                      ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-500/10' 
                      : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-4 text-left">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg transition-colors ${
                        selectedBusiness?.id === business.id ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-blue-400'
                    }`}>
                      {business.name.substring(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-white group-hover:text-blue-400 transition-colors">{business.name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <CreditCard className="w-3 h-3" />
                        PLAN {business.plan === 'premium' ? 'PRO' : business.plan?.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-600 transition-transform ${selectedBusiness?.id === business.id ? 'translate-x-1 text-blue-500' : ''}`} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="lg:col-span-8">
          {selectedBusiness ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 sticky top-6 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
                <div className="flex items-center gap-5">
                   <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl font-black text-white shadow-xl shadow-blue-500/20">
                     {selectedBusiness.name.substring(0, 1).toUpperCase()}
                   </div>
                   <div>
                     <h2 className="text-3xl font-black text-white">{selectedBusiness.name}</h2>
                     <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-mono">ID: {selectedBusiness.id}</span>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                          <Calendar className="w-3 h-3" />
                          Unido: {new Date(selectedBusiness.created_at).toLocaleDateString()}
                        </div>
                     </div>
                   </div>
                </div>
                
                <div className="flex flex-col items-end">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-2 ${
                    selectedBusiness.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                    {selectedBusiness.is_active ? 'Cuenta Activa' : 'Cuenta Suspendida'}
                    </span>
                    <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        Admin: {selectedBusinessAdmin?.full_name || 'Sin asignar'}
                    </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Subscription & Plans */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <CreditCard className="w-3 h-3 text-emerald-400" />
                        Plan Solaris
                    </h3>

                    <div className="grid grid-cols-1 gap-2">
                        {(['basic', 'premium', 'enterprise'] as const).map((p) => {
                            const isSelected = selectedBusiness.plan === p;
                            const label = p === 'premium' ? 'Pro' : p.charAt(0).toUpperCase() + p.slice(1);
                            return (
                                <button
                                    key={p}
                                    onClick={() => updateBusinessPlan(p)}
                                    disabled={saving}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                        isSelected 
                                        ? 'bg-blue-600/20 border-blue-500' 
                                        : 'bg-slate-800/30 border-slate-700 hover:border-slate-600'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isSelected ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-500'}`}>
                                            <Zap className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="text-left">
                                            <div className={`text-xs font-bold leading-none ${isSelected ? 'text-white' : 'text-slate-400'}`}>{label}</div>
                                            <div className="text-[9px] text-slate-500 mt-1">{p === 'enterprise' ? 'Custom' : '$850 - $1,000 MXN'}</div>
                                        </div>
                                    </div>
                                    {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Feature Toggles */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <LayoutGrid className="w-3 h-3 text-indigo-400" />
                            Módulos Habilitados
                        </h3>
                        <div className="flex gap-4">
                            <button 
                                onClick={async () => {
                                   const supabase = getSupabase();
                                   if (!supabase) return;
                                   const { data: existing } = await supabase.from('features').select('key');
                                   const existingKeys = (existing || []).map(f => f.key);
                                   const defaultFeatures = [
                                       { key: 'dashboard', name: 'Dashboard', description: 'Métricas y resumen' },
                                       { key: 'pos', name: 'Punto de Venta', description: 'Toma de pedidos' },
                                       { key: 'tables', name: 'Gestión de Mesas', description: 'Mapa y estados' },
                                       { key: 'hostess', name: 'Hostess / Reservas', description: 'Recepción' },
                                       { key: 'cashier', name: 'Caja y Gastos', description: 'Cortes y egresos' },
                                       { key: 'kitchen', name: 'Monitor Cocina', description: 'Área de producción' },
                                       { key: 'bar', name: 'Monitor Barra', description: 'Área de bebidas' },
                                       { key: 'remote_order', name: 'Comandero Tablet', description: 'Meseros' },
                                       { key: 'inventory', name: 'Inventarios', description: 'Stock' },
                                       { key: 'staff', name: 'Personal', description: 'Empleados' },
                                       { key: 'menu_admin', name: 'Catálogo de Menú', description: 'Edición' }
                                   ].filter(f => !existingKeys.includes(f.key));
                                   
                                   if (defaultFeatures.length > 0) {
                                       await supabase.from('features').insert(defaultFeatures);
                                       alert(`${defaultFeatures.length} nuevos módulos añadidos.`);
                                   } else {
                                       alert('Todos los módulos ya están registrados.');
                                   }
                                   loadData();
                                }}
                                className="text-[9px] font-bold text-slate-500 hover:text-white uppercase tracking-wider"
                            >
                                Sincronizar Catálogo
                            </button>

                            {features.length > 0 && (
                                <button 
                                    onClick={async () => {
                                        if (!selectedBusiness) return;
                                        const supabase = getSupabase();
                                        if (!supabase) return;
                                        const updates = features.map(f => ({
                                            business_id: selectedBusiness.id,
                                            feature_id: f.id,
                                            enabled: true
                                        }));
                                        await supabase.from('business_features').upsert(updates, { onConflict: 'business_id,feature_id' });
                                        loadBusinessFeatures(selectedBusiness.id);
                                        await refreshFeatures();
                                        alert('Todos los módulos habilitados para este cliente.');
                                    }}
                                    className="text-[9px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-wider"
                                >
                                    Habilitar Todos
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                    {features.length === 0 ? (
                        <div className="p-4 text-center border border-dashed border-slate-800 rounded-xl">
                            <p className="text-[10px] text-slate-600 mb-2">No se detectaron módulos.</p>
                            <button 
                                onClick={async () => {
                                   const supabase = getSupabase();
                                   if (!supabase) return;
                                   const { data: existing } = await supabase.from('features').select('key');
                                   const existingKeys = (existing || []).map(f => f.key);
                                   const defaultFeatures = [
                                       { key: 'dashboard', name: 'Dashboard', description: 'Panel de métricas y resumen de ventas' },
                                       { key: 'pos', name: 'Punto de Venta (POS)', description: 'Toma de pedidos principal' },
                                       { key: 'tables', name: 'Gestión de Mesas', description: 'Mapa de mesas y estados' },
                                       { key: 'hostess', name: 'Hostess / Reservas', description: 'Gestión de reservaciones y recepción' },
                                       { key: 'cashier', name: 'Caja y Gastos', description: 'Cortes de caja y egresos' },
                                       { key: 'kitchen', name: 'Monitor de Cocina', description: 'Pedidos para el área de cocina' },
                                       { key: 'bar', name: 'Monitor de Barra', description: 'Pedidos para el área de barra' },
                                       { key: 'remote_order', name: 'Comandero (Remote)', description: 'Tablets para meseros' },
                                       { key: 'inventory', name: 'Inventarios', description: 'Control de stock e insumos' },
                                       { key: 'staff', name: 'Personal', description: 'Gestión de empleados y roles' },
                                       { key: 'menu_admin', name: 'Administrador de Menú', description: 'Edición de platillos y precios' }
                                   ].filter(f => !existingKeys.includes(f.key));
                                   if (defaultFeatures.length > 0) await supabase.from('features').insert(defaultFeatures);
                                   loadData();
                                }}
                                className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded-lg"
                            >
                                Iniciar Módulos
                            </button>
                        </div>
                    ) : features.map(feature => {
                        const isEnabled = businessFeatures[feature.id] || false;
                        return (
                        <div 
                            key={feature.id}
                            className={`p-3 rounded-xl border transition-all ${
                            isEnabled ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-900/40 border-slate-800 opacity-40'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className={`text-[11px] font-bold block ${isEnabled ? 'text-white' : 'text-slate-500'}`}>{feature.name}</span>
                                    <span className="text-[8px] text-slate-600 block">{feature.key}</span>
                                </div>
                                <button 
                                    onClick={() => toggleFeature(feature.id, isEnabled)}
                                    className={`w-8 h-4 rounded-full relative transition-colors ${isEnabled ? 'bg-blue-500' : 'bg-slate-700'}`}
                                >
                                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isEnabled ? 'left-4.5' : 'left-0.5'}`} />
                                </button>
                            </div>
                        </div>
                        );
                    })}
                    </div>
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-[10px] text-slate-500 font-medium">
                      Los cambios en los módulos se reflejan inmediatamente en el cliente.
                  </div>
                  <div className="flex gap-4">
                    <button 
                        onClick={handleDeleteBusiness}
                        disabled={saving}
                        className="flex items-center gap-2 text-red-500 hover:text-red-400 font-bold text-xs px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                        <Trash2 className="w-4 h-4" />
                        Eliminar Cliente
                    </button>
                  </div>
              </div>
            </div>
          ) : (
            <div className="h-[60vh] flex flex-col items-center justify-center p-20 border-2 border-dashed border-slate-800 rounded-3xl text-slate-600 bg-slate-900/10 backdrop-blur-sm">
              <div className="bg-slate-900 p-6 rounded-full mb-6 ring-8 ring-slate-950">
                <BoxIcon className="w-12 h-12 opacity-20" />
              </div>
              <h3 className="text-xl font-bold text-slate-400 mb-2">Panel Maestro</h3>
              <p className="text-sm font-medium text-center text-slate-500 max-w-xs">Selecciona un negocio del panel lateral para gestionar sus planes, módulos y estado de cuenta.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BoxIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  )
}
