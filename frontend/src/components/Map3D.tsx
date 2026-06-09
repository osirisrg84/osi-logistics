import { useRef, useEffect, useCallback } from 'react';
import Map, { Marker, NavigationControl, Source, Layer } from 'react-map-gl/maplibre';
import type { MapRef, LayerSpecification } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Order, Driver } from '../types';

// Free map style with 3D buildings — no API key required
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const BUILDINGS_LAYER: LayerSpecification = {
  id: 'osi-3d-buildings',
  source: 'composite',
  'source-layer': 'building',
  type: 'fill-extrusion',
  minzoom: 14,
  paint: {
    'fill-extrusion-color': [
      'interpolate', ['linear'], ['get', 'render_height'],
      0,   '#cbd5e1',
      30,  '#94a3b8',
      100, '#64748b',
    ],
    'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
    'fill-extrusion-base':   ['coalesce', ['get', 'render_min_height'], 0],
    'fill-extrusion-opacity': 0.85,
  },
};

interface Props {
  driver: Driver | null;
  activeOrders?: Order[];
  interactive?: boolean;
  pitch?: number;
}

export default function Map3D({ driver, activeOrders = [], interactive = true, pitch = 52 }: Props) {
  const mapRef = useRef<MapRef>(null);
  const lat = driver?.current_lat  || 25.7617;
  const lng = driver?.current_lng  || -80.1918;

  // Re-center when driver position changes (simulation moves them)
  useEffect(() => {
    mapRef.current?.easeTo({ center: [lng, lat], duration: 1200, easing: t => t });
  }, [lat, lng]);

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    // Add 3D buildings once base style finishes loading
    if (!map.getLayer('osi-3d-buildings')) {
      try { map.addLayer(BUILDINGS_LAYER as Parameters<typeof map.addLayer>[0]); }
      catch { /* layer may already exist in style */ }
    }
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Map
        ref={mapRef}
        mapStyle={MAP_STYLE}
        initialViewState={{ latitude: lat, longitude: lng, zoom: 14.5, pitch, bearing: -18 }}
        style={{ width: '100%', height: '100%' }}
        interactive={interactive}
        onLoad={onMapLoad}
        attributionControl={false}
      >
        {interactive && <NavigationControl position="top-right" showCompass visualizePitch />}

        {/* Driver position — pulsing ring + truck icon */}
        {driver && (
          <Marker latitude={lat} longitude={lng} anchor="center">
            <div style={{ position: 'relative', width: 48, height: 48 }}>
              {/* Pulsing ring */}
              <span style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(249,115,22,0.25)',
                animation: 'osi-pulse 2s ease-out infinite',
              }} />
              {/* Inner ring */}
              <span style={{
                position: 'absolute', inset: 6, borderRadius: '50%',
                background: 'rgba(249,115,22,0.4)',
              }} />
              {/* Truck dot */}
              <span style={{
                position: 'absolute', inset: 12, borderRadius: '50%',
                background: '#f97316',
                border: '2.5px solid white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10,
              }}>🚛</span>
            </div>
          </Marker>
        )}

        {/* Delivery destination markers */}
        {activeOrders.filter(o => o.delivery_lat && o.delivery_lng).map(order => (
          <Marker key={order.id} latitude={order.delivery_lat} longitude={order.delivery_lng} anchor="bottom">
            <div style={{
              background: '#1e293b', color: 'white',
              borderRadius: 8, padding: '3px 7px',
              fontSize: 11, fontWeight: 700,
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              border: '1.5px solid rgba(255,255,255,0.15)',
              whiteSpace: 'nowrap',
            }}>
              📦 {order.order_number}
            </div>
          </Marker>
        ))}
      </Map>

      {/* Subtle dark vignette overlay for depth */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.18) 100%)',
      }} />

      {/* Pulse keyframe injected once */}
      <style>{`
        @keyframes osi-pulse {
          0%   { transform: scale(0.8); opacity: 0.9; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
