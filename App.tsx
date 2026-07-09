import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { MobileNavbar } from './components/MobileNavbar';
import { LockScreen } from './components/LockScreen';
import { SplashScreen } from './components/SplashScreen';
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
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { SubscriptionGuard } from './components/SubscriptionGuard';
import { ExpenseProvider } from './contexts/ExpenseContext';
import { BillingScreen } from './screens/Billing';
import { InvoiceScreen } from './screens/Invoice';
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
import { DigitalChannelScreen } from './screens/DigitalChannel';
import { DriverScreen } from './screens/Driver';
import { KioskScreen } from './screens/Kiosk';
import { StorefrontRoute } from './screens/Storefront';
import { canAccess, getDefaultRoute } from './services/rbac';
import { Activity } from 'lucide-react';

const RoleGuard: React.FC<{ children: React.ReactNode; path: string }> = ({ children, path }) => {
  const { activeEmployee } = useUser();
  const roleName = activeEmployee?.role;
  
  console.log(`[RBAC] Checking access for role: ${roleName} on path: ${path}`);
  
  if (!canAccess(activeEmployee, path)) {
    const fallback = getDefaultRoute(activeEmployee);
    console.warn(`[RBAC] Access denied for ${roleName} on ${path}. Redirecting to ${fallback}`);
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { clearActiveEmployee } = useUser();
  const { settings } = useSettings();
  const location = useLocation();

  // Terminal mode strips the chrome — useful for tablet-on-a-stand kiosk
  // setups where the device is glued to one screen. The screen the user
  // ends up locked to is enforced by their default route + a hidden
  // unlock affordance in the corner (long-press → PIN).
  const isKiosk = settings.terminalMode === 'tablet-pos' || settings.terminalMode === 'tablet-host';

  if (isKiosk) {
    return (
      <div className="flex h-screen w-screen bg-servirest-hueso font-sans overflow-hidden antialiased selection:bg-servirest-terracota selection:text-servirest-hueso">
        <main className="flex-1 h-full overflow-hidden relative bg-servirest-hueso">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-servirest-hueso font-sans overflow-hidden antialiased selection:bg-servirest-terracota selection:text-servirest-hueso">
      <div className="no-print hidden lg:block">
        <Sidebar onLock={clearActiveEmployee} />
      </div>
      <main className="flex-1 h-full overflow-hidden relative bg-servirest-hueso pb-28 lg:pb-0">
        {children}
        <MobileNavbar />
      </main>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { authProfile, isAuthenticating, activeEmployee, isSuperAdmin } = useUser();
  const { settings } = useSettings();
  const { tier } = useSubscription();
  const [showSplash, setShowSplash] = useState(true);

  // Apply commercial tier to <body> so CSS overrides in index.css can
  // promote Prestige to its editorial typography/spacing/radii layer.
  useEffect(() => {
    document.body.dataset.tier = tier;
    return () => { delete document.body.dataset.tier; };
  }, [tier]);

  // Apply terminal mode to <body>. CSS in index.css uses [data-terminal-mode]
  // to scale touch targets and adjust spacing for tablet kiosk setups.
  useEffect(() => {
    const mode = settings.terminalMode || 'standard';
    document.body.dataset.terminalMode = mode;
    return () => { delete document.body.dataset.terminalMode; };
  }, [settings.terminalMode]);

  // Splash Screen Timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500); // 2.5 seconds for a premium feel
    return () => clearTimeout(timer);
  }, []);

  // Theme Application Logic — locked to Sobremesa Lúcida (ServiRest brand).
  // The legacy multi-theme picker is preserved in Settings for the future but
  // every theme now resolves to the brand palette so older screens never drift.
  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color',   '#C4633F'); // terracota
    document.documentElement.style.setProperty('--secondary-color', '#C9A24A'); // mostaza
    document.documentElement.style.setProperty('--primary-rgb',     '196, 99, 63');
  }, [settings.themeId]);

  if (isAuthenticating || showSplash) {
    // Ruta pública del storefront — no requiere splash ni auth del negocio.
    // El cliente entra a #/o/{businessId} sin haberse loggeado nunca.
    if (window.location.hash.startsWith('#/o/')) {
      return <StorefrontRoute />;
    }
    return <SplashScreen />;
  }

  // Bypass total del auth: si estamos en /o/{id}, servir directo el
  // storefront público, sin requerir sesión de operador.
  if (window.location.hash.startsWith('#/o/')) {
    return <StorefrontRoute />;
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
            <Route path="/invoice" element={<InvoiceScreen />} />
            <Route path="/menu" element={<MenuScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/remote-order" element={<RemoteOrderScreen />} />
            <Route path="/bar" element={<BarScreen />} />
            <Route path="/my-tables" element={<MyTablesScreen />} />
            <Route path="/digital-channel" element={<DigitalChannelScreen />} />
            <Route path="/driver" element={<DriverScreen />} />
            <Route path="/kiosk" element={<KioskScreen />} />
            <Route path="/onboarding" element={<OnboardingScreen />} />
            <Route path="*" element={<Navigate to="/super-admin" replace />} />
          </Routes>
        </Layout>
      ) : (
        <SubscriptionGuard>
          <Layout>
            <Routes>
              <Route
                path="/"
                element={
                  <Navigate
                    to={
                      settings.terminalMode === 'tablet-pos'
                        ? '/pos'
                        : settings.terminalMode === 'tablet-host'
                        ? '/hostess'
                        : getDefaultRoute(activeEmployee)
                    }
                    replace
                  />
                }
              />
              
              <Route path="/dashboard" element={<RoleGuard path="/dashboard"><DashboardScreen /></RoleGuard>} />
              <Route path="/pos" element={<RoleGuard path="/pos"><POSScreen /></RoleGuard>} />
              <Route path="/hostess" element={<RoleGuard path="/hostess"><HostessScreen /></RoleGuard>} />
              <Route path="/kitchen" element={<RoleGuard path="/kitchen"><KitchenScreen /></RoleGuard>} />
              <Route path="/staff" element={<RoleGuard path="/staff"><StaffScreen /></RoleGuard>} />
              <Route path="/inventory" element={<RoleGuard path="/inventory"><InventoryScreen /></RoleGuard>} />
              <Route path="/cashier" element={<RoleGuard path="/cashier"><CashierScreen /></RoleGuard>} />
              <Route path="/billing" element={<RoleGuard path="/billing"><BillingScreen /></RoleGuard>} />
              <Route path="/invoice" element={<RoleGuard path="/invoice"><InvoiceScreen /></RoleGuard>} />
              <Route path="/menu" element={<RoleGuard path="/menu"><MenuScreen /></RoleGuard>} />
              <Route path="/settings" element={<RoleGuard path="/settings"><SettingsScreen /></RoleGuard>} />
              <Route path="/remote-order" element={<RoleGuard path="/remote-order"><RemoteOrderScreen /></RoleGuard>} />
              <Route path="/bar" element={<RoleGuard path="/bar"><BarScreen /></RoleGuard>} />
              <Route path="/my-tables" element={<RoleGuard path="/my-tables"><MyTablesScreen /></RoleGuard>} />
              <Route path="/digital-channel" element={<RoleGuard path="/digital-channel"><DigitalChannelScreen /></RoleGuard>} />
              <Route path="/driver" element={<RoleGuard path="/driver"><DriverScreen /></RoleGuard>} />
              <Route path="/kiosk" element={<KioskScreen />} />
              
              <Route path="/onboarding" element={<OnboardingScreen />} />
              <Route path="*" element={<div className="flex flex-col items-center justify-center h-full text-solaris-orange uppercase font-black tracking-[0.5em] italic text-[10px] gap-6"><Activity size={48} className="animate-pulse" /> 404 - M�dulo No Encontrado</div>} />
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
