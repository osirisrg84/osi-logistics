import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, MapPin, Users, BarChart3, MoreHorizontal, X, Truck, Layers } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';
import api from '../services/api';

const BACKEND = import.meta.env.PROD
  ? 'https://osi-logistics-backend.onrender.com'
  : 'http://localhost:3001';

const BOTTOM_NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home'    },
  { to: '/orders',    icon: Package,         label: 'Orders'  },
  { to: '/tracking',  icon: MapPin,          label: 'Tracking'},
  { to: '/drivers',   icon: Users,           label: 'Drivers' },
  { to: '/hub',       icon: Layers,          label: 'Hub'     },
];

interface DriverToast {
  id: string;
  name: string;
  status: string;
}

function DriverOnlineToast({ toast, onClose }: { toast: DriverToast; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="flex items-center gap-3 bg-slate-900 border border-green-500/40 text-white px-4 py-3 rounded-2xl shadow-2xl min-w-[260px] max-w-xs animate-slide-in">
      <div className="w-9 h-9 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
        <Truck className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-green-400">Driver Online</p>
        <p className="text-sm font-bold text-white truncate">{toast.name}</p>
        <p className="text-xs text-slate-400">Está disponible y listo</p>
      </div>
      <button onClick={onClose} className="text-slate-500 hover:text-slate-300 flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer as ArrayBuffer;
}

async function registerPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const { data } = await api.get('/push/vapid-public-key');
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.key),
    });
    await api.post('/push/subscribe', sub.toJSON());
  } catch {
    // Push not supported or denied — silent fail
  }
}

function BottomNav({ onMoreClick }: { onMoreClick: () => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const activeColor = isAdmin ? 'text-purple-500' : 'text-orange-500';
  const activeBg   = isAdmin ? 'bg-purple-50 dark:bg-purple-900/30' : 'bg-orange-50 dark:bg-orange-900/30';

  const navItems = isAdmin
    ? BOTTOM_NAV
    : [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Stats'   },
        { to: '/orders',    icon: Package,         label: 'Orders'  },
        { to: '/tracking',  icon: MapPin,          label: 'Tracking'},
        { to: '/drivers',   icon: Users,           label: 'Drivers' },
        { to: '/reports',   icon: BarChart3,       label: 'Reports' },
      ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex items-stretch">
      {navItems.map(({ to, icon: Icon, label }) => (
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
        title="Más opciones"
      >
        <MoreHorizontal className="w-5 h-5" />
        More
      </button>
    </nav>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const flag = sessionStorage.getItem('open_sidebar');
    if (flag) { sessionStorage.removeItem('open_sidebar'); return true; }
    return false;
  });

  const [toasts, setToasts] = useState<DriverToast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('subscribe_dispatchers');

    socket.on('driver_status_changed', (event: { id: string; name: string; status: string }) => {
      if (event.status === 'available') {
        setToasts(prev => [...prev.slice(-3), { id: event.id + Date.now(), name: event.name, status: event.status }]);
      }
    });

    registerPush();

    return () => { socket.off('driver_status_changed'); };
  }, []);

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
        <main className="flex-1 overflow-y-auto p-3 md:p-6 pb-16 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Bottom navigation — mobile only */}
      <BottomNav onMoreClick={() => setSidebarOpen(true)} />

      {/* Driver online toasts */}
      {toasts.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 items-end">
          {toasts.map(t => (
            <DriverOnlineToast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
