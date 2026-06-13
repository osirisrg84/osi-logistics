import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, DollarSign, Package, Users, Truck, Star, Clock, Download } from 'lucide-react';
import { analyticsApi } from '../services/api';
import { format } from 'date-fns';

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#8b5cf6', '#eab308', '#ef4444'];

interface KpiCardProps {
  title: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function KpiCard({ title, value, sub, icon: Icon, color }: KpiCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          <p className="text-xs text-gray-400 mt-1">{sub}</p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const [dashData, setDashData] = useState<Record<string, unknown> | null>(null);
  const [ordersReport, setOrdersReport] = useState<unknown[]>([]);
  const [driversReport, setDriversReport] = useState<unknown[]>([]);
  const [fleetReport, setFleetReport] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'drivers' | 'fleet'>('overview');

  useEffect(() => {
    async function load() {
      try {
        const [dash, orders, drivers, fleet] = await Promise.all([
          analyticsApi.getDashboard(),
          analyticsApi.getOrdersReport(),
          analyticsApi.getDriversReport(),
          analyticsApi.getFleetReport(),
        ]);
        setDashData(dash.data);
        setOrdersReport(orders.data);
        setDriversReport(drivers.data);
        setFleetReport(fleet.data);
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const kpis = (dashData as Record<string, unknown> & { kpis?: Record<string, number> })?.kpis;

  const exportCSV = (data: unknown[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0] as object);
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => (row as Record<string, unknown>)[h]).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  const byHour = ((dashData as Record<string, unknown>)?.deliveryByHour as Array<{ hour: string; count: number }>) || [];
  const byPriority = ((dashData as Record<string, unknown>)?.ordersByPriority as Array<{ priority: string; count: number }>) || [];

  return (
    <div className="space-y-5 fade-in">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700 rounded-xl p-1 w-fit">
        {(['overview', 'orders', 'drivers', 'fleet'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <KpiCard title="Total Revenue" value={`$${((kpis?.total_revenue || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub={`$${((kpis?.monthly_revenue || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} this month`} icon={DollarSign} color="bg-green-100 text-green-600" />
            <KpiCard title="Avg Order Value" value={`$${((kpis?.avg_order_value || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub="Per completed order" icon={Package} color="bg-blue-100 text-blue-600" />
            <KpiCard title="On-Time Rate" value={`${((kpis?.on_time_rate || 0)).toFixed(1)}%`} sub="Overall performance" icon={TrendingUp} color="bg-orange-100 text-orange-600" />
            <KpiCard title="Avg Delivery" value={`${((kpis?.avg_delivery_hours || 0)).toFixed(1)}h`} sub="Pickup to delivery" icon={Clock} color="bg-purple-100 text-purple-600" />
            <KpiCard title="Customer Rating" value={`★ ${kpis?.customer_satisfaction?.toFixed(1) || '4.7'}`} sub="Average satisfaction" icon={Star} color="bg-yellow-100 text-yellow-600" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Revenue trend */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Revenue Trend (7 days)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={((dashData as Record<string, unknown>)?.dailyRevenue as unknown[]) || []}>
                  <defs>
                    <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => format(new Date(d + 'T00:00:00'), 'MM/dd')} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} fill="url(#grad1)" name="Revenue ($)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Deliveries by hour */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Deliveries by Hour</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byHour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={h => `${h}:00`} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} name="Deliveries" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Orders by priority */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Orders by Priority</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byPriority} cx="50%" cy="50%" outerRadius={85} dataKey="count" nameKey="priority" labelLine={false}>
                    {byPriority.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} formatter={(value, name) => [value, name]} />
                  <Legend iconType="circle" iconSize={8} formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top drivers */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-4">Top Driver Performance</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={((dashData as Record<string, unknown>)?.topDrivers as unknown[] || []).slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="total_deliveries" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Total Deliveries" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Orders Report</h3>
            <button onClick={() => exportCSV(ordersReport, 'orders-report')} className="btn-secondary">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                    {['Period', 'Total Orders', 'Delivered', 'Cancelled', 'Revenue', 'Avg Distance (mi)'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(ordersReport as Array<{ period: string; total_orders: number; delivered: number; cancelled: number; revenue: number; avg_distance: number }>).map((row, i) => (
                    <tr key={i} className="table-row">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">{row.period}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{row.total_orders}</td>
                      <td className="px-4 py-3 text-sm text-green-600 font-medium">{row.delivered}</td>
                      <td className="px-4 py-3 text-sm text-red-500">{row.cancelled}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-slate-100">${(row.revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">{((row.avg_distance || 0) * 0.621371).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'drivers' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Driver Performance Report</h3>
            <button onClick={() => exportCSV(driversReport, 'drivers-report')} className="btn-secondary">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                    {['Driver', 'Status', 'Total Trips', 'This Month', 'On Time %', 'Rating', 'Revenue (Month)', 'Avg Time (min)'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(driversReport as Array<{ name: string; status: string; total_deliveries: number; orders_this_month: number; on_time_rate: number; rating: number; revenue_this_month: number; avg_delivery_minutes: number }>).map((driver, i) => (
                    <tr key={i} className="table-row">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-slate-100">{driver.name}</td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs ${driver.status === 'available' ? 'bg-green-100 text-green-700' : driver.status === 'busy' ? 'bg-orange-100 text-orange-700' : driver.status === 'on_break' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                          {driver.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{driver.total_deliveries}</td>
                      <td className="px-4 py-3 text-sm text-blue-600 font-medium">{driver.orders_this_month}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{(driver.on_time_rate || 0).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-sm text-yellow-500">★ {(driver.rating || 0).toFixed(1)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600">${(driver.revenue_this_month || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-400">{(driver.avg_delivery_minutes || 0).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'fleet' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900 dark:text-slate-100">Fleet Utilization Report</h3>
            <button onClick={() => exportCSV(fleetReport, 'fleet-report')} className="btn-secondary">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                    {['Truck', 'Type', 'Status', 'Mileage', 'Total Trips', 'Total km', 'Revenue', 'Fuel %', 'Driver'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(fleetReport as Array<{ plate_number: string; make: string; model: string; type: string; status: string; mileage: number; total_trips: number; total_km: number; revenue_generated: number; fuel_level: number; current_driver: string }>).map((truck, i) => (
                    <tr key={i} className="table-row">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{truck.plate_number}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{truck.make} {truck.model}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400">{truck.type}</td>
                      <td className="px-4 py-3">
                        <span className={`badge text-xs ${truck.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {truck.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{(truck.mileage || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-blue-600 font-medium">{truck.total_trips}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{(truck.total_km || 0).toFixed(0)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600">${(truck.revenue_generated || 0).toFixed(0)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full">
                            <div className={`h-1.5 rounded-full ${truck.fuel_level < 30 ? 'bg-red-400' : truck.fuel_level < 60 ? 'bg-yellow-400' : 'bg-green-500'}`} style={{ width: `${truck.fuel_level}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-slate-400">{truck.fuel_level}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-400">{truck.current_driver || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



