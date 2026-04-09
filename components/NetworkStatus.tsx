import React from 'react';
import { useSync } from '../contexts/SyncContext';

export const NetworkStatus: React.FC = () => {
  const { isOnline, isSyncing, pendingCount, lastSyncTime, syncError, triggerSync } = useSync();

  const getStatusConfig = () => {
    if (syncError) {
      return {
        bg: 'bg-red-50 border-red-200',
        dot: 'bg-red-500',
        text: 'Error de Sync',
        detail: syncError,
        icon: 'error_outline',
        textColor: 'text-red-600',
      };
    }
    if (!isOnline) {
      return {
        bg: 'bg-amber-50 border-amber-200',
        dot: 'bg-amber-500 animate-pulse',
        text: 'Modo Offline',
        detail: pendingCount > 0 ? `${pendingCount} cambios pendientes` : 'Datos locales activos',
        icon: 'cloud_off',
        textColor: 'text-amber-700',
      };
    }
    if (isSyncing) {
      return {
        bg: 'bg-blue-50 border-blue-200',
        dot: 'bg-blue-500 animate-pulse',
        text: 'Sincronizando...',
        detail: `${pendingCount} pendientes`,
        icon: 'sync',
        textColor: 'text-blue-600',
      };
    }
    return {
      bg: 'bg-green-50 border-green-200',
      dot: 'bg-green-500',
      text: 'Conectado',
      detail: lastSyncTime ? `Último sync: ${lastSyncTime.toLocaleTimeString()}` : 'Listo para sincronizar',
      icon: 'cloud_done',
      textColor: 'text-green-600',
    };
  };

  const config = getStatusConfig();

  return (
    <div className={`mx-3 mb-3 p-3 rounded-xl border ${config.bg} transition-all duration-300`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${config.dot} shrink-0`}></div>
        <span className={`material-icons-round text-sm ${config.textColor}`}>{config.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-black uppercase tracking-wider ${config.textColor} leading-none`}>{config.text}</p>
          <p className="text-[9px] text-gray-400 font-bold truncate mt-0.5">{config.detail}</p>
        </div>
        {(syncError || (!isOnline && pendingCount > 0)) && (
          <button 
            onClick={triggerSync}
            className={`p-1.5 rounded-lg ${config.textColor} hover:bg-white/50 transition-colors`}
            title="Reintentar sincronización"
          >
            <span className="material-icons-round text-sm">refresh</span>
          </button>
        )}
      </div>
      {pendingCount > 0 && isOnline && !isSyncing && (
        <div className="mt-2 pt-2 border-t border-gray-200/50">
          <button
            onClick={triggerSync}
            className="w-full text-[10px] font-black text-primary uppercase tracking-wider hover:underline"
          >
            Sincronizar {pendingCount} cambios
          </button>
        </div>
      )}
    </div>
  );
};
