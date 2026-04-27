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
  MonitorCheck,
  Zap,
  ShieldCheck
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
      `flex items-center ${isExpanded ? 'px-4 gap-4 w-full mx-2' : 'justify-center w-12 mx-auto'} h-12 rounded-solaris my-1 transition-all duration-300 group relative ${isActive ? 'bg-[#F98359] text-white shadow-[0_0_20px_rgba(249,131,89,0.4)] scale-105' : 'text-[#FAFAF3]/50 hover:bg-white/[0.08] hover:text-[#FAFAF3]'
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

  const color = sync.pendingCount > 0 ? 'text-[#F98359]' : sync.isSyncing ? 'text-white' : 'text-green-500/40';
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
  const { daysRemaining, status, isFeatureEnabled } = useSubscription();
  const { settings } = useSettings();

  const statusConfig = {
    [SubscriptionStatus.ACTIVE]: { color: 'text-green-500 border-green-500/20 bg-green-500/5', label: 'KOSO Activo' },
    [SubscriptionStatus.WARNING]: { color: 'text-[#F98359] border-[#F98359]/20 bg-[#F98359]/5', label: 'License Warning' },
    [SubscriptionStatus.EXPIRED]: { color: 'text-red-500 border-red-500/20 bg-red-500/5', label: 'Node Expired' },
    [SubscriptionStatus.DEMO]: { color: 'text-amber-500 border-amber-500/20 bg-amber-500/5', label: 'Demo Mode' },
    [SubscriptionStatus.DEMO_EXPIRED]: { color: 'text-red-500 border-red-500/20 bg-red-500/5', label: 'Demo Expired' },
    [SubscriptionStatus.DEBT_BLOCKED]: { color: 'text-red-500 border-red-500/20 bg-red-500/5', label: 'Debt Blocked' },
  }[status] || { color: 'text-gray-500 border-gray-500/20 bg-gray-500/5', label: 'Unknown' };

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      className={`hidden lg:flex ${isExpanded ? 'w-64' : 'w-24'} h-full flex-col py-8 z-50 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] relative shadow-[4px_0_30px_rgba(0,0,0,0.15)]`}
      style={{ background: 'linear-gradient(160deg, #505530 0%, #3d4124 60%, #2e3018 100%)' }}
    >
      {/* Brand Header */}
      <div className={`mb-12 p-2 flex flex-col items-center ${isExpanded ? 'px-8 w-full' : 'justify-center'}`}>
        <div className="flex items-center gap-4 mb-8">
          <PrinterStatus />
          <SyncBadge />
        </div>
        
        <div className="flex items-center gap-4 w-full group/header relative">
          <div className="w-12 h-12 min-w-[48px] bg-[#505530]/20 border border-[#505530]/40 rounded-solaris flex items-center justify-center overflow-hidden transition-all group-hover/header:border-[#F98359]/50 shadow-koso-glow">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover filter contrast-125" />
            ) : (
              <img src="/koso-logo.png" alt="KŌSO" className="w-full h-full object-cover" />
            )}
          </div>
          {isExpanded && (
            <div className="flex-1 overflow-hidden">
               <div className="flex items-center justify-between">
                <h1 className="font-black text-white leading-tight uppercase tracking-tighter text-xs truncate italic">KŌSO POS</h1>
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
                     className="text-[#F98359] hover:text-white p-1 hover:bg-white/5 rounded-full transition-colors hidden group-hover/header:block"
                   >
                     <RefreshCw size={12} />
                   </button>
                )}
               </div>
               <p className="text-[8px] text-[#F98359]/50 font-black uppercase tracking-[0.4em] mt-1 italic">Restaurant POS</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 flex flex-col w-full px-3 overflow-y-auto no-scrollbar space-y-1">
        {canAccess(activeEmployee?.role, '/dashboard') && isFeatureEnabled('dashboard') && (
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Network Hub" isExpanded={isExpanded} />
        )}
        
        {canAccess(activeEmployee?.role, '/pos') && isFeatureEnabled('pos') && (
          <NavItem to="/pos" icon={Zap} label="Quantum POS" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/my-tables') && isFeatureEnabled('tables') && (
          <NavItem to="/my-tables" icon={Table2} label="Matrix Tables" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/hostess') && isFeatureEnabled('hostess') && (
          <NavItem to="/hostess" icon={MonitorCheck} label="Host Logic" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/cashier') && isFeatureEnabled('cashier') && (
          <NavItem to="/cashier" icon={Receipt} label="Terminal Pay" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/kitchen') && isFeatureEnabled('kitchen') && (
          <NavItem to="/kitchen" icon={ChefHat} label="Kitchen Ops" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/bar') && isFeatureEnabled('bar') && (
          <NavItem to="/bar" icon={Wine} label="Bar System" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/remote-order') && isFeatureEnabled('remote_order') && (
          <NavItem to="/remote-order" icon={Smartphone} label="Remote Order" isExpanded={isExpanded} />
        )}
        
        {canAccess(activeEmployee?.role, '/menu') && isFeatureEnabled('menu_admin') && (
          <NavItem to="/menu" icon={MenuSquare} label="Asset Grid" isExpanded={isExpanded} />
        )}

        <div className={`h-px my-5 ${isExpanded ? 'w-full' : 'w-8 mx-auto'}`} style={{ background: 'rgba(250,250,243,0.1)' }}></div>

        {canAccess(activeEmployee?.role, '/staff') && isFeatureEnabled('staff') && (
          <NavItem to="/staff" icon={Users} label="Personnel" isExpanded={isExpanded} />
        )}
        
        {canAccess(activeEmployee?.role, '/inventory') && isFeatureEnabled('inventory') && (
          <NavItem to="/inventory" icon={Boxes} label="Supply Flow" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/billing') && (
          <NavItem to="/billing" icon={CreditCard} label="Membership" isExpanded={isExpanded} />
        )}

        {isSuperAdmin && (
          <NavItem to="/super-admin" icon={ShieldCheck} label="Admin Root" isExpanded={isExpanded} />
        )}

        {isExpanded && (
          <div className="px-4 mt-12 mb-6">
             <NavLink to="/billing" className={`block p-5 rounded-solaris border ${statusConfig.color} backdrop-blur-3xl relative overflow-hidden hover:scale-[1.02] transition-all cursor-pointer group/sub`}>
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-3">
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-60 italic">Node Status</span>
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

        {canAccess(activeEmployee?.role, '/settings') && (
          <NavItem to="/settings" icon={Settings2} label="Core Adjust" isExpanded={isExpanded} />
        )}
      </nav>

      {/* Network Operator Status */}
      <div className="w-full px-4 py-6 mt-auto" style={{ borderTop: '1px solid rgba(250,250,243,0.1)', background: 'rgba(0,0,0,0.15)' }}>
        <div 
          className="flex items-center justify-between group cursor-pointer bg-white/[0.02] p-4 rounded-solaris border border-white/5 hover:border-[#F98359]/20 transition-all shadow-xl" 
          onClick={onLock}
        >
           <div className="flex items-center gap-4 overflow-hidden">
              <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10 shadow-lg flex-shrink-0">
                <img src={activeEmployee?.image} alt={activeEmployee?.name} className="w-full h-full object-cover filter contrast-125 grayscale group-hover:grayscale-0 transition-all" />
              </div>
              {isExpanded && (
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-white truncate italic leading-none">{activeEmployee?.name}</p>
                  <p className="text-[8px] font-black uppercase text-[#F98359] tracking-widest mt-2">{activeEmployee?.role}</p>
                </div>
              )}
           </div>
           {isExpanded && <Lock size={14} className="text-white/20 group-hover:text-[#F98359] transition-colors" />}
        </div>
        
        {authProfile?.role === 'admin' && isExpanded && (
            <button
                onClick={signOut}
                className="mt-6 flex items-center justify-center gap-3 w-full py-4 text-white/30 hover:text-red-500 transition-colors uppercase font-black text-[9px] tracking-[0.3em] border border-white/5 rounded-2xl hover:bg-red-500/5 hover:border-red-500/20"
            >
                <LogOut size={14} /> Exit Core
            </button>
        )}
      </div>
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
