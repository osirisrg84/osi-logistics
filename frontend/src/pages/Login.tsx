import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Truck, Eye, EyeOff, AlertCircle, ArrowLeft, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
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
      // Block driver accounts from accessing dispatcher portal
      const stored = localStorage.getItem('osi_user');
      if (stored) {
        const user = JSON.parse(stored);
        if (user.role === 'driver') {
          setError('Driver accounts must use the Driver Portal.');
          localStorage.removeItem('osi_token');
          localStorage.removeItem('osi_user');
          setLoading(false);
          return;
        }
        if (user.role === 'admin') {
          setError('Admin accounts must use the Admin Console at /admin.');
          localStorage.removeItem('osi_token');
          localStorage.removeItem('osi_user');
          setLoading(false);
          return;
        }
      }
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-in">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to portal selection
        </Link>

        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-500 rounded-2xl mb-4 shadow-2xl shadow-orange-500/30">
            <ClipboardList className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Dispatcher Portal</h1>
          <p className="text-slate-400 text-sm mt-1">OSI Logistics â€” Operations Center</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Sign in</h2>
          <p className="text-sm text-gray-500 mb-6">Access your dispatch dashboard</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="dispatcher@osilogistics.com"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
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
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</>
                : 'Sign In to Dispatch Center'
              }
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              New dispatcher?{' '}
              <Link to="/dispatcher/register" className="text-orange-500 hover:text-orange-600 font-medium">Create account</Link>
            </p>
          </div>

          {/* Demo credentials */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3 font-medium uppercase tracking-wide">Demo Credentials</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setEmail('dispatcher@osilogistics.com'); setPassword('Dispatch123!'); }}
              className="col-span-2 text-sm font-medium py-2.5 px-4 rounded-xl bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition-colors flex items-center gap-2">
              <div className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">DO</div>
              Dispatcher OSI Â· dispatcher@osilogistics.com
            </button>
            </div>
            <div className="mt-3 flex flex-col gap-1 text-center">
              <p className="text-xs text-gray-400">
                Admin?{' '}
                <Link to="/admin" className="text-purple-500 hover:text-purple-600 font-medium">Admin Console â†’</Link>
              </p>
              <p className="text-xs text-gray-400">
                Driver?{' '}
                <Link to="/driver/login" className="text-blue-500 hover:text-blue-600 font-medium">Driver Portal â†’</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

