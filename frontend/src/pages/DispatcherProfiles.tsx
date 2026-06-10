import { useState, useEffect } from 'react';
import { Search, ClipboardList, Package, DollarSign, TrendingUp, Clock, X, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { format, formatDistanceToNow } from 'date-fns';

interface DispatcherProfile {
  id: string;
  name: string;
  email: string;
  active: number;
  created_at: string;
  total_orders: number;
  total_earned: number;
  pending: number;
  settled: number;
  active_orders: number;
}

interface DetailModalProps {
  dispatcher: DispatcherProfile;
  onClose: () => void;
}

function DetailModal({ dispatcher, onClose }: DetailModalProps) {
  const initials = dispatcher.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Perfil del Dispatcher</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {initials}
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{dispatcher.name}</p>
              <a href={`mailto:${dispatcher.email}`} className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 mt-0.5">
                <Mail className="w-3 h-3" /> {dispatcher.email}
              </a>
              <div className="flex items-center gap-1.5 mt-1">
                {dispatcher.active ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3" /> Activo
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    <AlertCircle className="w-3 h-3" /> Inactivo
                  </span>
                )}
                <span className="text-xs text-gray-400 dark:text-slate-500">
                  · Desde {format(new Date(dispatcher.created_at), 'MMM d, yyyy')}
                </span>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">{dispatcher.total_orders}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center justify-center gap-1 mt-1">
                <Package className="w-3 h-3" /> Órdenes gestionadas
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{dispatcher.active_orders}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center justify-center gap-1 mt-1">
                <Clock className="w-3 h-3" /> Órdenes activas
              </p>
            </div>
          </div>

          {/* Commissions breakdown */}
          <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-orange-500" /> Comisiones (5% por orden)
            </p>
            <div className="space-y-2">
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
            </div>
            {dispatcher.total_earned > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>Progreso liquidación</span>
                  <span>{Math.round((dispatcher.settled / dispatcher.total_earned) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(dispatcher.settled / dispatcher.total_earned) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-center text-gray-400 dark:text-slate-500">
            Miembro desde {formatDistanceToNow(new Date(dispatcher.created_at), { addSuffix: true })}
          </p>
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

  useEffect(() => {
    api.get('/admin/dispatchers')
      .then(r => setDispatchers(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
              <button
                key={d.id}
                onClick={() => setSelected(d)}
                className="card p-5 text-left hover:border-orange-300 dark:hover:border-orange-600 hover:shadow-lg transition-all group"
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 group-hover:bg-orange-600 transition-colors">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{d.name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{d.email}</p>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 ${
                      d.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${d.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {d.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
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
              </button>
            );
          })}
        </div>
      )}

      {selected && <DetailModal dispatcher={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
