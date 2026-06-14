import { useState, useEffect } from 'react';
import {
  Package, Users, Truck, TrendingUp, DollarSign,
  Clock, CheckCircle, AlertTriangle, Activity,
  Headphones, StickyNote, Plus, X, Pin
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { analyticsApi, ordersApi, driversApi } from '../services/api';
import { DashboardStats } from '../types';
import { OrderStatusBadge } from '../components/StatusBadge';
import { formatDistanceToNow, format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

function DispatcherHubStrip() {
  const { user } = useAuth();
  const { dark } = useTheme();
  const isAdmin = user?.role === 'admin';
  if (isAdmin) return null;

  const accent = '#f97316';
  const accentSoft = 'rgba(249,115,22,0.12)';

  const [musicOn, setMusicOn] = useState(() => {
    try { return localStorage.getItem('osi_music_on') === '1'; } catch { return false; }
  });
  const [noteInput, setNoteInput] = useState('');
  const [notes, setNotes] = useState<Array<{id: string; text: string; time: string}>>(() => {
    try { return JSON.parse(localStorage.getItem('osi_dispatch_notes') || '[]'); } catch { return []; }
  });
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    localStorage.setItem('osi_music_on', musicOn ? '1' : '0');
  }, [musicOn]);

  useEffect(() => {
    localStorage.setItem('osi_dispatch_notes', JSON.stringify(notes));
  }, [notes]);

  function addNote() {
    if (!noteInput.trim()) return;
    setNotes(prev => [{
      id: Date.now().toString(),
      text: noteInput.trim(),
      time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
    }, ...prev]);
    setNoteInput('');
  }

  return (
    <div className="md:hidden space-y-2 mb-4">
      {/* Music toggle */}
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer select-none active:opacity-80 transition-opacity shadow-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}
        onClick={() => setMusicOn(v => !v)}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
             style={{ background: musicOn ? 'rgba(168,85,247,0.15)' : dark ? 'rgba(51,65,85,0.6)' : '#f1f5f9' }}>
          <Headphones className="w-4 h-4" style={{ color: musicOn ? '#c084fc' : '#94a3b8' }} />
        </div>
        <div className="flex-1">
          <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Trap & Reggae Romantico</p>
          <p className="text-[11px]" style={{ color: musicOn ? '#c084fc' : '#94a3b8' }}>
            {musicOn ? '🎵 OSI Dispatch Music — activo' : 'Música para la jornada de trabajo'}
          </p>
        </div>
        <div className="relative flex-shrink-0 rounded-full transition-all duration-300"
             style={{ width: 44, height: 24, background: musicOn ? 'linear-gradient(90deg,#a855f7,#7c3aed)' : dark ? 'rgba(51,65,85,0.9)' : '#e2e8f0', boxShadow: musicOn ? '0 0 10px rgba(168,85,247,0.45)' : 'none' }}>
          <div className="absolute rounded-full bg-white shadow-md"
               style={{ width: 18, height: 18, top: 3, left: musicOn ? 23 : 3, transition: 'left 0.25s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
        </div>
      </div>

      {/* Spotify embed */}
      {musicOn && (
        <div className={`rounded-2xl overflow-hidden ${dark ? 'border border-purple-500/20' : 'border border-purple-200'}`}>
          <iframe
            src="https://open.spotify.com/embed/playlist/37i9dQZF1DWY7IeIP1cdjF?utm_source=generator&theme=0"
            width="100%" height="80"
            style={{ border: 'none', display: 'block' }}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        </div>
      )}

      {/* Notas strip */}
      <div className={`rounded-2xl overflow-hidden shadow-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}>
        {/* Header row */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}` }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accentSoft }}>
            <StickyNote className="w-4 h-4" style={{ color: accent }} />
          </div>
          <p className={`flex-1 text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>Notas Importantes</p>
          {notes.length > 0 && (
            <button
              onClick={() => setShowNotes(v => !v)}
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: accentSoft, color: accent }}
            >
              {notes.length} {showNotes ? '▲' : '▼'}
            </button>
          )}
        </div>
        {/* Input */}
        <div className="flex gap-2 px-3 py-2.5">
          <input
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addNote(); }}
            placeholder="Apuntar algo importante..."
            maxLength={200}
            className={`flex-1 text-sm px-3 py-2 rounded-xl outline-none border-0 ${dark ? 'bg-slate-700 text-slate-200 placeholder:text-slate-500' : 'bg-gray-50 text-gray-800 placeholder:text-gray-400'}`}
          />
          <button onClick={addNote} disabled={!noteInput.trim()}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-90 disabled:opacity-40 transition-all"
            style={{ background: `linear-gradient(135deg,${accent},#ea580c)` }}>
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>
        {/* Notes list (collapsible) */}
        {showNotes && notes.length > 0 && (
          <div className="px-3 pb-3 space-y-1.5 max-h-40 overflow-y-auto">
            {notes.map((note, i) => (
              <div key={note.id} className="flex items-start gap-2 p-2.5 rounded-xl"
                style={{
                  background: dark ? (i % 2 === 0 ? 'rgba(251,191,36,0.07)' : 'rgba(249,115,22,0.06)') : (i % 2 === 0 ? 'rgba(251,191,36,0.07)' : 'rgba(249,115,22,0.05)'),
                  border: `1px solid ${dark ? 'rgba(251,191,36,0.12)' : 'rgba(251,191,36,0.14)'}`,
                }}>
                <Pin className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-400" />
                <p className={`flex-1 text-xs leading-snug ${dark ? 'text-slate-200' : 'text-gray-800'}`}>{note.text}</p>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[9px] text-slate-500">{note.time}</span>
                  <button onClick={() => setNotes(prev => prev.filter(n => n.id !== note.id))}
                    className={`w-4 h-4 rounded-full flex items-center justify-center ${dark ? 'hover:bg-white/10 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-gray-400 hover:text-red-400'}`}>
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#eab308',
  assigned: '#3b82f6',
  picked_up: '#6366f1',
  in_transit: '#8b5cf6',
  delivered: '#22c55e',
  cancelled: '#ef4444',
};

interface StatCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: number;
}

function StatCard({ title, value, sub, icon: Icon, color, trend }: StatCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              <TrendingUp className="w-3 h-3" />
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}% vs last week
            </div>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [orderStats, setOrderStats] = useState<Record<string, number>>({});
  const [driverStats, setDriverStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [dashRes, orderRes, driverRes] = await Promise.all([
          analyticsApi.getDashboard(),
          ordersApi.getStats(),
          driversApi.getStats(),
        ]);
        setStats(dashRes.data);
        setOrderStats(orderRes.data);
        setDriverStats(driverRes.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  const pieData = stats?.ordersByStatus.map(s => ({
    name: s.status.replace('_', ' '),
    value: s.count,
    color: STATUS_COLORS[s.status] || '#94a3b8',
  })) || [];

  return (
    <div className="space-y-6 fade-in">
      {/* Hub strip — dispatcher only, mobile only */}
      <DispatcherHubStrip />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Total Orders"
          value={orderStats.total || 0}
          sub={`${orderStats.today || 0} new today`}
          icon={Package}
          color="bg-blue-100 text-blue-600"
          trend={8.2}
        />
        <StatCard
          title="In Transit"
          value={orderStats.in_transit || 0}
          sub={`${orderStats.assigned || 0} assigned`}
          icon={Activity}
          color="bg-purple-100 text-purple-600"
        />
        <StatCard
          title="Active Drivers"
          value={driverStats.busy || 0}
          sub={`${driverStats.available || 0} available`}
          icon={Users}
          color="bg-green-100 text-green-600"
          trend={2.1}
        />
        <StatCard
          title="Revenue (Total)"
          value={`$${((stats?.kpis.total_revenue || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`$${((stats?.kpis.monthly_revenue || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} this month`}
          icon={DollarSign}
          color="bg-orange-100 text-orange-600"
          trend={12.5}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400">Delivered Today</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white dark:text-slate-100">{orderStats.delivered || 0}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400">Avg Delivery Time</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white dark:text-slate-100">{(stats?.kpis.avg_delivery_hours || 0).toFixed(1)}h</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400">On-Time Rate</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white dark:text-slate-100">{(stats?.kpis.on_time_rate || 0).toFixed(1)}%</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400">Pending Orders</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white dark:text-slate-100">{orderStats.pending || 0}</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Revenue Chart */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Revenue & Orders (7 days)</h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">Last 7 days</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats?.dailyRevenue || []}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => format(new Date(d + 'T00:00:00'), 'MM/dd')} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === 'revenue' ? `$${value.toFixed(2)}` : value,
                  name === 'revenue' ? 'Revenue' : 'Orders',
                ]}
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} fill="url(#revenueGrad)" />
              <Area type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} fill="none" strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Order Status Pie */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Orders by Status</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="capitalize text-gray-600 dark:text-slate-400">{d.name}</span>
                </div>
                <span className="font-semibold text-gray-900 dark:text-slate-100">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Top Drivers */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Top Drivers</h3>
          <div className="space-y-3">
            {(stats?.topDrivers || []).slice(0, 5).map((driver, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {driver.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{driver.name}</p>
                    <span className="text-xs text-gray-500 dark:text-slate-400">{driver.total_deliveries} trips</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full">
                      <div
                        className="h-1.5 bg-orange-500 rounded-full"
                        style={{ width: `${driver.on_time_rate}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-slate-400">{driver.on_time_rate?.toFixed(0)}%</span>
                    <span className="text-xs text-yellow-500">★ {driver.rating?.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {(stats?.recentActivity || []).slice(0, 6).map((activity, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-slate-100">
                    <span className="font-medium">{activity.order_number}</span>
                    {' '}—{' '}
                    <OrderStatusBadge status={activity.status as never} />
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {activity.customer_name} · {activity.notes}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fleet Stats */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Fleet Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Trucks', value: driverStats.total || 0, color: 'text-gray-900 dark:text-white' },
            { label: 'Active', value: driverStats.available || 0, color: 'text-green-600' },
            { label: 'On Break', value: driverStats.on_break || 0, color: 'text-yellow-600' },
            { label: 'Offline', value: driverStats.offline || 0, color: 'text-gray-400' },
          ].map((item, i) => (
            <div key={i} className="text-center">
              <Truck className="w-6 h-6 mx-auto text-gray-300 mb-1" />
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}




