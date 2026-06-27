import { useState, useEffect } from 'react';
import {
  ShieldCheck, Clock, ChevronDown, ChevronUp,
  User, Truck, AlertTriangle, CheckCircle2,
  XCircle, RefreshCw, Search, UserCheck,
} from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

type CheckStatus = 'pending' | 'verified' | 'failed' | 'na';

interface VerificationCheck {
  id: string;
  entity_type: string;
  entity_id: string;
  check_name: string;
  status: CheckStatus;
  notes: string;
  checked_by: string;
  checked_at: string | null;
}

interface DriverEntity {
  id: string;
  name: string;
  email: string;
  phone: string;
  license_number: string;
  license_expiry: string;
  equipment_type: string;
  company_name: string;
  mc_number: string;
  coi_filename: string;
  coi_expiry: string;
  hire_date: string;
  avatar: string;
  driver_code: string;
  user_id: string;
  active: number;
  approval_status: string;
}

interface DispatcherEntity {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  years_experience: number;
  previous_companies: string;
  languages: string;
  availability: string;
  equipment_experience: string;
  date_of_birth: string;
  dispatcher_code: string;
  active: number;
  approval_status: string;
}

const DRIVER_CHECK_LABELS: Record<string, string> = {
  identity:            'Verificación de Identidad',
  license:             'Licencia de Conducir',
  mvr:                 'MVR – Historial de Manejo',
  insurance:           'Seguro / COI',
  criminal_background: 'Background Criminal',
  drug_test:           'Prueba de Drogas',
  equipment:           'Verificación de Equipo',
};

const DISPATCHER_CHECK_LABELS: Record<string, string> = {
  identity:           'Verificación de Identidad',
  background:         'Background Check',
  employment_history: 'Historial Laboral',
  references:         'Referencias',
  experience:         'Verificación de Experiencia',
};

const STATUS_STYLES: Record<CheckStatus, string> = {
  pending:  'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700/40',
  verified: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/40',
  failed:   'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700/40',
  na:       'bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600',
};

const STATUS_ICON: Record<CheckStatus, React.ReactNode> = {
  pending:  <Clock className="w-3 h-3" />,
  verified: <CheckCircle2 className="w-3 h-3" />,
  failed:   <XCircle className="w-3 h-3" />,
  na:       <span className="text-xs font-bold">N/A</span>,
};

function overallStatus(checks: VerificationCheck[]): { label: string; color: string } {
  if (checks.every(c => c.status === 'verified' || c.status === 'na'))
    return { label: 'Verificado', color: 'text-green-600 dark:text-green-400' };
  if (checks.some(c => c.status === 'failed'))
    return { label: 'Con observaciones', color: 'text-red-600 dark:text-red-400' };
  const done = checks.filter(c => c.status !== 'pending').length;
  return { label: `${done}/${checks.length} completados`, color: 'text-amber-600 dark:text-amber-400' };
}

interface CheckRowProps {
  check: VerificationCheck;
  label: string;
  onUpdate: (checkName: string, status: CheckStatus, notes: string) => Promise<void>;
}

function CheckRow({ check, label, onUpdate }: CheckRowProps) {
  const [notes, setNotes] = useState(check.notes || '');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleUpdate = async (status: CheckStatus) => {
    setSaving(true);
    await onUpdate(check.check_name, status, notes);
    setSaving(false);
    setExpanded(false);
  };

  return (
    <div className={`rounded-xl border transition-colors ${expanded ? 'bg-gray-50 dark:bg-slate-800/80' : 'bg-white dark:bg-slate-800'} border-gray-100 dark:border-slate-700`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold flex-shrink-0 ${STATUS_STYLES[check.status]}`}>
          {STATUS_ICON[check.status]}
          {check.status === 'na' ? 'N/A' : check.status.charAt(0).toUpperCase() + check.status.slice(1)}
        </span>
        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-slate-200">{label}</span>
        {check.checked_by && (
          <span className="text-xs text-gray-400 dark:text-slate-500 hidden sm:block truncate max-w-[160px]">
            {check.checked_by} · {check.checked_at ? format(new Date(check.checked_at), 'MMM d, HH:mm') : ''}
          </span>
        )}
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-slate-700 pt-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1 block">Notas / Observaciones</label>
            <textarea
              className="input resize-none text-sm"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Licencia válida hasta 2027, sin infracciones..."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleUpdate('verified')}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Verificado
            </button>
            <button
              onClick={() => handleUpdate('failed')}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" /> No Pasó
            </button>
            <button
              onClick={() => handleUpdate('na')}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 text-gray-700 dark:text-slate-300 text-xs font-semibold transition-colors"
            >
              N/A
            </button>
            {check.status !== 'pending' && (
              <button
                onClick={() => handleUpdate('pending')}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 disabled:opacity-50 text-amber-700 dark:text-amber-400 text-xs font-semibold transition-colors"
              >
                <Clock className="w-3.5 h-3.5" /> Pendiente
              </button>
            )}
            {saving && <span className="text-xs text-gray-400 self-center">Guardando...</span>}
          </div>
          {check.checked_by && (
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Última actualización por <span className="font-medium">{check.checked_by}</span>
              {check.checked_at && ` · ${format(new Date(check.checked_at), 'MMM d, yyyy HH:mm')}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface EntityCardProps {
  entityId: string;
  entityType: 'driver' | 'dispatcher';
  userId: string;
  approvalStatus: string;
  name: string;
  subtitle: string;
  detail: string;
  checks: VerificationCheck[];
  checkLabels: Record<string, string>;
  onUpdate: (entityId: string, checkName: string, status: CheckStatus, notes: string) => Promise<void>;
  onApprove: (userId: string) => Promise<void>;
  children?: React.ReactNode;
}

function EntityCard({ entityId, entityType, userId, approvalStatus, name, subtitle, detail, checks, checkLabels, onUpdate, onApprove, children }: EntityCardProps) {
  const [open, setOpen] = useState(false);
  const [approving, setApproving] = useState(false);
  const overall = overallStatus(checks);
  const pendingCount = checks.filter(c => c.status === 'pending').length;
  const isPending = approvalStatus === 'pending';

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setApproving(true);
    await onApprove(userId);
    setApproving(false);
  };

  return (
    <div className={`card p-0 overflow-hidden ${isPending ? 'border-2 border-amber-300 dark:border-amber-600/50' : ''}`}>
      {isPending && (
        <div className="flex items-center justify-between px-5 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700/40">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Cuenta pendiente de aprobación</span>
          </div>
          <button
            onClick={handleApprove}
            disabled={approving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-bold transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5" />
            {approving ? 'Aprobando...' : 'Aprobar cuenta'}
          </button>
        </div>
      )}
      <button
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-slate-800/70 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow ${entityType === 'driver' ? 'bg-blue-500' : 'bg-orange-500'}`}>
          {name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{name}</p>
            {isPending && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200 dark:border-amber-700/40">Pendiente</span>}
            {pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{subtitle}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{detail}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className={`text-xs font-semibold ${overall.color}`}>{overall.label}</p>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400 mt-1 ml-auto" /> : <ChevronDown className="w-4 h-4 text-gray-400 mt-1 ml-auto" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-slate-700 px-5 py-4 space-y-3">
          {children && (
            <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl p-4 grid grid-cols-2 gap-x-6 gap-y-1.5 mb-4">
              {children}
            </div>
          )}
          <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-2">Checklist de Verificación</p>
          <div className="space-y-2">
            {checks.map(c => (
              <CheckRow
                key={c.check_name}
                check={c}
                label={checkLabels[c.check_name] || c.check_name}
                onUpdate={(checkName, status, notes) => onUpdate(entityId, checkName, status, notes)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Verifications() {
  const [tab, setTab] = useState<'drivers' | 'dispatchers'>('drivers');
  const [drivers, setDrivers] = useState<DriverEntity[]>([]);
  const [dispatchers, setDispatchers] = useState<DispatcherEntity[]>([]);
  const [checks, setChecks] = useState<VerificationCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'issues'>('all');

  const fetchData = async () => {
    try {
      const { data } = await api.get('/admin/verifications');
      setDrivers(data.drivers);
      setDispatchers(data.dispatchers);
      setChecks(data.checks);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpdate = async (entityId: string, checkName: string, status: CheckStatus, notes: string) => {
    const entityType = tab === 'drivers' ? 'driver' : 'dispatcher';
    await api.put(`/admin/verifications/${entityType}/${entityId}/${checkName}`, { status, notes });
    const updated = await api.get('/admin/verifications');
    setChecks(updated.data.checks);
  };

  const handleApprove = async (userId: string) => {
    await api.put(`/admin/users/${userId}/approve`);
    fetchData();
  };

  const getChecksFor = (entityType: string, entityId: string) =>
    checks.filter(c => c.entity_type === entityType && c.entity_id === entityId);

  const matchesSearch = (name: string, email: string) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return name.toLowerCase().includes(q) || email.toLowerCase().includes(q);
  };

  const matchesFilter = (entityType: string, entityId: string) => {
    if (filter === 'all') return true;
    const ec = getChecksFor(entityType, entityId);
    if (filter === 'pending') return ec.some(c => c.status === 'pending');
    if (filter === 'issues') return ec.some(c => c.status === 'failed');
    return true;
  };

  const filteredDrivers = drivers.filter(d => matchesSearch(d.name, d.email) && matchesFilter('driver', d.id));
  const filteredDispatchers = dispatchers.filter(d => matchesSearch(d.name, d.email) && matchesFilter('dispatcher', d.id));

  const pendingDrivers = drivers.filter(d => getChecksFor('driver', d.id).some(c => c.status === 'pending')).length;
  const pendingDispatchers = dispatchers.filter(d => getChecksFor('dispatcher', d.id).some(c => c.status === 'pending')).length;

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-purple-500" /> Verificaciones
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">Verificación de identidad, licencias y background checks</p>
        </div>
        <button onClick={() => { setLoading(true); fetchData(); }}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors self-start sm:self-auto">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Drivers',       value: drivers.length,      sub: `${pendingDrivers} pendientes`,      color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'Dispatchers',   value: dispatchers.length,  sub: `${pendingDispatchers} pendientes`,  color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          { label: 'Verificaciones pendientes', value: checks.filter(c => c.status === 'pending').length, sub: 'sin revisar', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Con observaciones', value: checks.filter(c => c.status === 'failed').length, sub: 'requieren atención', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
        ].map(s => (
          <div key={s.label} className={`card ${s.bg} p-4`}>
            <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs + filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 flex-shrink-0">
          <button
            onClick={() => setTab('drivers')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${tab === 'drivers' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
          >
            <Truck className="w-4 h-4" /> Drivers
            {pendingDrivers > 0 && <span className="bg-amber-500 text-white text-xs font-bold px-1.5 rounded-full">{pendingDrivers}</span>}
          </button>
          <button
            onClick={() => setTab('dispatchers')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-l border-gray-200 dark:border-slate-700 ${tab === 'dispatchers' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
          >
            <User className="w-4 h-4" /> Dispatchers
            {pendingDispatchers > 0 && <span className="bg-amber-500 text-white text-xs font-bold px-1.5 rounded-full">{pendingDispatchers}</span>}
          </button>
        </div>

        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Buscar por nombre o email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 flex-shrink-0 text-xs font-semibold">
          {([['all','Todos'],['pending','Pendientes'],['issues','Observaciones']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-2 transition-colors ${filter === v ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'} ${v !== 'all' ? 'border-l border-gray-200 dark:border-slate-700' : ''}`}
            >{l}</button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-500">Cargando verificaciones...</div>
      ) : tab === 'drivers' ? (
        filteredDrivers.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-slate-500">No se encontraron drivers</div>
        ) : (
          <div className="space-y-3">
            {filteredDrivers.map(d => {
              const dChecks = getChecksFor('driver', d.id);
              return (
                <EntityCard
                  key={d.id}
                  entityId={d.id}
                  entityType="driver"
                  userId={d.user_id}
                  approvalStatus={d.approval_status}
                  name={d.name}
                  subtitle={`${d.email} · ${d.phone}`}
                  detail={`${d.equipment_type} · ${d.company_name}${d.mc_number ? ` · MC# ${d.mc_number}` : ''}`}
                  checks={dChecks}
                  checkLabels={DRIVER_CHECK_LABELS}
                  onUpdate={handleUpdate}
                  onApprove={handleApprove}
                >
                  <InfoRow label="Licencia #" value={d.license_number} />
                  <InfoRow label="Vence" value={d.license_expiry ? format(new Date(d.license_expiry), 'MMM d, yyyy') : '—'} warn={!!d.license_expiry && new Date(d.license_expiry) < new Date(Date.now() + 90*24*3600*1000)} />
                  <InfoRow label="COI" value={d.coi_filename || 'No subido'} warn={!d.coi_filename} />
                  <InfoRow label="COI Vence" value={d.coi_expiry ? format(new Date(d.coi_expiry), 'MMM d, yyyy') : '—'} warn={!!d.coi_expiry && new Date(d.coi_expiry) < new Date(Date.now() + 90*24*3600*1000)} />
                  <InfoRow label="Fecha Contrato" value={d.hire_date ? format(new Date(d.hire_date), 'MMM d, yyyy') : '—'} />
                  <InfoRow label="Código Driver" value={d.driver_code} />
                </EntityCard>
              );
            })}
          </div>
        )
      ) : (
        filteredDispatchers.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-slate-500">No se encontraron dispatchers</div>
        ) : (
          <div className="space-y-3">
            {filteredDispatchers.map(d => {
              const dChecks = getChecksFor('dispatcher', d.id);
              return (
                <EntityCard
                  key={d.id}
                  entityId={d.id}
                  entityType="dispatcher"
                  userId={d.id}
                  approvalStatus={d.approval_status}
                  name={d.name}
                  subtitle={`${d.email} · ${d.phone}`}
                  detail={`${d.city} · ${d.years_experience} años exp. · ${d.availability}`}
                  checks={dChecks}
                  checkLabels={DISPATCHER_CHECK_LABELS}
                  onUpdate={handleUpdate}
                  onApprove={handleApprove}
                >
                  <InfoRow label="Fecha Nacimiento" value={d.date_of_birth || '—'} />
                  <InfoRow label="Ciudad" value={d.city || '—'} />
                  <InfoRow label="Experiencia" value={`${d.years_experience} años`} />
                  <InfoRow label="Disponibilidad" value={d.availability} />
                  <InfoRow label="Idiomas" value={d.languages || '—'} />
                  <InfoRow label="Código Dispatcher" value={d.dispatcher_code} />
                  {d.previous_companies && (
                    <div className="col-span-2">
                      <span className="text-xs text-gray-500 dark:text-slate-400">Empresas anteriores: </span>
                      <span className="text-xs text-gray-800 dark:text-slate-200">{d.previous_companies}</span>
                    </div>
                  )}
                  {d.equipment_experience && (
                    <div className="col-span-2">
                      <span className="text-xs text-gray-500 dark:text-slate-400">Experiencia en equipo: </span>
                      <span className="text-xs text-gray-800 dark:text-slate-200">{d.equipment_experience}</span>
                    </div>
                  )}
                </EntityCard>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function InfoRow({ label, value, warn }: { label: string; value: string | boolean | null | undefined; warn?: boolean | null }) {
  return (
    <div>
      <span className="text-xs text-gray-500 dark:text-slate-400">{label}: </span>
      <span className={`text-xs font-medium ${warn ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-slate-200'}`}>
        {warn && <AlertTriangle className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
        {value as string}
      </span>
    </div>
  );
}
