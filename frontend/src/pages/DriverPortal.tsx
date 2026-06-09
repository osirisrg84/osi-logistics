import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import {
  Package, MapPin, CheckCircle, Truck, Phone,
  Clock, Star, Navigation, LogOut, User, Activity,
  Power, Coffee, AlertTriangle, Sun, Moon, Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ordersApi, driversApi } from '../services/api';
import { Order, Driver, DriverStatus } from '../types';
import { OrderStatusBadge, PriorityBadge } from '../components/StatusBadge';
import { format, formatDistanceToNow } from 'date-fns';
import { getSocket } from '../services/socket';
import WorldMapView from '../components/WorldMapView';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const STATUS_FLOW: Record<string, { next: string; label: string; color: string }> = {
  assigned: { next: 'picked_up', label: 'Confirm Pickup', color: 'bg-blue-500 hover:bg-blue-600' },
  picked_up: { next: 'in_transit', label: 'Start Delivery', color: 'bg-purple-500 hover:bg-purple-600' },
  in_transit: { next: 'delivered', label: 'Mark Delivered ✓', color: 'bg-green-500 hover:bg-green-600' },
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
      {/* Header */}
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

      {/* Customer */}
      <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{order.customer_name}</p>
        <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-1 hover:text-blue-700 dark:hover:text-blue-300">
          <Phone className="w-3 h-3" /> {order.customer_phone}
        </a>
      </div>

      {/* Route */}
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

      {/* Details */}
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

      {/* Description */}
      {order.description && (
        <p className="text-xs text-gray-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">{order.description}</p>
      )}

      {/* Action button */}
      {flow && order.status !== 'delivered' && order.status !== 'cancelled' && (
        <button
          onClick={handleUpdate}
          disabled={updating}
          className={`w-full text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 ${flow.color}`}
        >
          {updating ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              {flow.label}
            </>
          )}
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

export default function DriverPortal() {
  const { user, driverProfile, logout } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const driver = driverProfile as Driver | null;

  const [driverStatus, setDriverStatus] = useState<DriverStatus>(
    (driver?.status as DriverStatus) ?? 'offline'
  );
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [deliveredToday, setDeliveredToday] = useState<Order[]>([]);
  const [tab, setTab] = useState<'active' | 'delivered' | 'map' | 'world'>('active');
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!user?.driver_id) return;
    try {
      const [assignedRes, pickedRes, transitRes, delivRes] = await Promise.all([
        ordersApi.getAll({ driver_id: user.driver_id, status: 'assigned' }),
        ordersApi.getAll({ driver_id: user.driver_id, status: 'picked_up' }),
        ordersApi.getAll({ driver_id: user.driver_id, status: 'in_transit' }),
        ordersApi.getAll({ driver_id: user.driver_id, status: 'delivered' }),
      ]);
      setActiveOrders([
        ...assignedRes.data.orders,
        ...pickedRes.data.orders,
        ...transitRes.data.orders,
      ]);
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
    const socket = getSocket();
    socket.emit('subscribe_orders');
    socket.on('order_updated', () => fetchOrders());
    return () => { socket.off('order_updated'); };
  }, [fetchOrders]);

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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-slate-900 text-white px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm relative ${
              driverStatus === 'offline' ? 'bg-slate-600' : 'bg-orange-500'
            }`}>
              {driver?.avatar || user?.name?.charAt(0) || 'D'}
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${cfg.dot}`} />
            </div>
            <div>
              <p className="font-semibold text-sm">{driver?.name || user?.name}</p>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${
                  driverStatus === 'available' ? 'text-green-400' :
                  driverStatus === 'busy' ? 'text-orange-400' :
                  driverStatus === 'on_break' ? 'text-yellow-400' : 'text-slate-500'
                }`}>{cfg.label}</span>
                {driver?.plate_number && (
                  <span className="text-xs text-slate-500">· {driver.make} {driver.model}</span>
                )}
              </div>
            </div>
          </div>
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

      {/* Online / Offline controls */}
      <div className="bg-slate-800 px-4 py-3 border-b border-slate-700">
        <div className="max-w-lg mx-auto">
          {driverStatus === 'offline' ? (
            <button
              onClick={() => setStatus('available')}
              disabled={togglingStatus}
              className="w-full bg-green-500 hover:bg-green-400 active:scale-95 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-green-500/25"
            >
              {togglingStatus
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Power className="w-5 h-5" />
              }
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
                {driverStatus !== 'on_break' && (
                  <button
                    onClick={() => setStatus('on_break')}
                    disabled={togglingStatus || isBusy}
                    className="flex items-center justify-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-medium py-2.5 rounded-xl transition-colors disabled:opacity-40 text-sm"
                    title={isBusy ? 'Finish your delivery first' : 'Take a break'}
                  >
                    <Coffee className="w-4 h-4" />
                    Take a Break
                  </button>
                )}
                {driverStatus === 'on_break' && (
                  <button
                    onClick={() => setStatus('available')}
                    disabled={togglingStatus}
                    className="flex items-center justify-center gap-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 font-medium py-2.5 rounded-xl transition-colors text-sm"
                  >
                    <Power className="w-4 h-4" />
                    Resume
                  </button>
                )}
                <button
                  onClick={() => setStatus('offline')}
                  disabled={togglingStatus || isBusy}
                  className="flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-medium py-2.5 rounded-xl transition-colors disabled:opacity-40 text-sm"
                  title={isBusy ? 'Finish your delivery first' : 'Go offline'}
                >
                  <Power className="w-4 h-4" />
                  Go Offline
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
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

      {/* Offline state */}
      {driverStatus === 'offline' && (
        <div className="max-w-lg mx-auto px-4 py-12 text-center">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-5">
            <Power className="w-9 h-9 text-gray-300 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-700 dark:text-slate-200 mb-2">You're Offline</h3>
          <p className="text-sm text-gray-400 dark:text-slate-400 mb-6">
            Go online to start receiving and managing deliveries.
          </p>
          <button
            onClick={() => setStatus('available')}
            disabled={togglingStatus}
            className="mx-auto bg-green-500 hover:bg-green-400 text-white font-bold px-8 py-3.5 rounded-2xl transition-all flex items-center gap-3 shadow-lg shadow-green-500/20"
          >
            {togglingStatus
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Power className="w-5 h-5" />
            }
            Go Online Now
          </button>
        </div>
      )}

      {/* Tabs + Content */}
      {driverStatus !== 'offline' && <>
      <div className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
        <div className="max-w-lg mx-auto flex">
          {[
            { id: 'active',    label: `Active (${activeOrders.length})`,        icon: Activity     },
            { id: 'delivered', label: `Done (${deliveredToday.length})`,         icon: CheckCircle  },
            { id: 'map',       label: 'My Map',                                  icon: Navigation   },
            { id: 'world',     label: 'World',                                   icon: Globe        },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id as typeof tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                  : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

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
          <div className="rounded-2xl overflow-hidden h-96 shadow-sm border border-gray-100 dark:border-slate-700">
            <MapContainer
              center={[driver.current_lat || 25.7617, driver.current_lng || -80.1918]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {driver && (
                <Marker position={[driver.current_lat, driver.current_lng]}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{driver.name}</p>
                      <p className="text-gray-500">{driver.current_address}</p>
                    </div>
                  </Popup>
                </Marker>
              )}
              {activeOrders.filter(o => o.delivery_lat && o.delivery_lng).map(order => (
                <Marker key={order.id} position={[order.delivery_lat, order.delivery_lng]}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{order.order_number}</p>
                      <p className="text-gray-500">{order.customer_name}</p>
                      <p className="text-gray-400 text-xs">{order.delivery_address}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        )}

        {tab === 'world' && <WorldMapView />}

        {/* Driver profile card — hidden on world tab */}
        {driver && tab !== 'world' && (
          <div className="mt-5 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <div className="flex items-center gap-3 mb-4">
              <User className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">My Profile</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Deliveries', value: driver.total_deliveries, icon: Package },
                { label: 'On-Time Rate', value: `${driver.on_time_rate.toFixed(0)}%`, icon: Clock },
                { label: 'License', value: driver.license_number, icon: Truck },
                { label: 'Rating', value: `★ ${driver.rating.toFixed(1)}`, icon: Star },
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
        )}
      </div>
      </>}
    </div>
  );
}
