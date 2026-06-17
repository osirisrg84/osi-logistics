import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, X, Shield, UserCheck, Truck, AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'dispatcher' | 'driver';
  active: number;
  created_at: string;
  driver_name?: string;
  driver_status?: string;
  driver_avatar?: string;
}

interface PendingUser {
  id: string;
  name: string;
  email: string;
  role: 'dispatcher' | 'driver';
  phone: string;
  city: string;
  created_at: string;
  years_experience: number;
  equipment_experience: string;
  languages: string;
  availability: string;
  driver_name?: string;
  license_number?: string;
  equipment_type?: string;
}

interface AdminStats {
  total_users: number;
  admins: number;
  dispatchers: number;
  drivers_with_account: number;
  active_sessions: number;
  recent_logins: Array<{ name: string; email: string; role: string; created_at: string }>;
}

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 border-purple-200',
  dispatcher: 'bg-orange-100 text-orange-700 border-orange-200',
  driver: 'bg-blue-100 text-blue-700 border-blue-200',
};

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  admin: Shield,
  dispatcher: UserCheck,
  driver: Truck,
};

interface UserFormProps {
  user?: User;
  onClose: () => void;
  onSave: () => void;
}

function UserForm({ user, onClose, onSave }: UserFormProps) {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'dispatcher',
    active: user?.active ?? 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user && !form.password) { setError('Password is required for new users'); return; }
    if (form.password && form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name: form.name, email: form.email, role: form.role };
      if (form.password) payload.password = form.password;
      if (user) payload.active = form.active;
      if (user) {
        await api.put(`/admin/users/${user.id}`, payload);
      } else {
        await api.post('/admin/users', { ...payload, password: form.password });
      }
      onSave();
      onClose();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 dark:text-slate-100">{user ? 'Edit User' : 'Create User'}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 dark:text-slate-500" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg border border-red-200">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}
          <div>
            <label className="label">Full Name *</label>
            <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          </div>
          <div>
            <label className="label">Email *</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
          </div>
          <div>
            <label className="label">{user ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input className="input" type="password" value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              placeholder={user ? 'Leave blank to keep current' : 'Min. 8 characters'}
              required={!user} />
          </div>
          <div>
            <label className="label">Role *</label>
            <div className="grid grid-cols-3 gap-2">
              {(['admin', 'dispatcher', 'driver'] as const).map(r => {
                const Icon = ROLE_ICONS[r];
                return (
                  <button key={r} type="button" onClick={() => setForm({...form, role: r})}
                    className={`py-2.5 px-3 rounded-xl border-2 text-xs font-medium transition-all capitalize flex flex-col items-center gap-1 ${
                      form.role === r
                        ? r === 'admin' ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : r === 'dispatcher' ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    <Icon className="w-4 h-4" />
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
          {user && (
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Active Account</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">Deactivated users cannot sign in</p>
              </div>
              <button type="button" onClick={() => setForm({...form, active: form.active ? 0 : 1})}
                className={`w-11 h-6 rounded-full transition-colors ${form.active ? 'bg-green-500' : 'bg-gray-200'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow mx-0.5 transition-transform ${form.active ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 justify-center bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm">
              {saving ? 'Saving...' : user ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [usersRes, statsRes, pendingRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/stats'),
        api.get('/admin/pending'),
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
      setPending(pendingRes.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id + '_approve');
    try {
      await api.put(`/admin/users/${id}/approve`);
      fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('¿Rechazar esta solicitud de cuenta?')) return;
    setActionLoading(id + '_reject');
    try {
      await api.put(`/admin/users/${id}/reject`);
      fetchData();
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete ${user.name}? This action cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${user.id}`);
      fetchData();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Cannot delete user');
    }
  };

  const handleToggleActive = async (user: User) => {
    await api.put(`/admin/users/${user.id}`, { active: user.active ? 0 : 1 });
    fetchData();
  };

  const filtered = users.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-5 fade-in">

      {/* Pending Approvals */}
      {pending.length > 0 && (
        <div className="card border-2 border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/10 p-0 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-amber-200 dark:border-amber-700/30">
            <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300">Cuentas Pendientes de Aprobación</h3>
              <p className="text-xs text-amber-600 dark:text-amber-400">{pending.length} solicitud{pending.length !== 1 ? 'es' : ''} esperando revisión</p>
            </div>
          </div>
          <div className="divide-y divide-amber-100 dark:divide-amber-800/30">
            {pending.map(u => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${u.role === 'dispatcher' ? 'bg-orange-500' : 'bg-blue-500'}`}>
                  {u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{u.name}</p>
                    <span className={`badge border text-xs capitalize ${u.role === 'dispatcher' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
                      {u.role}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{u.email} {u.phone && `· ${u.phone}`} {u.city && `· ${u.city}`}</p>
                  {u.role === 'dispatcher' && u.years_experience > 0 && (
                    <p className="text-xs text-gray-400 dark:text-slate-500">{u.years_experience} años exp. · {u.availability} {u.languages && `· ${u.languages}`}</p>
                  )}
                  {u.role === 'driver' && u.license_number && (
                    <p className="text-xs text-gray-400 dark:text-slate-500">Licencia: {u.license_number} · {u.equipment_type}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-slate-500">Registrado {format(new Date(u.created_at), 'MMM d, yyyy HH:mm')}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleApprove(u.id)}
                    disabled={actionLoading === u.id + '_approve'}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {actionLoading === u.id + '_approve' ? 'Aprobando...' : 'Aprobar'}
                  </button>
                  <button
                    onClick={() => handleReject(u.id)}
                    disabled={actionLoading === u.id + '_reject'}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 disabled:opacity-50 text-red-600 dark:text-red-400 text-xs font-semibold transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    {actionLoading === u.id + '_reject' ? '...' : 'Rechazar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total Users', value: stats.total_users, color: 'text-gray-900', bg: 'bg-white' },
            { label: 'Admins', value: stats.admins, color: 'text-purple-700', bg: 'bg-purple-50' },
            { label: 'Dispatchers', value: stats.dispatchers, color: 'text-orange-700', bg: 'bg-orange-50' },
            { label: 'Drivers', value: stats.drivers_with_account, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Active Sessions', value: stats.active_sessions, color: 'text-green-700', bg: 'bg-green-50' },
          ].map(s => (
            <div key={s.label} className={`card ${s.bg} p-4`}>
              <p className="text-xs text-gray-500 dark:text-slate-400">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
            <input className="input pl-9 w-52" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-36" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="dispatcher">Dispatcher</option>
            <option value="driver">Driver</option>
          </select>
        </div>
        <button onClick={() => { setEditUser(null); setShowForm(true); }}
          className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Create User
        </button>
      </div>

      {/* Users Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                {['User', 'Role', 'Status', 'Driver Profile', 'Created', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 dark:text-slate-500">Loading users...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400 dark:text-slate-500">No users found</td></tr>
              ) : filtered.map(user => {
                const RoleIcon = ROLE_ICONS[user.role];
                return (
                  <tr key={user.id} className="table-row">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold ${
                          user.role === 'admin' ? 'bg-purple-600' :
                          user.role === 'dispatcher' ? 'bg-orange-500' : 'bg-blue-500'
                        }`}>
                          {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{user.name}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge border ${ROLE_STYLES[user.role]} capitalize`}>
                        <RoleIcon className="w-3 h-3" /> {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggleActive(user)}
                        className={`badge border cursor-pointer transition-colors ${user.active ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {user.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {user.driver_name ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {user.driver_avatar}
                          </div>
                          <span className="text-xs text-gray-600 dark:text-slate-400">{user.driver_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                      {format(new Date(user.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditUser(user); setShowForm(true); }}
                          className="p-1.5 hover:bg-purple-50 rounded-lg" title="Edit">
                          <Edit2 className="w-3.5 h-3.5 text-purple-500" />
                        </button>
                        <button onClick={() => handleDelete(user)}
                          className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent logins */}
      {stats && stats.recent_logins.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Recent Sign-Ins</h3>
          <div className="space-y-2">
            {stats.recent_logins.map((login, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    login.role === 'admin' ? 'bg-purple-600' :
                    login.role === 'dispatcher' ? 'bg-orange-500' : 'bg-blue-500'
                  }`}>
                    {login.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-slate-100">{login.name}</span>
                    <span className="text-gray-400 ml-1 text-xs">{login.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge text-xs ${ROLE_STYLES[login.role]}`}>{login.role}</span>
                  <span className="text-xs text-gray-400 dark:text-slate-500">{format(new Date(login.created_at), 'MMM d, HH:mm')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <UserForm
          user={editUser || undefined}
          onClose={() => { setShowForm(false); setEditUser(null); }}
          onSave={fetchData}
        />
      )}
    </div>
  );
}


