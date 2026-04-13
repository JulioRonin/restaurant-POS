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
import { 
  Printer, 
  Cloud, 
  CloudOff, 
  CloudCog, 
  LayoutDashboard, 
  Smartphone, 
  Table2, 
  Receipt, 
  ChefHat, 
  MenuSquare, 
  CreditCard, 
  Users, 
  Boxes, 
  Wine, 
  Settings2, 
  Rocket, 
  Lock, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  MonitorCheck
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
      className={`transition-all active:scale-95 ${connected ? 'text-emerald-500' : 'text-red-500 animate-pulse'}`}
      title={connected ? 'Impresora Conectada' : 'Impresora Desconectada (Clic para reconectar)'}
    >
      <Printer size={18} />
    </button>
  );
};

const NavItem = ({ to, icon: Icon, label, isExpanded }: { to: string; icon: any; label: string; isExpanded: boolean }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center ${isExpanded ? 'px-4 gap-4 w-full mx-2' : 'justify-center w-12 mx-auto'} h-12 rounded-2xl my-1.5 transition-all duration-300 group relative ${isActive ? 'bg-solaris-orange text-white shadow-solaris-glow' : 'text-gray-500 hover:bg-white/[0.05] hover:text-white'
      }`
    }
  >
    <Icon size={20} className="flex-shrink-0" />
    {isExpanded && (
      <span className={`font-black text-[10px] uppercase tracking-[0.2em] whitespace-nowrap transition-opacity duration-300`}>
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

  const color = sync.pendingCount > 0 ? 'text-amber-500' : sync.isSyncing ? 'text-solaris-orange' : 'text-emerald-500';
  const Icon = sync.pendingCount > 0 ? CloudCog : sync.isSyncing ? RefreshCw : Cloud;
  
  return (
    <span 
      className={`${color} ${sync.isSyncing ? 'animate-spin' : ''}`}
      title={sync.pendingCount > 0 ? `${sync.pendingCount} cambios pendientes` : 'Todo sincronizado'}
    >
      <Icon size={18} />
    </span>
  );
};

export const Sidebar: React.FC<{ onLock?: () => void }> = ({ onLock }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { activeEmployee, isSuperAdmin, signOut, authProfile, switchBusiness } = useUser();
  const { daysRemaining, status, isFeatureEnabled } = useSubscription();
  const { settings } = useSettings();

  const statusConfig = {
    [SubscriptionStatus.ACTIVE]: { color: 'text-emerald-500 bg-emerald-500/5 border-emerald-500/20', label: 'Solaris Active' },
    [SubscriptionStatus.WARNING]: { color: 'text-amber-500 bg-amber-500/5 border-amber-500/20', label: 'Vencimiento' },
    [SubscriptionStatus.EXPIRED]: { color: 'text-red-500 bg-red-500/5 border-red-500/20', label: 'Vencida' },
  }[status];

  return (
    <aside
      className={`${isExpanded ? 'w-64' : 'w-24'} h-full bg-solaris-black flex flex-col items-center py-6 z-50 border-r border-white/5 transition-all duration-500 ease-in-out relative`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3.5 top-12 bg-solaris-black border border-white/10 w-7 h-7 rounded-full flex items-center justify-center shadow-2xl text-gray-500 hover:text-solaris-orange z-50 transition-all"
      >
        {isExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Brand Header */}
      <div className={`mb-8 p-2 flex flex-col items-center ${isExpanded ? 'px-6 w-full' : 'justify-center'}`}>
        <div className="flex items-center gap-3 mb-4">
          <PrinterStatus />
          <SyncBadge />
        </div>
        
        <div className="flex items-center gap-4 w-full group/header relative">
          <div className="w-12 h-12 min-w-[48px] bg-solaris-orange rounded-solaris flex items-center justify-center shadow-solaris-glow overflow-hidden border border-white/10">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <ChefHat className="text-white" size={24} />
            )}
          </div>
          {isExpanded && (
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between">
                <h1 className="font-black text-white leading-tight uppercase tracking-tighter text-xs truncate italic">{settings.name}</h1>
                {isSuperAdmin && (
                   <button 
                     onClick={async () => {
                       const businesses = await authService.getAllBusinesses();
                       const selection = window.prompt("ID Negocio:", "");
                       if (selection) {
                          const match = businesses.find((b: any) => b.id === selection);
                          if (match) switchBusiness(match.id, match.name);
                       }
                     }}
                     className="text-solaris-orange hover:text-white p-1 hover:bg-white/5 rounded-full transition-colors hidden group-hover/header:block"
                   >
                     <RefreshCw size={12} />
                   </button>
                )}
              </div>
              <p className="text-[8px] text-solaris-orange font-bold uppercase tracking-[0.3em] mt-0.5">Solaris Core</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 flex flex-col w-full px-3 overflow-y-auto custom-scrollbar space-y-1">
        {canAccess(activeEmployee?.role, '/dashboard') && (
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" isExpanded={isExpanded} />
        )}
        
        {canAccess(activeEmployee?.role, '/pos') && (
          <NavItem to="/pos" icon={Smartphone} label="Venta Rápida" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/my-tables') && (
          <NavItem to="/my-tables" icon={Table2} label="Mis Mesas" isExpanded={isExpanded} />
        )}

        {(canAccess(activeEmployee?.role, '/remote-order')) && (isFeatureEnabled('remote_order') || isSuperAdmin) && (
          <NavItem to="/remote-order" icon={Smartphone} label="Orden Móvil" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/hostess') && (
          <NavItem to="/hostess" icon={MonitorCheck} label="Anfitrión" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/cashier') && (
          <NavItem to="/cashier" icon={Receipt} label="Modulo Caja" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/kitchen') && (
          <NavItem to="/kitchen" icon={ChefHat} label="Cocina" isExpanded={isExpanded} />
        )}
        
        {canAccess(activeEmployee?.role, '/menu') && (
          <NavItem to="/menu" icon={MenuSquare} label="Menú Mix" isExpanded={isExpanded} />
        )}
        
        {canAccess(activeEmployee?.role, '/billing') && (
          <NavItem to="/billing" icon={CreditCard} label="Membresía" isExpanded={isExpanded} />
        )}

        <div className={`h-px bg-white/5 my-4 ${isExpanded ? 'w-full' : 'w-10 mx-auto'}`}></div>

        {canAccess(activeEmployee?.role, '/staff') && (
          <NavItem to="/staff" icon={Users} label="Equipo" isExpanded={isExpanded} />
        )}
        
        {canAccess(activeEmployee?.role, '/inventory') && (
          <NavItem to="/inventory" icon={Boxes} label="Almacén" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/bar') && (
          <NavItem to="/bar" icon={Wine} label="Monitor Bar" isExpanded={isExpanded} />
        )}

        {isSuperAdmin && (
          <>
            <div className={`h-px bg-solaris-orange/20 my-4 ${isExpanded ? 'w-full' : 'w-10 mx-auto'}`}></div>
            <NavItem to="/super-admin" icon={ShieldCheck} label="Solaris Root" isExpanded={isExpanded} />
          </>
        )}

        {isExpanded && (
          <div className="px-3 mt-8 mb-4">
             <div className={`p-4 rounded-3xl border ${statusConfig.color} backdrop-blur-md`}>
                <div className="flex justify-between items-center mb-2">
                   <span className="text-[8px] font-black uppercase tracking-widest opacity-60">Status</span>
                   <div className="w-1.5 h-1.5 rounded-full bg-current animate-ping"></div>
                </div>
                <div className="text-xl font-black italic">{daysRemaining}</div>
                <p className="text-[9px] font-bold uppercase tracking-tighter mt-1">{statusConfig.label}</p>
             </div>
          </div>
        )}

        {canAccess(activeEmployee?.role, '/settings') && (
          <NavItem to="/settings" icon={Settings2} label="Ajustes" isExpanded={isExpanded} />
        )}
        
        {authProfile?.role === 'admin' && !authProfile.onboardingCompleted && (
          <NavItem to="/onboarding" icon={Rocket} label="Setup Solaris" isExpanded={isExpanded} />
        )}
      </nav>

      {/* Network & Footer */}
      <div className="w-full px-6 py-6 border-t border-white/5 mt-auto">
        <div className="flex items-center justify-between group cursor-pointer" onClick={onLock}>
           <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-2xl overflow-hidden border border-white/10 shadow-lg flex-shrink-0 group-hover:border-solaris-orange/50 transition-all">
                <img src={activeEmployee?.image} alt={activeEmployee?.name} className="w-full h-full object-cover" />
              </div>
              {isExpanded && (
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-white truncate leading-none italic">{activeEmployee?.name}</p>
                  <p className="text-[8px] font-bold uppercase text-solaris-orange tracking-[0.2em] mt-1.5">{activeEmployee?.role}</p>
                </div>
              )}
           </div>
           {isExpanded && <Lock size={14} className="text-gray-600 group-hover:text-solaris-orange transition-colors" />}
        </div>
      </div>

      {authProfile?.role === 'admin' && isExpanded && (
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-8 py-4 text-gray-700 hover:text-red-500 transition-colors border-t border-white/5"
        >
          <LogOut size={16} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Root Logout</span>
        </button>
      )}

    </aside>
  );
};

const RefreshCw = ({ size, className }: { size: number, className?: string }) => (
    <svg 
        width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
        className={className}
    >
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />
    </svg>
);