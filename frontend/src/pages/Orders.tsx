import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Filter, X, ChevronDown, Package,
  MapPin, User, Truck, Clock, DollarSign, Eye, Edit2, Trash2, UserCheck, CheckCircle,
  Building2, Phone, Mail, Hash, FileText, Upload
} from 'lucide-react';
import { Order, Driver, Truck as TruckType, OrderStatus } from '../types';
import { ordersApi, driversApi, trucksApi } from '../services/api';
import { OrderStatusBadge, DriverStatusBadge } from '../components/StatusBadge';
import { format, formatDistanceToNow } from 'date-fns';
import { getSocket } from '../services/socket';
import { playSuccessChime } from '../utils/sounds';
import { formatLocation } from '../utils/location';
import { CITIES_BY_STATE } from '../data/usCities';

const STATUS_OPTIONS: OrderStatus[] = ['pending', 'offered', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

interface OrderModalProps {
  onClose: () => void;
  onSave: () => void;
  drivers: Driver[];
  trucks: TruckType[];
}

interface CityStateFieldsProps {
  state: string;
  city: string;
  onStateChange: (v: string) => void;
  onCityChange: (v: string) => void;
  listId: string;
}

// State first, then a city input that autosuggests (via <datalist>) once a state is picked —
// makes it fast for dispatch to type a city without knowing it up front.
function CityStateFields({ state, city, onStateChange, onCityChange, listId }: CityStateFieldsProps) {
  const cityOptions = CITIES_BY_STATE[state] || [];
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="label">State *</label>
        <select className="input" value={state} onChange={e => onStateChange(e.target.value)} required>
          <option value="">— Select State —</option>
          {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="label">City</label>
        <input className="input" list={listId} value={city} onChange={e => onCityChange(e.target.value)}
          placeholder={state ? 'Escribe para buscar...' : 'Ej: Miami'} />
        <datalist id={listId}>
          {cityOptions.map(c => <option key={c} value={c} />)}
        </datalist>
      </div>
    </div>
  );
}

function CreateOrderModal({ onClose, onSave, drivers }: OrderModalProps) {
  const [form, setForm] = useState({
    pickup_name: '', pickup_address: '',
    delivery_name: '', delivery_address: '',
    weight_kg: '', commodity: '',
    notes: '', price: '', distance_mi: '', estimated_delivery: '',
  });
  const [extraPickups, setExtraPickups] = useState<string[]>([]);
  const [extraDeliveries, setExtraDeliveries] = useState<string[]>([]);
  const [assignDriverId, setAssignDriverId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const availableDrivers = drivers.filter(d => d.status === 'available');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pickup_address || !form.delivery_address) {
      setError('Por favor completa los campos requeridos');
      return;
    }
    setSaving(true);
    try {
      let fullNotes = form.notes;
      const validPickups = extraPickups.filter(a => a.trim());
      const validDeliveries = extraDeliveries.filter(a => a.trim());
      if (validPickups.length > 0)
        fullNotes += `\n[RECOGIDAS ADICIONALES]\n${validPickups.map(a => `• ${a}`).join('\n')}`;
      if (validDeliveries.length > 0)
        fullNotes += `\n[ENTREGAS ADICIONALES]\n${validDeliveries.map(a => `• ${a}`).join('\n')}`;

      const { data } = await ordersApi.create({
        pickup_address: form.pickup_address,
        pickup_contact: form.pickup_name,
        pickup_lat: 25.7617, pickup_lng: -80.1918,
        delivery_address: form.delivery_address,
        delivery_contact: form.delivery_name,
        delivery_lat: 25.7907, delivery_lng: -80.1300,
        weight_kg: Math.round(parseFloat(form.weight_kg || '0') * 0.453592 * 10) / 10,
        volume_m3: 0,
        description: form.commodity,
        notes: fullNotes.trim(),
        price: parseFloat(form.price) || 0,
        distance_km: Math.round(parseFloat(form.distance_mi || '0') * 1.60934 * 10) / 10,
        estimated_delivery: form.estimated_delivery,
      });

      if (assignDriverId && data?.id) {
        await ordersApi.offer(data.id, { driver_id: assignDriverId, truck_id: '' });
      }

      onSave();
      onClose();
    } catch {
      setError('Error al crear la orden');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">New Order</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg border border-red-200">{error}</div>}

          {/* Pickup */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" /> Pickup Location
            </h3>
            <div className="space-y-3">
              <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-orange-600 dark:text-orange-400">Stop #1</p>
                <CityStateFields state={form.pickup_address} city={form.pickup_name}
                  onStateChange={v => setForm({...form, pickup_address: v})}
                  onCityChange={v => setForm({...form, pickup_name: v})}
                  listId="create-pickup-cities" />
              </div>
              {extraPickups.map((addr, i) => (
                <div key={i} className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-orange-600 dark:text-orange-400">Stop #{i + 2}</p>
                    <button type="button" onClick={() => setExtraPickups(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input className="input" value={addr} onChange={e => setExtraPickups(prev => prev.map((a, j) => j === i ? e.target.value : a))} placeholder="Dirección adicional de recogida" />
                </div>
              ))}
              <button type="button" onClick={() => setExtraPickups(prev => [...prev, ''])}
                className="flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 font-semibold transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar parada de recogida
              </button>
            </div>
          </div>

          {/* Delivery */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500" /> Delivery Location
            </h3>
            <div className="space-y-3">
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-green-600 dark:text-green-400">Stop #2</p>
                <CityStateFields state={form.delivery_address} city={form.delivery_name}
                  onStateChange={v => setForm({...form, delivery_address: v})}
                  onCityChange={v => setForm({...form, delivery_name: v})}
                  listId="create-delivery-cities" />
              </div>
              {extraDeliveries.map((addr, i) => (
                <div key={i} className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-green-600 dark:text-green-400">Stop #{i + 3}</p>
                    <button type="button" onClick={() => setExtraDeliveries(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input className="input" value={addr} onChange={e => setExtraDeliveries(prev => prev.map((a, j) => j === i ? e.target.value : a))} placeholder="Dirección adicional de entrega" />
                </div>
              ))}
              <button type="button" onClick={() => setExtraDeliveries(prev => [...prev, ''])}
                className="flex items-center gap-1.5 text-xs text-green-500 hover:text-green-600 font-semibold transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar parada de entrega
              </button>
            </div>
          </div>

          {/* Shipment Details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-500" /> Shipment Details
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Weight (lbs)</label>
                <input className="input" type="number" value={form.weight_kg} onChange={e => setForm({...form, weight_kg: e.target.value})} placeholder="0" min="0" />
              </div>
              <div>
                <label className="label">Rate ($)</label>
                <input className="input" type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div>
                <label className="label">Distance (mi)</label>
                <input className="input" type="number" value={form.distance_mi} onChange={e => setForm({...form, distance_mi: e.target.value})} placeholder="0" min="0" />
              </div>
              <div className="col-span-2">
                <label className="label">End Delivery</label>
                <input className="input" type="datetime-local" value={form.estimated_delivery} onChange={e => setForm({...form, estimated_delivery: e.target.value})} />
              </div>
              <div className="col-span-3">
                <label className="label">Commodity</label>
                <input className="input" value={form.commodity} onChange={e => setForm({...form, commodity: e.target.value})} placeholder="Ej: Fresh produce, Electronics, Automotive parts..." />
              </div>
              <div className="col-span-3">
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Special instructions..." />
              </div>
            </div>
          </div>

          {/* Assign Driver */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-500" /> Asignar Driver <span className="text-xs font-normal text-gray-400">(opcional)</span>
            </h3>
            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl p-4 space-y-3">

              {/* Company header — shown when a driver is selected */}
              {(() => {
                const sel = availableDrivers.find(d => d.id === assignDriverId);
                if (!sel) return null;
                return (
                  <div className="bg-white dark:bg-slate-700/60 rounded-lg border border-blue-200 dark:border-blue-700/40 p-3 mb-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="text-sm font-bold text-gray-800 dark:text-slate-100 truncate">
                        {sel.company_name || 'OSI Logistics LLC'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
                      <div className="flex items-center gap-1 col-span-3">
                        <Phone className="w-3 h-3 flex-shrink-0 text-blue-400" />
                        <span>{sel.phone || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1 col-span-3">
                        <Mail className="w-3 h-3 flex-shrink-0 text-blue-400" />
                        <span className="truncate">{sel.email || '—'}</span>
                      </div>
                      {sel.mc_number && (
                        <div className="flex items-center gap-1 col-span-3">
                          <Hash className="w-3 h-3 flex-shrink-0 text-blue-400" />
                          <span className="font-medium text-gray-600 dark:text-slate-300">MC# {sel.mc_number}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-100 dark:border-blue-700/30 flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300">
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                        {sel.avatar || sel.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="font-semibold">{sel.name}</span>
                      <span className="text-gray-400">·</span>
                      <span>★ {sel.rating.toFixed(1)}</span>
                      <span className="text-gray-400">·</span>
                      <span>{sel.total_deliveries} viajes</span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="label">Conductor ({availableDrivers.length} disponibles)</label>
                <select className="input" value={assignDriverId} onChange={e => setAssignDriverId(e.target.value)}>
                  <option value="">Sin asignar — asignar después</option>
                  {availableDrivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} · ★{d.rating.toFixed(1)} · {d.total_deliveries} viajes</option>
                  ))}
                </select>
              </div>
              {assignDriverId && (
                <p className="text-xs text-blue-600 dark:text-blue-400">La oferta se enviará al conductor en tiempo real al crear la orden.</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center gap-2">
              {saving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : assignDriverId ? <><UserCheck className="w-4 h-4" /> Crear y Asignar</> : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditOrderModalProps {
  order: Order;
  onClose: () => void;
  onSave: () => void;
}

function EditOrderModal({ order, onClose, onSave }: EditOrderModalProps) {
  const [form, setForm] = useState({
    pickup_name: order.pickup_contact || '',
    pickup_address: order.pickup_address || '',
    delivery_name: order.delivery_contact || '',
    delivery_address: order.delivery_address || '',
    weight_kg: order.weight_kg ? String(Math.round(order.weight_kg * 2.20462)) : '',
    commodity: order.description || '',
    notes: order.notes || '',
    price: order.price ? String(order.price) : '',
    distance_mi: order.distance_km ? String(Math.round(order.distance_km * 0.621371 * 10) / 10) : '',
    estimated_delivery: order.estimated_delivery ? order.estimated_delivery.slice(0, 16) : '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Rate Confirmation
  const [rateCon, setRateCon] = useState<{ filename: string; uploaded_at: string; data: string } | null>(null);
  const [loadingRateCon, setLoadingRateCon] = useState(true);
  const [uploadingRateCon, setUploadingRateCon] = useState(false);
  const [rateConError, setRateConError] = useState('');

  useEffect(() => {
    ordersApi.getRateCon(order.id)
      .then(({ data }) => setRateCon(data))
      .catch(() => setRateCon(null))
      .finally(() => setLoadingRateCon(false));
  }, [order.id]);

  const handleRateConUpload = async (file: File) => {
    setRateConError('');
    if (file.size > 8 * 1024 * 1024) {
      setRateConError('El archivo no puede superar 8MB');
      return;
    }
    setUploadingRateCon(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const { data } = await ordersApi.uploadRateCon(order.id, { filename: file.name, data: base64 });
      setRateCon({ filename: data.filename, uploaded_at: data.uploaded_at, data: base64 });
    } catch {
      setRateConError('Error al subir el archivo');
    } finally {
      setUploadingRateCon(false);
    }
  };

  const handleRateConDelete = async () => {
    try {
      await ordersApi.deleteRateCon(order.id);
      setRateCon(null);
    } catch {
      setRateConError('Error al eliminar el archivo');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pickup_address || !form.delivery_address) {
      setError('Por favor completa los campos requeridos');
      return;
    }
    setSaving(true);
    try {
      await ordersApi.update(order.id, {
        pickup_address: form.pickup_address,
        pickup_contact: form.pickup_name,
        delivery_address: form.delivery_address,
        delivery_contact: form.delivery_name,
        weight_kg: Math.round(parseFloat(form.weight_kg || '0') * 0.453592 * 10) / 10,
        description: form.commodity,
        notes: form.notes,
        price: parseFloat(form.price) || 0,
        distance_km: Math.round(parseFloat(form.distance_mi || '0') * 1.60934 * 10) / 10,
        estimated_delivery: form.estimated_delivery,
      });
      onSave();
      onClose();
    } catch {
      setError('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Edit Order · {order.order_number}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg border border-red-200">{error}</div>}

          {/* Rate Confirmation */}
          <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" /> Rate Confirmation
            </h3>
            {loadingRateCon ? (
              <p className="text-xs text-gray-400">Cargando...</p>
            ) : (
              <div className="space-y-2">
                {rateCon && (
                  <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 border border-indigo-100 dark:border-indigo-800/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 dark:text-slate-200 truncate">{rateCon.filename}</p>
                        <p className="text-[10px] text-gray-400">Subido {format(new Date(rateCon.uploaded_at), 'MMM d, yyyy HH:mm')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a href={rateCon.data} download={rateCon.filename} target="_blank" rel="noreferrer"
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">Ver</a>
                      <button type="button" onClick={handleRateConDelete} className="text-xs font-semibold text-red-400 hover:text-red-500">
                        Eliminar
                      </button>
                    </div>
                  </div>
                )}
                <label className="flex items-center justify-center gap-2 cursor-pointer px-3 py-2 rounded-lg border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-400 transition-colors text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  {uploadingRateCon ? <div className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {rateCon ? 'Reemplazar archivo' : 'Subir Rate Con (PDF, JPG, PNG)'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={uploadingRateCon}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleRateConUpload(f); e.target.value = ''; }} />
                </label>
                {rateConError && <p className="text-xs text-red-500">{rateConError}</p>}
              </div>
            )}
          </div>

          {/* Pickup */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" /> Pickup Location
            </h3>
            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30 rounded-xl p-3">
              <CityStateFields state={form.pickup_address} city={form.pickup_name}
                onStateChange={v => setForm({...form, pickup_address: v})}
                onCityChange={v => setForm({...form, pickup_name: v})}
                listId="edit-pickup-cities" />
            </div>
          </div>

          {/* Delivery */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-green-500" /> Delivery Location
            </h3>
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 rounded-xl p-3">
              <CityStateFields state={form.delivery_address} city={form.delivery_name}
                onStateChange={v => setForm({...form, delivery_address: v})}
                onCityChange={v => setForm({...form, delivery_name: v})}
                listId="edit-delivery-cities" />
            </div>
          </div>

          {/* Shipment Details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-500" /> Shipment Details
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Weight (lbs)</label>
                <input className="input" type="number" value={form.weight_kg} onChange={e => setForm({...form, weight_kg: e.target.value})} placeholder="0" min="0" />
              </div>
              <div>
                <label className="label">Rate ($)</label>
                <input className="input" type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div>
                <label className="label">Distance (mi)</label>
                <input className="input" type="number" value={form.distance_mi} onChange={e => setForm({...form, distance_mi: e.target.value})} placeholder="0" min="0" />
              </div>
              <div className="col-span-2">
                <label className="label">End Delivery</label>
                <input className="input" type="datetime-local" value={form.estimated_delivery} onChange={e => setForm({...form, estimated_delivery: e.target.value})} />
              </div>
              <div className="col-span-3">
                <label className="label">Commodity</label>
                <input className="input" value={form.commodity} onChange={e => setForm({...form, commodity: e.target.value})} placeholder="Ej: Fresh produce, Electronics, Automotive parts..." />
              </div>
              <div className="col-span-3">
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Special instructions..." />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center gap-2">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AssignModalProps {
  order: Order;
  drivers: Driver[];
  trucks: TruckType[];
  onClose: () => void;
  onSave: () => void;
}

function AssignModal({ order, drivers, onClose, onSave }: Omit<AssignModalProps, 'trucks'>) {
  const [driverId, setDriverId] = useState('');
  const [saving, setSaving] = useState(false);

  const availableDrivers = drivers.filter(d => d.status === 'available');

  const handleOffer = async () => {
    if (!driverId) return;
    setSaving(true);
    try {
      await ordersApi.offer(order.id, { driver_id: driverId, truck_id: '' });
      onSave();
      onClose();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Enviar Oferta al Conductor</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500 dark:text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{order.order_number}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">{order.customer_name} · {formatLocation(order.delivery_address, order.delivery_contact)}</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
            El conductor recibirá la oferta en tiempo real y tendrá 60 segundos para aceptarla o ignorarla.
          </p>

          <div>
            <label className="label">Seleccionar Conductor ({availableDrivers.length} disponibles)</label>
            <select className="input" value={driverId} onChange={e => setDriverId(e.target.value)}>
              <option value="">Elige un conductor...</option>
              {availableDrivers.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} · ★{d.rating.toFixed(1)} · {d.total_deliveries} viajes
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button onClick={handleOffer} disabled={!driverId || saving} className="btn-primary flex-1 justify-center">
              <UserCheck className="w-4 h-4" />
              {saving ? 'Enviando...' : 'Enviar Oferta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DetailModalProps {
  order: Order & { history?: unknown[]; tracking?: unknown[] };
  onClose: () => void;
  onRefresh: () => void;
}

function DetailModal({ order, onClose, onRefresh }: DetailModalProps) {
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const nextStatus: Record<string, string> = {
    assigned: 'picked_up',
    picked_up: 'in_transit',
    in_transit: 'delivered',
  };

  const handleStatusUpdate = async (status: string) => {
    setUpdatingStatus(true);
    try {
      await ordersApi.updateStatus(order.id, { status });
      onRefresh();
      onClose();
    } catch {
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 dark:text-slate-100">{order.order_number}</h2>
            <div className="flex items-center gap-2 mt-1">
              <OrderStatusBadge status={order.status} />
            </div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500 dark:text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* Customer */}
          <div className="bg-gray-50 dark:bg-slate-800/50 dark:bg-slate-900 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 text-orange-500" /> Customer
            </div>
            <div className="text-sm"><span className="text-gray-500 dark:text-slate-400">Name:</span> <span className="text-gray-900 font-medium">{order.customer_name}</span></div>
            <div className="text-sm"><span className="text-gray-500 dark:text-slate-400">Phone:</span> <span className="text-gray-900 dark:text-slate-100">{order.customer_phone}</span></div>
            {order.customer_email && <div className="text-sm"><span className="text-gray-500 dark:text-slate-400">Email:</span> <span className="text-gray-900 dark:text-slate-100">{order.customer_email}</span></div>}
          </div>

          {/* Pickup & Delivery */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-orange-50 rounded-xl p-3">
              <div className="flex items-center gap-1 text-xs font-semibold text-orange-700 mb-2">
                <MapPin className="w-3 h-3" /> PICKUP
              </div>
              <p className="text-sm text-gray-700 dark:text-slate-300">{formatLocation(order.pickup_address, order.pickup_contact)}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3">
              <div className="flex items-center gap-1 text-xs font-semibold text-green-700 mb-2">
                <MapPin className="w-3 h-3" /> DELIVERY
              </div>
              <p className="text-sm text-gray-700 dark:text-slate-300">{formatLocation(order.delivery_address, order.delivery_contact)}</p>
            </div>
          </div>

          {/* Shipment Info */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-slate-400">Weight</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{(order.weight_kg * 2.20462).toFixed(0)} lbs</p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-slate-400">Distance</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{(order.distance_km * 0.621371).toFixed(1)} mi</p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-slate-400">Rate</p>
              <p className="text-sm font-semibold text-green-600">${(Math.round(order.price / 100) * 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>

          {/* Driver */}
          {order.driver_name && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">
                <User className="w-3 h-3" /> ASSIGNED DRIVER
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{order.driver_name}</span>
                {order.plate_number && (
                  <span className="text-xs bg-white dark:bg-slate-700 text-gray-600 dark:text-slate-300 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-700">{order.plate_number}</span>
                )}
              </div>
            </div>
          )}

          {/* Dispatcher */}
          {(order.dispatcher_name || order.dispatcher_user_id) && (
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 dark:text-orange-400 mb-2">
                <User className="w-3 h-3" /> DISPATCHER
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(order.dispatcher_name || 'DS').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 leading-tight">{order.dispatcher_name || 'Dispatcher'}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">Assigned this order</p>
                  </div>
                </div>
                <span className="text-xs bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-lg border border-orange-200 dark:border-orange-700 font-semibold">
                  #{(order.dispatcher_id || order.dispatcher_user_id || '').slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <p className="text-xs font-semibold text-gray-700 mb-3">TIMELINE</p>
            <div className="space-y-2">
              {[
                { label: 'Created', time: order.created_at },
                { label: 'Assigned', time: order.assigned_at },
                { label: 'Picked Up', time: order.picked_up_at },
                { label: 'In Transit', time: order.in_transit_at },
                { label: 'Delivered', time: order.delivered_at },
              ].filter(t => t.time).map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-orange-400 rounded-full flex-shrink-0" />
                  <span className="text-xs text-gray-500 w-20">{t.label}</span>
                  <span className="text-xs text-gray-900 dark:text-slate-100">{format(new Date(t.time!), 'MMM d, HH:mm')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          {nextStatus[order.status] && (
            <button
              onClick={() => handleStatusUpdate(nextStatus[order.status])}
              disabled={updatingStatus}
              className="btn-primary w-full justify-center"
            >
              Mark as {nextStatus[order.status].replace('_', ' ').toUpperCase()}
            </button>
          )}
          {['pending', 'assigned'].includes(order.status) && (
            <button
              onClick={() => handleStatusUpdate('cancelled')}
              disabled={updatingStatus}
              className="btn-danger w-full justify-center mt-2"
            >
              Cancel Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [total, setTotal] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4500);
  };

  const fetchOrders = useCallback(async () => {
    try {
      const params: Record<string, unknown> = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const { data } = await ordersApi.getAll(params);
      setOrders(data.orders);
      setTotal(data.total);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  const fetchDriversAndTrucks = async () => {
    const [driversRes, trucksRes] = await Promise.all([
      driversApi.getAll(),
      trucksApi.getAll(),
    ]);
    setDrivers(driversRes.data);
    setTrucks(trucksRes.data);
  };

  useEffect(() => {
    fetchOrders();
    fetchDriversAndTrucks();
    const socket = getSocket();
    socket.emit('subscribe_orders');
    socket.on('order_updated', () => fetchOrders());
    return () => { socket.off('order_updated'); };
  }, [fetchOrders]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    await ordersApi.delete(id);
    fetchOrders();
  };

  return (
    <div className="space-y-3 fade-in">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-green-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-2xl shadow-green-600/30 animate-fade-in">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          {toast}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input className="input pl-9 w-full" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-full sm:w-32" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400">{total} orders total</p>

      {/* Orders — cards on mobile, table on desktop */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">No orders found</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {orders.map(order => (
              <div key={order.id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{order.order_number}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">{order.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">${(Math.round(order.price / 100) * 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </div>
                <p className="text-xs text-gray-500 truncate mb-2">{formatLocation(order.delivery_address, order.delivery_contact)}</p>
                <div className="flex items-center justify-end">
                  <div className="flex gap-1">
                    <button onClick={() => setDetailOrder(order)} className="p-1.5 hover:bg-gray-100 dark:bg-slate-700 rounded-lg">
                      <Eye className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                    </button>
                    <button onClick={() => setEditOrder(order)} className="p-1.5 hover:bg-gray-100 dark:bg-slate-700 rounded-lg">
                      <Edit2 className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                    </button>
                    {order.status === 'pending' && (
                      <button onClick={() => setAssignOrder(order)} className="p-1.5 hover:bg-blue-50 rounded-lg">
                        <UserCheck className="w-4 h-4 text-blue-500" />
                      </button>
                    )}
                    {['pending', 'cancelled'].includes(order.status) && (
                      <button onClick={() => handleDelete(order.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">ORDER</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">CUSTOMER</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">PICKUP</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">DELIVERY</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">STATUS</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 hidden lg:table-cell">DRIVER</th>
                    <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">RATE</th>
                    <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} className="table-row">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{order.order_number}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{(order.weight_kg * 2.20462).toFixed(0)}lbs · {(order.distance_km * 0.621371).toFixed(1)}mi</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{order.customer_name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{order.customer_phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-600 dark:text-slate-400 max-w-[160px] truncate">{formatLocation(order.pickup_address, order.pickup_contact)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-600 dark:text-slate-400 max-w-[160px] truncate">{formatLocation(order.delivery_address, order.delivery_contact)}</p>
                      </td>
                      <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {order.driver_name
                          ? <p className="text-xs text-gray-700 dark:text-slate-300">{order.driver_name}</p>
                          : order.status === 'offered' && order.offered_driver_name
                            ? <p className="text-xs text-orange-600 dark:text-orange-400">⏳ {order.offered_driver_name}</p>
                            : <span className="text-xs text-gray-400 dark:text-slate-500">Sin asignar</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-green-600">${(Math.round(order.price / 100) * 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setDetailOrder(order)} className="p-1.5 hover:bg-gray-100 dark:bg-slate-700 rounded-lg">
                            <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                          </button>
                          <button onClick={() => setEditOrder(order)} className="p-1.5 hover:bg-gray-100 dark:bg-slate-700 rounded-lg" title="Edit order">
                            <Edit2 className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                          </button>
                          {['pending', 'offered'].includes(order.status) && (
                            <button onClick={() => setAssignOrder(order)} className="p-1.5 hover:bg-blue-50 rounded-lg" title="Enviar oferta">
                              <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                            </button>
                          )}
                          {['pending', 'cancelled'].includes(order.status) && (
                            <button onClick={() => handleDelete(order.id)} className="p-1.5 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} onSave={() => { fetchOrders(); showToast('¡Orden creada exitosamente! 🚛'); playSuccessChime(); }} drivers={drivers} trucks={trucks} />}
      {assignOrder && <AssignModal order={assignOrder} drivers={drivers} onClose={() => setAssignOrder(null)} onSave={fetchOrders} />}
      {detailOrder && <DetailModal order={detailOrder} onClose={() => setDetailOrder(null)} onRefresh={fetchOrders} />}
      {editOrder && <EditOrderModal order={editOrder} onClose={() => setEditOrder(null)} onSave={() => { fetchOrders(); showToast('¡Orden actualizada! ✅'); }} />}
    </div>
  );
}

