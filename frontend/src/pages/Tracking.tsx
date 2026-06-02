import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Users, Package, Navigation, Activity, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { trackingApi, driversApi } from '../services/api';
import { Driver } from '../types';
import { getSocket } from '../services/socket';
import { DriverStatusBadge } from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createDriverIcon(status: string, initials: string): L.DivIcon {
  const colors: Record<string, string> = {
    available: '#22c55e',
    busy: '#f97316',
    on_break: '#eab308',
    offline: '#94a3b8',
  };
  const color = colors[status] || '#94a3b8';

  return L.divIcon({
    html: `
      <div style="position:relative;width:40px;height:40px">
        <div style="
          width:36px;height:36px;background:${color};
          border:3px solid white;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          font-size:11px;font-weight:bold;color:white;
          box-shadow:0 3px 10px rgba(0,0,0,0.25);
          font-family:Inter,sans-serif;
        ">${initials}</div>
        <div style="
          position:absolute;bottom:-2px;right:-2px;
          width:12px;height:12px;background:${color};
          border:2px solid white;border-radius:50%;
        "></div>
      </div>
    `,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function MapUpdater({ drivers }: { drivers: Driver[] }) {
  const map = useMap();
  const hasInit = useRef(false);

  useEffect(() => {
    if (!hasInit.current && drivers.length > 0) {
      const bounds = L.latLngBounds(drivers.map(d => [d.current_lat, d.current_lng]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
        hasInit.current = true;
      }
    }
  }, [drivers, map]);

  return null;
}

interface LocationUpdate {
  driver_id: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
}

interface StatusEvent {
  id: string;
  name: string;
  status: string;
  lat: number;
  lng: number;
  avatar: string;
}

interface StatusToast {
  id: string;
  name: string;
  online: boolean;
}

export default function Tracking() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [driverPath, setDriverPath] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [toasts, setToasts] = useState<StatusToast[]>([]);
  const driverRefs = useRef<Map<string, [number, number][]>>(new Map());

  const showToast = (toast: StatusToast) => {
    setToasts(prev => [...prev, toast]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toast.id)), 4000);
  };

  const fetchLive = async () => {
    try {
      const { data } = await trackingApi.getLive();
      setDrivers(data);
      setLastUpdate(new Date());
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLive();
    const socket = getSocket();
    socket.emit('subscribe_tracking');

    socket.on('location_update', (updates: LocationUpdate[]) => {
      setDrivers(prev => prev.map(d => {
        const update = updates.find(u => u.driver_id === d.id);
        if (update) {
          const path = driverRefs.current.get(d.id) || [];
          path.push([update.lat, update.lng]);
          if (path.length > 30) path.shift();
          driverRefs.current.set(d.id, path);
          return { ...d, current_lat: update.lat, current_lng: update.lng };
        }
        return d;
      }));
      setLastUpdate(new Date());
    });

    // Driver came online — fetch their full profile and add to map
    socket.on('driver_status_changed', async (event: StatusEvent) => {
      if (event.status === 'offline') return; // handled by driver_went_offline
      setDrivers(prev => {
        const exists = prev.find(d => d.id === event.id);
        if (exists) {
          // Just update status
          return prev.map(d => d.id === event.id ? { ...d, status: event.status as Driver['status'] } : d);
        }
        // New driver came online — add minimal record, full data comes from API call below
        return [...prev, {
          id: event.id, name: event.name, status: event.status as Driver['status'],
          current_lat: event.lat, current_lng: event.lng, current_address: '',
          avatar: event.avatar, phone: '', email: '', license_number: '',
          license_expiry: '', truck_id: null, rating: 0, total_deliveries: 0,
          on_time_rate: 0, hire_date: '', created_at: '',
        } as Driver];
      });
      // Fetch full driver data to get truck info, etc.
      try {
        const { data } = await driversApi.getById(event.id);
        setDrivers(prev => prev.map(d => d.id === event.id ? { ...d, ...data.driver } : d));
      } catch {}
      showToast({ id: `${event.id}-${Date.now()}`, name: event.name, online: true });
    });

    // Driver went offline — remove from map
    socket.on('driver_went_offline', ({ id }: { id: string }) => {
      setDrivers(prev => {
        const driver = prev.find(d => d.id === id);
        if (driver) showToast({ id: `${id}-${Date.now()}`, name: driver.name, online: false });
        return prev.filter(d => d.id !== id);
      });
      driverRefs.current.delete(id);
    });

    return () => {
      socket.off('location_update');
      socket.off('driver_status_changed');
      socket.off('driver_went_offline');
    };
  }, []);

  const handleSelectDriver = async (driver: Driver) => {
    setSelectedDriver(driver);
    const path = driverRefs.current.get(driver.id) || [];
    setDriverPath(path);
  };

  const statusCounts = {
    available: drivers.filter(d => d.status === 'available').length,
    busy: drivers.filter(d => d.status === 'busy').length,
    on_break: drivers.filter(d => d.status === 'on_break').length,
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 fade-in relative">
      {/* Status toasts */}
      <div className="fixed top-20 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-xl text-sm font-medium slide-in ${
              toast.online
                ? 'bg-green-500 text-white'
                : 'bg-slate-700 text-slate-200'
            }`}>
            {toast.online
              ? <Wifi className="w-4 h-4 flex-shrink-0" />
              : <WifiOff className="w-4 h-4 flex-shrink-0" />
            }
            <span>
              <span className="font-bold">{toast.name}</span>
              {toast.online ? ' is now online' : ' went offline'}
            </span>
          </div>
        ))}
      </div>
      {/* Left Panel */}
      <div className="w-72 flex flex-col gap-3 flex-shrink-0">
        {/* Status summary */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Live Fleet</h3>
            <button onClick={fetchLive} className="p-1 hover:bg-gray-100 rounded-lg">
              <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-green-50 rounded-lg p-2">
              <p className="text-lg font-bold text-green-600">{statusCounts.available}</p>
              <p className="text-xs text-gray-500">Available</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-2">
              <p className="text-lg font-bold text-orange-600">{statusCounts.busy}</p>
              <p className="text-xs text-gray-500">Busy</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-2">
              <p className="text-lg font-bold text-yellow-600">{statusCounts.on_break}</p>
              <p className="text-xs text-gray-500">Break</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center flex items-center justify-center gap-1">
            <Activity className="w-3 h-3" />
            Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
          </p>
        </div>

        {/* Driver list */}
        <div className="card p-0 flex-1 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Active Drivers</h3>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="py-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : drivers.map(driver => (
              <button
                key={driver.id}
                onClick={() => handleSelectDriver(driver)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedDriver?.id === driver.id ? 'bg-orange-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
                    driver.status === 'available' ? 'bg-green-500' :
                    driver.status === 'busy' ? 'bg-orange-500' :
                    driver.status === 'on_break' ? 'bg-yellow-500' : 'bg-gray-400'
                  }`}>
                    {driver.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{driver.name}</p>
                    <DriverStatusBadge status={driver.status as never} className="mt-0.5" />
                  </div>
                </div>
                {driver.order_number && (
                  <div className="mt-2 ml-12">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Package className="w-3 h-3" /> {driver.order_number}
                    </p>
                    {driver.delivery_address && (
                      <p className="text-xs text-gray-400 truncate">{driver.delivery_address}</p>
                    )}
                  </div>
                )}
                {driver.plate_number && (
                  <p className="text-xs text-gray-400 mt-1 ml-12">
                    {driver.make} {driver.model} · {driver.plate_number}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Selected driver detail */}
        {selectedDriver && (
          <div className="card p-4 bg-slate-900 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {selectedDriver.avatar}
              </div>
              <div>
                <p className="text-sm font-semibold">{selectedDriver.name}</p>
                <p className="text-xs text-slate-400">{selectedDriver.current_address}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800 rounded-lg p-2">
                <p className="text-slate-400">Rating</p>
                <p className="font-semibold">★ {selectedDriver.rating.toFixed(1)}</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-2">
                <p className="text-slate-400">Deliveries</p>
                <p className="font-semibold">{selectedDriver.total_deliveries}</p>
              </div>
              <div className="bg-slate-800 rounded-lg p-2 col-span-2">
                <p className="text-slate-400">Location</p>
                <p className="font-mono text-xs">{selectedDriver.current_lat.toFixed(4)}, {selectedDriver.current_lng.toFixed(4)}</p>
              </div>
            </div>
            <button
              onClick={() => { setSelectedDriver(null); setDriverPath([]); }}
              className="mt-3 w-full text-xs text-slate-400 hover:text-white"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden shadow-sm border border-gray-100">
        <MapContainer
          center={[25.7617, -80.1918]}
          zoom={11}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater drivers={drivers} />

          {drivers.map(driver => (
            <Marker
              key={driver.id}
              position={[driver.current_lat, driver.current_lng]}
              icon={createDriverIcon(driver.status, driver.avatar || 'D')}
              eventHandlers={{ click: () => handleSelectDriver(driver) }}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      driver.status === 'available' ? 'bg-green-500' :
                      driver.status === 'busy' ? 'bg-orange-500' : 'bg-yellow-500'
                    }`}>{driver.avatar}</div>
                    <div>
                      <p className="font-semibold text-sm">{driver.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{driver.status.replace('_', ' ')}</p>
                    </div>
                  </div>
                  {driver.plate_number && (
                    <p className="text-xs text-gray-600 mb-1">
                      🚛 {driver.make} {driver.model} · {driver.plate_number}
                    </p>
                  )}
                  {driver.order_number && (
                    <p className="text-xs text-blue-600 font-medium">
                      📦 {driver.order_number}
                    </p>
                  )}
                  {driver.delivery_address && (
                    <p className="text-xs text-gray-500 mt-1">{driver.delivery_address}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    ★ {driver.rating.toFixed(1)} · {driver.total_deliveries} trips
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}

          {selectedDriver && driverPath.length > 1 && (
            <Polyline
              positions={driverPath}
              color="#f97316"
              weight={3}
              opacity={0.7}
              dashArray="8 4"
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
