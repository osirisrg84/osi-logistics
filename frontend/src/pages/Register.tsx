import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Truck, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft, Languages } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';

interface DriverOption {
  id: string;
  name: string;
  email: string;
  phone: string;
  has_account: number;
}

export default function Register() {
  const { t } = useTranslation();
  const { lang, toggle: toggleLang } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultRole = (searchParams.get('role') as 'dispatcher' | 'driver') || 'dispatcher';

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: defaultRole,
    driver_id: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [driversList, setDriversList] = useState<DriverOption[]>([]);

  useEffect(() => {
    authApi.getDriversList().then(r => setDriversList(r.data)).catch(() => {});
  }, []);

  const passwordStrength = (p: string) => {
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };

  const strength = passwordStrength(form.password);
  const strengthLabels = ['', t('register2.strengthWeak'), t('register2.strengthFair'), t('register2.strengthGood'), t('register2.strengthStrong')];
  const strengthColors = ['', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError(t('register2.errMismatch'));
      return;
    }
    if (form.password.length < 8) {
      setError(t('register2.errShort'));
      return;
    }
    if (form.role === 'driver' && !form.driver_id) {
      setError(t('register2.errSelectProfile'));
      return;
    }

    setLoading(true);
    try {
      await authApi.register({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        driver_id: form.role === 'driver' ? form.driver_id : null,
      });
      await login(form.email, form.password);
      navigate(form.role === 'driver' ? '/driver' : '/dashboard', { replace: true });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || t('register2.errFailed'));
    } finally {
      setLoading(false);
    }
  };

  const availableDrivers = driversList.filter(d => !d.has_account);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-in">
        {/* Back link + language */}
        <div className="flex items-center justify-between mb-5">
          <Link
            to={form.role === 'driver' ? '/driver/login' : '/dispatcher'}
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t('register2.backToLogin')}
          </Link>
          <button type="button" onClick={toggleLang} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors">
            <Languages className="w-4 h-4 hidden sm:block" /> {lang.toUpperCase()}
          </button>
        </div>

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-500 rounded-2xl mb-3 shadow-2xl shadow-orange-500/30">
            <Truck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">OSI Logistics</h1>
          <p className="text-slate-400 text-sm mt-1">{t('register2.createYourAccount')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{t('register2.joinTitle')}</h2>
          <p className="text-sm text-gray-500 mb-6">{t('register2.joinSubtitle')}</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role selection */}
            <div>
              <label className="label">{t('register2.accountType')}</label>
              <div className="grid grid-cols-2 gap-2">
                {(['dispatcher', 'driver'] as const).map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setForm({...form, role, driver_id: ''})}
                    className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                      form.role === role
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-lg mb-0.5">{role === 'dispatcher' ? '📋' : '🚛'}</div>
                    <div>{t(role === 'dispatcher' ? 'register2.dispatcher' : 'register2.driver')}</div>
                    <div className="text-xs mt-0.5 font-normal text-gray-400">
                      {role === 'dispatcher' ? t('register2.dispatcherDesc') : t('register2.driverDesc')}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">{t('register2.fullName')}</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                placeholder="Carlos Rodriguez" required />
            </div>

            <div>
              <label className="label">{t('register2.emailAddress')}</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                placeholder="you@osilogistics.com" required />
            </div>

            {/* Driver profile selection */}
            {form.role === 'driver' && (
              <div>
                <label className="label">{t('register2.selectProfile')}</label>
                {availableDrivers.length === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
                    {t('register2.noProfiles')}
                  </div>
                ) : (
                  <select
                    className="input"
                    value={form.driver_id}
                    onChange={e => {
                      const driver = driversList.find(d => d.id === e.target.value);
                      setForm({...form, driver_id: e.target.value, email: driver?.email || form.email, name: driver?.name || form.name});
                    }}
                    required={form.role === 'driver'}
                  >
                    <option value="">{t('register2.chooseProfile')}</option>
                    {availableDrivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name} · {d.phone}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <label className="label">{t('register2.password')}</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  placeholder={t('register2.passwordPlaceholder')}
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColors[strength] : 'bg-gray-100'}`} />
                    ))}
                  </div>
                  <p className={`text-xs ${strength >= 3 ? 'text-green-600' : strength >= 2 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {strengthLabels[strength]}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="label">{t('register2.confirmPassword')}</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={e => setForm({...form, confirmPassword: e.target.value})}
                  placeholder={t('register2.confirmPlaceholder')}
                  required
                />
                {form.confirmPassword && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {form.password === form.confirmPassword
                      ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                      : <AlertCircle className="w-4 h-4 text-red-400" />
                    }
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || (form.role === 'driver' && availableDrivers.length === 0)}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('register2.creating')}
                </>
              ) : (
                t('register2.createAccount')
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              {t('register2.haveAccount')}{' '}
              <Link
                to={form.role === 'driver' ? '/driver/login' : '/dispatcher'}
                className="text-orange-500 hover:text-orange-600 font-medium"
              >
                {t('register2.signIn')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

