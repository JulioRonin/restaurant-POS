import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { LockScreen } from './components/LockScreen';
import { useSettings } from './contexts/SettingsContext';
import { POSScreen } from './screens/POS';
import { DashboardScreen } from './screens/Dashboard';
import { HostessScreen } from './screens/Hostess';
import { KitchenScreen } from './screens/Kitchen';
import { StaffScreen } from './screens/Staff';
import { InventoryScreen } from './screens/Inventory';
import { SettingsScreen } from './screens/Settings';
import { CashierScreen } from './screens/Cashier';
import { OrderProvider } from './contexts/OrderContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { SubscriptionGuard } from './components/SubscriptionGuard';
import { ExpenseProvider } from './contexts/ExpenseContext';
import { BillingScreen } from './screens/Billing';
import { MenuScreen } from './screens/Menu';
import { MenuProvider } from './contexts/MenuContext';
import { MOCK_STAFF } from './constants';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout } = useUser();
  return (
    <div className="flex h-screen w-screen bg-[#F3F4F6] font-sans overflow-hidden">
      <div className="no-print">
        <Sidebar onLock={logout} />
      </div>
      <main className="flex-1 h-full overflow-hidden relative">
        {children}
      </main>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated } = useUser();
  const { settings } = useSettings();

  // Theme Application Logic
  useEffect(() => {
    const themes = {
      indigo: { primary: '#5D5FEF', secondary: '#A5A6F6', rgb: '93, 95, 239' },
      emerald: { primary: '#10B981', secondary: '#A7F3D0', rgb: '16, 185, 129' },
      ruby: { primary: '#EF4444', secondary: '#FECACA', rgb: '239, 68, 68' },
      amber: { primary: '#F59E0B', secondary: '#FDE68A', rgb: '245, 158, 11' },
      midnight: { primary: '#334155', secondary: '#94A3B8', rgb: '51, 65, 85' }
    };

    const activeTheme = themes[settings.themeId || 'indigo'];
    document.documentElement.style.setProperty('--primary-color', activeTheme.primary);
    document.documentElement.style.setProperty('--secondary-color', activeTheme.secondary);
    document.documentElement.style.setProperty('--primary-rgb', activeTheme.rgb);
  }, [settings.themeId]);

  if (!isAuthenticated) {
    return <LockScreen onUnlock={() => {}} />;
  }

  return (
    <OrderProvider>
      <HashRouter>
        <SubscriptionGuard>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardScreen />} />
              <Route path="/pos" element={<POSScreen />} />
              <Route path="/hostess" element={<HostessScreen />} />
              <Route path="/kitchen" element={<KitchenScreen />} />
              <Route path="/staff" element={<StaffScreen />} />
              <Route path="/inventory" element={<InventoryScreen />} />
              <Route path="/cashier" element={<CashierScreen />} />
              <Route path="/billing" element={<BillingScreen />} />
              <Route path="/menu" element={<MenuScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="*" element={<div className="flex items-center justify-center h-full text-gray-500">404 - Module Not Found</div>} />
            </Routes>
          </Layout>
        </SubscriptionGuard>
      </HashRouter>
    </OrderProvider>
  );
};

import { SettingsProvider } from './contexts/SettingsContext';

const App: React.FC = () => {
  return (
    <UserProvider>
      <SubscriptionProvider>
        <ExpenseProvider>
          <SettingsProvider>
            <MenuProvider>
              <AppContent />
            </MenuProvider>
          </SettingsProvider>
        </ExpenseProvider>
      </SubscriptionProvider>
    </UserProvider>
  );
};

export default App;