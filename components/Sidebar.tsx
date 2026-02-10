import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

const NavItem = ({ to, icon, label, isExpanded, activeIcon }: { to: string; icon: string; label: string; isExpanded: boolean; activeIcon?: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center ${isExpanded ? 'px-4 gap-4 w-full mx-2' : 'justify-center w-12 mx-auto'} h-12 rounded-xl my-2 transition-all duration-300 group relative ${isActive ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-gray-400 hover:bg-gray-100 hover:text-primary'
      }`
    }
  >
    {({ isActive }) => (
      <>
        <span
          className={`material-icons-round text-xl transition-colors duration-300`}
        >
          {isActive && activeIcon ? activeIcon : icon}
        </span>

        {isExpanded && (
          <span className={`font-semibold text-sm whitespace-nowrap transition-opacity duration-300 ${isActive ? 'text-white' : 'text-gray-600 group-hover:text-primary'}`}>
            {label}
          </span>
        )}
      </>
    )}
  </NavLink>
);

export const Sidebar: React.FC<{ onLock?: () => void }> = ({ onLock }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside
      className={`${isExpanded ? 'w-64' : 'w-20'} h-full bg-white flex flex-col items-center py-6 z-50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-all duration-300 ease-in-out relative`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="absolute -right-3 top-10 bg-white border border-gray-100 w-6 h-6 rounded-full flex items-center justify-center shadow-lg text-gray-400 hover:text-primary z-50 cursor-pointer"
      >
        <span className="material-icons-round text-sm">{isExpanded ? 'chevron_left' : 'chevron_right'}</span>
      </button>

      {/* Logo Area */}
      <div className={`mb-8 p-2 flex items-center ${isExpanded ? 'gap-3 px-6 w-full' : 'justify-center'}`}>
        <div className="w-10 h-10 min-w-[40px] bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="material-icons-round text-white text-xl">restaurant</span>
        </div>
        {isExpanded && (
          <div className="overflow-hidden whitespace-nowrap">
            <h1 className="font-bold text-gray-900 leading-tight">Culinex</h1>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Operating OS</p>
          </div>
        )}
      </div>

      <nav className="flex-1 flex flex-col w-full px-2">
        <NavItem to="/" icon="dashboard" label="Dashboard" isExpanded={isExpanded} />
        <NavItem to="/pos" icon="point_of_sale" label="Point of Sale" isExpanded={isExpanded} />
        <NavItem to="/hostess" icon="table_restaurant" label="Hostess / Floor" isExpanded={isExpanded} />
        <NavItem to="/kitchen" icon="soup_kitchen" label="Kitchen Display" isExpanded={isExpanded} />

        <div className={`w-8 h-px bg-gray-200 my-4 ${isExpanded ? 'w-full px-4' : 'mx-auto'}`}></div>

        <NavItem to="/staff" icon="badge" label="Staff & Schedule" isExpanded={isExpanded} />
        <NavItem to="/inventory" icon="inventory_2" label="Inventory" isExpanded={isExpanded} />

        <div className={`w-8 h-px bg-gray-200 my-4 ${isExpanded ? 'w-full px-4' : 'mx-auto'}`}></div>

        <NavItem to="/settings" icon="settings" label="Settings" isExpanded={isExpanded} />
      </nav>

      <div className="mt-auto mb-4 w-full px-2">
        <button
          onClick={onLock}
          className={`flex items-center ${isExpanded ? 'px-4 gap-4 w-full' : 'justify-center w-10 mx-auto'} h-10 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors group`}
        >
          <span className="material-icons-round text-xl">logout</span>
          {isExpanded && <span className="font-semibold text-sm whitespace-nowrap">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};