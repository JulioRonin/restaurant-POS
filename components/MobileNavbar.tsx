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
  MoreHorizontal
} from 'lucide-react';

export const MobileNavbar: React.FC = () => {
    const { activeEmployee, isSuperAdmin } = useUser();
    const { isFeatureEnabled } = useSubscription();

    const navItems = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dash', path: '/dashboard', feature: 'dashboard' },
        { to: '/pos', icon: Zap, label: 'POS', path: '/pos', feature: 'pos' },
        { to: '/my-tables', icon: Table2, label: 'Mesas', path: '/my-tables', feature: 'tables' },
        { to: '/cashier', icon: Receipt, label: 'Caja', path: '/cashier', feature: 'cashier' },
        { to: '/settings', icon: MoreHorizontal, label: 'Más', path: '/settings', feature: null },
    ];

    return (
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md print:hidden">
            <div className="bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/10 rounded-[32px] p-2 flex items-center justify-around shadow-2xl shadow-black">
                {navItems.map((item) => {
                    const hasAccess = isSuperAdmin || (canAccess(activeEmployee?.role, item.path) && (!item.feature || isFeatureEnabled(item.feature)));
                    if (!hasAccess) return null;

                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all ${
                                    isActive 
                                    ? 'bg-solaris-orange text-white shadow-solaris-glow scale-110' 
                                    : 'text-white/40 active:scale-95'
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
