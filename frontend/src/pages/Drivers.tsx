import { useState, useEffect } from 'react';
import { Plus, Search, Phone, Mail, Star, Truck, Package, X, Edit2, Trash2, Eye, MapPin, Building2, Clock } from 'lucide-react';
import { Driver, DriverStatus } from '../types';
import { driversApi, trucksApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DriverStatusBadge } from '../components/StatusBadge';
import { format, formatDistanceToNow } from 'date-fns';

const STATUS_OPTIONS: DriverStatus[] = ['available', 'busy', 'on_break', 'offline'];

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

interface DriverFormProps {
  driver?: Driver;
  onClose: () => void;
  onSave: () => void;
}

function DriverForm({ driver, onClose, onSave }: DriverFormProps) {
  const [form, setForm] = useState({
    name: driver?.name || '',
    phone: driver?.phone || '',
    email: driver?.email || '',
    license_number: driver?.license_number || '',
    license_expiry: driver?.license_expiry || '',
    hire_date: driver?.hire_date || '',
    status: driver?.status || 'available',
    equipment_type: driver?.equipment_type || 'Dry Van',
    company_name: driver?.company_name || '',
    mc_number: driver?.mc_number || '',
    authority_since: driver?.authority_since || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (driver) {
        await driversApi.update(driver.id, form);
      } else {
        await driversApi.create(form);
      }
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 dark:text-slate-100">{driver ? 'Edit Driver' : 'Add New Driver'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500 dark:text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Full Name *</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="John Smith" />
            </div>
            <div>
              <label className="label">Phone *</label>
              <input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required placeholder="(305) 555-0000" />
            </div>
            <div>
              <label className="label">Email *</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="driver@company.com" />
            </div>
            <div>
              <label className="label">CDL License # *</label>
              <input className="input" value={form.license_number} onChange={e => setForm({...form, license_number: e.target.value})} required placeholder="FL-CDL-000000" />
            </div>
            <div>
              <label className="label">License Expiry *</label>
              <input className="input" type="date" value={form.license_expiry} onChange={e => setForm({...form, license_expiry: e.target.value})} required />
            </div>
            <div>
              <label className="label">Hire Date *</label>
              <input className="input" type="date" value={form.hire_date} onChange={e => setForm({...form, hire_date: e.target.value})} required />
            </div>
            <div className="col-span-2 border-t border-gray-100 dark:border-slate-700 pt-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5" /> Empresa / Equipo
              </p>
            </div>
            <div>
              <label className="label">Tipo de Equipo</label>
              <select className="input" value={form.equipment_type} onChange={e => setForm({...form, equipment_type: e.target.value})}>
                {['Dry Van', 'Reefer', 'Flatbed', 'Box Truck'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">MC# / Póliza Comercial</label>
              <input className="input" value={form.mc_number} onChange={e => setForm({...form, mc_number: e.target.value})} placeholder="MC-000000" />
            </div>
            <div className="col-span-2">
              <label className="label">Nombre de Compañía</label>
              <input className="input" value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} placeholder="OSI Logistics LLC" />
            </div>
            <div className="col-span-2">
              <label className="label">Autoridad MC desde</label>
              <input className="input" type="date" value={form.authority_since} onChange={e => setForm({...form, authority_since: e.target.value})} />
            </div>
            {driver && (
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value as typeof form.status})}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Saving...' : driver ? 'Save Changes' : 'Add Driver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DriverDetailProps {
  driverId: string;
  onClose: () => void;
}

interface Favorite { id: string; name: string; address: string; type: string; }
const FAV_ICONS: Record<string, string> = { home: '🏠', work: '🏢', frequent: '⭐', other: '📍' };

function DriverDetail({ driverId, onClose }: DriverDetailProps) {
  const [data, setData] = useState<{ driver: Driver; recentOrders: unknown[]; } | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    driversApi.getById(driverId).then(r => setData(r.data));
    driversApi.getFavorites(driverId).then(r => setFavorites(r.data as Favorite[])).catch(() => {});
  }, [driverId]);

  if (!data) return null;
  const { driver, recentOrders } = data;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 dark:text-slate-100">Driver Profile</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500 dark:text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* Profile Header */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
              {driver.avatar}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">{driver.name}</h3>
              <DriverStatusBadge status={driver.status} className="mt-1" />
              <p className="text-xs text-gray-400 mt-1">Hired {format(new Date(driver.hire_date), 'MMM d, yyyy')}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-orange-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{driver.rating.toFixed(1)}</p>
              <p className="text-xs text-gray-500 flex items-center justify-center gap-1"><Star className="w-3 h-3" /> Rating</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{driver.total_deliveries}</p>
              <p className="text-xs text-gray-500 flex items-center justify-center gap-1"><Package className="w-3 h-3" /> Trips</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{driver.on_time_rate.toFixed(0)}%</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">On-Time</p>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-2">
            <a href={`tel:${driver.phone}`} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-900 rounded-xl p-3 hover:bg-gray-100 transition-colors">
              <Phone className="w-4 h-4 text-gray-400 dark:text-slate-500" />
              <span className="text-sm text-gray-700 dark:text-slate-300">{driver.phone}</span>
            </a>
            <a href={`mailto:${driver.email}`} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-900 rounded-xl p-3 hover:bg-gray-100 transition-colors">
              <Mail className="w-4 h-4 text-gray-400 dark:text-slate-500" />
              <span className="text-sm text-gray-700 dark:text-slate-300">{driver.email}</span>
            </a>
          </div>

          {/* License */}
          <div className="bg-gray-50 dark:bg-slate-800/50 dark:bg-slate-900 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">CDL LICENSE</p>
            <p className="text-sm font-mono text-gray-900 dark:text-slate-100">{driver.license_number}</p>
            <p className="text-xs text-gray-500 mt-1">Expires: {format(new Date(driver.license_expiry), 'MMMM d, yyyy')}</p>
          </div>

          {/* Equipment */}
          {(driver.make || driver.equipment_type) && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2 mb-2">
                <Truck className="w-3 h-3" /> EQUIPO
              </p>
              <div className="flex items-center gap-3">
                {driver.equipment_type && (
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold ${
                    driver.equipment_type === 'Reefer'    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                    driver.equipment_type === 'Flatbed'   ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' :
                    driver.equipment_type === 'Box Truck' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                  }`}>
                    {driver.equipment_type}
                  </span>
                )}
                {driver.make && driver.model && (
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{driver.make} {driver.model}</p>
                )}
              </div>
            </div>
          )}

          {/* Empresa / Autoridad MC */}
          {(driver.company_name || driver.mc_number) && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-green-700 dark:text-green-400 flex items-center gap-2 mb-3">
                <Building2 className="w-3 h-3" /> EMPRESA / AUTORIDAD
              </p>
              <div className="space-y-2">
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
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">{calcAuthority(driver.authority_since)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lugares favoritos */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-3.5 h-3.5 text-orange-500" />
              <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wide">Lugares favoritos del driver</p>
            </div>
            {favorites.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-3 bg-gray-50 dark:bg-slate-900 rounded-xl">
                Sin lugares guardados
              </p>
            ) : (
              <div className="space-y-2">
                {favorites.map(fav => (
                  <div key={fav.id} className="flex items-center gap-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl px-3 py-2.5">
                    <span className="text-base flex-shrink-0">{FAV_ICONS[fav.type] || '📍'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{fav.name}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{fav.address}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent orders */}
          {recentOrders.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-3">RECENT ORDERS</p>
              <div className="space-y-2">
                {(recentOrders as Array<{ id: string; order_number: string; customer_name: string; status: string; delivered_at: string | null }>).slice(0, 5).map(order => (
                  <div key={order.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-slate-100">{order.order_number}</span>
                      <span className="text-gray-400 ml-2">{order.customer_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge text-xs ${order.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {order.status}
                      </span>
                      {order.delivered_at && (
                        <span className="text-xs text-gray-400 dark:text-slate-500">{formatDistanceToNow(new Date(order.delivered_at), { addSuffix: true })}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Drivers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editDriver, setEditDriver] = useState<Driver | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const fetchDrivers = async () => {
    try {
      const params: Record<string, unknown> = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const [driversRes, statsRes] = await Promise.all([
        driversApi.getAll(params),
        driversApi.getStats(),
      ]);
      setDrivers(driversRes.data);
      setStats(statsRes.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDrivers(); }, [statusFilter, search]);

  const handleDelete = async (driver: Driver) => {
    if (!confirm(`Delete ${driver.name}? This cannot be undone.`)) return;
    try {
      await driversApi.delete(driver.id);
      fetchDrivers();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Cannot delete driver');
    }
  };

  return (
    <div className="space-y-4 fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Drivers', value: stats.total || 0, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'Available', value: stats.available || 0, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'On Delivery', value: stats.busy || 0, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Offline', value: stats.offline || 0, color: 'text-gray-500', bg: 'bg-gray-50' },
        ].map((s, i) => (
          <div key={i} className={`card ${s.bg} p-4`}>
            <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input className="input pl-9 w-48" placeholder="Search drivers..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Driver
        </button>
      </div>

      {/* Drivers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-gray-400 dark:text-slate-500">Loading...</div>
        ) : drivers.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-gray-400 dark:text-slate-500">No drivers found</div>
        ) : drivers.map(driver => (
          <div key={driver.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold ${
                  driver.status === 'available' ? 'bg-green-500' :
                  driver.status === 'busy' ? 'bg-orange-500' :
                  driver.status === 'on_break' ? 'bg-yellow-500' : 'bg-gray-400'
                }`}>
                  {driver.avatar}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{driver.name}</h3>
                  <DriverStatusBadge status={driver.status} className="mt-0.5" />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setDetailId(driver.id)} className="p-1.5 hover:bg-gray-100 dark:bg-slate-700 rounded-lg">
                  <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                </button>
                <button onClick={() => { setEditDriver(driver); setShowForm(true); }} className="p-1.5 hover:bg-gray-100 dark:bg-slate-700 rounded-lg">
                  <Edit2 className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                </button>
                {isAdmin && (
                  <button onClick={() => handleDelete(driver)} className="p-1.5 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                <Phone className="w-3 h-3 text-gray-400 dark:text-slate-500" /> {driver.phone}
              </div>
              <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                <Mail className="w-3 h-3 text-gray-400 dark:text-slate-500" /> {driver.email}
              </div>
              {(driver.equipment_type || driver.make) && (
                <div className="flex items-center gap-2">
                  <Truck className="w-3 h-3 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                  {driver.equipment_type && (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                      driver.equipment_type === 'Reefer'    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                      driver.equipment_type === 'Flatbed'   ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' :
                      driver.equipment_type === 'Box Truck' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                      'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                    }`}>{driver.equipment_type}</span>
                  )}
                  {driver.make && driver.model && (
                    <span className="text-gray-500 dark:text-slate-400">{driver.make} {driver.model}</span>
                  )}
                </div>
              )}
              {driver.current_address && (
                <div className={`flex items-center gap-2 font-medium ${
                  driver.status === 'offline' ? 'text-gray-400' : 'text-blue-600'
                }`}>
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{driver.current_address}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="text-center bg-gray-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-xs text-gray-500 dark:text-slate-400">Rating</p>
                <p className="text-sm font-bold text-yellow-500">★ {driver.rating.toFixed(1)}</p>
              </div>
              <div className="text-center bg-gray-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-xs text-gray-500 dark:text-slate-400">Trips</p>
                <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{driver.total_deliveries}</p>
              </div>
              <div className="text-center bg-gray-50 dark:bg-slate-900 rounded-lg p-2">
                <p className="text-xs text-gray-500 dark:text-slate-400">On-Time</p>
                <p className="text-sm font-bold text-green-600">{driver.on_time_rate.toFixed(0)}%</p>
              </div>
            </div>

            {driver.active_orders !== undefined && driver.active_orders > 0 && (
              <div className="mt-3 bg-orange-50 rounded-lg p-2 flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-xs text-orange-700 font-medium">{driver.active_orders} active order(s)</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modals */}
      {showForm && (
        <DriverForm
          driver={editDriver || undefined}
          onClose={() => { setShowForm(false); setEditDriver(null); }}
          onSave={fetchDrivers}
        />
      )}
      {detailId && <DriverDetail driverId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

