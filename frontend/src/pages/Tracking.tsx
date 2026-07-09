import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Users, MapPin, Navigation, Activity, RefreshCw, Wifi, WifiOff, Map as MapIcon, Truck } from 'lucide-react';
import { trackingApi, driversApi } from '../services/api';
import { Driver } from '../types';
import { getSocket } from '../services/socket';
import { DriverStatusBadge } from '../components/StatusBadge';
import { formatDistanceToNow } from 'date-fns';

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
      if (bounds.isValid()) { map.fitBounds(bounds, { padding: [40, 40] }); hasInit.current = true; }
    }
  }, [drivers, map]);
  return null;
}

interface LocationUpdate { driver_id: string; lat: number; lng: number; speed: number; heading: number; current_address?: string; }
interface StatusEvent { id: string; name: string; status: string; lat: number; lng: number; avatar: string; }
interface StatusToast { id: string; name: string; online: boolean; }

export default function Tracking() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [driverPath, setDriverPath] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [toasts, setToasts] = useState<StatusToast[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const driverRefs = useRef<Map<string, [number, number][]>>(new Map());
  const geocodeCache = useRef<Map<string, string>>(new Map());

  const showToast = (toast: StatusToast) => {
    setToasts(prev => [...prev, toast]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toast.id)), 4000);
  };

  const reverseGeocodeDriver = async (driverId: string, lat: number, lng: number): Promise<void> => {
    const key = `${Math.round(lat * 200) / 200},${Math.round(lng * 200) / 200}`;
    const cached = geocodeCache.current.get(key);
    if (cached !== undefined) {
      if (cached) setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, current_address: cached } : d));
      return;
    }
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'en-US,en' } }
      );
      const data = await r.json();
      const city  = data.address?.city || data.address?.town || data.address?.village || data.address?.county || '';
      const state = (data.address?.['ISO3166-2-lvl4'] as string | undefined)?.split('-')[1]
                 || (data.address?.state as string | undefined)?.slice(0, 2).toUpperCase()
                 || '';
      const address = city ? `${city}, ${state}` : '';
      geocodeCache.current.set(key, address);
      if (address) setDrivers(prev => prev.map(d => d.id === driverId ? { ...d, current_address: address } : d));
    } catch { geocodeCache.current.set(key, ''); }
  };

  const fetchLive = async () => {
    try {
      const { data } = await trackingApi.getLive();
      setDrivers(data);
      setLastUpdate(new Date());
      // Geocode drivers that have coordinates but no saved address
      for (const d of data as Driver[]) {
        if (!d.current_address && d.current_lat && d.current_lng) {
          reverseGeocodeDriver(d.id, d.current_lat, d.current_lng);
        }
      }
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
          return {
            ...d,
            current_lat: update.lat,
            current_lng: update.lng,
            ...(update.current_address ? { current_address: update.current_address } : {}),
          };
        }
        return d;
      }));
      setLastUpdate(new Date());
    });

    socket.on('driver_status_changed', async (event: StatusEvent) => {
      if (event.status === 'offline') return;
      setDrivers(prev => {
        const exists = prev.find(d => d.id === event.id);
        if (exists) return prev.map(d => d.id === event.id ? { ...d, status: event.status as Driver['status'] } : d);
        return [...prev, {
          id: event.id, name: event.name, status: event.status as Driver['status'],
          current_lat: event.lat, current_lng: event.lng, current_address: '',
          avatar: event.avatar, phone: '', email: '', license_number: '',
          license_expiry: '', truck_id: null, rating: 0, total_deliveries: 0,
          on_time_rate: 0, hire_date: '', created_at: '',
        } as Driver];
      });
      try {
        const { data } = await driversApi.getById(event.id);
        setDrivers(prev => prev.map(d => d.id === event.id ? { ...d, ...data.driver } : d));
      } catch {}
      showToast({ id: `${event.id}-${Date.now()}`, name: event.name, online: true });
    });

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
    setDriverPath(driverRefs.current.get(driver.id) || []);
    setViewMode('map');
  };

  const statusCounts = {
    available: drivers.filter(d => d.status === 'available').length,
    busy: drivers.filter(d => d.status === 'busy').length,
    on_break: drivers.filter(d => d.status === 'on_break').length,
  };

  const mapPanel = (
    <div className="w-full rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-slate-700 h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)]">
      <MapContainer center={[25.7617, -80.1918]} zoom={11} style={{ height: '100%', width: '100%' }}>
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
                {driver.current_address && (
                  <p className="text-xs text-green-600 font-medium mb-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                    {driver.current_address}
                  </p>
                )}
                {(driver as typeof driver & { equipment_type?: string }).equipment_type && (
                  <p className="text-xs font-medium text-blue-600 mb-1">
                    {(driver as typeof driver & { equipment_type?: string }).equipment_type}
                    {driver.make ? ` · ${driver.make}${driver.model ? ' ' + driver.model : ''}` : ''}
                  </p>
                )}
                {driver.order_number && driver.status !== 'available' && (
                  <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-orange-500" /> {driver.order_number}
                  </p>
                )}
                {driver.delivery_address && driver.status !== 'available' && (
                  <p className="text-xs text-gray-500 mt-0.5 pl-4">{driver.delivery_address}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">★ {driver.rating.toFixed(1)} · {(driver as typeof driver & { total_deliveries?: number }).total_deliveries ?? 0} trips</p>
              </div>
            </Popup>
          </Marker>
        ))}
        {selectedDriver && driverPath.length > 1 && (
          <Polyline positions={driverPath} color="#f97316" weight={3} opacity={0.7} dashArray="8 4" />
        )}
      </MapContainer>
    </div>
  );

  return (
    <div className="fade-in">
      {/* Status toasts */}
      <div className="fixed top-20 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-xl text-sm font-medium slide-in ${
            toast.online ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-200'
          }`}>
            {toast.online ? <Wifi className="w-4 h-4 flex-shrink-0" /> : <WifiOff className="w-4 h-4 flex-shrink-0" />}
            <span><span className="font-bold">{toast.name}</span>{toast.online ? ' is now online' : ' went offline'}</span>
          </div>
        ))}
      </div>

      {/* Mobile: list/map toggle */}
      <div className="md:hidden flex rounded-xl bg-gray-100 dark:bg-slate-800 p-1 gap-1 mb-3">
        <button
          onClick={() => setViewMode('list')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            viewMode === 'list'
              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-400 dark:text-slate-500'
          }`}
        >
          <Users className="w-4 h-4" /> Drivers ({drivers.length})
        </button>
        <button
          onClick={() => setViewMode('map')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            viewMode === 'map'
              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-400 dark:text-slate-500'
          }`}
        >
          <MapIcon className="w-4 h-4" /> Vista mapa
        </button>
      </div>

      {/* Mobile map view */}
      {viewMode === 'map' && <div className="md:hidden">{mapPanel}</div>}

      {/* List view (always on desktop, toggleable on mobile) */}
      <div className={`${viewMode === 'map' ? 'hidden md:flex' : 'flex'} flex-col md:flex-row md:h-[calc(100vh-8rem)] gap-3`}>

        {/* Left panel */}
        <div className="w-full md:w-72 flex flex-col gap-3 md:flex-shrink-0">

          {/* Stats */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Live Fleet</h3>
              <button onClick={fetchLive} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                <p className="text-lg font-bold text-green-600">{statusCounts.available}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Available</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2">
                <p className="text-lg font-bold text-orange-600">{statusCounts.busy}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Busy</p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2">
                <p className="text-lg font-bold text-yellow-600">{statusCounts.on_break}</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Break</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2 text-center flex items-center justify-center gap-1">
              <Activity className="w-3 h-3" /> Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
            </p>
          </div>

          {/* Driver list */}
          <div className="card p-0 flex-1 overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Active Drivers</h3>
              <span className="text-xs text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                {drivers.length} online
              </span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-slate-700/50">
              {loading ? (
                <div className="py-8 text-center text-gray-400 text-sm">Loading...</div>
              ) : drivers.length === 0 ? (
                <div className="py-10 text-center">
                  <Users className="w-8 h-8 text-gray-200 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 dark:text-slate-500">No drivers online</p>
                </div>
              ) : drivers.map(driver => (
                <button
                  key={driver.id}
                  onClick={() => handleSelectDriver(driver)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${
                    selectedDriver?.id === driver.id ? 'bg-orange-50 dark:bg-orange-900/20' : ''
                  }`}
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
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{driver.name}</p>
                      <DriverStatusBadge status={driver.status as never} className="mt-0.5" />
                    </div>
                    {/* Live indicator */}
                    <span className={`w-2 h-2 rounded-full animate-pulse flex-shrink-0 ${
                      driver.status === 'available' ? 'bg-green-400' :
                      driver.status === 'busy'      ? 'bg-red-400'   :
                      driver.status === 'on_break'  ? 'bg-yellow-400': 'bg-gray-400'
                    }`} title="Ubicación en tiempo real" />
                  </div>

                  {/* Current real-time location */}
                  {driver.current_address && (
                    <div className="mt-2 ml-12">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Navigation className="w-3 h-3 text-blue-500 flex-shrink-0" />
                        <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide">Ahora en</span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-slate-300 truncate pl-4">{driver.current_address}</p>
                    </div>
                  )}

                  {/* Active order destination — solo si tiene orden activa */}
                  {driver.order_number && driver.status !== 'available' && (
                    <div className="mt-1.5 ml-12">
                      <div className="flex items-center gap-1 mb-0.5">
                        <MapPin className="w-3 h-3 text-orange-500 flex-shrink-0" />
                        <span className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide">Destino · {driver.order_number}</span>
                      </div>
                      {driver.delivery_address && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate pl-4">{driver.delivery_address}</p>
                      )}
                    </div>
                  )}

                  {/* Equipment type */}
                  {(driver as typeof driver & { equipment_type?: string }).equipment_type && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5 ml-12 flex items-center gap-1.5">
                      <Truck className="w-3 h-3 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                        (driver as typeof driver & { equipment_type?: string }).equipment_type === 'Reefer'    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                        (driver as typeof driver & { equipment_type?: string }).equipment_type === 'Flatbed'   ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' :
                        (driver as typeof driver & { equipment_type?: string }).equipment_type === 'Box Truck' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                        'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                      }`}>
                        {(driver as typeof driver & { equipment_type?: string }).equipment_type}
                      </span>
                      {driver.make && driver.model && (
                        <span>{driver.make} {driver.model}</span>
                      )}
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
                <div className="w-9 h-9 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {selectedDriver.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{selectedDriver.name}</p>
                  {selectedDriver.current_address && (
                    <p className="text-xs text-slate-400 truncate">{selectedDriver.current_address}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                <div className="bg-slate-800 rounded-lg p-2">
                  <p className="text-slate-400">Rating</p>
                  <p className="font-semibold">★ {selectedDriver.rating.toFixed(1)}</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-2">
                  <p className="text-slate-400">Deliveries</p>
                  <p className="font-semibold">{selectedDriver.total_deliveries}</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-2 col-span-2">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    <p className="text-slate-400 text-[10px] uppercase tracking-wide">Ubicación en tiempo real</p>
                  </div>
                  <p className="font-mono text-xs">{selectedDriver.current_lat.toFixed(5)}, {selectedDriver.current_lng.toFixed(5)}</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedDriver(null); setDriverPath([]); }}
                className="w-full text-xs text-slate-400 hover:text-white transition-colors"
              >
                Limpiar selección
              </button>
            </div>
          )}
        </div>

        {/* Map — desktop always, mobile hidden (toggle handles it) */}
        <div className="hidden md:flex flex-1">
          {mapPanel}
        </div>

      </div>
    </div>
  );
}
