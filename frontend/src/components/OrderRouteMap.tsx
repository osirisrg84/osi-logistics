import { useEffect, useRef, useState } from 'react';
import Map, { Marker, NavigationControl, Source, Layer } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { loadOrderRoute, routeBounds, type OrderRoute } from '../utils/orderRoute';
import type { Order } from '../types';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

type RouteOrder = Pick<Order, 'pickup_address' | 'pickup_contact' | 'delivery_address' | 'delivery_contact' | 'notes'>;

// Carga la ruta de una orden (coordenadas de cada parada + trazado por carretera). Se recalcula si cambian las direcciones.
export function useOrderRoute(order: RouteOrder | null | undefined) {
  const [route, setRoute] = useState<OrderRoute | null>(null);
  const [loading, setLoading] = useState(false);
  const key = order ? [order.pickup_address, order.pickup_contact, order.delivery_address, order.delivery_contact, order.notes].join('|') : '';
  useEffect(() => {
    let live = true;
    if (!order) { setRoute(null); return; }
    setLoading(true);
    loadOrderRoute(order).then(r => { if (live) { setRoute(r); setLoading(false); } }).catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { route, loading };
}

// Linea de la ruta + marcadores A, entregas intermedias y B. Se usa dentro de cualquier <Map>.
export function RouteOverlay({ route, id = 'osi-route' }: { route: OrderRoute; id?: string }) {
  return (
    <>
      {route.line && (
        <Source id={id} type="geojson" data={route.line as any}>
          <Layer id={`${id}-casing`} type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 }} />
          <Layer id={`${id}-line`} type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': '#f97316', 'line-width': 4.5, ...(route.approx ? { 'line-dasharray': [2, 1.5] } : {}) }} />
        </Source>
      )}
      {route.stops.map((s, i) => {
        const isA = s.label === 'A', isB = s.label === 'B';
        const bg = isA ? '#f97316' : isB ? '#16a34a' : s.kind === 'pickup' ? '#fb923c' : '#22c55e';
        return (
          <Marker key={i} latitude={s.lat} longitude={s.lng} anchor="center">
            <div title={s.text} style={{
              minWidth: 28, height: 28, padding: '0 6px', borderRadius: 14, background: bg, color: '#fff',
              border: '2.5px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
            }}>{s.label}</div>
          </Marker>
        );
      })}
    </>
  );
}

// Mapa completo de la ruta de una orden (por ejemplo dentro del detalle de la orden).
export default function OrderRouteMap({ order, height = 260 }: { order: RouteOrder; height?: number }) {
  const { route, loading } = useOrderRoute(order);
  const ref = useRef<MapRef>(null);

  useEffect(() => {
    if (!route) return;
    const [sw, ne] = routeBounds(route);
    const fit = () => ref.current?.fitBounds([sw, ne], { padding: 44, duration: 600, maxZoom: 11 });
    fit();
    const t = setTimeout(fit, 700); // por si el mapa aun no habia terminado de cargar
    return () => clearTimeout(t);
  }, [route]);

  if (!loading && !route) return null;
  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(148,163,184,.35)' }}>
      <Map ref={ref} mapStyle={MAP_STYLE} initialViewState={{ latitude: 39.5, longitude: -98.35, zoom: 3 }} style={{ width: '100%', height: '100%' }}
        attributionControl={false} cooperativeGestures>
        <NavigationControl position="top-right" showCompass={false} />
        {route && <RouteOverlay route={route} />}
      </Map>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,.35)', color: '#fff', fontSize: 13, fontWeight: 600 }}>
          Calculando ruta…
        </div>
      )}
      {route && (route.distanceMi != null || route.approx) && (
        <div style={{ position: 'absolute', left: 8, bottom: 8, background: 'rgba(15,23,42,.88)', color: '#fff', borderRadius: 10, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
          {route.distanceMi != null ? `${route.distanceMi.toLocaleString()} mi · ${route.durationH} h` : 'Ruta aproximada'}
        </div>
      )}
    </div>
  );
}
