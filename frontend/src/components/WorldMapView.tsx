import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { driversApi } from '../services/api';
import { Driver } from '../types';

// ── Operating countries ──────────────────────────────────────────────────────
const COUNTRIES = [
  { code: 'US', name: 'United States',      flag: '🇺🇸', lat: 37.09,  lng: -95.71, tier: 'hub'     },
  { code: 'MX', name: 'Mexico',             flag: '🇲🇽', lat: 23.63,  lng: -102.55, tier: 'active'  },
  { code: 'CO', name: 'Colombia',           flag: '🇨🇴', lat: 4.57,   lng: -74.30,  tier: 'active'  },
  { code: 'BR', name: 'Brazil',             flag: '🇧🇷', lat: -14.24, lng: -51.93,  tier: 'active'  },
  { code: 'PA', name: 'Panama',             flag: '🇵🇦', lat: 8.99,   lng: -79.52,  tier: 'partner' },
  { code: 'DO', name: 'Dominican Republic', flag: '🇩🇴', lat: 18.74,  lng: -70.16,  tier: 'partner' },
  { code: 'CU', name: 'Cuba',               flag: '🇨🇺', lat: 21.52,  lng: -77.78,  tier: 'partner' },
  { code: 'GT', name: 'Guatemala',          flag: '🇬🇹', lat: 15.78,  lng: -90.23,  tier: 'partner' },
  { code: 'VE', name: 'Venezuela',          flag: '🇻🇪', lat: 6.42,   lng: -66.59,  tier: 'partner' },
  { code: 'PE', name: 'Peru',               flag: '🇵🇪', lat: -9.19,  lng: -75.01,  tier: 'partner' },
  { code: 'AR', name: 'Argentina',          flag: '🇦🇷', lat: -38.42, lng: -63.62,  tier: 'partner' },
  { code: 'CA', name: 'Canada',             flag: '🇨🇦', lat: 56.13,  lng: -106.35, tier: 'partner' },
  { code: 'ES', name: 'Spain',              flag: '🇪🇸', lat: 40.46,  lng: -3.75,   tier: 'partner' },
  { code: 'PR', name: 'Puerto Rico',        flag: '🇵🇷', lat: 18.22,  lng: -66.59,  tier: 'active'  },
];

const TIER_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  hub:     { bg: 'bg-orange-500',  text: 'text-orange-600 dark:text-orange-400',  label: 'HUB'     },
  active:  { bg: 'bg-blue-500',    text: 'text-blue-600 dark:text-blue-400',      label: 'Active'  },
  partner: { bg: 'bg-slate-400',   text: 'text-slate-600 dark:text-slate-400',    label: 'Partner' },
};

const DRIVER_STATUS_COLOR: Record<string, string> = {
  available: '#22c55e',
  busy:      '#f97316',
  on_break:  '#eab308',
  offline:   '#64748b',
};

const DRIVER_STATUS_LABEL: Record<string, string> = {
  available: 'Online',
  busy:      'On Delivery',
  on_break:  'On Break',
  offline:   'Offline',
};

// Build country pin icon
function countryIcon(flag: string, tier: string) {
  const border = tier === 'hub' ? '#f97316' : tier === 'active' ? '#3b82f6' : '#94a3b8';
  return L.divIcon({
    className: '',
    html: `
      <div style="
        display:flex; flex-direction:column; align-items:center;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
      ">
        <div style="
          background:white;
          border: 2.5px solid ${border};
          border-radius: 50%;
          width: 30px; height: 30px;
          display:flex; align-items:center; justify-content:center;
          font-size: 16px; line-height:1;
        ">${flag}</div>
        <div style="
          width:2px; height:8px; background:${border};
        "></div>
        <div style="
          width:4px; height:4px; background:${border}; border-radius:50%;
        "></div>
      </div>`,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -44],
  });
}

// Build driver circle icon
function driverIcon(status: string, name: string) {
  const color = DRIVER_STATUS_COLOR[status] || '#64748b';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        width: 28px; height: 28px;
        display:flex; align-items:center; justify-content:center;
        color: white; font-size: 10px; font-weight: 700;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        letter-spacing: 0.05em;
      ">${initials}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

// Fit map to show all markers on first load
function FitBounds({ drivers }: { drivers: Driver[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || drivers.length === 0) return;
    fitted.current = true;
    map.setView([20, -30], 2);
  }, [drivers, map]);
  return null;
}

export default function WorldMapView() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    driversApi.getAll().then(res => {
      setDrivers(res.data.drivers || []);
    }).finally(() => setLoading(false));

    // Refresh driver positions every 5s
    const interval = setInterval(() => {
      driversApi.getAll().then(res => setDrivers(res.data.drivers || []));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const online  = drivers.filter(d => d.status !== 'offline').length;
  const onRoute = drivers.filter(d => d.status === 'busy').length;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 text-center">
          <p className="text-xl font-bold text-orange-500">{COUNTRIES.length}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">Countries</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 text-center">
          <p className="text-xl font-bold text-green-600">{online}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">Online Drivers</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3 text-center">
          <p className="text-xl font-bold text-blue-600">{onRoute}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">On Route</p>
        </div>
      </div>

      {/* World Map */}
      <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700 shadow-sm" style={{ height: 380 }}>
        {loading ? (
          <div className="h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
            <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          </div>
        ) : (
          <MapContainer
            center={[20, -30]}
            zoom={2}
            minZoom={2}
            maxZoom={10}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds drivers={drivers} />

            {/* Country pins */}
            {COUNTRIES.map(c => (
              <Marker
                key={c.code}
                position={[c.lat, c.lng]}
                icon={countryIcon(c.flag, c.tier)}
              >
                <Popup>
                  <div className="text-sm min-w-[140px]">
                    <p className="font-bold text-base">{c.flag} {c.name}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${
                      c.tier === 'hub' ? 'bg-orange-100 text-orange-700' :
                      c.tier === 'active' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {TIER_STYLE[c.tier].label}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Driver pins */}
            {drivers.map(d => (
              <Marker
                key={d.id}
                position={[d.current_lat || 25.7617, d.current_lng || -80.1918]}
                icon={driverIcon(d.status, d.name)}
              >
                <Popup>
                  <div className="text-sm min-w-[160px]">
                    <p className="font-bold">{d.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{d.current_address}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: DRIVER_STATUS_COLOR[d.status] }}
                      />
                      <span className="text-xs font-medium">{DRIVER_STATUS_LABEL[d.status]}</span>
                    </div>
                    {d.plate_number && (
                      <p className="text-xs text-gray-400 mt-1">🚛 {d.plate_number} · {d.make} {d.model}</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Map legend */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-2">Legend</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-500 flex-shrink-0" />
            <span className="text-xs text-gray-600 dark:text-slate-300">Main Hub</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
            <span className="text-xs text-gray-600 dark:text-slate-300">Active Region</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-400 flex-shrink-0" />
            <span className="text-xs text-gray-600 dark:text-slate-300">Partner Region</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
            <span className="text-xs text-gray-600 dark:text-slate-300">Driver Online</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-orange-400 flex-shrink-0" />
            <span className="text-xs text-gray-600 dark:text-slate-300">On Delivery</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-400 flex-shrink-0" />
            <span className="text-xs text-gray-600 dark:text-slate-300">Offline</span>
          </div>
        </div>
      </div>

      {/* Countries grid */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4">
        <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Operating Countries</p>
        <div className="grid grid-cols-2 gap-2">
          {COUNTRIES.map(c => (
            <div key={c.code} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-700">
              <span className="text-lg">{c.flag}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                <span className={`text-[10px] font-semibold ${TIER_STYLE[c.tier].text}`}>
                  {TIER_STYLE[c.tier].label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
