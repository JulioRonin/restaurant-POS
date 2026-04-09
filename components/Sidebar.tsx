import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useSettings } from '../contexts/SettingsContext';
import { SubscriptionStatus } from '../types';
import { NetworkStatus } from './NetworkStatus';
import { canAccess } from '../services/rbac';
import { onSyncStatusChange, getSyncStatus } from '../services/SyncService';
import { authService } from '../services/auth';
import { printerService } from '../services/PrinterService';

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
      className={`material-icons-round text-lg transition-all active:scale-95 ${connected ? 'text-emerald-500' : 'text-red-500 animate-pulse'}`}
      title={connected ? 'Impresora Conectada' : 'Impresora Desconectada (Clic para reconectar)'}
    >
      print
    </button>
  );
};

const NavItem = ({ to, icon, label, isExpanded, activeIcon }: { to: string; icon: string; label: string; isExpanded: boolean; activeIcon?: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center ${isExpanded ? 'px-4 gap-4 w-full mx-2' : 'justify-center w-12 mx-auto'} h-12 rounded-xl my-2 transition-all duration-300 group relative ${isActive ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-gray-400 hover:bg-gray-100 hover:text-primary'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <span
          className={`material-icons-round text-xl transition-colors duration-300`}
        >
          {isActive && activeIcon ? activeIcon : icon}
        </span>

        {isExpanded && (
          <span className={`font-semibold text-sm whitespace-nowrap transition-opacity duration-300 ${isActive ? 'text-white' : 'text-gray-600 group-hover:text-primary'}`}>
            {label}
          </span>
        )}
      </>
    )}
  </NavLink>
);

const SyncBadge = () => {
  const [sync, setSync] = React.useState(getSyncStatus());
  
  React.useEffect(() => {
    const unsubscribe = onSyncStatusChange(setSync);
    return unsubscribe;
  }, []);

  const color = sync.pendingCount > 0 ? 'text-amber-500' : sync.isSyncing ? 'text-blue-500' : 'text-emerald-500';
  const icon = sync.pendingCount > 0 ? 'cloud_upload' : sync.isSyncing ? 'cached' : 'cloud_done';
  
  return (
    <span 
      className={`material-icons-round text-lg ${color} ${sync.isSyncing ? 'animate-spin' : ''}`}
      title={sync.pendingCount > 0 ? `${sync.pendingCount} cambios pendientes` : 'Todo sincronizado'}
    >
      {icon}
    </span>
  );
};

export const Sidebar: React.FC<{ onLock?: () => void }> = ({ onLock }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { activeEmployee, isSuperAdmin, signOut, authProfile, switchBusiness } = useUser();
  const { daysRemaining, status, isFeatureEnabled } = useSubscription();
  const { settings } = useSettings();

  const statusConfig = {
    [SubscriptionStatus.ACTIVE]: { color: 'text-primary bg-primary/5 border-primary/20', label: 'Activa' },
    [SubscriptionStatus.WARNING]: { color: 'text-orange-500 bg-orange-50 border-orange-200', label: 'Vencimiento' },
    [SubscriptionStatus.EXPIRED]: { color: 'text-red-500 bg-red-50 border-red-200', label: 'Vencida' },
  }[status];

  return (
    <aside
      className={`${isExpanded ? 'w-64' : 'w-20'} h-full bg-white flex flex-col items-center py-6 z-50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out relative`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-10 bg-white border border-gray-100 w-6 h-6 rounded-full flex items-center justify-center shadow-lg text-gray-400 hover:text-primary z-50 cursor-pointer"
      >
        <span className="material-icons-round text-sm">{isExpanded ? 'chevron_left' : 'chevron_right'}</span>
      </button>

      <div className={`mb-4 p-2 flex flex-col items-center ${isExpanded ? 'px-6 w-full' : 'justify-center'}`}>
          <div className="flex items-center gap-1.5 mb-2">
            <PrinterStatus />
            <SyncBadge />
          </div>
        <div className="flex items-center gap-3 w-full group/header relative">
          <div className="w-10 h-10 min-w-[40px] bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden border border-white/20">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="material-icons-round text-white text-xl">restaurant</span>
            )}
          </div>
          {isExpanded && (
            <div className="flex-1 overflow-hidden whitespace-nowrap">
              <div className="flex items-center justify-between">
                <h1 className="font-black text-gray-900 leading-tight uppercase tracking-tight text-xs truncate">{settings.name}</h1>
                {isSuperAdmin && (
                   <button 
                     onClick={async () => {
                       const businesses = await authService.getAllBusinesses();
                       const selection = window.prompt(
                         "Seleccione el ID del negocio al que desea cambiar:\n\n" + 
                         businesses.map((b: any) => `${b.id}: ${b.name}`).join('\n')
                       );
                       if (selection) {
                         const match = businesses.find((b: any) => b.id === selection || b.name === selection);
                         if (match) {
                           switchBusiness(match.id, match.name);
                         } else {
                           alert("Negocio no encontrado.");
                         }
                       }
                     }}
                     className="material-icons-round text-[14px] text-primary hover:text-primary-dark ml-1 p-1 hover:bg-primary/10 rounded-full transition-colors hidden group-hover/header:block"
                     title="Cambiar de Negocio (ADMIN)"
                   >
                     swap_horiz
                   </button>
                )}
              </div>
              <p className="text-[9px] text-primary font-bold uppercase tracking-widest">Sucursal Principal</p>
            </div>
          )}
        </div>
      </div>

      {/* Culinex OS Branding Footer-style in Logo Area */}
      <div className={`mb-8 w-full flex items-center ${isExpanded ? 'px-6' : 'justify-center opacity-0 h-0 overflow-hidden'}`}>
        <div className="py-2 border-t border-gray-100 w-full">
            <h2 className="font-black text-[11px] text-gray-400 leading-none uppercase tracking-[0.2em]">Culinex POS</h2>
            <p className="text-[8px] text-gray-300 font-bold uppercase tracking-widest mt-1">By Ronin Studio</p>
        </div>
      </div>

      <nav className="flex-1 flex flex-col w-full px-2 overflow-y-auto custom-scrollbar">
        {canAccess(activeEmployee?.role, '/dashboard') && (
          <NavItem to="/dashboard" icon="dashboard" label="Dashboard" isExpanded={isExpanded} />
        )}
        
        {canAccess(activeEmployee?.role, '/pos') && (
          <NavItem to="/pos" icon="point_of_sale" label="Point of Sale" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/my-tables') && (
          <NavItem to="/my-tables" icon="table_bar" label="Mis Mesas" isExpanded={isExpanded} />
        )}

        {(canAccess(activeEmployee?.role, '/remote-order')) && (isFeatureEnabled('remote_order') || isSuperAdmin) && (
          <NavItem to="/remote-order" icon="tablet_mac" label="Orden Remota" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/hostess') && (
          <NavItem to="/hostess" icon="table_restaurant" label="Hostess / Floor" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/cashier') && (
          <NavItem to="/cashier" icon="receipt_long" label="Caja (Billing)" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/kitchen') && (
          <NavItem to="/kitchen" icon="soup_kitchen" label="Kitchen Display" isExpanded={isExpanded} />
        )}
        
        {canAccess(activeEmployee?.role, '/menu') && (
          <NavItem to="/menu" icon="restaurant_menu" label="Menú (Admin)" isExpanded={isExpanded} />
        )}
        
        {canAccess(activeEmployee?.role, '/billing') && (
          <NavItem to="/billing" icon="credit_card" label="Membresía" isExpanded={isExpanded} />
        )}

        <div className={`w-8 h-px bg-gray-200 my-4 ${isExpanded ? 'w-full px-4' : 'mx-auto'}`}></div>

        {canAccess(activeEmployee?.role, '/staff') && (
          <NavItem to="/staff" icon="badge" label="Staff & Schedule" isExpanded={isExpanded} />
        )}
        
        {canAccess(activeEmployee?.role, '/inventory') && (
          <NavItem to="/inventory" icon="inventory_2" label="Inventory" isExpanded={isExpanded} />
        )}

        {canAccess(activeEmployee?.role, '/bar') && (
          <NavItem to="/bar" icon="local_bar" label="Monitor de Bar" isExpanded={isExpanded} />
        )}

        {isSuperAdmin && (
          <>
            <div className={`w-8 h-px bg-blue-200 my-4 ${isExpanded ? 'w-full px-4' : 'mx-auto'}`}></div>
            <NavItem to="/super-admin" icon="admin_panel_settings" label="Platform Admin" isExpanded={isExpanded} />
          </>
        )}

        <div className={`w-8 h-px bg-gray-200 my-4 ${isExpanded ? 'w-full px-4' : 'mx-auto'}`}></div>

        {isExpanded && (
          <div className="px-4 mb-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Suscripción</p>
            <div className={`p-3 rounded-xl border ${statusConfig.color} transition-colors`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[9px] font-bold uppercase">Días Restantes</span>
                <span className="material-icons-round text-xs">history</span>
              </div>
              <div className="text-lg font-black">{daysRemaining}</div>
              <div className="text-[10px] font-bold opacity-80">Licencia {statusConfig.label}</div>
            </div>
          </div>
        )}

        {canAccess(activeEmployee?.role, '/settings') && (
          <NavItem to="/settings" icon="settings" label="Settings" isExpanded={isExpanded} />
        )}
        
        {authProfile?.role === 'admin' && !authProfile.onboardingCompleted && (
          <div className="relative">
            <NavItem to="/onboarding" icon="rocket_launch" label="Configuración Inicial" isExpanded={isExpanded} />
            {!authProfile.onboardingCompleted && (
              <div className={`absolute top-2 ${isExpanded ? 'right-4' : 'right-4'} w-2 h-2 bg-red-500 rounded-full animate-pulse border border-white`}></div>
            )}
          </div>
        )}
      </nav>

      {/* Network & Sync Status */}
      {isExpanded ? (
        <div className="w-full px-6 mb-2">
            <NetworkStatus />
        </div>
      ) : (
        <div className="mb-2 w-full flex flex-col items-center gap-2">
          {/* Internet Status */}
          <div 
            className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${navigator.onLine ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} 
            title={navigator.onLine ? 'Conectado a Internet' : 'Sin Internet'}
          ></div>
          
          {/* Sync status: Only show if online */}
          {navigator.onLine && <SyncBadge />}
        </div>
      )}

      {/* Active Employee Profile */}
      {activeEmployee && (
        <div className={`mb-4 w-full px-2 ${isExpanded ? 'px-4' : ''}`}>
          <div className={`flex items-center gap-3 p-2 rounded-2xl bg-gray-50 border border-gray-100 ${isExpanded ? '' : 'justify-center cursor-help'}`} title={!isExpanded ? `${activeEmployee.name} (${activeEmployee.role})` : ''}>
            <div className="w-8 h-8 rounded-xl overflow-hidden border-2 border-white shadow-sm flex-shrink-0">
              <img src={activeEmployee.image} alt={activeEmployee.name} className="w-full h-full object-cover" />
            </div>
            {isExpanded && (
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase text-gray-900 truncate tracking-tight">{activeEmployee.name}</p>
                <p className="text-[8px] font-bold uppercase text-primary tracking-widest">{activeEmployee.role}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 w-full px-2 space-y-2">
        <button
          onClick={onLock}
          className={`flex items-center ${isExpanded ? 'px-4 gap-4 w-full' : 'justify-center w-10 mx-auto'} h-10 rounded-xl hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors group`}
          title="Bloquear Estación"
        >
          <span className="material-icons-round text-xl">lock_open</span>
          {isExpanded && <span className="font-semibold text-sm whitespace-nowrap">Bloquear Acceso</span>}
        </button>

        {authProfile?.role === 'admin' && (
          <button
            onClick={signOut}
            className={`flex items-center ${isExpanded ? 'px-4 gap-4 w-full' : 'justify-center w-10 mx-auto'} h-10 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors group`}
            title="Cerrar Sesión"
          >
            <span className="material-icons-round text-xl">logout</span>
            {isExpanded && <span className="font-semibold text-sm whitespace-nowrap">Cerrar Sesión</span>}
          </button>
        )}
      </div>

    </aside>
  );
};