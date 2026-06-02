import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, AlertCircle, ArrowLeft, Users, BarChart3, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const stored = localStorage.getItem('osi_user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user.role !== 'admin') {
          setError('Admin access only. Dispatchers use the Dispatcher Portal.');
          localStorage.removeItem('osi_token');
          localStorage.removeItem('osi_user');
          setLoading(false);
          return;
        }
      }
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-in">
        <Link to="/" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to portal selection
        </Link>

        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-600 rounded-2xl mb-4 shadow-2xl shadow-purple-500/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Console</h1>
          <p className="text-slate-400 text-sm mt-1">OSI Logistics — System Administration</p>
        </div>

        {/* Feature list */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { icon: Users, label: 'User Management' },
            { icon: BarChart3, label: 'Full Analytics' },
            { icon: Settings, label: 'System Config' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="bg-purple-900/20 border border-purple-800/30 rounded-xl p-3 text-center">
              <Icon className="w-4 h-4 text-purple-400 mx-auto mb-1" />
              <p className="text-xs text-slate-400 leading-tight">{label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-purple-500 rounded-full" />
            <h2 className="text-xl font-semibold text-gray-900">Administrator Sign In</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6 ml-4">Restricted access — authorized personnel only</p>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Admin Email</label>
              <input
                className="input focus:ring-purple-500/30 focus:border-purple-400"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@osilogistics.com"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10 focus:ring-purple-500/30 focus:border-purple-400"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Admin password"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Authenticating...</>
                : <><Shield className="w-4 h-4" /> Access Admin Console</>
              }
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3 font-medium uppercase tracking-wide">Demo Access</p>
            <button
              type="button"
              onClick={() => { setEmail('admin@osilogistics.com'); setPassword('Admin123!'); }}
              className="w-full text-sm font-medium py-2.5 px-4 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors flex items-center gap-2"
            >
              <div className="w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">AO</div>
              Admin OSI · admin@osilogistics.com
            </button>
            <div className="mt-3 flex flex-col gap-1 text-center">
              <p className="text-xs text-gray-400">
                Dispatcher?{' '}
                <Link to="/dispatcher" className="text-orange-500 hover:text-orange-600 font-medium">Dispatcher Portal →</Link>
              </p>
              <p className="text-xs text-gray-400">
                Driver?{' '}
                <Link to="/driver/login" className="text-blue-500 hover:text-blue-600 font-medium">Driver Portal →</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
