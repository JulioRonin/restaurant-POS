import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSettings } from '../contexts/SettingsContext';
import { SubscriptionStatus } from '../types';
import { canAccess } from '../services/rbac';
import { onSyncStatusChange, getSyncStatus } from '../services/SyncService';
import { authService } from '../services/auth';
import { printerService } from '../services/PrinterService';
import { Logo } from './Logo';
import {
  Printer,
  Cloud,
  CloudCog,
  LayoutDashboard,
  Smartphone,
  Table2,
  Receipt,
  ChefHat,
  MenuSquare,
  CreditCard,
  FileText,
  Users,
  Boxes,
  Wine,
  Settings2,
  Lock,
  LogOut,
  MonitorCheck,
  Zap,
  ShieldCheck,
  RefreshCw,
  Globe2,
  Tv
} from 'lucide-react';

const PrinterStatus = () => {
  const { settings } = useSettings();
  const [connected, setConnected] = React.useState(printerService.isConnected());
  
  React.useEffect(() => {
    const interval = setInterval(() => {
        setConnected(printerService.isConnected());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleReconnect = () => {
     if (settings.connectedDeviceName && settings.connectedDeviceName !== 'None') {
        printerService.autoConnect(settings.connectedDeviceName);
     }
  };

  if (!settings.connectedDeviceName || settings.connectedDeviceName === 'None') return null;

  return (
    <button 
      onClick={handleReconnect}
      className={`transition-all active:scale-95 ${connected ? 'text-green-500' : 'text-red-500 animate-pulse'}`}
      title={connected ? 'Printer Active' : 'Printer Offline'}
    >
      <Printer size={18} />
    </button>
  );
};

const NavItem = ({ to, icon: Icon, label, isExpanded }: { to: string; icon: any; label: string; isExpanded: boolean }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center ${isExpanded ? 'px-4 gap-4 w-full mx-2' : 'justify-center w-12 mx-auto'} h-12 rounded-solaris my-1 transition-all duration-300 group relative ${isActive ? 'bg-[#C4633F] text-[#FAF8F4] shadow-[0_0_20px_rgba(196,99,63,0.4)] scale-105' : 'text-[#FAF8F4]/50 hover:bg-white/[0.08] hover:text-[#FAF8F4]'
      }`
    }
  >
    <Icon size={20} className="flex-shrink-0" />
    {isExpanded && (
      <span className={`font-black text-[9px] uppercase tracking-[0.3em] whitespace-nowrap transition-opacity duration-300`}>
        {label}
      </span>
    )}
  </NavLink>
);

const SyncBadge = () => {
  const [sync, setSync] = React.useState(getSyncStatus());
  
  React.useEffect(() => {
    const unsubscribe = onSyncStatusChange(setSync);
    return unsubscribe;
  }, []);

  const color = sync.pendingCount > 0 ? 'text-[#C4633F]' : sync.isSyncing ? 'text-white' : 'text-green-500/40';
  const Icon = sync.pendingCount > 0 ? CloudCog : sync.isSyncing ? RefreshCw : Cloud;
  
  return (
    <span 
      className={`transition-all ${color} ${sync.isSyncing ? 'animate-spin' : ''}`}
      title={sync.pendingCount > 0 ? `${sync.pendingCount} pending packets` : 'Node Sync OK'}
    >
      <Icon size={18} />
    </span>
  );
};

export const Sidebar: React.FC<{ onLock?: () => void }> = ({ onLock }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { activeEmployee, isSuperAdmin, signOut, authProfile, switchBusiness } = useUser();
  const { daysRemaining, status, isFeatureEnabled, meetsTier } = useSubscription();
  const { settings } = useSettings();

  /**
   * Module visibility — 3 capas combinadas:
   *
   *   1. RBAC (canAccess): el rol del empleado puede entrar a la ruta.
   *   2. Feature flag (SuperAdmin): apagado = oculto SIEMPRE (control global
   *      del equipo comercial ServiRest).
   *   3. Business tier: el plan comercial cubre este módulo por default.
   *
   * ── Override de tier ──────────────────────────────────────────────────
   * Cuando el SuperAdmin activa un feature explícitamente para un cliente,
   * ESE feature aparece aunque el plan del cliente no lo cubra por default.
   * Esto permite vender módulos "Prestige" (Canal digital, Reservas online,
   * etc.) como add-on a clientes Esencial/Profesional sin obligar al salto
   * de tier completo.
   *
   * Reglas efectivas:
   *   • Feature con toggle OFF → oculto.
   *   • Feature con toggle ON  → visible, no importa el tier.
   *   • Sin feature flag       → visible si el tier alcanza el mínimo.
   */
  const showModule = (path: string, feature: string | null, minTier: 'esencial' | 'profesional' | 'prestige' = 'esencial') => {
    if (!canAccess(activeEmployee, path)) return false;

    // El feature flag es control fuerte del SuperAdmin. OFF = oculto siempre.
    if (feature && !isFeatureEnabled(feature)) return false;

    // Si el feature está ON (o no aplica), el gate de tier solo se usa
    // cuando NO hay feature flag — el toggle explícito del SuperAdmin
    // sobreescribe el requisito de tier (add-on manual).
    if (!feature && !meetsTier(minTier)) return false;

    return true;
  };

  const statusConfig = {
    [SubscriptionStatus.ACTIVE]: { color: 'text-green-500 border-green-500/20 bg-green-500/5', label: 'ServiRest Activo' },
    [SubscriptionStatus.WARNING]: { color: 'text-[#C4633F] border-[#C4633F]/20 bg-[#C4633F]/5', label: 'Aviso de Licencia' },
    [SubscriptionStatus.EXPIRED]: { color: 'text-red-500 border-red-500/20 bg-red-500/5', label: 'Nodo Expirado' },
    [SubscriptionStatus.DEMO]: { color: 'text-amber-500 border-amber-500/20 bg-amber-500/5', label: 'Modo Demo' },
    [SubscriptionStatus.DEMO_EXPIRED]: { color: 'text-red-500 border-red-500/20 bg-red-500/5', label: 'Demo Expirada' },
    [SubscriptionStatus.DEBT_BLOCKED]: { color: 'text-red-500 border-red-500/20 bg-red-500/5', label: 'Bloqueado por Pago' },
  }[status] || { color: 'text-gray-500 border-gray-500/20 bg-gray-500/5', label: 'Unknown' };

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`hidden lg:flex ${isExpanded ? 'w-64' : 'w-24'} h-full flex-col py-8 z-50 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] relative shadow-[4px_0_30px_rgba(0,0,0,0.15)]`}
      style={{ background: 'linear-gradient(160deg, #1A1E2E 0%, #232839 60%, #1A1E2E 100%)' }}
    >
      {/* Brand Header */}
      <div className={`mb-12 p-2 flex flex-col items-center ${isExpanded ? 'px-8 w-full' : 'justify-center'}`}>
        <div className="flex items-center gap-4 mb-8">
          <PrinterStatus />
          <SyncBadge />
        </div>
        
        <div className="flex items-center gap-4 w-full group/header relative">
          <div className="w-12 h-12 min-w-[48px] bg-[#FAF8F4]/10 border border-[#FAF8F4]/20 rounded-solaris flex items-center justify-center overflow-hidden transition-all group-hover/header:border-[#C4633F]/50 shadow-koso-glow">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover filter contrast-125" />
            ) : (
              <Logo variant="midnight" size={32} showText={false} />
            )}
          </div>
          {isExpanded && (
            <div className="flex-1 overflow-hidden">
               <div className="flex items-center justify-between">
                <h1 className="font-serif text-white font-medium leading-tight uppercase tracking-tighter text-sm truncate italic" style={{ fontFamily: '"Fraunces", Georgia, serif' }}>ServiRest</h1>
                {isSuperAdmin && (
                   <button 
                     onClick={async () => {
                       const businesses = await authService.getAllBusinesses();
                       const selection = window.prompt("Node ID:", "");
                       if (selection) {
                          const match = businesses.find((b: any) => b.id === selection);
                          if (match) switchBusiness(match.id, match.name);
                       }
                     }}
                     className="text-[#C4633F] hover:text-white p-1 hover:bg-white/5 rounded-full transition-colors hidden group-hover/header:block"
                   >
                     <RefreshCw size={12} />
                   </button>
                )}
               </div>
               <p className="text-[8px] text-[#C9A24A]/70 font-black uppercase tracking-[0.4em] mt-1 italic">POS Restaurante</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 flex flex-col w-full px-3 overflow-y-auto no-scrollbar gap-0.5">
        {/* ─── Operación diaria (todos los tiers) ─────────────────────── */}
        {showModule('/dashboard', 'dashboard')        && <NavItem to="/dashboard"    icon={LayoutDashboard} label="Dashboard"     isExpanded={isExpanded} />}
        {showModule('/pos',       'pos')              && <NavItem to="/pos"          icon={Zap}             label="POS"           isExpanded={isExpanded} />}
        {showModule('/my-tables', 'tables')           && <NavItem to="/my-tables"    icon={Table2}          label="Mis mesas"     isExpanded={isExpanded} />}
        {showModule('/cashier',   'cashier')          && <NavItem to="/cashier"      icon={Receipt}         label="Caja"          isExpanded={isExpanded} />}
        {showModule('/menu',      'menu_admin')       && <NavItem to="/menu"         icon={MenuSquare}      label="Menú"          isExpanded={isExpanded} />}

        {/* ─── Profesional+ ─────────────────────────────────────── */}
        {showModule('/hostess',      'hostess',      'profesional') && <NavItem to="/hostess"      icon={MonitorCheck} label="Hostess"       isExpanded={isExpanded} />}
        {showModule('/kitchen',      'kitchen',      'profesional') && <NavItem to="/kitchen"      icon={ChefHat}      label="Cocina (KDS)"  isExpanded={isExpanded} />}
        {showModule('/bar',          'bar',          'profesional') && <NavItem to="/bar"          icon={Wine}         label="Bar"           isExpanded={isExpanded} />}
        {showModule('/remote-order', 'remote_order', 'profesional') && <NavItem to="/remote-order" icon={Smartphone}   label="Orden remota"  isExpanded={isExpanded} />}
        {showModule('/invoice',      'cfdi',         'profesional') && <NavItem to="/invoice"      icon={FileText}     label="Facturación"   isExpanded={isExpanded} />}
        {showModule('/digital-channel', 'online_ordering', 'prestige') && <NavItem to="/digital-channel" icon={Globe2}  label="Canal digital" isExpanded={isExpanded} />}
        {showModule('/kiosk',           'kiosk_mode',       'prestige') && <NavItem to="/kiosk"           icon={Tv}      label="Vista Kiosko"  isExpanded={isExpanded} />}

        {/* ─── Administración (todos los tiers) ──────────────────────── */}
        <div className={`h-px my-4 ${isExpanded ? 'w-full' : 'w-8 mx-auto'}`} style={{ background: 'rgba(250,248,244,0.10)' }} />

        {showModule('/staff',     'staff')     && <NavItem to="/staff"     icon={Users} label="Personal"   isExpanded={isExpanded} />}
        {showModule('/inventory', 'inventory') && <NavItem to="/inventory" icon={Boxes} label="Inventario" isExpanded={isExpanded} />}
        {showModule('/billing',   null)        && <NavItem to="/billing"   icon={CreditCard} label="Membresía"  isExpanded={isExpanded} />}

        {isSuperAdmin && (
          <NavItem to="/super-admin" icon={ShieldCheck} label="Super Admin" isExpanded={isExpanded} />
        )}

        {isExpanded && (
          <div className="px-4 mt-12 mb-6">
             <NavLink to="/billing" className={`block p-5 rounded-solaris border ${statusConfig.color} backdrop-blur-3xl relative overflow-hidden hover:scale-[1.02] transition-all cursor-pointer group/sub`}>
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-3">
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-60 italic">Estado del Nodo</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></div>
                    </div>
                    <div className="text-2xl font-black italic tracking-tighter text-white">{daysRemaining}D</div>
                    <div className="flex items-center justify-between mt-1">
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{statusConfig.label}</p>
                        <CreditCard size={12} className="opacity-0 group-hover/sub:opacity-100 transition-opacity" />
                    </div>
                </div>
                <div className="absolute top-0 right-0 w-full h-full bg-white/[0.02] pointer-events-none"></div>
             </NavLink>
          </div>
        )}

        {canAccess(activeEmployee, '/settings') && (
          <NavItem to="/settings" icon={Settings2} label="Ajustes" isExpanded={isExpanded} />
        )}
      </nav>

      {/* Network Operator Status */}
      <div className="w-full px-4 py-6 mt-auto" style={{ borderTop: '1px solid rgba(250,248,244,0.1)', background: 'rgba(0,0,0,0.15)' }}>
        <div 
          className="flex items-center justify-between group cursor-pointer bg-white/[0.02] p-4 rounded-solaris border border-white/5 hover:border-[#C4633F]/20 transition-all shadow-xl" 
          onClick={onLock}
        >
           <div className="flex items-center gap-4 overflow-hidden">
              <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10 shadow-lg flex-shrink-0">
                <img src={activeEmployee?.image} alt={activeEmployee?.name} className="w-full h-full object-cover filter contrast-125 grayscale group-hover:grayscale-0 transition-all" />
              </div>
              {isExpanded && (
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-white truncate italic leading-none">{activeEmployee?.name}</p>
                  <p className="text-[8px] font-black uppercase text-[#C9A24A] tracking-widest mt-2">{activeEmployee?.role}</p>
                </div>
              )}
           </div>
           {isExpanded && <Lock size={14} className="text-white/20 group-hover:text-[#C4633F] transition-colors" />}
        </div>
        
        {authProfile?.role === 'admin' && isExpanded && (
            <button
                onClick={signOut}
                className="mt-6 flex items-center justify-center gap-3 w-full py-4 text-white/30 hover:text-red-500 transition-colors uppercase font-black text-[9px] tracking-[0.3em] border border-white/5 rounded-2xl hover:bg-red-500/5 hover:border-red-500/20"
            >
                <LogOut size={14} /> Salir
            </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
