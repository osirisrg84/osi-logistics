import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClipboardList, Eye, EyeOff, AlertCircle, ArrowLeft, Truck, BarChart2, Users } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a selección de portal
        </Link>

        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-orange-500/30">
            <ClipboardList className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Dispatcher Console</h1>
          <p className="text-slate-400 mt-2">OSI Logistics · Operations Center</p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {[
            { icon: Truck,       text: 'Gestionar flota' },
            { icon: Users,       text: 'Asignar conductores' },
            { icon: BarChart2,   text: 'Reportes de operaciones' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 bg-slate-700/50 rounded-full px-3 py-1.5 text-xs text-slate-300">
              <Icon className="w-3 h-3 text-orange-400" />
              {text}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-sm mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Bienvenido de nuevo</h2>
          <p className="text-sm text-gray-500 mb-5">Inicia sesión en tu panel de despacho</p>

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
                placeholder="dispatcher@osilogistics.com"
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
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2 text-base mt-2"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</>
                : 'Sign In'
              }
            </button>
          </form>

          {/* Demo */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-2 uppercase tracking-wide font-medium">Demo Credentials</p>
            <button
              type="button"
              onClick={() => { setEmail('dispatcher@osilogistics.com'); setPassword('Dispatch123!'); }}
              className="w-full text-sm font-medium py-2.5 px-4 rounded-xl bg-orange-50 text-orange-700 border border-orange-100 hover:bg-orange-100 transition-colors flex items-center gap-2"
            >
              <div className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">DO</div>
              Maria Gonzalez · Dispatch
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            ¿Eres nuevo dispatcher?{' '}
            <Link to="/dispatcher/register" className="text-orange-500 hover:text-orange-600 font-medium">Crear cuenta</Link>
          </p>
        </div>

        <p className="text-xs text-slate-600 mt-6 text-center">
          ¿Eres conductor?{' '}
          <Link to="/driver/login" className="text-blue-400 hover:text-blue-300 font-medium">Portal Conductor →</Link>
        </p>
      </div>
    </div>
  );
}
