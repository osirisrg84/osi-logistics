import { useState, useEffect } from 'react';
import { Search, ClipboardList, Package, DollarSign, TrendingUp, Clock, X, Mail, CheckCircle, AlertCircle, Phone, Shield, Eye, EyeOff, Edit2, Trash2 } from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

interface DispatcherProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  ssn: string;
  active: number;
  created_at: string;
  total_orders: number;
  total_earned: number;
  pending: number;
  settled: number;
  active_orders: number;
}

function maskSSN(ssn: string): string {
  if (!ssn) return '—';
  const digits = ssn.replace(/\D/g, '');
  if (digits.length < 4) return '***-**-' + ssn.slice(-digits.length).padStart(4, '*');
  return `***-**-${digits.slice(-4)}`;
}

interface EditModalProps {
  dispatcher: DispatcherProfile;
  onClose: () => void;
  onSaved: (updated: Partial<DispatcherProfile>) => void;
}

function EditModal({ dispatcher, onClose, onSaved }: EditModalProps) {
  const [phone, setPhone] = useState(dispatcher.phone || '');
  const [ssn,   setSSN]   = useState(dispatcher.ssn   || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.put(`/admin/dispatchers/${dispatcher.id}`, { phone, ssn });
      onSaved({ phone, ssn });
      onClose();
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Editar información de pago</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5 block">Teléfono</label>
            <input
              className="input w-full"
              placeholder="(305) 555-0000"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1.5 block flex items-center gap-1">
              <Shield className="w-3 h-3" /> SSN (Social Security Number)
            </label>
            <input
              className="input w-full font-mono"
              placeholder="XXX-XX-XXXX"
              value={ssn}
              onChange={e => setSSN(e.target.value)}
            />
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">Información confidencial — solo visible para admins</p>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 text-sm">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DetailModalProps {
  dispatcher: DispatcherProfile;
  onClose: () => void;
  onEdit: () => void;
}

function DetailModal({ dispatcher, onClose, onEdit }: DetailModalProps) {
  const [showSSN, setShowSSN] = useState(false);
  const initials = dispatcher.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const pct = dispatcher.total_earned > 0 ? Math.round((dispatcher.settled / dispatcher.total_earned) * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header band */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-5 pt-5 pb-8 relative">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-orange-100 uppercase tracking-wide">Dispatcher</span>
            <div className="flex items-center gap-1">
              <button onClick={onEdit} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <Edit2 className="w-4 h-4 text-white" />
              </button>
              <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white text-xl font-bold border border-white/30">
              {initials}
            </div>
            <div>
              <p className="text-lg font-bold text-white leading-tight">{dispatcher.name}</p>
              <a href={`mailto:${dispatcher.email}`} className="text-orange-100 text-xs hover:text-white flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3" /> {dispatcher.email}
              </a>
            </div>
          </div>
        </div>

        {/* Status pill — overlapping */}
        <div className="px-5 -mt-4 flex items-center gap-2 mb-4">
          <span className={`flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full shadow-md ${
            dispatcher.active
              ? 'bg-green-500 text-white'
              : 'bg-gray-400 text-white'
          }`}>
            {dispatcher.active ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            {dispatcher.active ? 'Activo' : 'Inactivo'}
          </span>
          <span className="text-xs text-gray-400 dark:text-slate-500">
            Desde {format(new Date(dispatcher.created_at), 'MMM d, yyyy')}
          </span>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Stats row — compact 3 cols */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Órdenes', value: dispatcher.total_orders, color: 'text-orange-600' },
              { label: 'Activas',  value: dispatcher.active_orders, color: 'text-blue-600' },
              { label: 'Ganado',   value: `$${dispatcher.total_earned.toFixed(0)}`, color: 'text-green-600' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 dark:bg-slate-700/60 rounded-xl py-3 text-center">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Contact & Tax */}
          <div className="bg-gray-50 dark:bg-slate-700/40 rounded-xl p-4 space-y-2.5">
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">Contacto y Taxes</p>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400"><Phone className="w-3 h-3" /> Teléfono</span>
              {dispatcher.phone
                ? <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{dispatcher.phone}</span>
                : <button onClick={onEdit} className="text-xs text-orange-500 hover:text-orange-600 font-medium">+ Agregar</button>
              }
            </div>
            <div className="border-t border-gray-200 dark:border-slate-600" />
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400"><Shield className="w-3 h-3" /> SSN</span>
              <div className="flex items-center gap-1.5">
                {dispatcher.ssn ? (
                  <>
                    <span className="text-sm font-mono font-medium text-gray-800 dark:text-slate-200">
                      {showSSN ? dispatcher.ssn : maskSSN(dispatcher.ssn)}
                    </span>
                    <button onClick={() => setShowSSN(!showSSN)} className="p-0.5 hover:bg-gray-200 dark:hover:bg-slate-600 rounded">
                      {showSSN ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-400" />}
                    </button>
                  </>
                ) : (
                  <button onClick={onEdit} className="text-xs text-orange-500 hover:text-orange-600 font-medium">+ Agregar</button>
                )}
              </div>
            </div>
          </div>

          {/* Commissions */}
          <div className="bg-gray-50 dark:bg-slate-700/40 rounded-xl p-4 space-y-2.5">
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">Comisiones · 5% por orden</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">Total generado</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">${dispatcher.total_earned.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">Liquidado</span>
              <span className="text-sm font-semibold text-green-600">${dispatcher.settled.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-slate-400">Pendiente</span>
              <span className="text-sm font-semibold text-yellow-600">${dispatcher.pending.toFixed(2)}</span>
            </div>
            {dispatcher.total_earned > 0 && (
              <div className="pt-1">
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>Progreso liquidación</span><span>{pct}%</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DispatcherProfiles() {
  const [dispatchers, setDispatchers] = useState<DispatcherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DispatcherProfile | null>(null);
  const [editing, setEditing] = useState<DispatcherProfile | null>(null);

  useEffect(() => {
    api.get('/admin/dispatchers')
      .then(r => setDispatchers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(d: DispatcherProfile) {
    if (!confirm(`¿Eliminar a ${d.name}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/admin/users/${d.id}`);
      setDispatchers(prev => prev.filter(x => x.id !== d.id));
      if (selected?.id === d.id) setSelected(null);
    } catch {}
  }

  function handleSaved(id: string, updated: Partial<DispatcherProfile>) {
    setDispatchers(prev => prev.map(d => d.id === id ? { ...d, ...updated } : d));
    setSelected(prev => prev?.id === id ? { ...prev, ...updated } : prev);
  }

  const filtered = dispatchers.filter(d =>
    !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalOrders  = dispatchers.reduce((s, d) => s + d.total_orders, 0);
  const totalEarned  = dispatchers.reduce((s, d) => s + d.total_earned, 0);
  const totalPending = dispatchers.reduce((s, d) => s + d.pending, 0);

  return (
    <div className="space-y-5 fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Dispatchers', value: dispatchers.length, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          { label: 'Órdenes gestionadas', value: totalOrders, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Comisiones totales', value: `$${totalEarned.toFixed(2)}`, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'Pendiente por pagar', value: `$${totalPending.toFixed(2)}`, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
        ].map(s => (
          <div key={s.label} className={`card ${s.bg} p-4`}>
            <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input className="input pl-9 w-full" placeholder="Buscar dispatcher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400">{filtered.length} dispatcher{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-500">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-500">No se encontraron dispatchers</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(d => {
            const initials = d.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div key={d.id} className="card p-5 hover:border-orange-300 dark:hover:border-orange-600 hover:shadow-lg transition-all">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{d.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{d.email}</p>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 ${
                      d.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${d.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {d.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={() => setSelected(d)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                      <Eye className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                    </button>
                    <button onClick={() => setEditing(d)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                      <Edit2 className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
                    </button>
                    <button onClick={() => handleDelete(d)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Contact chips */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {d.phone ? (
                    <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                      <Phone className="w-2.5 h-2.5" /> {d.phone}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 italic">Sin teléfono</span>
                  )}
                  <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
                    d.ssn
                      ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
                      : 'text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 italic'
                  }`}>
                    <Shield className="w-2.5 h-2.5" /> {d.ssn ? 'SSN registrado' : 'Sin SSN'}
                  </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-orange-600">{d.total_orders}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">Órdenes</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-blue-600">{d.active_orders}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">Activas</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2 text-center">
                    <p className="text-base font-bold text-green-600">${d.total_earned.toFixed(0)}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">Ganado</p>
                  </div>
                </div>

                {/* Commission bar */}
                {d.total_earned > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500 mb-1">
                      <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Comisiones liquidadas</span>
                      <span>{Math.round((d.settled / d.total_earned) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${(d.settled / d.total_earned) * 100}%` }} />
                    </div>
                    {d.pending > 0 && (
                      <p className="text-[10px] text-yellow-600 mt-1">${d.pending.toFixed(2)} pendiente</p>
                    )}
                  </div>
                )}

                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-3">
                  <ClipboardList className="w-3 h-3 inline mr-1" />
                  Miembro desde {format(new Date(d.created_at), 'MMM yyyy')}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {selected && !editing && (
        <DetailModal
          dispatcher={selected}
          onClose={() => setSelected(null)}
          onEdit={() => setEditing(selected)}
        />
      )}

      {editing && (
        <EditModal
          dispatcher={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => handleSaved(editing.id, updated)}
        />
      )}
    </div>
  );
}
