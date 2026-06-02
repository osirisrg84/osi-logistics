import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, MapPin, Users, Truck,
  BarChart3, Settings, Zap, Shield, UserCog
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DISPATCHER_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/orders', icon: Package, label: 'Orders' },
  { to: '/tracking', icon: MapPin, label: 'Live Tracking' },
  { to: '/drivers', icon: Users, label: 'Drivers' },
  { to: '/fleet', icon: Truck, label: 'Fleet' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
];

const ADMIN_ONLY_NAV = [
  { to: '/users', icon: UserCog, label: 'Users' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const DISPATCHER_BOTTOM_NAV = [
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const topNav = DISPATCHER_NAV;
  const bottomNav = isAdmin ? ADMIN_ONLY_NAV : DISPATCHER_BOTTOM_NAV;

  const roleLabel = isAdmin ? 'Admin Console' : 'Dispatch Center';
  const roleBadgeColor = isAdmin ? 'bg-purple-600' : 'bg-orange-500';

  return (
    <aside className="w-60 bg-slate-900 flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 ${roleBadgeColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
            {isAdmin ? <Shield className="w-5 h-5 text-white" /> : <Truck className="w-5 h-5 text-white" />}
          </div>
          <div>
            <div className="font-bold text-white text-sm leading-tight">OSI Logistics</div>
            <div className="text-slate-400 text-xs">{roleLabel}</div>
          </div>
        </div>
      </div>

      {/* Live indicator */}
      <div className="px-5 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full pulse-dot" />
          <span className="text-xs text-slate-400 font-medium">System Online</span>
          <Zap className="w-3 h-3 text-green-400 ml-auto" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {/* Main nav */}
        <div className="space-y-0.5">
          {topNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? `${roleBadgeColor} text-white shadow-lg ${isAdmin ? 'shadow-purple-500/20' : 'shadow-orange-500/20'}`
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Admin / Settings section */}
        {bottomNav.length > 0 && (
          <>
            <div className="my-3 border-t border-slate-800" />
            {isAdmin && (
              <p className="text-xs text-slate-600 font-semibold uppercase tracking-widest px-3 mb-2">Admin</p>
            )}
            <div className="space-y-0.5">
              {bottomNav.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? `${roleBadgeColor} text-white shadow-lg`
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`
                  }
                >
                  <Icon size={18} className="flex-shrink-0" />
                  {label}
                </NavLink>
              ))}
            </div>
          </>
        )}
      </nav>

      {/* Footer — user info */}
      <div className="px-5 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 ${roleBadgeColor} rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
            {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-medium truncate">{user?.name}</div>
            <div className={`text-xs font-semibold capitalize ${isAdmin ? 'text-purple-400' : 'text-orange-400'}`}>
              {user?.role}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
