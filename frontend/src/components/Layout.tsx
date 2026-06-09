import { useState, useEffect } from 'react';
import { Outlet, useLocation, NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, MapPin, Users, BarChart3, MoreHorizontal } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../context/AuthContext';

const BOTTOM_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home'     },
  { to: '/orders',    icon: Package,         label: 'Orders'   },
  { to: '/tracking',  icon: MapPin,          label: 'Tracking' },
  { to: '/drivers',   icon: Users,           label: 'Drivers'  },
  { to: '/reports',   icon: BarChart3,       label: 'Reports'  },
];

function BottomNav({ onMoreClick }: { onMoreClick: () => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const activeColor = isAdmin ? 'text-purple-500' : 'text-orange-500';
  const activeBg   = isAdmin ? 'bg-purple-50 dark:bg-purple-900/30' : 'bg-orange-50 dark:bg-orange-900/30';

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex items-stretch">
      {BOTTOM_NAV.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors
            ${isActive ? `${activeColor} ${activeBg}` : 'text-gray-400 dark:text-slate-500'}`
          }
        >
          <Icon className="w-5 h-5" />
          {label}
        </NavLink>
      ))}
      <button
        onClick={onMoreClick}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-gray-400 dark:text-slate-500"
      >
        <MoreHorizontal className="w-5 h-5" />
        More
      </button>
    </nav>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 transform transition-transform duration-200
        md:relative md:translate-x-0 md:flex md:flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        {/* pb-16 on mobile reserves space for the bottom nav */}
        <main className="flex-1 overflow-y-auto p-3 md:p-6 pb-16 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom navigation — mobile only */}
      <BottomNav onMoreClick={() => setSidebarOpen(true)} />
    </div>
  );
}
