import { useState, useEffect } from 'react';
import { Search, ClipboardList, Package, DollarSign, TrendingUp, Clock, X, Mail, CheckCircle, AlertCircle, Phone, Shield, Eye, EyeOff, Edit2, Trash2, Truck, Hash } from 'lucide-react';
import type { ReactNode } from 'react';
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
  equipment_experience: string;
  dispatcher_code: string;
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
  const [name,     setName]     = useState(dispatcher.name  || '');
  const [email,    setEmail]    = useState(dispatcher.email || '');
  const [phone,    setPhone]    = useState(dispatcher.phone || '');
  const [ssn,      setSSN]      = useState(dispatcher.ssn   || '');
  const [active,   setActive]   = useState(!!dispatcher.active);
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [saving,   setSaving]   = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name, email, phone, ssn, active };
      if (password) payload.password = password;
      await api.put(`/admin/dispatchers/${dispatcher.id}`, payload);
      onSaved({ name, email, phone, ssn, active: active ? 1 : 0 });
      onClose();
    } catch {
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Editar dispatcher</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-3">

          {/* Name */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1 block">Nombre</label>
            <input className="input w-full" placeholder="Nombre completo" value={name} onChange={e => setName(e.target.value)} />
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1 block">Email</label>
            <input className="input w-full" type="email" placeholder="email@osilogistics.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1 block">Teléfono</label>
            <input className="input w-full" placeholder="(305) 555-0000" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>

          {/* SSN */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1 block flex items-center gap-1">
              <Shield className="w-3 h-3" /> SSN
            </label>
            <input className="input w-full font-mono" placeholder="XXX-XX-XXXX" value={ssn} onChange={e => setSSN(e.target.value)} />
            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">Confidencial — solo visible para admins</p>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1 block">Nueva contraseña <span className="text-gray-400 font-normal">(dejar vacío para no cambiar)</span></label>
            <div className="relative">
              <input
                className="input w-full pr-9"
                type={showPwd ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-1">
            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Estado de cuenta</span>
            <button
              type="button"
              onClick={() => setActive(!active)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${active ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* Actions */}
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

const EQ_COLORS: Record<string, string> = {
  'Dry Van':    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'Reefer':     'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Flatbed':    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  'Box Truck':  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'Power Only': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'Hotshot':    'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  'Tanker':     'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">{children}</p>
  );
}

function DetailModal({ dispatcher, onClose, onEdit }: DetailModalProps) {
  const [showSSN, setShowSSN] = useState(false);
  const initials = dispatcher.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const pct = dispatcher.total_earned > 0 ? Math.round((dispatcher.settled / dispatcher.total_earned) * 100) : 0;
  const eqList = dispatcher.equipment_experience?.split(',').map(e => e.trim()).filter(Boolean) ?? [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* ── Title bar ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Perfil del Dispatcher</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-500 dark:text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* ── Profile header ── */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {initials}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">{dispatcher.name}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  dispatcher.active
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dispatcher.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {dispatcher.active ? 'Activo' : 'Inactivo'}
                </span>
                {dispatcher.dispatcher_code && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full tracking-widest">
                    <Hash className="w-2.5 h-2.5" /> ID {dispatcher.dispatcher_code}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Miembro desde {format(new Date(dispatcher.created_at), 'MMM d, yyyy')}</p>
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{dispatcher.total_orders}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center justify-center gap-1"><Package className="w-3 h-3" /> Órdenes</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{dispatcher.active_orders}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Activas</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-600">${dispatcher.total_earned.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Ganado</p>
            </div>
          </div>

          {/* ── Contact ── */}
          <div className="space-y-2">
            {dispatcher.phone ? (
              <a href={`tel:${dispatcher.phone}`} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-900 rounded-xl p-3 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                <Phone className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                <span className="text-sm text-gray-700 dark:text-slate-300">{dispatcher.phone}</span>
              </a>
            ) : (
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-900 rounded-xl p-3">
                <Phone className="w-4 h-4 text-gray-300 dark:text-slate-600" />
                <button onClick={onEdit} className="text-sm text-orange-500 hover:text-orange-600 font-medium">+ Agregar teléfono</button>
              </div>
            )}
            <a href={`mailto:${dispatcher.email}`} className="flex items-center gap-3 bg-gray-50 dark:bg-slate-900 rounded-xl p-3 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
              <Mail className="w-4 h-4 text-gray-400 dark:text-slate-500" />
              <span className="text-sm text-blue-500 truncate">{dispatcher.email}</span>
            </a>
          </div>

          {/* ── Commissions ── */}
          <div className="bg-gray-50 dark:bg-slate-900 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Comisiones · 5% por orden</p>
            {[
              { label: 'Total generado', value: `$${dispatcher.total_earned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, cls: 'font-bold text-gray-900 dark:text-white' },
              { label: 'Liquidado',      value: `$${dispatcher.settled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,      cls: 'font-semibold text-green-600 dark:text-green-400' },
              { label: 'Pendiente',      value: `$${dispatcher.pending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,      cls: 'font-semibold text-yellow-600 dark:text-yellow-400' },
            ].map(r => (
              <div key={r.label} className="flex justify-between items-center text-sm">
                <span className="text-gray-500 dark:text-slate-400">{r.label}</span>
                <span className={r.cls}>{r.value}</span>
              </div>
            ))}
            {dispatcher.total_earned > 0 && (
              <div className="pt-1">
                <div className="flex justify-between text-[10px] text-gray-400 dark:text-slate-500 mb-1.5">
                  <span>Progreso de liquidación</span><span className="font-semibold">{pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* ── Tax / SSN ── */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2 mb-3">
              <Shield className="w-3 h-3" /> INFORMACIÓN FISCAL · 1099
            </p>
            {dispatcher.ssn ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-slate-400">SSN</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-medium text-gray-800 dark:text-slate-200">{showSSN ? dispatcher.ssn : maskSSN(dispatcher.ssn)}</span>
                  <button onClick={() => setShowSSN(!showSSN)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
                    {showSSN ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={onEdit} className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium">+ Agregar SSN</button>
            )}
          </div>

          {/* ── Equipment experience ── */}
          {eqList.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">Experiencia en loads</p>
              <div className="flex flex-wrap gap-2">
                {eqList.map(eq => (
                  <span key={eq} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${EQ_COLORS[eq] || 'bg-gray-100 text-gray-700'}`}>
                    <Truck className="w-3 h-3" />{eq}
                  </span>
                ))}
              </div>
            </div>
          )}
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
                {/* Header row: avatar + info + actions */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{d.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        d.active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${d.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {d.active ? 'Activo' : 'Inactivo'}
                      </span>
                      {d.dispatcher_code && (
                        <span className="text-[10px] font-bold text-orange-500 tracking-widest">{d.dispatcher_code}</span>
                      )}
                    </div>
                  </div>
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

                {/* Contact info — driver card style */}
                <div className="space-y-1.5 text-xs mb-3">
                  <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                    <Phone className="w-3 h-3 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                    <span>{d.phone || <span className="italic text-gray-300 dark:text-slate-600">Sin teléfono</span>}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                    <Mail className="w-3 h-3 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                    <span className="truncate text-blue-500">{d.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                    <span className={`text-xs font-medium ${d.ssn ? 'text-green-600 dark:text-green-400' : 'italic text-gray-300 dark:text-slate-600'}`}>
                      {d.ssn ? 'SSN registrado' : 'Sin SSN'}
                    </span>
                  </div>
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

                {/* Equipment experience */}
                {d.equipment_experience && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {d.equipment_experience.split(',').map(eq => eq.trim()).filter(Boolean).map(eq => (
                      <span key={eq} className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold ${EQ_COLORS[eq] || 'bg-gray-100 text-gray-600'}`}>
                        {eq}
                      </span>
                    ))}
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
