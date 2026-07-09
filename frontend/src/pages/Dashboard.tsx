import { useState, useEffect } from 'react';
import {
  Package, Users, Truck, TrendingUp, DollarSign,
  Clock, CheckCircle, AlertTriangle, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { analyticsApi, ordersApi, driversApi } from '../services/api';
import { DashboardStats } from '../types';
import { OrderStatusBadge } from '../components/StatusBadge';
import { formatDistanceToNow, format } from 'date-fns';

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
  const [chartDays, setChartDays] = useState<7 | 30>(7);

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

  // Fill 30 days so chart always shows meaningful history
  const revenueMap = new Map(
    (stats?.dailyRevenue || []).map((r: { date: string; revenue: number; orders: number }) => [r.date, r])
  );
  const chartData = Array.from({ length: chartDays }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (chartDays - 1 - i));
    const key = d.toISOString().slice(0, 10);
    const row = revenueMap.get(key);
    return { date: key, revenue: row?.revenue || 0, orders: row?.orders || 0 };
  });

  return (
    <div className="space-y-6 fade-in">
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
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Revenue & Orders</h3>
            <div className="flex gap-1">
              {([7, 30] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setChartDays(d)}
                  className={`text-xs px-2 py-1 rounded-lg transition-colors ${chartDays === d ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  {d === 7 ? 'Last 7 days' : 'Last 30 days'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => format(new Date(d + 'T00:00:00'), 'MM/dd')} />
              <YAxis yAxisId="rev" orientation="left" tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} width={45} />
              <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 10 }} allowDecimals={false} width={30} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  name === 'revenue' ? `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : value,
                  name === 'revenue' ? 'Revenue' : 'Orders',
                ]}
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={n => n === 'revenue' ? 'Revenue' : 'Orders'} />
              <Area yAxisId="rev" type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} fill="url(#revenueGrad)" />
              <Area yAxisId="ord" type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} fill="url(#ordersGrad)" />
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




