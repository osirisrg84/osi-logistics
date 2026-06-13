import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, CheckCircle2, Clock, RefreshCw,
  ChevronDown, DollarSign, Package,
  Wallet, Smartphone, Building2, FileText, CreditCard,
  Send, Pencil, PlusCircle, AlertCircle,
} from 'lucide-react';
import { billingApi, userApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

interface CommissionRow {
  id: string;
  order_number: string;
  driver_name: string;
  order_price: number;
  dispatcher_pay: number;
  delivery_date: string | null;
  status: 'pending' | 'settled';
  settled_at: string | null;
}

type PayoutDetails = Record<string, string>;

const PAYOUT_METHODS = [
  {
    id: 'zelle',  label: 'Zelle',
    icon: Smartphone,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-700/30',
    activeBorder: 'border-purple-400 dark:border-purple-500',
  },
  {
    id: 'ach',    label: 'ACH / Dep. Directo',
    icon: Building2,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-700/30',
    activeBorder: 'border-blue-400 dark:border-blue-500',
  },
  {
    id: 'wire',   label: 'Wire Transfer',
    icon: Send,
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-700/30',
    activeBorder: 'border-green-400 dark:border-green-500',
  },
  {
    id: 'paypal', label: 'PayPal',
    icon: CreditCard,
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-700/30',
    activeBorder: 'border-blue-400 dark:border-blue-500',
  },
  {
    id: 'venmo',  label: 'Venmo',
    icon: CreditCard,
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-900/20',
    border: 'border-cyan-200 dark:border-cyan-700/30',
    activeBorder: 'border-cyan-400 dark:border-cyan-500',
  },
  {
    id: 'check',  label: 'Check',
    icon: FileText,
    color: 'text-gray-600 dark:text-slate-300',
    bg: 'bg-gray-50 dark:bg-slate-700/50',
    border: 'border-gray-200 dark:border-slate-600',
    activeBorder: 'border-gray-400 dark:border-slate-400',
  },
  {
    id: 'cash',   label: 'Efectivo',
    icon: DollarSign,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-700/30',
    activeBorder: 'border-emerald-400 dark:border-emerald-500',
  },
];

function fmt(n: number) { return `$${n.toFixed(2)}`; }
function maskAccount(s: string) { return s.length > 4 ? `****${s.slice(-4)}` : s; }

function payoutSummary(method: string, details: PayoutDetails): string {
  switch (method) {
    case 'zelle':  return details.contact || '—';
    case 'ach':    return `${details.bank || 'Banco'} · ${maskAccount(details.account || '')} · ${details.type === 'savings' ? 'Savings' : 'Checking'}`;
    case 'wire':   return `${details.bank || 'Banco'} · ${maskAccount(details.account || '')}${details.swift ? ` · ${details.swift}` : ''}`;
    case 'paypal': return details.email || '—';
    case 'venmo':  return details.username || '—';
    case 'check':  return `A nombre de: ${details.payable_to || '—'}`;
    case 'cash':   return 'OSI coordinará la entrega en efectivo';
    default:       return '—';
  }
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function StatusChip({ status }: { status: 'pending' | 'settled' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      status === 'settled'
        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
    }`}>
      {status === 'settled' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {status === 'settled' ? 'Pagado' : 'Pendiente'}
    </span>
  );
}

function PayoutDisplay({ method, details }: { method: string; details: PayoutDetails }) {
  const cfg = PAYOUT_METHODS.find(m => m.id === method);
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-4 ${cfg.bg} rounded-2xl p-4 border ${cfg.border}`}>
      <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 border border-gray-100 dark:border-slate-700">
        <Icon className={`w-6 h-6 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-bold text-gray-900 dark:text-white">{cfg.label}</p>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Activo
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{payoutSummary(method, details)}</p>
      </div>
    </div>
  );
}

export default function DispatcherCommissions() {
  const { user } = useAuth();

  // Commissions
  const [rows, setRows]           = useState<CommissionRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading]     = useState(true);

  // Payout method
  const [payoutMethod,  setPayoutMethod]  = useState('');
  const [payoutDetails, setPayoutDetails] = useState<PayoutDetails>({});
  const [editingPayout, setEditingPayout] = useState(false);
  const [savingPayout,  setSavingPayout]  = useState(false);
  const [origMethod,    setOrigMethod]    = useState('');
  const [origDetails,   setOrigDetails]   = useState<PayoutDetails>({});

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { dispatcher_user_id: user.id };
      if (statusFilter) params.status = statusFilter;
      const { data } = await billingApi.getRecords(params);
      setRows(data as CommissionRow[]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Load payout profile
  useEffect(() => {
    userApi.getProfile().then(({ data }) => {
      setPayoutMethod(data.payout_method || '');
      try { setPayoutDetails(data.payout_details ? JSON.parse(data.payout_details) : {}); }
      catch { setPayoutDetails({}); }
    }).catch(() => {});
  }, []);

  const startEdit = () => {
    setOrigMethod(payoutMethod);
    setOrigDetails({ ...payoutDetails });
    setEditingPayout(true);
  };

  const cancelEdit = () => {
    setPayoutMethod(origMethod);
    setPayoutDetails(origDetails);
    setEditingPayout(false);
  };

  const changeMethod = (id: string) => {
    setPayoutMethod(id);
    setPayoutDetails({});
  };

  const updateDetail = (key: string, value: string) =>
    setPayoutDetails(d => ({ ...d, [key]: value }));

  const savePayout = async () => {
    setSavingPayout(true);
    try {
      await userApi.updateProfile({
        payout_method: payoutMethod,
        payout_details: JSON.stringify(payoutDetails),
      });
      setEditingPayout(false);
    } catch { }
    finally { setSavingPayout(false); }
  };

  const total   = rows.reduce((s, r) => s + r.dispatcher_pay, 0);
  const settled = rows.filter(r => r.status === 'settled').reduce((s, r) => s + r.dispatcher_pay, 0);
  const pending = rows.filter(r => r.status === 'pending').reduce((s, r) => s + r.dispatcher_pay, 0);

  return (
    <div className="space-y-5 fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Mis Comisiones</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            En OSI valoramos tu esfuerzo. Por eso te pagamos el <span className="font-semibold text-blue-600">5%</span> por cada carga gestionada.
          </p>
        </div>
        <button onClick={load} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
          <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400">Total a cobrar</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(total)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">5% · {rows.length} cargas</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400">Cobrado</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{fmt(settled)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{rows.filter(r => r.status === 'settled').length} liquidadas</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400">Pendiente</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{fmt(pending)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{rows.filter(r => r.status === 'pending').length} por cobrar</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400">Cargas</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{rows.length}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">gestionadas</p>
        </div>
      </div>

      {/* ── Payout Method Section ──────────────────────────── */}
      {/* Alert banner: pending amount but no payout method */}
      {pending > 0 && !payoutMethod && !editingPayout && (
        <div className="flex items-center gap-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/40 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <p className="text-xs text-yellow-700 dark:text-yellow-300 flex-1">
            Tienes <strong>{fmt(pending)}</strong> pendientes. Configura tu método de cobro para que OSI pueda enviarte el pago.
          </p>
          <button onClick={startEdit} className="text-xs font-bold text-yellow-700 dark:text-yellow-300 hover:underline flex-shrink-0">
            Configurar
          </button>
        </div>
      )}

      <div className="card p-5">
        {/* Card header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Método de cobro</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500">Cómo OSI Logistics te envía tus pagos</p>
            </div>
          </div>
          {!editingPayout && payoutMethod && (
            <button onClick={startEdit}
              className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 font-semibold transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          )}
        </div>

        {editingPayout ? (
          <div className="space-y-4">
            {/* Method grid selector */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">Selecciona un método</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {PAYOUT_METHODS.map(m => {
                  const Icon = m.icon;
                  const isSelected = payoutMethod === m.id;
                  return (
                    <button key={m.id} type="button" onClick={() => changeMethod(m.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        isSelected
                          ? `${m.bg} ${m.activeBorder} ${m.color} shadow-sm`
                          : 'bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-500'
                      }`}>
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic fields */}
            {payoutMethod === 'zelle' && (
              <Field label="Email o teléfono de Zelle" required>
                <input className="input" type="text" placeholder="305-555-0101 o correo@email.com"
                  value={payoutDetails.contact || ''} onChange={e => updateDetail('contact', e.target.value)} />
              </Field>
            )}

            {(payoutMethod === 'ach' || payoutMethod === 'wire') && (
              <div className="space-y-3">
                <Field label="Nombre del banco" required>
                  <input className="input" type="text" placeholder="Chase, Wells Fargo, Bank of America..."
                    value={payoutDetails.bank || ''} onChange={e => updateDetail('bank', e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Routing #" required>
                    <input className="input font-mono" type="text" placeholder="021000021"
                      maxLength={9}
                      value={payoutDetails.routing || ''} onChange={e => updateDetail('routing', e.target.value)} />
                  </Field>
                  <Field label="Account #" required>
                    <input className="input font-mono" type="text" placeholder="000123456789"
                      value={payoutDetails.account || ''} onChange={e => updateDetail('account', e.target.value)} />
                  </Field>
                </div>
                {payoutMethod === 'ach' ? (
                  <Field label="Tipo de cuenta">
                    <select className="input" value={payoutDetails.type || 'checking'} onChange={e => updateDetail('type', e.target.value)}>
                      <option value="checking">Checking</option>
                      <option value="savings">Savings</option>
                    </select>
                  </Field>
                ) : (
                  <Field label="SWIFT / BIC (opcional)">
                    <input className="input font-mono" type="text" placeholder="CHASUS33"
                      value={payoutDetails.swift || ''} onChange={e => updateDetail('swift', e.target.value)} />
                  </Field>
                )}
              </div>
            )}

            {payoutMethod === 'paypal' && (
              <Field label="Email de PayPal" required>
                <input className="input" type="email" placeholder="tu@email.com"
                  value={payoutDetails.email || ''} onChange={e => updateDetail('email', e.target.value)} />
              </Field>
            )}

            {payoutMethod === 'venmo' && (
              <Field label="Usuario de Venmo" required>
                <input className="input" type="text" placeholder="@tu-usuario"
                  value={payoutDetails.username || ''} onChange={e => updateDetail('username', e.target.value)} />
              </Field>
            )}

            {payoutMethod === 'check' && (
              <div className="space-y-3">
                <Field label="A nombre de (Payable to)" required>
                  <input className="input" type="text" placeholder="Tu nombre completo legal"
                    value={payoutDetails.payable_to || ''} onChange={e => updateDetail('payable_to', e.target.value)} />
                </Field>
                <Field label="Dirección de envío" required>
                  <input className="input" type="text" placeholder="123 Main St, Miami FL 33125"
                    value={payoutDetails.address || ''} onChange={e => updateDetail('address', e.target.value)} />
                </Field>
              </div>
            )}

            {payoutMethod === 'cash' && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/30 rounded-xl p-3.5">
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Recibirás tus pagos en efectivo. OSI Logistics coordinará el método de entrega contigo directamente.
                </p>
              </div>
            )}

            {/* Save / Cancel */}
            <div className="flex gap-2 pt-1">
              <button onClick={cancelEdit}
                className="flex-1 py-2.5 rounded-xl text-sm text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-medium">
                Cancelar
              </button>
              <button onClick={savePayout} disabled={savingPayout || !payoutMethod}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                {savingPayout
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><CheckCircle2 className="w-4 h-4" /> Guardar método</>
                }
              </button>
            </div>
          </div>
        ) : payoutMethod ? (
          <PayoutDisplay method={payoutMethod} details={payoutDetails} />
        ) : (
          <div className="border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-2xl p-7 text-center">
            <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Wallet className="w-6 h-6 text-gray-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">Sin método de cobro configurado</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
              Agrega tu método preferido para que OSI pueda enviarte tus comisiones
            </p>
            <button onClick={startEdit}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-blue-500/20">
              <PlusCircle className="w-3.5 h-3.5" /> Configurar método de cobro
            </button>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Historial de comisiones</h2>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/40"
          >
            <option value="">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="settled">Cobrados</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Desktop table */}
      <div className="card overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400 uppercase">
                <th className="text-left px-4 py-3 font-semibold">Orden</th>
                <th className="text-left px-4 py-3 font-semibold">Driver</th>
                <th className="text-right px-4 py-3 font-semibold">Precio carga</th>
                <th className="text-right px-4 py-3 font-semibold text-blue-600">Mi comisión (5%)</th>
                <th className="text-left px-4 py-3 font-semibold">Fecha</th>
                <th className="text-center px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Cargando...</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <DollarSign className="w-10 h-10 text-gray-200 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Sin comisiones registradas</p>
                    <p className="text-gray-300 dark:text-slate-600 text-xs mt-1">Las comisiones aparecen cuando tus cargas se entregan</p>
                  </td>
                </tr>
              ) : rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900 dark:text-white">{r.order_number}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{r.driver_name}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{fmt(r.order_price)}</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-600">{fmt(r.dispatcher_pay)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500">
                    {r.delivery_date ? format(new Date(r.delivery_date), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center"><StatusChip status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-700">
          {loading ? (
            <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <DollarSign className="w-10 h-10 text-gray-200 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Sin comisiones registradas</p>
            </div>
          ) : rows.map(r => (
            <div key={r.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">{r.order_number}</span>
                <StatusChip status={r.status} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-slate-400">{r.driver_name}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{fmt(r.order_price)} carga</p>
              </div>
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Mi comisión (5%)</span>
                <span className="text-sm font-bold text-blue-600">{fmt(r.dispatcher_pay)}</span>
              </div>
              {r.delivery_date && (
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {format(new Date(r.delivery_date), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
