import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { InventoryProvider } from './contexts/InventoryContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { SyncProvider } from './contexts/SyncContext';
import { TableProvider } from './contexts/TableContext';

import { AuthScreen } from './components/AuthScreen';
import { RemoteOrderScreen } from './screens/RemoteOrder';
import SuperAdminScreen from './screens/SuperAdmin';
import OnboardingScreen from './screens/Onboarding';
import { BarScreen } from './screens/Bar';
import { MyTablesScreen } from './screens/MyTables';
import { canAccess, getDefaultRoute } from './services/rbac';
import { Activity } from 'lucide-react';

const RoleGuard: React.FC<{ children: React.ReactNode; path: string }> = ({ children, path }) => {
  const { activeEmployee } = useUser();
  const role = activeEmployee?.role;
  
  console.log(`[RBAC] Checking access for role: ${role} on path: ${path}`);
  
  if (!canAccess(role, path)) {
    const fallback = getDefaultRoute(role);
    console.warn(`[RBAC] Access denied for ${role} on ${path}. Redirecting to ${fallback}`);
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { clearActiveEmployee } = useUser();
  const location = useLocation(); // Accurate location tracking for stable transitions

  return (
    <div className="flex h-screen w-screen bg-[#030303] text-white font-sans overflow-hidden antialiased selection:bg-solaris-orange selection:text-white">
      <div className="no-print">
        <Sidebar onLock={clearActiveEmployee} />
      </div>
      <main className="flex-1 h-full overflow-hidden relative bg-[#030303]">
        {children}
      </main>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { authProfile, isAuthenticating, activeEmployee, isSuperAdmin } = useUser();
  const { settings } = useSettings();

  // Theme Application Logic
  useEffect(() => {
    const themes = {
      indigo: { primary: '#5D5FEF', secondary: '#A5A6F6', rgb: '93, 95, 239' },
      emerald: { primary: '#10B981', secondary: '#A7F3D0', rgb: '16, 185, 129' },
      ruby: { primary: '#EF4444', secondary: '#FECACA', rgb: '239, 68, 68' },
      amber: { primary: '#f97316', secondary: '#fb923c', rgb: '249, 115, 22' },
      midnight: { primary: '#334155', secondary: '#94A3B8', rgb: '51, 65, 85' }
    } as const;

    const activeTheme = themes[settings.themeId as keyof typeof themes || 'amber'];
    document.documentElement.style.setProperty('--primary-color', activeTheme.primary);
    document.documentElement.style.setProperty('--secondary-color', activeTheme.secondary);
    document.documentElement.style.setProperty('--primary-rgb', activeTheme.rgb);
  }, [settings.themeId]);

  if (isAuthenticating) {
    return (
      <div className="fixed inset-0 bg-[#030303] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-solaris-orange/20 border-t-solaris-orange rounded-full animate-spin mb-6 shadow-solaris-glow"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-solaris-orange animate-pulse italic">Solaris OS Core Booting</p>
      </div>
    );
  }

  // 1. Not logged into the system (SaaS account)
  if (!authProfile) {
    return <AuthScreen />;
  }

  // 2. System logged in, but terminal is locked (no staff selected)
  if (!activeEmployee && !isSuperAdmin) {
    if (!authProfile.onboardingCompleted) {
       return <OnboardingScreen />;
    }
    return <LockScreen />;
  }

  // 3. Fully logged in and unlocked
  return (
    <OrderProvider>
      {isSuperAdmin ? (
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/super-admin" replace />} />
            <Route path="/super-admin" element={<SuperAdminScreen />} />
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
            <Route path="/remote-order" element={<RemoteOrderScreen />} />
            <Route path="/bar" element={<BarScreen />} />
            <Route path="/my-tables" element={<MyTablesScreen />} />
            <Route path="/onboarding" element={<OnboardingScreen />} />
            <Route path="*" element={<Navigate to="/super-admin" replace />} />
          </Routes>
        </Layout>
      ) : (
        <SubscriptionGuard>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to={getDefaultRoute(activeEmployee?.role)} replace />} />
              
              <Route path="/dashboard" element={<RoleGuard path="/dashboard"><DashboardScreen /></RoleGuard>} />
              <Route path="/pos" element={<RoleGuard path="/pos"><POSScreen /></RoleGuard>} />
              <Route path="/hostess" element={<RoleGuard path="/hostess"><HostessScreen /></RoleGuard>} />
              <Route path="/kitchen" element={<RoleGuard path="/kitchen"><KitchenScreen /></RoleGuard>} />
              <Route path="/staff" element={<RoleGuard path="/staff"><StaffScreen /></RoleGuard>} />
              <Route path="/inventory" element={<RoleGuard path="/inventory"><InventoryScreen /></RoleGuard>} />
              <Route path="/cashier" element={<RoleGuard path="/cashier"><CashierScreen /></RoleGuard>} />
              <Route path="/billing" element={<RoleGuard path="/billing"><BillingScreen /></RoleGuard>} />
              <Route path="/menu" element={<RoleGuard path="/menu"><MenuScreen /></RoleGuard>} />
              <Route path="/settings" element={<RoleGuard path="/settings"><SettingsScreen /></RoleGuard>} />
              <Route path="/remote-order" element={<RoleGuard path="/remote-order"><RemoteOrderScreen /></RoleGuard>} />
              <Route path="/bar" element={<RoleGuard path="/bar"><BarScreen /></RoleGuard>} />
              <Route path="/my-tables" element={<RoleGuard path="/my-tables"><MyTablesScreen /></RoleGuard>} />
              
              <Route path="/onboarding" element={<OnboardingScreen />} />
              <Route path="*" element={<div className="flex flex-col items-center justify-center h-full text-solaris-orange uppercase font-black tracking-[0.5em] italic text-[10px] gap-6"><Activity size={48} className="animate-pulse" /> 404 - Module Lost in Solaris</div>} />
            </Routes>
          </Layout>
        </SubscriptionGuard>
      )}
    </OrderProvider>
  );
};

const App: React.FC = () => {
  return (
    <SyncProvider>
      <UserProvider>
        <SubscriptionProvider>
          <ExpenseProvider>
            <SettingsProvider>
              <InventoryProvider>
                <MenuProvider>
                  <TableProvider>
                    <HashRouter>
                      <AppContent />
                    </HashRouter>
                  </TableProvider>
                </MenuProvider>
              </InventoryProvider>
            </SettingsProvider>
          </ExpenseProvider>
        </SubscriptionProvider>
      </UserProvider>
    </SyncProvider>
  );
};

export default App;