import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { LockScreen } from './components/LockScreen';
import { POSScreen } from './screens/POS';
import { DashboardScreen } from './screens/Dashboard';
import { HostessScreen } from './screens/Hostess';
import { KitchenScreen } from './screens/Kitchen';
import { StaffScreen } from './screens/Staff';
import { InventoryScreen } from './screens/Inventory';
import { SettingsScreen } from './screens/Settings';
import { OrderProvider } from './contexts/OrderContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { MOCK_STAFF } from './constants';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout } = useUser();
  return (
    <div className="flex h-screen w-screen bg-[#F3F4F6] font-sans overflow-hidden">
      <Sidebar onLock={logout} />
      <main className="flex-1 h-full overflow-hidden relative">
        {children}
      </main>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isAuthenticated, login } = useUser();

  if (!isAuthenticated) {
    return <LockScreen onUnlock={(userId) => {
      const user = MOCK_STAFF.find(u => u.id === userId);
      if (user) login(user);
    }} />;
  }

  return (
    <OrderProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardScreen />} />
            <Route path="/pos" element={<POSScreen />} />
            <Route path="/hostess" element={<HostessScreen />} />
            <Route path="/kitchen" element={<KitchenScreen />} />
            <Route path="/staff" element={<StaffScreen />} />
            <Route path="/inventory" element={<InventoryScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="*" element={<div className="flex items-center justify-center h-full text-gray-500">404 - Module Not Found</div>} />
          </Routes>
        </Layout>
      </HashRouter>
    </OrderProvider>
  );
};

const App: React.FC = () => {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
};

export default App;