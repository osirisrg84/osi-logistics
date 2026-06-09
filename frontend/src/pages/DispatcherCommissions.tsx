import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, CheckCircle2, Clock, RefreshCw,
  ChevronDown, DollarSign, Package
} from 'lucide-react';
import { billingApi } from '../services/api';
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

function fmt(n: number) { return `$${n.toFixed(2)}`; }

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

export default function DispatcherCommissions() {
  const { user } = useAuth();
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

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
            OSI Logistics te paga <span className="font-semibold text-blue-600">5%</span> por cada carga gestionada
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
