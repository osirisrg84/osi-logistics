import { useState, useEffect, useCallback } from 'react';
import {
  Package, MapPin, CheckCircle, Truck, Phone,
  Clock, Star, Navigation, LogOut, User, Activity,
  Power, Coffee, AlertTriangle, Sun, Moon, Plus, X, Home, Briefcase, Wallet, Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ordersApi, driversApi, billingApi } from '../services/api';
import { Order, Driver, DriverStatus } from '../types';
import { OrderStatusBadge, PriorityBadge } from '../components/StatusBadge';
import { format, formatDistanceToNow } from 'date-fns';
import { getSocket } from '../services/socket';
import Map3D from '../components/Map3D';

function calcAuthority(since: string): string {
  if (!since) return '';
  const start = new Date(since);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months--;
  if (months < 0) { years--; months += 12; }
  if (years === 0) return `${months} mes${months !== 1 ? 'es' : ''}`;
  if (months === 0) return `${years} año${years !== 1 ? 's' : ''}`;
  return `${years} año${years !== 1 ? 's' : ''}, ${months} mes${months !== 1 ? 'es' : ''}`;
}

const STATUS_FLOW: Record<string, { next: string; label: string; color: string }> = {
  assigned:  { next: 'picked_up', label: 'Confirm Pickup',    color: 'bg-blue-500 hover:bg-blue-600'   },
  picked_up: { next: 'in_transit', label: 'Start Delivery',   color: 'bg-purple-500 hover:bg-purple-600' },
  in_transit:{ next: 'delivered',  label: 'Mark Delivered ✓', color: 'bg-green-500 hover:bg-green-600'  },
};

function OrderCard({ order, onStatusUpdate }: { order: Order; onStatusUpdate: (id: string, status: string) => void }) {
  const [updating, setUpdating] = useState(false);
  const flow = STATUS_FLOW[order.status];

  const handleUpdate = async () => {
    if (!flow) return;
    setUpdating(true);
    await onStatusUpdate(order.id, flow.next);
    setUpdating(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base font-bold text-gray-900 dark:text-white">{order.order_number}</span>
            <PriorityBadge priority={order.priority} />
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-green-600">${order.price.toFixed(2)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{order.distance_km} km</p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{order.customer_name}</p>
        <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-1 hover:text-blue-700 dark:hover:text-blue-300">
          <Phone className="w-3 h-3" /> {order.customer_phone}
        </a>
      </div>

      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPin className="w-3 h-3 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Pickup</p>
            <p className="text-sm text-gray-700 dark:text-slate-300">{order.pickup_address}</p>
          </div>
        </div>
        <div className="ml-3 w-0.5 h-4 bg-gray-200 dark:bg-slate-600" />
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPin className="w-3 h-3 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Delivery</p>
            <p className="text-sm text-gray-700 dark:text-slate-300">{order.delivery_address}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-400 dark:text-slate-500">Weight</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{order.weight_kg} kg</p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-400 dark:text-slate-500">Created</p>
          <p className="text-xs font-medium text-gray-900 dark:text-slate-100">{formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}</p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-2 text-center">
          <p className="text-xs text-gray-400 dark:text-slate-500">ETA</p>
          <p className="text-xs font-medium text-gray-900 dark:text-slate-100">
            {order.estimated_delivery ? format(new Date(order.estimated_delivery), 'HH:mm') : '—'}
          </p>
        </div>
      </div>

      {order.description && (
        <p className="text-xs text-gray-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">{order.description}</p>
      )}

      {flow && order.status !== 'delivered' && order.status !== 'cancelled' && (
        <button onClick={handleUpdate} disabled={updating}
          className={`w-full text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 ${flow.color}`}>
          {updating
            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><CheckCircle className="w-4 h-4" />{flow.label}</>}
        </button>
      )}

      {order.status === 'delivered' && (
        <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
          <CheckCircle className="w-5 h-5" />
          <span className="font-semibold text-sm">Delivered {order.delivered_at ? format(new Date(order.delivered_at), 'HH:mm') : ''}</span>
        </div>
      )}
    </div>
  );
}

const STATUS_CONFIG: Record<DriverStatus, { label: string; dot: string; bg: string; text: string }> = {
  available: { label: 'Online',      dot: 'bg-green-400',  bg: 'bg-green-50 dark:bg-green-900/30',   text: 'text-green-700 dark:text-green-400' },
  busy:      { label: 'On Delivery', dot: 'bg-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
  on_break:  { label: 'On Break',    dot: 'bg-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  offline:   { label: 'Offline',     dot: 'bg-gray-400',   bg: 'bg-gray-100 dark:bg-slate-700',      text: 'text-gray-500 dark:text-slate-400' },
};

type Tab = 'active' | 'delivered' | 'map' | 'profile' | 'payments';

export default function DriverPortal() {
  const { user, driverProfile, logout } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const driver = driverProfile as Driver | null;

  const [driverStatus, setDriverStatus] = useState<DriverStatus>((driver?.status as DriverStatus) ?? 'offline');
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [deliveredToday, setDeliveredToday] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>('active');
  const [loading, setLoading] = useState(true);

  // ── Favorites ────────────────────────────────────────────
  interface Favorite { id: string; name: string; address: string; type: 'home' | 'work' | 'frequent' | 'other'; }
  const FAV_PRESETS = [
    { type: 'home'     as const, label: 'Casa',            icon: '🏠' },
    { type: 'work'     as const, label: 'Zona de trabajo', icon: '🏢' },
    { type: 'frequent' as const, label: 'Lugar frecuente', icon: '⭐' },
    { type: 'other'    as const, label: 'Otro',            icon: '📍' },
  ];
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [showAddFav, setShowAddFav] = useState(false);
  const [newFav, setNewFav] = useState({ name: '', address: '', type: 'home' as Favorite['type'] });
  const [savingFav, setSavingFav] = useState(false);
  const [favError, setFavError] = useState('');

  // Use driver.id as the primary ID — it comes directly from the loaded driverProfile
  const driverId = driver?.id ?? user?.driver_id ?? '';

  const addFavorite = async () => {
    if (!newFav.name.trim() || !newFav.address.trim() || !driverId) return;
    setSavingFav(true);
    setFavError('');
    try {
      const { data } = await driversApi.addFavorite(driverId, newFav);
      setFavorites(prev => [...prev, data as Favorite]);
      setNewFav({ name: '', address: '', type: 'home' });
      setShowAddFav(false);
    } catch {
      setFavError('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSavingFav(false);
    }
  };
  const deleteFavorite = async (id: string) => {
    if (!driverId) return;
    try {
      await driversApi.deleteFavorite(driverId, id);
      setFavorites(prev => prev.filter(f => f.id !== id));
    } catch {}
  };

  // ── Driver billing ────────────────────────────────────────
  interface DriverBillingRow {
    id: string; order_number: string; order_price: number;
    driver_charge: number; delivery_date: string | null; status: 'pending' | 'settled';
  }
  interface DriverBillingSummary { total_charged: number; settled: number; pending: number; }
  const [billingRows, setBillingRows] = useState<DriverBillingRow[]>([]);
  const [billingSummary, setBillingSummary] = useState<DriverBillingSummary | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user?.driver_id) return;
    try {
      const [assignedRes, pickedRes, transitRes, delivRes] = await Promise.all([
        ordersApi.getAll({ driver_id: user.driver_id, status: 'assigned' }),
        ordersApi.getAll({ driver_id: user.driver_id, status: 'picked_up' }),
        ordersApi.getAll({ driver_id: user.driver_id, status: 'in_transit' }),
        ordersApi.getAll({ driver_id: user.driver_id, status: 'delivered' }),
      ]);
      setActiveOrders([...assignedRes.data.orders, ...pickedRes.data.orders, ...transitRes.data.orders]);
      setDeliveredToday(delivRes.data.orders.slice(0, 10));
    } catch {
    } finally {
      setLoading(false);
    }
  }, [user?.driver_id]);

  useEffect(() => {
    if (driver?.status) setDriverStatus(driver.status as DriverStatus);
  }, [driver?.status]);

  useEffect(() => {
    fetchOrders();
    if (driverId) {
      driversApi.getFavorites(driverId)
        .then(r => setFavorites(r.data as Favorite[]))
        .catch(() => {});
      billingApi.getRecords({ driver_id: driverId })
        .then(r => {
          const rows = r.data as DriverBillingRow[];
          setBillingRows(rows.slice(0, 20));
          const total = rows.reduce((s, r) => s + r.driver_charge, 0);
          const settled = rows.filter(r => r.status === 'settled').reduce((s, r) => s + r.driver_charge, 0);
          setBillingSummary({ total_charged: total, settled, pending: total - settled });
        })
        .catch(() => {});
    }
    const socket = getSocket();
    socket.emit('subscribe_orders');
    socket.on('order_updated', () => fetchOrders());
    return () => { socket.off('order_updated'); };
  }, [fetchOrders, user?.driver_id]);

  const setStatus = async (newStatus: DriverStatus) => {
    if (!user?.driver_id || togglingStatus) return;
    setTogglingStatus(true);
    try {
      await driversApi.update(user.driver_id, { status: newStatus });
      setDriverStatus(newStatus);
    } catch {
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, status: string) => {
    await ordersApi.updateStatus(orderId, { status });
    await fetchOrders();
  };

  const isBusy = activeOrders.some(o => ['picked_up', 'in_transit'].includes(o.status));
  const todayRevenue = deliveredToday.reduce((sum, o) => sum + o.price, 0);
  const cfg = STATUS_CONFIG[driverStatus];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-16">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="bg-slate-900 text-white px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          {/* OSI Logistics branding */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">OSI Logistics</p>
              <p className="text-[10px] text-slate-400 leading-tight">Driver Portal</p>
            </div>
          </div>

          {/* Action buttons only */}
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="p-2 hover:bg-slate-800 rounded-lg transition-colors" title={dark ? 'Light mode' : 'Dark mode'}>
              {dark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
            </button>
            <button onClick={logout} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
              <LogOut className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Online / Offline controls ───────────────────────── */}
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
        {/* Driver identity card */}
        <div className="max-w-lg mx-auto mb-3">
          <div className="flex items-center gap-3 bg-slate-700/50 border border-slate-600/50 rounded-2xl px-4 py-2.5">
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
              driverStatus === 'offline' ? 'bg-slate-500' : 'bg-orange-500'
            }`}>
              <span className="text-white">{user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'D'}</span>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{driver?.name || user?.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot} ${driverStatus === 'available' ? 'pulse-dot' : ''}`} />
                <span className={`text-xs font-medium ${
                  driverStatus === 'available' ? 'text-green-400' :
                  driverStatus === 'busy'      ? 'text-orange-400' :
                  driverStatus === 'on_break'  ? 'text-yellow-400' : 'text-slate-400'
                }`}>{cfg.label}</span>
                {driver?.plate_number && (
                  <span className="text-xs text-slate-500">· {driver.plate_number}</span>
                )}
              </div>
            </div>
            {/* Rating badge */}
            {driver?.rating && (
              <div className="flex items-center gap-1 bg-slate-600/60 rounded-xl px-2.5 py-1 flex-shrink-0">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-xs font-bold text-white">{driver.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
        <div className="max-w-lg mx-auto">
          {driverStatus === 'offline' ? (
            <button onClick={() => setStatus('available')} disabled={togglingStatus}
              className="w-full bg-green-500 hover:bg-green-400 active:scale-95 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-green-500/25">
              {togglingStatus
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Power className="w-5 h-5" />}
              <span className="text-base">Go Online</span>
            </button>
          ) : (
            <div className="space-y-2">
              <div className={`flex items-center justify-between ${cfg.bg} rounded-xl px-4 py-2.5`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot} ${driverStatus === 'available' ? 'pulse-dot' : ''}`} />
                  <span className={`text-sm font-semibold ${cfg.text}`}>{cfg.label}</span>
                  {isBusy && driverStatus !== 'busy' && (
                    <span className="text-xs text-orange-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Active delivery
                    </span>
                  )}
                </div>
                <span className={`text-xs ${cfg.text} opacity-70`}>
                  {activeOrders.length} order{activeOrders.length !== 1 ? 's' : ''} active
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {driverStatus !== 'on_break' ? (
                  <button onClick={() => setStatus('on_break')} disabled={togglingStatus || isBusy}
                    className="flex items-center justify-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-medium py-2.5 rounded-xl transition-colors disabled:opacity-40 text-sm"
                    title={isBusy ? 'Finish your delivery first' : 'Take a break'}>
                    <Coffee className="w-4 h-4" /> Take a Break
                  </button>
                ) : (
                  <button onClick={() => setStatus('available')} disabled={togglingStatus}
                    className="flex items-center justify-center gap-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 font-medium py-2.5 rounded-xl transition-colors text-sm">
                    <Power className="w-4 h-4" /> Resume
                  </button>
                )}
                <button onClick={() => setStatus('offline')} disabled={togglingStatus || isBusy}
                  className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-medium py-2.5 rounded-xl transition-colors disabled:opacity-40 text-sm"
                  title={isBusy ? 'Finish your delivery first' : 'Go offline'}>
                  <Power className="w-4 h-4" /> Go Offline
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-3">
        <div className="max-w-lg mx-auto grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-xl font-bold text-orange-600">{activeOrders.length}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Active Orders</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-green-600">${todayRevenue.toFixed(0)}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Today's Revenue</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-yellow-500">★ {driver?.rating?.toFixed(1) || '—'}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">My Rating</p>
          </div>
        </div>
      </div>

      {/* ── Content area ───────────────────────────────────── */}

      {/* Offline: 3D map fullscreen */}
      {driverStatus === 'offline' && tab !== 'profile' && tab !== 'payments' && (
        <div className="relative" style={{ height: 'calc(100vh - 252px)', minHeight: 340 }}>
          <Map3D driver={driver} activeOrders={activeOrders} pitch={52} />
          <div className="absolute inset-x-0 top-0 h-16 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25), transparent)' }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 pointer-events-none">
            <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl px-6 py-5 text-center shadow-2xl border border-white/10 w-full max-w-xs pointer-events-auto">
              <div className="w-14 h-14 bg-slate-700/80 rounded-full flex items-center justify-center mx-auto mb-3">
                <Power className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">You're Offline</h3>
              <p className="text-xs text-slate-400 mb-4">Go online to receive deliveries</p>
              <button onClick={() => setStatus('available')} disabled={togglingStatus}
                className="w-full bg-green-500 hover:bg-green-400 active:scale-95 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/30">
                {togglingStatus
                  ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Power className="w-5 h-5" />}
                Go Online Now
              </button>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)' }} />
        </div>
      )}

      {/* Online content */}
      {driverStatus !== 'offline' && (
        <div className="max-w-lg mx-auto px-4 py-5">

          {tab === 'active' && (
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-12 text-gray-400 dark:text-slate-500">Loading orders...</div>
              ) : activeOrders.length === 0 ? (
                <div className="text-center py-16">
                  <Package className="w-12 h-12 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-slate-400 font-medium">No active orders</p>
                  <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">New orders will appear here when assigned</p>
                </div>
              ) : (
                activeOrders.map(order => (
                  <OrderCard key={order.id} order={order} onStatusUpdate={handleStatusUpdate} />
                ))
              )}
            </div>
          )}

          {tab === 'delivered' && (
            <div className="space-y-3">
              {deliveredToday.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle className="w-12 h-12 text-gray-200 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-slate-400 font-medium">No deliveries yet today</p>
                </div>
              ) : (
                deliveredToday.map(order => (
                  <div key={order.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{order.order_number}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{order.customer_name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{order.delivery_address}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">${order.price.toFixed(2)}</p>
                      {order.delivered_at && (
                        <p className="text-xs text-gray-400 dark:text-slate-500">{format(new Date(order.delivered_at), 'HH:mm')}</p>
                      )}
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                        <span className="text-xs text-green-600">Delivered</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'map' && driver && (
            <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-slate-700" style={{ height: 420 }}>
              <Map3D driver={driver} activeOrders={activeOrders} pitch={48} />
            </div>
          )}

        </div>
      )}

      {/* Profile tab — visible regardless of online status */}
      {tab === 'profile' && driver && (
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
          {/* Driver card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                {driver.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white text-base">{driver.name}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">{driver.email}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{driver.phone}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Deliveries', value: driver.total_deliveries, icon: Package },
                { label: 'On-Time Rate',     value: `${driver.on_time_rate.toFixed(0)}%`, icon: Clock },
                { label: 'License',          value: driver.license_number, icon: Truck },
                { label: 'Rating',           value: `★ ${driver.rating.toFixed(1)}`, icon: Star },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                    <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Truck info */}
          {driver.plate_number && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">My Truck</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                  <Truck className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{driver.make} {driver.model}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{driver.plate_number}</p>
                </div>
              </div>
            </div>
          )}

          {/* Empresa / Autoridad MC */}
          {(driver.company_name || driver.mc_number) && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-green-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Empresa / Autoridad</h3>
              </div>
              <div className="space-y-2.5">
                {driver.company_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-slate-400">Nombre de compañía</span>
                    <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{driver.company_name}</span>
                  </div>
                )}
                {driver.mc_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-slate-400">MC# / Póliza Comercial</span>
                    <span className="text-sm font-mono font-medium text-gray-800 dark:text-slate-200">{driver.mc_number}</span>
                  </div>
                )}
                {driver.authority_since && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Tiempo con autoridad</span>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">{calcAuthority(driver.authority_since)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lugares favoritos */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Lugares favoritos</h3>
              </div>
              {favorites.length < 5 && !showAddFav && (
                <button onClick={() => setShowAddFav(true)}
                  className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-semibold transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Agregar
                </button>
              )}
            </div>

            {favorites.length === 0 && !showAddFav && (
              <div className="text-center py-4">
                <MapPin className="w-8 h-8 text-gray-200 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-gray-400 dark:text-slate-500">No hay lugares guardados</p>
                <button onClick={() => setShowAddFav(true)}
                  className="mt-2 text-xs text-orange-500 hover:text-orange-600 font-medium">
                  + Agregar un lugar
                </button>
              </div>
            )}

            {favorites.length > 0 && (
              <div className="space-y-2 mb-3">
                {favorites.map(fav => {
                  const preset = FAV_PRESETS.find(p => p.type === fav.type);
                  return (
                    <div key={fav.id} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-700 rounded-xl px-3 py-2.5">
                      <span className="text-lg flex-shrink-0">{preset?.icon || '📍'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{fav.name}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{fav.address}</p>
                      </div>
                      <button onClick={() => deleteFavorite(fav.id)}
                        className="text-gray-300 dark:text-slate-600 hover:text-red-400 transition-colors flex-shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add form */}
            {showAddFav && (
              <div className="border-t border-gray-100 dark:border-slate-700 pt-3 space-y-2.5">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Nuevo lugar</p>
                {/* Type selector */}
                <div className="grid grid-cols-4 gap-1.5">
                  {FAV_PRESETS.map(p => (
                    <button key={p.type} onClick={() => setNewFav(f => ({ ...f, type: p.type }))}
                      className={`flex flex-col items-center gap-0.5 py-2 rounded-lg text-center transition-colors ${
                        newFav.type === p.type
                          ? 'bg-orange-100 dark:bg-orange-900/30 ring-1 ring-orange-400'
                          : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600'
                      }`}>
                      <span className="text-base">{p.icon}</span>
                      <span className="text-[9px] text-gray-600 dark:text-slate-400 leading-tight">{p.label}</span>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Nombre del lugar"
                  value={newFav.name}
                  onChange={e => setNewFav(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                />
                <input
                  type="text"
                  placeholder="Dirección"
                  value={newFav.address}
                  onChange={e => setNewFav(f => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-400/40"
                />
                {favError && (
                  <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{favError}</p>
                )}
                <div className="flex gap-2">
                  <button onClick={() => { setShowAddFav(false); setFavError(''); setNewFav({ name: '', address: '', type: 'home' }); }}
                    className="flex-1 py-2 rounded-xl text-sm text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={addFavorite} disabled={!newFav.name.trim() || !newFav.address.trim() || savingFav}
                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                    {savingFav
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <><Plus className="w-4 h-4" /> Guardar</>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Pagos shortcut */}
          <button
            onClick={() => setTab('payments')}
            className="w-full bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-4 flex items-center justify-between hover:border-orange-300 dark:hover:border-orange-600 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
                <Wallet className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Mis Pagos a OSI</p>
                {billingSummary && billingSummary.pending > 0 ? (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                    ${billingSummary.pending.toFixed(2)} pendiente
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-slate-500">Ver historial de pagos</p>
                )}
              </div>
            </div>
            <span className="text-gray-300 dark:text-slate-600 text-lg">›</span>
          </button>
        </div>
      )}

      {/* Payments tab — always accessible */}
      {tab === 'payments' && (
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Mis Pagos a OSI</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              OSI Logistics cobra el <span className="font-semibold text-red-500">8%</span> por cada carga conseguida
            </p>
          </div>

          {/* Summary */}
          {billingSummary && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-3 text-center">
                <p className="text-[10px] text-gray-500 dark:text-slate-400 mb-1">Total cobrado</p>
                <p className="text-lg font-bold text-red-600">${billingSummary.total_charged.toFixed(2)}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-3 text-center">
                <p className="text-[10px] text-gray-500 dark:text-slate-400 mb-1">Liquidado</p>
                <p className="text-lg font-bold text-green-600">${billingSummary.settled.toFixed(2)}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-3 text-center">
                <p className="text-[10px] text-gray-500 dark:text-slate-400 mb-1">Pendiente</p>
                <p className="text-lg font-bold text-yellow-600">${billingSummary.pending.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* Records */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            {billingRows.length === 0 ? (
              <div className="py-10 text-center">
                <Wallet className="w-10 h-10 text-gray-200 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-gray-400 dark:text-slate-500">Sin pagos registrados</p>
                <p className="text-xs text-gray-300 dark:text-slate-600 mt-1">Aparecen cuando se confirman tus entregas</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {billingRows.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{r.order_number}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                        ${r.order_price.toFixed(2)} × 8% = <span className="text-red-500 font-semibold">${r.driver_charge.toFixed(2)}</span>
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      r.status === 'settled'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                    }`}>
                      {r.status === 'settled' ? 'Liquidado' : 'Pendiente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Fixed Bottom Navigation ─────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-slate-900 border-t border-slate-700 flex items-stretch">
        {([
          { id: 'active',    icon: Activity,    label: 'Active',  badge: activeOrders.length },
          { id: 'delivered', icon: CheckCircle, label: 'Done',    badge: deliveredToday.length },
          { id: 'map',       icon: Navigation,  label: 'Map',     badge: 0 },
          { id: 'payments',  icon: Wallet,      label: 'Pagos',   badge: (billingSummary?.pending ?? 0) > 0 ? 1 : 0 },
          { id: 'profile',   icon: User,        label: 'Perfil',  badge: 0 },
        ] as const).map(({ id, icon: Icon, label, badge }) => {
          const isActive = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors relative ${
                isActive ? 'text-orange-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute top-0 inset-x-3 h-0.5 bg-orange-500 rounded-full" />
              )}
              <div className="relative">
                <Icon className="w-5 h-5" />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </nav>

    </div>
  );
}
