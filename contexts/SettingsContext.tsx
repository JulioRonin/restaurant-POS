import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  isTerminalEnabled: boolean;
  logoUrl?: string; // New field
  themeId?: 'indigo' | 'emerald' | 'ruby' | 'amber' | 'midnight'; // Theme selector
}

interface SettingsContextType {
  settings: BusinessSettings;
  updateSettings: (newSettings: Partial<BusinessSettings>) => void;
}

const DEFAULT_SETTINGS: BusinessSettings = {
  name: 'Culinex Restaurante',
  legalName: 'Culinex Solutions S.A. de C.V.',
  rfc: 'CUL123456789',
  address: 'Av. Marina Nacional 123, Col. Anáhuac, CDMX',
  phone: '55 1234 5678',
  email: 'contacto@culinex.app',
  footerMessage: '¡Gracias por su visita!',
  printerWidth: '80mm',
  connectedDeviceName: 'None',
  connectedTerminalName: 'None',
  isDirectPrintingEnabled: false,
  isKitchenPrintingEnabled: false,
  isTerminalEnabled: false,
  logoUrl: '', // Default empty logo
  themeId: 'indigo' // Default theme
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<BusinessSettings>(() => {
    const saved = localStorage.getItem('business_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('business_settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<BusinessSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
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
