import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft, User, Mail, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

export default function RegisterDispatcher() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = (() => {
    const p = form.password;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await authApi.register({ name: form.name, email: form.email, password: form.password, role: 'dispatcher' });
      await login(form.email, form.password);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-in">
        <Link to="/dispatcher" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dispatcher Login
        </Link>

        {/* Header */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-500 rounded-2xl mb-4 shadow-2xl shadow-orange-500/30">
            <ClipboardList className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Dispatcher Account</h1>
          <p className="text-slate-400 text-sm mt-1">Create your operations access</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">New Dispatcher</h2>
          <p className="text-sm text-gray-500 mb-6">Full access to orders, fleet, tracking and reports</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Jane Smith" required autoFocus />
              </div>
            </div>

            <div>
              <label className="label">Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9" type="email" value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="dispatcher@osilogistics.com" required />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9 pr-10"
                  type={showPw ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 8 characters" required />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= strength
                          ? strength >= 4 ? 'bg-green-500' : strength >= 3 ? 'bg-blue-400' : strength >= 2 ? 'bg-yellow-400' : 'bg-red-400'
                          : 'bg-gray-100'
                      }`} />
                    ))}
                  </div>
                  <p className={`text-xs ${strength >= 4 ? 'text-green-600' : strength >= 3 ? 'text-blue-600' : strength >= 2 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {['', 'Weak', 'Fair', 'Good', 'Strong'][strength]} password
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="label">Confirm Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9 pr-10"
                  type={showPw ? 'text' : 'password'} value={form.confirm}
                  onChange={e => setForm({ ...form, confirm: e.target.value })}
                  placeholder="Repeat password" required />
                {form.confirm && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {form.password === form.confirm
                      ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                      : <AlertCircle className="w-4 h-4 text-red-400" />}
                  </div>
                )}
              </div>
            </div>

            {/* Access preview */}
            <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
              <p className="text-xs font-semibold text-orange-700 mb-2">You will have access to:</p>
              <div className="grid grid-cols-2 gap-1">
                {['Dashboard & KPIs', 'Order Management', 'Live Fleet Tracking', 'Driver Assignments', 'Fleet Management', 'Analytics & Reports'].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-xs text-orange-700">
                    <CheckCircle2 className="w-3 h-3 text-orange-500 flex-shrink-0" /> {f}
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account...</>
                : 'Create Dispatcher Account'}
            </button>
          </form>

          <p className="text-sm text-gray-500 text-center mt-5">
            Already have an account?{' '}
            <Link to="/dispatcher" className="text-orange-500 hover:text-orange-600 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

