import React, { useRef } from 'react';
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
    const scrollRef = useRef<HTMLDivElement>(null);

    const navItems = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', feature: 'dashboard' },
        { to: '/pos', icon: Zap, label: 'POS', path: '/pos', feature: 'pos' },
        { to: '/my-tables', icon: Table2, label: 'Mesas Activas', path: '/my-tables', feature: 'tables' },
        { to: '/hostess', icon: MonitorCheck, label: 'Hostes', path: '/hostess', feature: 'hostess' },
        { to: '/cashier', icon: Receipt, label: 'Caja', path: '/cashier', feature: 'cashier' },
        { to: '/kitchen', icon: ChefHat, label: 'Cocina', path: '/kitchen', feature: 'kitchen' },
        { to: '/bar', icon: Wine, label: 'Bar', path: '/bar', feature: 'bar' },
        { to: '/remote-order', icon: Smartphone, label: 'Remoto', path: '/remote-order', feature: 'remote_order' },
        { to: '/menu', icon: MenuSquare, label: 'Menú', path: '/menu', feature: 'menu_admin' },
        { to: '/staff', icon: Users, label: 'Personal', path: '/staff', feature: 'staff' },
        { to: '/inventory', icon: Boxes, label: 'Inventario', path: '/inventory', feature: 'inventory' },
        { to: '/billing', icon: CreditCard, label: 'Membresia', path: '/billing', feature: null },
        { to: '/settings', icon: Settings2, label: 'Ajustes', path: '/settings', feature: null },
    ];

    const visibleItems = navItems.filter(item =>
        isSuperAdmin || (canAccess(activeEmployee?.role, item.path) && (!item.feature || isFeatureEnabled(item.feature)))
    );

    return (
        <div
            className="lg:hidden print:hidden"
            style={{
                position: 'fixed',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '95%',
                maxWidth: '100%',
                zIndex: 100,
            }}
        >
            <div
                ref={scrollRef}
                style={{
                    background: 'linear-gradient(160deg, #505530 0%, #3d4124 80%, #2e3018 100%)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '28px',
                    padding: '8px 12px',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    gap: '4px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                }}
            >
                {visibleItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        style={{ textDecoration: 'none' }}
                        className={({ isActive }) =>
                            isActive
                                ? 'flex flex-col items-center justify-center rounded-2xl transition-all bg-[#F98359] text-white shadow-lg'
                                : 'flex flex-col items-center justify-center rounded-2xl transition-all text-white/50 active:scale-95'
                        }
                    >
                        {({ isActive }) => (
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '58px',
                                    minWidth: '58px',
                                    height: '58px',
                                    flexShrink: 0,
                                    borderRadius: '16px',
                                    background: isActive ? '#F98359' : 'transparent',
                                    color: isActive ? '#FAFAF3' : 'rgba(250,250,243,0.45)',
                                    transition: 'all 0.2s ease',
                                    transform: isActive ? 'scale(1.05)' : 'scale(1)',
                                    boxShadow: isActive ? '0 0 20px rgba(249,131,89,0.5)' : 'none',
                                }}
                            >
                                <item.icon size={20} />
                                <span style={{
                                    fontSize: '8px',
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    marginTop: '4px',
                                    letterSpacing: '-0.02em',
                                    opacity: 0.8,
                                    whiteSpace: 'nowrap',
                                }}>
                                    {item.label}
                                </span>
                            </div>
                        )}
                    </NavLink>
                ))}
            </div>
            {/* Hide scrollbar with inline style */}
            <style>{`
                div[data-mobile-nav]::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};
