import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Truck, Eye, EyeOff, AlertCircle, ArrowLeft, MapPin, Package, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DriverLogin() {
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
        if (user.role !== 'driver') {
          setError('This portal is for drivers only. Dispatchers must use the Dispatcher Portal.');
          localStorage.removeItem('osi_token');
          localStorage.removeItem('osi_user');
          setLoading(false);
          return;
        }
      }
      navigate('/driver');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
      {/* Top bar */}
      <div className="px-5 pt-5">
        <Link to="/" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-blue-500/30">
            <Truck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Driver Portal</h1>
          <p className="text-slate-400 mt-2">OSI Logistics Â· Miami, FL</p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {[
            { icon: Package, text: 'View your orders' },
            { icon: MapPin, text: 'Live navigation' },
            { icon: Star, text: 'Track performance' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 bg-slate-700/50 rounded-full px-3 py-1.5 text-xs text-slate-300">
              <Icon className="w-3 h-3 text-blue-400" />
              {text}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-sm">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Welcome back</h2>
          <p className="text-sm text-gray-500 mb-5">Sign in to see your deliveries</p>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-2xl mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                autoComplete="email"
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
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2 text-base mt-2"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</>
                : 'Sign In'
              }
            </button>
          </form>

          {/* Demo */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-2 uppercase tracking-wide font-medium">Demo Driver</p>
            <button
              type="button"
              onClick={() => { setEmail('carlos.r@osilogistics.com'); setPassword('Driver123!'); }}
              className="w-full text-sm font-medium py-2.5 px-4 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-2"
            >
              <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">CR</div>
              Carlos Rodriguez Â· Driver
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            Don't have an account?{' '}
            <Link to="/driver/register" className="text-blue-500 hover:text-blue-600 font-medium">Register here</Link>
          </p>
        </div>

        <p className="text-xs text-slate-600 mt-6 text-center">
          Are you a dispatcher?{' '}
          <Link to="/dispatcher" className="text-orange-400 hover:text-orange-300 font-medium">Dispatcher Portal â†’</Link>
        </p>
      </div>
    </div>
  );
}

