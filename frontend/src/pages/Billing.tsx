import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DollarSign, TrendingUp, TrendingDown, CheckCircle2,
  Clock, RefreshCw, ChevronDown, Users, UserCog, FileText, Search, X
} from 'lucide-react';
import { billingApi } from '../services/api';
import api from '../services/api';
import { format } from 'date-fns';

interface Commission {
  id: string;
  order_id: string;
  order_number: string;
  driver_id: string;
  driver_name: string;
  dispatcher_user_id: string | null;
  dispatcher_name: string | null;
  order_price: number;
  driver_charge: number;
  dispatcher_pay: number;
  net_osi: number;
  delivery_date: string | null;
  status: 'pending' | 'settled';
  settled_at: string | null;
}

interface DriverSummary {
  driver_id: string;
  driver_name: string;
  total_orders: number;
  total_revenue: number;
  total_charged: number;
  settled: number;
  pending: number;
}

interface DispatcherSummary {
  dispatcher_user_id: string | null;
  dispatcher_name: string;
  total_orders: number;
  total_order_value: number;
  total_earned: number;
  settled: number;
  pending: number;
}

interface Summary {
  total_orders: number;
  total_driver_charges: number;
  total_dispatcher_pay: number;
  total_net_osi: number;
  pending_driver: number;
  settled_driver: number;
  pending_count: number;
  settled_count: number;
}

function fmt(n: number) { return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }); }

function StatusChip({ status }: { status: 'pending' | 'settled' }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      status === 'settled'
        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
        : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
    }`}>
      {status === 'settled' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {status === 'settled' ? t('billing.statusPaid') : t('billing.statusPendingChip')}
    </span>
  );
}

export default function Billing() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [records, setRecords] = useState<Commission[]>([]);
  const [byDriver, setByDriver] = useState<DriverSummary[]>([]);
  const [byDispatcher, setByDispatcher] = useState<DispatcherSummary[]>([]);
  const [tab, setTab] = useState<'records' | 'drivers' | 'dispatchers'>('records');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [confirmSettle, setConfirmSettle] = useState<{
    id: string; label: string; amount: number; type: 'one' | 'driver_all';
  } | null>(null);

  useEffect(() => { setPage(1); }, [statusFilter, pageSize, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: pageSize, offset: (page - 1) * pageSize };
      if (statusFilter) params.status = statusFilter;
      if (search)       params.search = search;
      const [summaryRes, recordsRes, driversRes, dispatchersRes] = await Promise.all([
        billingApi.getSummary(),
        billingApi.getRecords(params),
        billingApi.getByDriver(),
        billingApi.getByDispatcher(),
      ]);
      setSummary(summaryRes.data);
      setRecords(recordsRes.data.records ?? recordsRes.data);
      setTotal(recordsRes.data.total ?? 0);
      setByDriver(driversRes.data);
      setByDispatcher(dispatchersRes.data);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, pageSize, page]);

  useEffect(() => { load(); }, [load]);

  const settleOne = async (id: string) => {
    setSettling(id);
    setConfirmSettle(null);
    await billingApi.settleOne(id);
    await load();
    setSettling(null);
  };

  const payWithStripe = async (id: string, amount: number, description: string) => {
    setSettling(id);
    try {
      const res = await api.post('/stripe/create-checkout', {
        billing_id: id,
        amount,
        description,
      });
      if (res.data?.url) window.open(res.data.url, '_blank');
    } finally {
      setSettling(null);
    }
  };

  const settleDriverAll = async (driverId: string) => {
    setSettling(driverId);
    setConfirmSettle(null);
    await billingApi.settleDriverAll(driverId);
    await load();
    setSettling(null);
  };

  return (
    <div className="space-y-5 fade-in">

      {/* ── Confirm Settle Modal ─────────────────────────── */}
      {confirmSettle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{t('billing.confirmTitle')}</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{confirmSettle.label}</p>
              </div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 mb-5 text-center">
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{t('billing.amountToSettle')}</p>
              <p className="text-2xl font-black text-orange-600">{fmt(confirmSettle.amount)}</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 text-center mb-5">
              {t('billing.confirmHintPrefix')} <span className="font-semibold text-green-600">{t('billing.settledWord')}</span>. {t('billing.confirmHintSuffix')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmSettle(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                {t('billing.cancel')}
              </button>
              <button
                onClick={() =>
                  confirmSettle.type === 'one'
                    ? settleOne(confirmSettle.id)
                    : settleDriverAll(confirmSettle.id)
                }
                disabled={!!settling}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-sm font-bold text-white transition-colors"
              >
                {settling ? t('billing.processing') : t('billing.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('billing.title')}</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {t('billing.subtitleDriversPay')} <span className="font-semibold text-red-600">7%</span> · {t('billing.subtitleDispatchGets')}{' '}
            <span className="font-semibold text-blue-600">4%</span> · {t('billing.subtitleOsiNet')}{' '}
            <span className="font-semibold text-green-600">3%</span>
          </p>
        </div>
        <button onClick={load} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
          <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <span className="text-xs text-gray-500 dark:text-slate-400">{t('billing.statChargedDrivers')}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(summary.total_driver_charges)}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t('billing.statLoadsSuffix', { count: summary.total_orders })}</p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xs text-gray-500 dark:text-slate-400">{t('billing.statOwedDispatch')}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{fmt(summary.total_dispatcher_pay)}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t('billing.statLoadsSuffix4', { count: summary.total_orders })}</p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-xs text-gray-500 dark:text-slate-400">{t('billing.statNetEarnings')}</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{fmt(summary.total_net_osi)}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t('billing.statNetSuffix')}</p>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              </div>
              <span className="text-xs text-gray-500 dark:text-slate-400">{t('billing.statPending')}</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{fmt(summary.pending_driver)}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{t('billing.statUnsettledSuffix', { count: summary.pending_count })}</p>
          </div>
        </div>
      )}

      {/* Tabs + filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
          {([
            { id: 'records',     label: t('billing.tabRecords'),     icon: FileText },
            { id: 'drivers',     label: t('billing.tabByDriver'),     icon: Users },
            { id: 'dispatchers', label: t('billing.tabByDispatcher'), icon: UserCog },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                tab === id
                  ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400'
              }`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {tab === 'records' && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('billing.searchPlaceholder')}
                className="pl-9 pr-8 py-2 text-sm border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/40 w-52"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/40"
              >
                <option value="">{t('billing.allStatus')}</option>
                <option value="pending">{t('billing.statusPending')}</option>
                <option value="settled">{t('billing.statusSettled')}</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="pl-3 pr-2 py-2 text-sm border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/40"
            >
              <option value={25}>25 / {t('billing.pageSize')}</option>
              <option value={50}>50 / {t('billing.pageSize')}</option>
              <option value={100}>100 / {t('billing.pageSize')}</option>
            </select>
          </div>
        )}
      </div>

      {/* Pagination info + controls — only on records tab */}
      {tab === 'records' && total > 0 && (() => {
        const totalPages = Math.ceil(total / pageSize);
        const from = (page - 1) * pageSize + 1;
        const to = Math.min(page * pageSize, total);
        return (
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-slate-400">{t('billing.countRange', { from, to, total })}</p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">{t('billing.prev')}</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | '…')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i-1] as number) > 1) acc.push('…');
                    acc.push(p); return acc;
                  }, [])
                  .map((p, i) => p === '…'
                    ? <span key={`e${i}`} className="px-1 text-xs text-gray-400">…</span>
                    : <button key={p} onClick={() => setPage(p as number)}
                        className={`w-7 h-7 text-xs font-medium rounded-lg transition-colors ${page === p ? 'bg-orange-500 text-white' : 'border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                      >{p}</button>
                  )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">{t('billing.next')}</button>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Records tab ─────────────────────────────────── */}
      {tab === 'records' && (
        <div className="card overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400 uppercase">
                  <th className="text-left px-4 py-3 font-semibold">{t('billing.tableOrder')}</th>
                  <th className="text-left px-4 py-3 font-semibold">{t('billing.tableDriver')}</th>
                  <th className="text-left px-4 py-3 font-semibold">{t('billing.tableDispatcher')}</th>
                  <th className="text-right px-4 py-3 font-semibold">{t('billing.tablePrice')}</th>
                  <th className="text-right px-4 py-3 font-semibold text-red-600">{t('billing.tableDriver7')}</th>
                  <th className="text-right px-4 py-3 font-semibold text-blue-600">{t('billing.tableDispatch4')}</th>
                  <th className="text-right px-4 py-3 font-semibold text-green-600">{t('billing.tableOsi3')}</th>
                  <th className="text-left px-4 py-3 font-semibold">{t('billing.tableDate')}</th>
                  <th className="text-center px-4 py-3 font-semibold">{t('billing.tableStatus')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {loading ? (
                  <tr><td colSpan={10} className="text-center py-8 text-gray-400">{t('billing.loading')}</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-8 text-gray-400">{t('billing.noRecords')}</td></tr>
                ) : records.map(r => (
                  <tr key={r.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${
                    r.status === 'pending' ? 'bg-yellow-50/30 dark:bg-yellow-900/5' : ''
                  }`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900 dark:text-white">{r.order_number}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{r.driver_name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{r.dispatcher_name || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{fmt(r.order_price)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt(r.driver_charge)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-600">{fmt(r.dispatcher_pay)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">{fmt(r.net_osi)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 dark:text-slate-500">
                      {r.delivery_date ? format(new Date(r.delivery_date), 'MMM d, HH:mm') : '—'}
                    </td>
                    <td className="px-4 py-3 text-center"><StatusChip status={r.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => payWithStripe(r.id, r.driver_charge, `Comisión OSI - Orden ${r.order_number}`)}
                            disabled={settling === r.id}
                            className="text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-40 whitespace-nowrap"
                          >
                            {settling === r.id ? '...' : t('billing.stripePay')}
                          </button>
                          <button
                            onClick={() => setConfirmSettle({ id: r.id, label: `${r.order_number} · ${r.driver_name}`, amount: r.driver_charge, type: 'one' })}
                            disabled={settling === r.id}
                            className="text-xs font-medium text-orange-600 hover:text-orange-700 disabled:opacity-40 whitespace-nowrap"
                          >
                            {t('billing.settle')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-700">
            {loading ? (
              <div className="py-8 text-center text-gray-400 text-sm">{t('billing.loading')}</div>
            ) : records.map(r => (
              <div key={r.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-gray-900 dark:text-white">{r.order_number}</span>
                  <StatusChip status={r.status} />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-700 dark:text-slate-300">{r.driver_name}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{fmt(r.order_price)}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2 text-center">
                    <p className="text-red-400 mb-0.5">{t('billing.tableDriver7')}</p>
                    <p className="font-bold text-red-600">{fmt(r.driver_charge)}</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
                    <p className="text-blue-400 mb-0.5">{t('billing.tableDispatch4')}</p>
                    <p className="font-bold text-blue-600">{fmt(r.dispatcher_pay)}</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 text-center">
                    <p className="text-green-400 mb-0.5">{t('billing.tableOsi3')}</p>
                    <p className="font-bold text-green-600">{fmt(r.net_osi)}</p>
                  </div>
                </div>
                {r.status === 'pending' && (
                  <button onClick={() => setConfirmSettle({ id: r.id, label: `${r.order_number} · ${r.driver_name}`, amount: r.driver_charge, type: 'one' })} disabled={settling === r.id}
                    className="w-full py-2 rounded-xl text-sm font-semibold text-orange-600 border border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-40 transition-colors">
                    {settling === r.id ? t('billing.processing') : t('billing.markSettled')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── By Driver tab ────────────────────────────────── */}
      {tab === 'drivers' && (
        <div className="space-y-3">
          {loading ? (
            <div className="card py-8 text-center text-gray-400">{t('billing.loading')}</div>
          ) : byDriver.map(d => (
            <div key={d.driver_id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {d.driver_name.split(' ').map(n => n[0]).join('').slice(0,2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{d.driver_name}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{t('billing.driverLoadsRevenue', { count: d.total_orders, revenue: fmt(d.total_revenue) })}</p>
                  </div>
                </div>
                {d.pending > 0 && (
                  <button
                    onClick={() => setConfirmSettle({ id: d.driver_id, label: `${d.driver_name}`, amount: d.pending, type: 'driver_all' })}
                    disabled={settling === d.driver_id}
                    className="text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {settling === d.driver_id ? '...' : t('billing.settleAll')}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
                  <p className="text-red-400 mb-1">{t('billing.totalCharged7')}</p>
                  <p className="text-lg font-bold text-red-600">{fmt(d.total_charged)}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                  <p className="text-green-400 mb-1">{t('billing.settled')}</p>
                  <p className="text-lg font-bold text-green-600">{fmt(d.settled)}</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-3 text-center">
                  <p className="text-yellow-400 mb-1">{t('billing.pending')}</p>
                  <p className="text-lg font-bold text-yellow-600">{fmt(d.pending)}</p>
                </div>
              </div>
            </div>
          ))}
          {!loading && byDriver.length === 0 && (
            <div className="card py-8 text-center text-gray-400">{t('billing.noCommissionRecords')}</div>
          )}
        </div>
      )}

      {/* ── By Dispatcher tab ─────────────────────────────── */}
      {tab === 'dispatchers' && (
        <div className="space-y-3">
          {loading ? (
            <div className="card py-8 text-center text-gray-400">{t('billing.loading')}</div>
          ) : byDispatcher.map((d, i) => (
            <div key={d.dispatcher_user_id || i} className="card p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {d.dispatcher_name.split(' ').map(n => n[0]).join('').slice(0,2)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{d.dispatcher_name}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{t('billing.dispatcherOrdersManaged', { count: d.total_orders, value: fmt(d.total_order_value) })}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                  <p className="text-blue-400 mb-1">{t('billing.toCollect4')}</p>
                  <p className="text-lg font-bold text-blue-600">{fmt(d.total_earned)}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                  <p className="text-green-400 mb-1">{t('billing.paid')}</p>
                  <p className="text-lg font-bold text-green-600">{fmt(d.settled)}</p>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-3 text-center">
                  <p className="text-yellow-400 mb-1">{t('billing.pending')}</p>
                  <p className="text-lg font-bold text-yellow-600">{fmt(d.pending)}</p>
                </div>
              </div>
            </div>
          ))}
          {!loading && byDispatcher.length === 0 && (
            <div className="card py-8 text-center text-gray-400">{t('billing.noRecords')}</div>
          )}
        </div>
      )}
    </div>
  );
}
