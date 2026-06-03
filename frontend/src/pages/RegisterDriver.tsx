import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Truck, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft, Search, Phone, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

interface DriverOption {
  id: string;
  name: string;
  email: string;
  phone: string;
  has_account: number;
}

export default function RegisterDriver() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DriverOption | null>(null);
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    authApi.getDriversList().then(r => setDrivers(r.data)).catch(() => {});
  }, []);

  const available = drivers.filter(d => !d.has_account && (
    !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.phone.includes(search)
  ));

  const strength = (() => {
    const p = form.password;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  })();

  const handleSelectDriver = (driver: DriverOption) => {
    setSelected(driver);
    setStep(2);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selected) { setError('Please select your driver profile first'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await authApi.register({
        name: selected.name,
        email: selected.email,
        password: form.password,
        role: 'driver',
        driver_id: selected.id,
      });
      await login(selected.email, form.password);
      navigate('/driver', { replace: true });
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
      {/* Top bar */}
      <div className="px-5 pt-5 flex items-center justify-between">
        <button onClick={() => step === 2 ? setStep(1) : navigate('/driver/login')}
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          {step === 2 ? 'Back to profile selection' : 'Back to Driver Login'}
        </button>
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[1, 2].map(s => (
            <div key={s} className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${
              s === step ? 'bg-blue-500 text-white' : s < step ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400'
            }`}>
              {s < step ? 'âœ“' : s}
            </div>
          ))}
          <span className="text-xs text-slate-400">Step {step} of 2</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-10 pt-5">
        {/* Logo */}
        <div className="text-center mb-7">
          <div className="w-16 h-16 bg-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-blue-500/30">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Driver Account</h1>
          <p className="text-slate-400 text-sm mt-1">{step === 1 ? 'Find your driver profile' : 'Set your password'}</p>
        </div>

        {/* â”€â”€ STEP 1: Select driver profile â”€â”€ */}
        {step === 1 && (
          <div className="w-full max-w-sm space-y-4">
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-2xl p-4">
              <p className="text-xs text-blue-300 font-medium mb-1">How does it work?</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Find your name in the list below â€” it comes from your employee record.
                If you don't appear, contact your dispatcher to have your profile created first.
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                placeholder="Search by name or phone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Driver list */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {available.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  {search ? 'No drivers match your search' : 'No available driver profiles'}
                </div>
              ) : available.map(driver => (
                <button key={driver.id} onClick={() => handleSelectDriver(driver)}
                  className="w-full flex items-center gap-3 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-blue-500/50 rounded-xl p-3.5 text-left transition-all group">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {driver.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{driver.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {driver.phone}
                      </span>
                    </div>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:text-blue-400 rotate-180 transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>

            <p className="text-xs text-center text-slate-600">
              Already registered?{' '}
              <Link to="/driver/login" className="text-blue-400 hover:text-blue-300 font-medium">Sign in here</Link>
            </p>
          </div>
        )}

        {/* â”€â”€ STEP 2: Set password â”€â”€ */}
        {step === 2 && selected && (
          <div className="w-full max-w-sm">
            {/* Selected profile card */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 mb-5 flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                {selected.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{selected.name}</p>
                <p className="text-blue-300 text-xs flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3" /> {selected.phone}
                </p>
                <p className="text-blue-300 text-xs flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {selected.email}
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
            </div>

            <div className="bg-white rounded-2xl shadow-2xl p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Set your password</h3>
              <p className="text-sm text-gray-500 mb-5">Choose a secure password for your driver account</p>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 text-sm px-3 py-2.5 rounded-xl mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <input className="input pr-10" type={showPw ? 'text' : 'password'}
                      value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                      placeholder="Min. 8 characters" required autoFocus />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {form.password && (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                            i <= strength
                              ? strength >= 4 ? 'bg-green-500' : strength >= 3 ? 'bg-blue-400' : strength >= 2 ? 'bg-yellow-400' : 'bg-red-400'
                              : 'bg-gray-100'
                          }`} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Confirm Password</label>
                  <div className="relative">
                    <input className="input pr-10" type={showPw ? 'text' : 'password'}
                      value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })}
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

                <button type="submit" disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</>
                    : 'Create Driver Account'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

