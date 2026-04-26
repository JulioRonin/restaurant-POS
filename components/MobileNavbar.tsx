import React from 'react';
import { NavLink } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { canAccess } from '../services/rbac';
import { 
  LayoutDashboard, 
  Zap, 
  Table2, 
  Receipt, 
  ChefHat, 
  MenuSquare,
  Wine,
  Smartphone,
  Users,
  Boxes,
  CreditCard,
  Settings2,
  MonitorCheck
} from 'lucide-react';

export const MobileNavbar: React.FC = () => {
    const { activeEmployee, isSuperAdmin } = useUser();
    const { isFeatureEnabled } = useSubscription();

    const navItems = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dash', path: '/dashboard', feature: 'dashboard' },
        { to: '/pos', icon: Zap, label: 'POS', path: '/pos', feature: 'pos' },
        { to: '/my-tables', icon: Table2, label: 'Mesas', path: '/my-tables', feature: 'tables' },
        { to: '/hostess', icon: MonitorCheck, label: 'Host', path: '/hostess', feature: 'hostess' },
        { to: '/cashier', icon: Receipt, label: 'Caja', path: '/cashier', feature: 'cashier' },
        { to: '/kitchen', icon: ChefHat, label: 'Cocina', path: '/kitchen', feature: 'kitchen' },
        { to: '/bar', icon: Wine, label: 'Bar', path: '/bar', feature: 'bar' },
        { to: '/remote-order', icon: Smartphone, label: 'Remote', path: '/remote-order', feature: 'remote_order' },
        { to: '/menu', icon: MenuSquare, label: 'Menú', path: '/menu', feature: 'menu_admin' },
        { to: '/staff', icon: Users, label: 'Staff', path: '/staff', feature: 'staff' },
        { to: '/inventory', icon: Boxes, label: 'Inv', path: '/inventory', feature: 'inventory' },
        { to: '/billing', icon: CreditCard, label: 'Susc', path: '/billing', feature: null },
        { to: '/settings', icon: Settings2, label: 'Ajustes', path: '/settings', feature: null },
    ];

    return (
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-full print:hidden">
            <div className="bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/10 rounded-[32px] p-2 flex items-center shadow-2xl shadow-black overflow-x-auto no-scrollbar gap-2 px-4">
                {navItems.map((item) => {
                    const hasAccess = isSuperAdmin || (canAccess(activeEmployee?.role, item.path) && (!item.feature || isFeatureEnabled(item.feature)));
                    if (!hasAccess) return null;

                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `flex flex-col items-center justify-center w-[60px] min-w-[60px] h-[60px] rounded-2xl transition-all flex-shrink-0 ${
                                    isActive 
                                    ? 'bg-solaris-orange text-white shadow-solaris-glow scale-105' 
                                    : 'text-white/40 active:scale-95 hover:bg-white/5'
                                }`
                            }
                        >
                            <item.icon size={20} />
                            <span className="text-[8px] font-black uppercase mt-1 tracking-tighter opacity-70">
                                {item.label}
                            </span>
                        </NavLink>
                    );
                })}
            </div>
        </div>
    );
};
