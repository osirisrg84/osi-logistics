import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Search, RefreshCw, X, Check, LogOut, ChevronDown, Menu } from 'lucide-react';
import { notificationsApi } from '../services/api';
import { Notification } from '../types';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/orders': 'Orders',
  '/tracking': 'Live Tracking',
  '/drivers': 'Drivers',
  '/fleet': 'Fleet',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/users': 'Users',
};

const NOTIF_COLORS: Record<string, string> = {
  order: 'bg-blue-100 text-blue-700',
  driver: 'bg-green-100 text-green-700',
  truck: 'bg-purple-100 text-purple-700',
  system: 'bg-gray-100 text-gray-700',
  alert: 'bg-red-100 text-red-700',
};

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const title = PAGE_TITLES[location.pathname] || 'OSI Logistics';

  const fetchNotifications = async () => {
    try {
      const { data } = await notificationsApi.getAll();
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const socket = getSocket();
    socket.on('notification', (notif: Notification) => {
      setNotifications(prev => [notif, ...prev].slice(0, 50));
      setUnread(prev => prev + 1);
    });
    return () => { socket.off('notification'); };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base md:text-lg font-semibold text-gray-900">{title}</h1>
          <p className="text-xs text-gray-400 hidden sm:block">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Search — hidden on small screens */}
        <div className="relative hidden lg:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders, drivers..."
            className="pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 w-52"
          />
        </div>

        {/* Refresh */}
        <button onClick={async () => { setLoading(true); await fetchNotifications(); setLoading(false); }}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors hidden sm:block">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-72 md:w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50 slide-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="font-semibold text-gray-900 text-sm">Notifications</span>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                  <button onClick={() => setShowNotifs(false)}>
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-sm">No notifications</div>
                ) : notifications.map(n => (
                  <div key={n.id} className={`px-4 py-3 hover:bg-gray-50 ${!n.read ? 'bg-orange-50/30' : ''}`}>
                    <div className="flex items-start gap-3">
                      <span className={`badge mt-0.5 text-xs ${NOTIF_COLORS[n.type] || NOTIF_COLORS.system}`}>{n.type}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                          {!n.read && <div className="w-1.5 h-1.5 bg-orange-500 rounded-full flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative" ref={userMenuRef}>
          <button onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <div className={`w-7 h-7 ${user?.role === 'admin' ? 'bg-purple-600' : 'bg-orange-500'} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
              {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-gray-900 leading-none">{user?.name}</p>
              <p className="text-xs text-gray-400 capitalize mt-0.5">{user?.role}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 hidden md:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 slide-in py-1">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                <span className={`badge mt-1 capitalize ${user?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>{user?.role}</span>
              </div>
              <button onClick={() => { setShowUserMenu(false); logout(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
