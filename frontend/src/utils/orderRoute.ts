import { formatLocation } from './location';
import type { Order } from '../types';

// Ruta de una orden: punto A (recogida), recogidas adicionales, entrega y entregas adicionales, en ese orden.
// Las direcciones se guardan como "Ciudad, ESTADO" (o texto libre en las paradas adicionales), asi que se
// convierten a coordenadas con Nominatim (OpenStreetMap) y la ruta por carretera se pide a OSRM. Ambos son gratis y
// sin clave; los resultados se guardan en este navegador para no repetir consultas.

export interface RouteStop { label: string; text: string; kind: 'pickup' | 'delivery'; lat: number; lng: number }
export interface OrderRoute {
  stops: RouteStop[];
  line: { type: 'Feature'; properties: object; geometry: { type: 'LineString'; coordinates: [number, number][] } } | null;
  distanceMi: number | null;
  durationH: number | null;
  approx: boolean; // true si no hubo ruta por carretera y se dibujo en linea recta
}

const GEO_KEY = 'osi-geo-v1';
const ROUTE_KEY = 'osi-route-v1';

function readCache(key: string): Record<string, any> {
  try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; }
}
function writeCache(key: string, obj: Record<string, any>, max = 300) {
  try {
    const keys = Object.keys(obj);
    if (keys.length > max) for (const k of keys.slice(0, keys.length - max)) delete obj[k];
    localStorage.setItem(key, JSON.stringify(obj));
  } catch { /* sin almacenamiento */ }
}

// Paradas adicionales: viven como lineas "• texto" bajo [RECOGIDAS ADICIONALES] / [ENTREGAS ADICIONALES] en las notas.
function extraStops(notes: string | undefined, header: string): string[] {
  if (!notes) return [];
  const i = notes.indexOf(header);
  if (i < 0) return [];
  const rest = notes.slice(i + header.length).split('\n').slice(1);
  const out: string[] = [];
  for (const line of rest) {
    const m = line.match(/^\s*•\s*(.+)$/);
    if (m) out.push(m[1].trim()); else if (line.trim().startsWith('[')) break; else if (line.trim() === '') continue; else break;
  }
  return out;
}

export function orderStopTexts(order: Pick<Order, 'pickup_address' | 'pickup_contact' | 'delivery_address' | 'delivery_contact' | 'notes'>): { text: string; kind: 'pickup' | 'delivery' }[] {
  const list: { text: string; kind: 'pickup' | 'delivery' }[] = [];
  const p = formatLocation(order.pickup_address, order.pickup_contact);
  if (p) list.push({ text: p, kind: 'pickup' });
  for (const t of extraStops(order.notes, '[RECOGIDAS ADICIONALES]')) list.push({ text: t, kind: 'pickup' });
  const d = formatLocation(order.delivery_address, order.delivery_contact);
  if (d) list.push({ text: d, kind: 'delivery' });
  for (const t of extraStops(order.notes, '[ENTREGAS ADICIONALES]')) list.push({ text: t, kind: 'delivery' });
  return list;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
let lastGeo = 0;

async function geocode(text: string): Promise<{ lat: number; lng: number } | null> {
  const key = text.trim().toLowerCase();
  const cache = readCache(GEO_KEY);
  if (cache[key]) return cache[key];
  // Nominatim pide como maximo 1 consulta por segundo
  const wait = lastGeo + 1100 - Date.now(); if (wait > 0) await sleep(wait);
  lastGeo = Date.now();
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(text)}`, { headers: { Accept: 'application/json' } });
    const j = await r.json();
    if (Array.isArray(j) && j[0]) {
      const v = { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) };
      if (Number.isFinite(v.lat) && Number.isFinite(v.lng)) { cache[key] = v; writeCache(GEO_KEY, cache); return v; }
    }
  } catch { /* sin red o limite alcanzado */ }
  return null;
}

const inFlight = new Map<string, Promise<OrderRoute | null>>();

export function loadOrderRoute(order: Pick<Order, 'pickup_address' | 'pickup_contact' | 'delivery_address' | 'delivery_contact' | 'notes'>): Promise<OrderRoute | null> {
  const texts = orderStopTexts(order);
  if (texts.length < 2) return Promise.resolve(null);
  const k = texts.map(t => t.text.toLowerCase()).join('|');
  const hit = inFlight.get(k);
  if (hit) return hit;
  const p = (async () => {
    const stops: RouteStop[] = [];
    let pu = 0, de = 0;
    for (const t of texts) {
      const g = await geocode(t.text);
      if (!g) continue;
      const label = t.kind === 'pickup' ? (pu++ === 0 ? 'A' : `P${pu}`) : `${++de}`;
      stops.push({ label, text: t.text, kind: t.kind, lat: g.lat, lng: g.lng });
    }
    if (stops.length < 2) return null;
    // la ultima entrega es el punto B
    const last = stops[stops.length - 1]; last.label = 'B';
    const coordKey = stops.map(s => `${s.lng.toFixed(3)},${s.lat.toFixed(3)}`).join(';');
    const rc = readCache(ROUTE_KEY);
    if (rc[coordKey]) return { stops, ...rc[coordKey] } as OrderRoute;
    let line: OrderRoute['line'] = null, distanceMi: number | null = null, durationH: number | null = null, approx = true;
    try {
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordKey}?overview=full&geometries=geojson`);
      const j = await r.json();
      const route = j?.routes?.[0];
      if (j?.code === 'Ok' && route?.geometry?.coordinates?.length) {
        line = { type: 'Feature', properties: {}, geometry: route.geometry };
        distanceMi = Math.round(route.distance / 1609.344);
        durationH = Math.round((route.duration / 3600) * 10) / 10;
        approx = false;
      }
    } catch { /* se dibuja en linea recta */ }
    if (!line) {
      line = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: stops.map(s => [s.lng, s.lat] as [number, number]) } };
    } else {
      rc[coordKey] = { line, distanceMi, durationH, approx }; writeCache(ROUTE_KEY, rc, 25);
    }
    return { stops, line, distanceMi, durationH, approx } as OrderRoute;
  })();
  inFlight.set(k, p);
  p.finally(() => setTimeout(() => inFlight.delete(k), 5000));
  return p;
}

export function routeBounds(route: OrderRoute): [[number, number], [number, number]] {
  const pts = route.line?.geometry.coordinates?.length ? route.line.geometry.coordinates : route.stops.map(s => [s.lng, s.lat] as [number, number]);
  let minX = 180, minY = 90, maxX = -180, maxY = -90;
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return [[minX, minY], [maxX, maxY]];
}
