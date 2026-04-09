import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useUser } from './UserContext';
import { getSetting, putSetting } from '../services/db';
import { printerService } from '../services/PrinterService';
import { trackChange, onSyncComplete } from '../services/SyncService';

export interface BusinessSettings {
  name: string;
  legalName: string;
  rfc: string;
  address: string;
  phone: string;
  email: string;
  footerMessage: string;
  printerWidth: '58mm' | '80mm';
  connectedDeviceName: string;
  connectedTerminalName: string;
  isDirectPrintingEnabled: boolean;
  isKitchenPrintingEnabled: boolean;
  isCashDrawerEnabled: boolean;
  isTerminalEnabled: boolean;
  logoUrl?: string;
  themeId?: 'indigo' | 'emerald' | 'ruby' | 'amber' | 'midnight';
  bankName?: string;
  bankAccount?: string;
  bankCLABE?: string;
  bankBeneficiary?: string;
  bankWhatsapp?: string;
  tables: { id: string; name: string; seats: number; status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED'; x: number; y: number }[];
}

interface SettingsContextType {
  settings: BusinessSettings;
  updateSettings: (newSettings: Partial<BusinessSettings>) => void;
}

const DEFAULT_SETTINGS: BusinessSettings = {
  name: 'Culinex Restaurante',
  legalName: '',
  rfc: '',
  address: '',
  phone: '',
  email: '',
  footerMessage: '¡Gracias por su visita!',
  printerWidth: '80mm',
  connectedDeviceName: 'None',
  connectedTerminalName: 'None',
  isDirectPrintingEnabled: false,
  isKitchenPrintingEnabled: true,
  isCashDrawerEnabled: true,
  isTerminalEnabled: false,
  logoUrl: '',
  themeId: 'indigo',
  bankName: '',
  bankAccount: '',
  bankCLABE: '',
  bankBeneficiary: '',
  bankWhatsapp: '',
  tables: [] // Start with no tables
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { authProfile } = useUser();
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);

  // Load from IndexedDB/LocalStorage on mount
  useEffect(() => {
    if (!authProfile?.businessId) {
      setSettings(DEFAULT_SETTINGS);
      return;
    }

    const bizKey = `culinex_settings_${authProfile.businessId}`;
    const idbKey = `settings_${authProfile.businessId}`;

    const saved = localStorage.getItem(bizKey);
    if (saved) {
      setSettings(JSON.parse(saved));
    } else {
      // Initialize with business info from UserContext
      setSettings({
        ...DEFAULT_SETTINGS,
        name: authProfile.businessName || DEFAULT_SETTINGS.name,
        email: authProfile.email || DEFAULT_SETTINGS.email
      });
    }

    // Prioritize business-scoped IndexedDB settings
    // Prioritize business-scoped IndexedDB settings
    const loadFromStore = async () => {
      try {
        const idbSettings = await getSetting(idbKey);
        if (idbSettings) {
          setSettings(prev => ({ ...prev, ...idbSettings }));
        }

        // Check if we need to sync basic info from Supabase (Source of Truth)
        if (!idbSettings || idbSettings.name === DEFAULT_SETTINGS.name) {
          const client = (await import('../services/auth')).getSupabase();
          if (client) {
             const { data: biz } = await client.from('businesses').select('name').eq('id', authProfile.businessId).single();
             if (biz?.name) {
                setSettings(prev => ({ ...prev, name: biz.name }));
             }
          }
        }
      } catch (err) {
        console.error('[SettingsContext] Error loading settings:', err);
      }
    };

    loadFromStore();

    // Listen for sync updates (e.g. settings changed by another user)
    const unsubscribe = onSyncComplete(() => {
        console.log('[SettingsContext] Sync complete - Refreshing settings');
        loadFromStore();
    });

    return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [authProfile?.businessId]);

  // Handle Hardware Auto-reconnection & Retention across Refreshes
  useEffect(() => {
    if (!authProfile?.businessId) return;
    
    const deviceName = settings.connectedDeviceName;
    if (!deviceName || deviceName === 'None') return;

    const attemptRecovery = async () => {
      if (!printerService.isConnected()) {
        console.log(`[SettingsContext] Wake-up attempt for: ${deviceName}`);
        await printerService.autoConnect(deviceName);
      }
    };

    // 1. Initial attempt (might fail due to browser security gesture requirement)
    attemptRecovery();

    // 2. Gesture Listener (The "Secret Sauce"): 
    // Browser requires a click to allow GATT connection on a fresh page.
    const wakeOnGesture = () => {
        if (!printerService.isConnected()) {
            attemptRecovery();
        }
        // Remove after success or keep for robustness
        // window.removeEventListener('pointerdown', wakeOnGesture);
    };

    window.addEventListener('pointerdown', wakeOnGesture);

    // 3. Keep-alive/Reconnect interval (every 30s check)
    const interval = setInterval(() => {
      if (!printerService.isConnected()) {
        console.log(`[SettingsContext] Heartbeat recovery: ${deviceName}`);
        attemptRecovery();
      }
    }, 30000);

    return () => {
        clearInterval(interval);
        window.removeEventListener('pointerdown', wakeOnGesture);
    };
  }, [authProfile?.businessId, settings.connectedDeviceName]);

  // Sync with business info from UserContext when profile refreshes
  useEffect(() => {
    if (authProfile?.businessName && authProfile.businessName !== settings.name) {
      setSettings(prev => ({ ...prev, name: authProfile.businessName! }));
    }
  }, [authProfile?.businessName]);

  // Persist to both localStorage and IndexedDB
  useEffect(() => {
    if (!authProfile?.businessId) return;

    const bizKey = `culinex_settings_${authProfile.businessId}`;
    const idbKey = `settings_${authProfile.businessId}`;

    localStorage.setItem(bizKey, JSON.stringify(settings));
    putSetting(idbKey, settings).catch(console.error);
  }, [settings, authProfile?.businessId]);

  const updateSettings = async (newSettings: Partial<BusinessSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    // Track change for global sync if businessId is present
    if (authProfile?.businessId) {
        const idbKey = `settings_${authProfile.businessId}`;
        await trackChange('settings', 'UPDATE', idbKey, updated);
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
