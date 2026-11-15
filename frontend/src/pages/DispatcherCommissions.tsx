import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp, CheckCircle2, Clock, RefreshCw,
  ChevronDown, DollarSign, Package,
  Wallet, Smartphone, Building2, FileText, CreditCard,
  Send, Pencil, PlusCircle, AlertCircle, Shield, Eye, EyeOff,
} from 'lucide-react';
import { billingApi, userApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { format } from '../utils/dateFormat';
import i18n from '../i18n';
import { effectiveTaxType, isColombia, maskTaxId, validateTaxId, type TaxIdType } from '../utils/taxId';

interface CommissionRow {
  id: string;
  order_number: string;
  driver_name: string;
  order_price: number;
  dispatcher_pay: number;
  delivery_date: string | null;
  status: 'pending' | 'settled';
  settled_at: string | null;
  // Si OSI ya le pago al dispatcher su 3% -- independiente de `status`, que
  // es si el DRIVER ya pago su 7% (dos pagos distintos, misma orden).
  dispatcher_status: 'pending' | 'settled';
  dispatcher_settled_at: string | null;
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

function fmt(n: number) { return `$${n.toLocaleString(i18n.language?.startsWith('en') ? 'en-US' : 'es-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function maskAccount(s: string) { return s.length > 4 ? `****${s.slice(-4)}` : s; }

function methodLabel(m: { id: string; label: string }): string {
  if (['ach', 'wire', 'check', 'cash'].includes(m.id)) return i18n.t(`grupoB.commissions.method_${m.id}`);
  return m.label;
}

function payoutSummary(method: string, details: PayoutDetails): string {
  switch (method) {
    case 'zelle':  return details.contact || '—';
    case 'ach':    return `${details.bank || i18n.t('grupoB.commissions.bankFallback')} · ${maskAccount(details.account || '')} · ${details.type === 'savings' ? i18n.t('grupoB.commissions.savings') : i18n.t('grupoB.commissions.checking')}`;
    case 'wire':   return `${details.bank || i18n.t('grupoB.commissions.bankFallback')} · ${maskAccount(details.account || '')}${details.swift ? ` · ${details.swift}` : ''}`;
    case 'paypal': return details.email || '—';
    case 'venmo':  return details.username || '—';
    case 'check':  return i18n.t('grupoB.commissions.payableToSummary', { name: details.payable_to || '—' });
    case 'cash':   return i18n.t('grupoB.commissions.cashSummary');
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
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      status === 'settled'
        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
    }`}>
      {status === 'settled' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {status === 'settled' ? t('commissions.statusPaid') : t('commissions.statusPending')}
    </span>
  );
}

function PayoutDisplay({ method, details }: { method: string; details: PayoutDetails }) {
  const { t } = useTranslation();
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
          <p className="text-sm font-bold text-gray-900 dark:text-white">{methodLabel(cfg)}</p>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> {t('common.truckStatus.active')}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{payoutSummary(method, details)}</p>
      </div>
    </div>
  );
}

export default function DispatcherCommissions() {
  const { t } = useTranslation();
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

  // SSN / Tax info
  const [ssn,          setSsn]          = useState('');
  const [editingSsn,   setEditingSsn]   = useState(false);
  const [ssnInput,     setSsnInput]     = useState('');
  const [savingSsn,    setSavingSsn]    = useState(false);
  const [showSsn,      setShowSsn]      = useState(false);
  // El documento fiscal depende del pais: EE. UU. = SSN, Colombia = cedula o NIT/RUT
  const [country,      setCountry]      = useState('');
  const [storedType,   setStoredType]   = useState('');
  const [docType,      setDocType]      = useState<TaxIdType>('ssn');
  const [taxError,     setTaxError]     = useState('');
  const colombia = isColombia(country);
  const taxType: TaxIdType = effectiveTaxType(country, storedType);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const params: Record<string, string> = { dispatcher_user_id: user.id };
      if (statusFilter) params.dispatcher_status = statusFilter;
      const { data } = await billingApi.getRecords(params);
      setRows((data.records ?? []) as CommissionRow[]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Load payout profile + SSN
  useEffect(() => {
    userApi.getProfile().then(({ data }) => {
      setPayoutMethod(data.payout_method || '');
      setSsn(data.ssn || '');
      setCountry(data.country || '');
      setStoredType(data.tax_id_type || '');
      try { setPayoutDetails(data.payout_details ? JSON.parse(data.payout_details) : {}); }
      catch { setPayoutDetails({}); }
    }).catch(() => {});
  }, []);

  const startEditTax = (value: string) => {
    setSsnInput(value);
    setDocType(taxType);
    setTaxError('');
    setEditingSsn(true);
  };

  const saveSsn = async () => {
    const type: TaxIdType = colombia ? docType : 'ssn';
    const err = validateTaxId(type, ssnInput);
    if (err) { setTaxError(err); return; }
    setTaxError('');
    setSavingSsn(true);
    try {
      await userApi.updateProfile({ ssn: ssnInput.trim(), tax_id_type: type });
      setSsn(ssnInput.trim());
      setStoredType(type);
      setEditingSsn(false);
    } catch {} finally { setSavingSsn(false); }
  };

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
  const settled = rows.filter(r => r.dispatcher_status === 'settled').reduce((s, r) => s + r.dispatcher_pay, 0);
  const pending = rows.filter(r => r.dispatcher_status === 'pending').reduce((s, r) => s + r.dispatcher_pay, 0);

  return (
    <div className="space-y-5 fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('commissions.title')}</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {t('commissions.subtitlePrefix')} <span className="font-semibold text-blue-600">3%</span> {t('commissions.subtitleSuffix')}
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
            <span className="text-xs text-gray-500 dark:text-slate-400">{t('commissions.statTotal')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(total)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t('commissions.statLoadsSuffix', { count: rows.length })}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400">{t('commissions.statCollected')}</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{fmt(settled)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t('commissions.statSettledSuffix', { count: rows.filter(r => r.dispatcher_status === 'settled').length })}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400">{t('commissions.statPending')}</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{fmt(pending)}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t('commissions.statPendingSuffix', { count: rows.filter(r => r.dispatcher_status === 'pending').length })}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-xs text-gray-500 dark:text-slate-400">{t('commissions.statLoads')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{rows.length}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t('commissions.statManaged')}</p>
        </div>
      </div>

      {/* ── Payout Method Section ──────────────────────────── */}
      {/* Alert banner: pending amount but no payout method */}
      {pending > 0 && !payoutMethod && !editingPayout && (
        <div className="flex items-center gap-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/40 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <p className="text-xs text-yellow-700 dark:text-yellow-300 flex-1">
            {t('commissions.pendingAlertPrefix')} <strong>{fmt(pending)}</strong> {t('commissions.pendingAlertSuffix')}
          </p>
          <button onClick={startEdit} className="text-xs font-bold text-yellow-700 dark:text-yellow-300 hover:underline flex-shrink-0">
            {t('commissions.configure')}
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
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t('commissions.payoutMethodTitle')}</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500">{t('commissions.payoutMethodSubtitle')}</p>
            </div>
          </div>
          {!editingPayout && payoutMethod && (
            <button onClick={startEdit}
              className="flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-600 font-semibold transition-colors">
              <Pencil className="w-3.5 h-3.5" /> {t('commissions.edit')}
            </button>
          )}
        </div>

        {editingPayout ? (
          <div className="space-y-4">
            {/* Method grid selector */}
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 mb-2">{t('grupoB.commissions.selectMethod')}</p>
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
                      <span className="truncate">{methodLabel(m)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic fields */}
            {payoutMethod === 'zelle' && (
              <Field label={t('grupoB.commissions.zelleLabel')} required>
                <input className="input" type="text" placeholder={t('grupoB.commissions.zellePlaceholder')}
                  value={payoutDetails.contact || ''} onChange={e => updateDetail('contact', e.target.value)} />
              </Field>
            )}

            {(payoutMethod === 'ach' || payoutMethod === 'wire') && (
              <div className="space-y-3">
                <Field label={t('grupoB.commissions.bankName')} required>
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
                  <Field label={t('grupoB.commissions.accountType')}>
                    <select className="input" value={payoutDetails.type || 'checking'} onChange={e => updateDetail('type', e.target.value)}>
                      <option value="checking">{t('grupoB.commissions.checking')}</option>
                      <option value="savings">{t('grupoB.commissions.savings')}</option>
                    </select>
                  </Field>
                ) : (
                  <Field label={t('grupoB.commissions.swiftOptional')}>
                    <input className="input font-mono" type="text" placeholder="CHASUS33"
                      value={payoutDetails.swift || ''} onChange={e => updateDetail('swift', e.target.value)} />
                  </Field>
                )}
              </div>
            )}

            {payoutMethod === 'paypal' && (
              <Field label={t('grupoB.commissions.paypalEmail')} required>
                <input className="input" type="email" placeholder={t('grupoB.commissions.emailPlaceholder')}
                  value={payoutDetails.email || ''} onChange={e => updateDetail('email', e.target.value)} />
              </Field>
            )}

            {payoutMethod === 'venmo' && (
              <Field label={t('grupoB.commissions.venmoUser')} required>
                <input className="input" type="text" placeholder={t('grupoB.commissions.venmoPlaceholder')}
                  value={payoutDetails.username || ''} onChange={e => updateDetail('username', e.target.value)} />
              </Field>
            )}

            {payoutMethod === 'check' && (
              <div className="space-y-3">
                <Field label={t('grupoB.commissions.payableTo')} required>
                  <input className="input" type="text" placeholder={t('grupoB.commissions.legalNamePlaceholder')}
                    value={payoutDetails.payable_to || ''} onChange={e => updateDetail('payable_to', e.target.value)} />
                </Field>
                <Field label={t('grupoB.commissions.mailingAddress')} required>
                  <input className="input" type="text" placeholder="123 Main St, Miami FL 33125"
                    value={payoutDetails.address || ''} onChange={e => updateDetail('address', e.target.value)} />
                </Field>
              </div>
            )}

            {payoutMethod === 'cash' && (
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/30 rounded-xl p-3.5">
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  {t('grupoB.commissions.cashNote')}
                </p>
              </div>
            )}

            {/* Save / Cancel */}
            <div className="flex gap-2 pt-1">
              <button onClick={cancelEdit}
                className="flex-1 py-2.5 rounded-xl text-sm text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-medium">
                {t('commissions.cancel')}
              </button>
              <button onClick={savePayout} disabled={savingPayout || !payoutMethod}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                {savingPayout
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><CheckCircle2 className="w-4 h-4" /> {t('commissions.saveMethod')}</>
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
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">{t('commissions.noPayoutTitle')}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
              {t('commissions.noPayoutHint')}
            </p>
            <button onClick={startEdit}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-colors shadow-sm shadow-blue-500/20">
              <PlusCircle className="w-3.5 h-3.5" /> {t('commissions.setupPayout')}
            </button>
          </div>
        )}
      </div>

      {/* ── Tax / 1099 Section ──────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">{colombia ? t('commissions.taxTitleCo') : t('commissions.taxTitle')}</h2>
              <p className="text-xs text-gray-400 dark:text-slate-500">{colombia ? t('commissions.taxSubtitleCo') : t('commissions.taxSubtitle')}</p>
            </div>
          </div>
          {!editingSsn && ssn && (
            <button onClick={() => startEditTax(ssn)}
              className="flex items-center gap-1.5 text-xs text-purple-500 hover:text-purple-600 font-semibold transition-colors">
              <Pencil className="w-3.5 h-3.5" /> {t('commissions.edit')}
            </button>
          )}
        </div>

        <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 -mt-2 mb-3">
          {colombia ? t('commissions.taxFormCo') : t('commissions.taxFormUS')}
        </p>

        {editingSsn ? (
          <div className="space-y-3">
            {colombia ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">
                    {t('commissions.taxDocType')} <span className="text-red-400">*</span>
                  </label>
                  <select className="input" value={docType} onChange={e => { setDocType(e.target.value as TaxIdType); setTaxError(''); }}>
                    <option value="cedula">{t('commissions.taxDocCedula')}</option>
                    <option value="nit">{t('commissions.taxDocNit')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">
                    {docType === 'nit' ? t('commissions.taxDocNumberNit') : t('commissions.taxDocNumberCedula')} <span className="text-red-400">*</span>
                  </label>
                  <input className="input font-mono" type="text" inputMode="numeric"
                    placeholder={docType === 'nit' ? '900.123.456-7' : '1.234.567.890'}
                    value={ssnInput} onChange={e => { setSsnInput(e.target.value); setTaxError(''); }} maxLength={16} />
                  {taxError && <p className="text-[11px] text-red-500 mt-1">{t('commissions.' + taxError)}</p>}
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1.5">{t('commissions.taxDocHelpCo')}</p>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mb-1.5">
                  {t('grupoB.commissions.ssnLabel')} <span className="text-red-400">*</span>
                </label>
                <input className="input font-mono" type="text" placeholder="XXX-XX-XXXX"
                  value={ssnInput} onChange={e => { setSsnInput(e.target.value); setTaxError(''); }} maxLength={11} />
                {taxError && <p className="text-[11px] text-red-500 mt-1">{t('commissions.' + taxError)}</p>}
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1.5">
                  {t('commissions.ssnHelp')}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setEditingSsn(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors font-medium">
                {t('commissions.cancel')}
              </button>
              <button onClick={saveSsn} disabled={savingSsn || !ssnInput.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-purple-500 hover:bg-purple-600 disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
                {savingSsn
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><CheckCircle2 className="w-4 h-4" /> {colombia ? t('commissions.saveDoc') : t('commissions.saveSsn')}</>}
              </button>
            </div>
          </div>
        ) : ssn ? (
          <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-700/30 rounded-xl px-4 py-3">
            <Shield className="w-4 h-4 text-purple-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-gray-400 dark:text-slate-500 mb-0.5">{colombia ? t('commissions.docRegistered') + ' · ' + (taxType === 'nit' ? 'NIT / RUT' : 'CC') : t('commissions.ssnRegistered')}</p>
              <p className="text-sm font-mono font-bold text-gray-900 dark:text-white">{showSsn ? ssn : maskTaxId(taxType, ssn)}</p>
            </div>
            <button onClick={() => setShowSsn(!showSsn)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
              {showSsn ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-2xl p-6 text-center">
            <div className="w-10 h-10 bg-gray-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-2">
              <Shield className="w-5 h-5 text-gray-400 dark:text-slate-500" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-1">{colombia ? t('commissions.noDocTitle') : t('commissions.noSsnTitle')}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">{colombia ? t('commissions.noDocHint') : t('commissions.noSsnHint')}</p>
            <button onClick={() => startEditTax('')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold rounded-xl transition-colors">
              <PlusCircle className="w-3.5 h-3.5" /> {colombia ? t('commissions.addDoc') : t('commissions.addSsn')}
            </button>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300">{t('commissions.historyTitle')}</h2>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/40"
          >
            <option value="">{t('commissions.filterAll')}</option>
            <option value="pending">{t('commissions.filterPending')}</option>
            <option value="settled">{t('commissions.filterSettled')}</option>
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
                <th className="text-left px-4 py-3 font-semibold">{t('commissions.tableOrder')}</th>
                <th className="text-left px-4 py-3 font-semibold">{t('commissions.tableDriver')}</th>
                <th className="text-right px-4 py-3 font-semibold">{t('commissions.tableRate')}</th>
                <th className="text-right px-4 py-3 font-semibold text-blue-600">{t('commissions.tableMyCommission')}</th>
                <th className="text-left px-4 py-3 font-semibold">{t('commissions.tableDate')}</th>
                <th className="text-center px-4 py-3 font-semibold">{t('commissions.tableStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">{t('commissions.loading')}</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <DollarSign className="w-10 h-10 text-gray-200 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">{t('commissions.emptyTitle')}</p>
                    <p className="text-gray-300 dark:text-slate-600 text-xs mt-1">{t('commissions.emptyHint2')}</p>
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
                  <td className="px-4 py-3 text-center"><StatusChip status={r.dispatcher_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-700">
          {loading ? (
            <div className="py-8 text-center text-gray-400 text-sm">{t('commissions.loading')}</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <DollarSign className="w-10 h-10 text-gray-200 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">{t('commissions.emptyTitle')}</p>
            </div>
          ) : rows.map(r => (
            <div key={r.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">{r.order_number}</span>
                <StatusChip status={r.dispatcher_status} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-slate-400">{r.driver_name}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{t('grupoB.commissions.loadSuffix', { amount: fmt(r.order_price) })}</p>
              </div>
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{t('commissions.tableMyCommission')}</span>
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
