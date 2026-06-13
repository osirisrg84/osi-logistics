import { useState, useEffect } from 'react';
import { Plus, Search, X, Edit2, Trash2, Fuel, Wrench, AlertTriangle, Eye } from 'lucide-react';
import { Truck } from '../types';
import { trucksApi } from '../services/api';
import { TruckStatusBadge } from '../components/StatusBadge';
import { format, differenceInDays } from 'date-fns';

interface TruckFormProps {
  truck?: Truck;
  onClose: () => void;
  onSave: () => void;
}

function TruckForm({ truck, onClose, onSave }: TruckFormProps) {
  const [form, setForm] = useState({
    plate_number: truck?.plate_number || '',
    make: truck?.make || '',
    model: truck?.model || '',
    year: truck?.year?.toString() || new Date().getFullYear().toString(),
    type: truck?.type || 'Box Truck',
    capacity_kg: truck?.capacity_kg?.toString() || '',
    capacity_m3: truck?.capacity_m3?.toString() || '',
    status: truck?.status || 'active',
    mileage: truck?.mileage?.toString() || '0',
    fuel_level: truck?.fuel_level?.toString() || '100',
    last_maintenance: truck?.last_maintenance || '',
    next_maintenance: truck?.next_maintenance || '',
    vin: truck?.vin || '',
    color: truck?.color || 'White',
  });
  const [saving, setSaving] = useState(false);

  const TRUCK_TYPES = ['Box Truck', 'Refrigerated', 'Flatbed', 'Van', 'Semi-Truck', 'Tanker'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        ...form,
        year: parseInt(form.year),
        capacity_kg: parseFloat(form.capacity_kg),
        capacity_m3: parseFloat(form.capacity_m3),
        mileage: parseInt(form.mileage),
        fuel_level: parseInt(form.fuel_level),
      };
      if (truck) {
        await trucksApi.update(truck.id, data);
      } else {
        await trucksApi.create(data);
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 dark:text-slate-100">{truck ? 'Edit Truck' : 'Add New Truck'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500 dark:text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Plate Number *</label>
              <input className="input" value={form.plate_number} onChange={e => setForm({...form, plate_number: e.target.value})} required placeholder="OSI-XXX" />
            </div>
            <div>
              <label className="label">Type *</label>
              <select className="input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                {TRUCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Make *</label>
              <input className="input" value={form.make} onChange={e => setForm({...form, make: e.target.value})} required placeholder="Ford" />
            </div>
            <div>
              <label className="label">Model *</label>
              <input className="input" value={form.model} onChange={e => setForm({...form, model: e.target.value})} required placeholder="F-650" />
            </div>
            <div>
              <label className="label">Year *</label>
              <input className="input" type="number" value={form.year} onChange={e => setForm({...form, year: e.target.value})} required min="2000" max="2030" />
            </div>
            <div>
              <label className="label">Color</label>
              <input className="input" value={form.color} onChange={e => setForm({...form, color: e.target.value})} placeholder="White" />
            </div>
            <div>
              <label className="label">Capacity (lbs)</label>
              <input className="input" type="number" value={form.capacity_kg} onChange={e => setForm({...form, capacity_kg: e.target.value})} placeholder="5000" />
            </div>
            <div>
              <label className="label">Volume (m³)</label>
              <input className="input" type="number" value={form.capacity_m3} onChange={e => setForm({...form, capacity_m3: e.target.value})} placeholder="20" />
            </div>
            <div>
              <label className="label">Mileage</label>
              <input className="input" type="number" value={form.mileage} onChange={e => setForm({...form, mileage: e.target.value})} placeholder="0" />
            </div>
            <div>
              <label className="label">Fuel Level (%)</label>
              <input className="input" type="number" value={form.fuel_level} onChange={e => setForm({...form, fuel_level: e.target.value})} min="0" max="100" placeholder="100" />
            </div>
            <div>
              <label className="label">Last Maintenance</label>
              <input className="input" type="date" value={form.last_maintenance} onChange={e => setForm({...form, last_maintenance: e.target.value})} />
            </div>
            <div>
              <label className="label">Next Maintenance</label>
              <input className="input" type="date" value={form.next_maintenance} onChange={e => setForm({...form, next_maintenance: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="label">VIN</label>
              <input className="input font-mono" value={form.vin} onChange={e => setForm({...form, vin: e.target.value})} placeholder="Vehicle Identification Number" />
            </div>
            {truck && (
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value as typeof form.status})}>
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Saving...' : truck ? 'Save Changes' : 'Add Truck'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Fleet() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTruck, setEditTruck] = useState<Truck | null>(null);

  const fetchTrucks = async () => {
    try {
      const params: Record<string, unknown> = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const [trucksRes, statsRes] = await Promise.all([
        trucksApi.getAll(params),
        trucksApi.getStats(),
      ]);
      setTrucks(trucksRes.data);
      setStats(statsRes.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrucks(); }, [statusFilter, search]);

  const handleDelete = async (truck: Truck) => {
    if (!confirm(`Remove ${truck.plate_number} from fleet?`)) return;
    try {
      await trucksApi.delete(truck.id);
      fetchTrucks();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Cannot delete truck');
    }
  };

  const getMaintenanceStatus = (nextMaint: string) => {
    const days = differenceInDays(new Date(nextMaint), new Date());
    if (days < 0) return { label: 'Overdue', color: 'text-red-600 bg-red-50' };
    if (days <= 30) return { label: `${days}d`, color: 'text-yellow-600 bg-yellow-50' };
    return { label: `${days}d`, color: 'text-green-600 bg-green-50' };
  };

  return (
    <div className="space-y-4 fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Trucks', value: stats.total || 0, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'Active', value: stats.active || 0, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'In Maintenance', value: stats.maintenance || 0, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Maintenance Due', value: stats.maintenance_due || 0, color: 'text-red-500', bg: 'bg-red-50' },
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
            <input className="input pl-9 w-48" placeholder="Search trucks..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-36" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Truck
        </button>
      </div>

      {/* Trucks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-gray-400 dark:text-slate-500">Loading fleet...</div>
        ) : trucks.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-gray-400 dark:text-slate-500">No trucks found</div>
        ) : trucks.map(truck => {
          const maintStatus = getMaintenanceStatus(truck.next_maintenance);
          return (
            <div key={truck.id} className="card hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-gray-900 dark:text-slate-100">{truck.plate_number}</span>
                    <TruckStatusBadge status={truck.status} />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">{truck.year} {truck.make} {truck.model}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{truck.type} · {truck.color}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => { setEditTruck(truck); setShowForm(true); }} className="p-1.5 hover:bg-gray-100 dark:bg-slate-700 rounded-lg">
                    <Edit2 className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                  </button>
                  <button onClick={() => handleDelete(truck)} className="p-1.5 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>

              {/* Capacity */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-gray-50 dark:bg-slate-800/50 dark:bg-slate-900 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500 dark:text-slate-400">Capacity</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{truck.capacity_kg.toLocaleString()} kg</p>
                </div>
                <div className="bg-gray-50 dark:bg-slate-800/50 dark:bg-slate-900 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500 dark:text-slate-400">Volume</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{truck.capacity_m3} m³</p>
                </div>
              </div>

              {/* Fuel Level */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 flex items-center gap-1"><Fuel className="w-3 h-3" /> Fuel Level</span>
                  <span className={`text-xs font-semibold ${truck.fuel_level < 30 ? 'text-red-500' : truck.fuel_level < 60 ? 'text-yellow-500' : 'text-green-600'}`}>
                    {truck.fuel_level}%
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full">
                  <div
                    className={`h-1.5 rounded-full transition-all ${truck.fuel_level < 30 ? 'bg-red-400' : truck.fuel_level < 60 ? 'bg-yellow-400' : 'bg-green-500'}`}
                    style={{ width: `${truck.fuel_level}%` }}
                  />
                </div>
              </div>

              {/* Maintenance */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">
                  <Wrench className="w-3 h-3" />
                  Next service: {format(new Date(truck.next_maintenance), 'MMM d, yyyy')}
                </div>
                <span className={`badge text-xs ${maintStatus.color}`}>
                  {maintStatus.label}
                </span>
              </div>

              {/* Mileage */}
              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
                <span>{truck.mileage.toLocaleString()} mi</span>
                {truck.driver_name && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <span>Driver: {truck.driver_name}</span>
                  </span>
                )}
                {truck.active_orders !== undefined && truck.active_orders > 0 && (
                  <span className="text-orange-500">{truck.active_orders} active orders</span>
                )}
              </div>

              {/* VIN */}
              {truck.vin && (
                <p className="text-xs text-gray-300 font-mono mt-2 truncate">{truck.vin}</p>
              )}
            </div>
          );
        })}
      </div>

      {showForm && (
        <TruckForm
          truck={editTruck || undefined}
          onClose={() => { setShowForm(false); setEditTruck(null); }}
          onSave={fetchTrucks}
        />
      )}
    </div>
  );
}

