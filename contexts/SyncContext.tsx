import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  SyncStatus, 
  onSyncStatusChange, 
  startNetworkMonitoring, 
  stopNetworkMonitoring, 
  triggerSync as triggerSyncService,
  getSyncStatus,
  configureSyncService
} from '../services/SyncService';
import { migrateFromLocalStorage } from '../services/migration';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  syncError: string | null;
  isMigrated: boolean;
  triggerSync: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    syncError: null,
  });
  const [isMigrated, setIsMigrated] = useState(false);

  useEffect(() => {
    // Configure Sync Service with credentials
    const url = (import.meta as any).env.VITE_SUPABASE_URL;
    const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
    if (url && key) {
      configureSyncService(url, key);
    }

    // Run migration first
    migrateFromLocalStorage().then(() => {
      setIsMigrated(true);
      console.log('[SyncContext] Migration check complete');
    });

    // Start network monitoring
    onSyncStatusChange((newStatus) => {
      setStatus({ ...newStatus });
    });
    startNetworkMonitoring();

    return () => {
      stopNetworkMonitoring();
    };
  }, []);

  const handleTriggerSync = () => {
    triggerSyncService();
  };

  return (
    <SyncContext.Provider value={{ 
      ...status, 
      isMigrated,
      triggerSync: handleTriggerSync 
    }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};
