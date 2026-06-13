import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Filter, X, ChevronDown, Package,
  MapPin, User, Truck, Clock, DollarSign, Eye, Edit2, Trash2, UserCheck, CheckCircle
} from 'lucide-react';
import { Order, Driver, Truck as TruckType, OrderStatus, OrderPriority } from '../types';
import { ordersApi, driversApi, trucksApi } from '../services/api';
import { OrderStatusBadge, PriorityBadge, DriverStatusBadge } from '../components/StatusBadge';
import { format, formatDistanceToNow } from 'date-fns';
import { getSocket } from '../services/socket';

const STATUS_OPTIONS: OrderStatus[] = ['pending', 'offered', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled'];
const PRIORITY_OPTIONS: OrderPriority[] = ['low', 'normal', 'high', 'urgent'];

interface OrderModalProps {
  onClose: () => void;
  onSave: () => void;
}

function CreateOrderModal({ onClose, onSave }: OrderModalProps) {
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', customer_email: '',
    pickup_name: '', pickup_address: '',
    delivery_name: '', delivery_address: '',
    priority: 'normal', weight_kg: '', commodity: '',
    notes: '', price: '', distance_mi: '', estimated_delivery: '',
  });
  const [extraPickups, setExtraPickups] = useState<string[]>([]);
  const [extraDeliveries, setExtraDeliveries] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name || !form.pickup_address || !form.delivery_address) {
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

      await ordersApi.create({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email,
        pickup_address: form.pickup_address,
        pickup_contact: form.pickup_name,
        pickup_lat: 25.7617, pickup_lng: -80.1918,
        delivery_address: form.delivery_address,
        delivery_contact: form.delivery_name,
        delivery_lat: 25.7907, delivery_lng: -80.1300,
        priority: form.priority,
        weight_kg: Math.round(parseFloat(form.weight_kg || '0') * 0.453592 * 10) / 10,
        volume_m3: 0,
        description: form.commodity,
        notes: fullNotes.trim(),
        price: parseFloat(form.price) || 0,
        distance_km: Math.round(parseFloat(form.distance_mi || '0') * 1.60934 * 10) / 10,
        estimated_delivery: form.estimated_delivery,
      });
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Nueva Orden</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg border border-red-200">{error}</div>}

          {/* Customer */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-orange-500" /> Customer Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Customer Name *</label>
                <input className="input" value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} placeholder="Company or contact name" required />
              </div>
              <div>
                <label className="label">Phone *</label>
                <input className="input" value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value})} placeholder="(305) 555-0000" required />
              </div>
              <div className="col-span-2">
                <label className="label">Email</label>
                <input className="input" type="email" value={form.customer_email} onChange={e => setForm({...form, customer_email: e.target.value})} placeholder="orders@company.com" />
              </div>
            </div>
          </div>

          {/* Pickup */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" /> Pickup Location
            </h3>
            <div className="space-y-3">
              <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-orange-600 dark:text-orange-400">Stop #1</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Nombre del lugar</label>
                    <input className="input" value={form.pickup_name} onChange={e => setForm({...form, pickup_name: e.target.value})} placeholder="Ej: ABC Warehouse" />
                  </div>
                  <div>
                    <label className="label">Dirección *</label>
                    <input className="input" value={form.pickup_address} onChange={e => setForm({...form, pickup_address: e.target.value})} placeholder="Full street address" required />
                  </div>
                </div>
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Nombre del lugar</label>
                    <input className="input" value={form.delivery_name} onChange={e => setForm({...form, delivery_name: e.target.value})} placeholder="Ej: Cliente XYZ" />
                  </div>
                  <div>
                    <label className="label">Dirección *</label>
                    <input className="input" value={form.delivery_address} onChange={e => setForm({...form, delivery_address: e.target.value})} placeholder="Full street address" required />
                  </div>
                </div>
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
                <label className="label">Priority</label>
                <select className="input" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                  {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
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
                <label className="label">End. Delivery</label>
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
              {saving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Create Order'}
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

function AssignModal({ order, drivers, trucks, onClose, onSave }: AssignModalProps) {
  const [driverId, setDriverId] = useState('');
  const [truckId, setTruckId] = useState('');
  const [saving, setSaving] = useState(false);

  const availableDrivers = drivers.filter(d => d.status === 'available');
  const availableTrucks = trucks.filter(t => t.status === 'active');

  const handleOffer = async () => {
    if (!driverId || !truckId) return;
    setSaving(true);
    try {
      await ordersApi.offer(order.id, { driver_id: driverId, truck_id: truckId });
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
            <p className="text-xs text-gray-500 dark:text-slate-400">{order.customer_name} · {order.delivery_address}</p>
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

          <div>
            <label className="label">Seleccionar Camión ({availableTrucks.length} activos)</label>
            <select className="input" value={truckId} onChange={e => setTruckId(e.target.value)}>
              <option value="">Elige un camión...</option>
              {availableTrucks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.plate_number} · {t.make} {t.model} · {t.capacity_kg}kg
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1 justify-center">Cancelar</button>
            <button onClick={handleOffer} disabled={!driverId || !truckId || saving} className="btn-primary flex-1 justify-center">
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
              <PriorityBadge priority={order.priority} />
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
              <p className="text-sm text-gray-700 dark:text-slate-300">{order.pickup_address}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3">
              <div className="flex items-center gap-1 text-xs font-semibold text-green-700 mb-2">
                <MapPin className="w-3 h-3" /> DELIVERY
              </div>
              <p className="text-sm text-gray-700 dark:text-slate-300">{order.delivery_address}</p>
            </div>
          </div>

          {/* Shipment Info */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-slate-400">Weight</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{order.weight_kg} kg</p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-slate-400">Distance</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{order.distance_km} km</p>
            </div>
            <div className="text-center bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
              <p className="text-xs text-gray-500 dark:text-slate-400">Price</p>
              <p className="text-sm font-semibold text-green-600">${order.price.toFixed(2)}</p>
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
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
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
      if (priorityFilter) params.priority = priorityFilter;
      if (search) params.search = search;
      const { data } = await ordersApi.getAll(params);
      setOrders(data.orders);
      setTotal(data.total);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, search]);

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
          <select className="input w-full sm:w-32" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
            <option value="">All Priority</option>
            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
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
                    <p className="text-sm font-bold text-green-600">${order.price.toFixed(2)}</p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </div>
                <p className="text-xs text-gray-500 truncate mb-2">{order.delivery_address}</p>
                <div className="flex items-center justify-between">
                  <PriorityBadge priority={order.priority} />
                  <div className="flex gap-1">
                    <button onClick={() => setDetailOrder(order)} className="p-1.5 hover:bg-gray-100 dark:bg-slate-700 rounded-lg">
                      <Eye className="w-4 h-4 text-gray-500 dark:text-slate-400" />
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
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">PRIORITY</th>
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
                        <p className="text-xs text-gray-400 dark:text-slate-500">{order.weight_kg}kg · {order.distance_km}km</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{order.customer_name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{order.customer_phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-600 dark:text-slate-400 max-w-[160px] truncate">{order.pickup_address}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-600 dark:text-slate-400 max-w-[160px] truncate">{order.delivery_address}</p>
                      </td>
                      <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                      <td className="px-4 py-3"><PriorityBadge priority={order.priority} /></td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {order.driver_name
                          ? <p className="text-xs text-gray-700 dark:text-slate-300">{order.driver_name}</p>
                          : order.status === 'offered' && order.offered_driver_name
                            ? <p className="text-xs text-orange-600 dark:text-orange-400">⏳ {order.offered_driver_name}</p>
                            : <span className="text-xs text-gray-400 dark:text-slate-500">Sin asignar</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-green-600">${order.price.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setDetailOrder(order)} className="p-1.5 hover:bg-gray-100 dark:bg-slate-700 rounded-lg">
                            <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
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
      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} onSave={() => { fetchOrders(); showToast('¡Orden creada exitosamente! 🚛'); }} />}
      {assignOrder && <AssignModal order={assignOrder} drivers={drivers} trucks={trucks} onClose={() => setAssignOrder(null)} onSave={fetchOrders} />}
      {detailOrder && <DetailModal order={detailOrder} onClose={() => setDetailOrder(null)} onRefresh={fetchOrders} />}
    </div>
  );
}

