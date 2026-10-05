import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Truck, Eye, EyeOff, AlertCircle, ArrowLeft, MapPin, Package, Star, CheckCircle, KeyRound, Languages } from 'lucide-react';
import { useDriverAuth } from '../context/DriverAuthContext';
import { useLanguage } from '../context/LanguageContext';
import { authApi } from '../services/driverApi';
import { setAppManifest, setThemeColor, DRIVER_MANIFEST, DISPATCH_MANIFEST, DRIVER_COLOR, DISPATCH_COLOR } from '../utils/appManifest';

type LoginMode = 'login' | 'forgot' | 'reset';

export default function DriverLogin() {
  useEffect(() => {
    setAppManifest(DRIVER_MANIFEST);
    setThemeColor(DRIVER_COLOR);
    return () => { setAppManifest(DISPATCH_MANIFEST); setThemeColor(DISPATCH_COLOR); };
  }, []);

  const { t } = useTranslation();
  const { lang, toggle: toggleLang } = useLanguage();
  const { login } = useDriverAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Olvidé mi contraseña ──
  const [mode, setMode] = useState<LoginMode>('login');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetInfo, setResetInfo] = useState('');

  const goToForgot = () => {
    setResetEmail(email);
    setResetError('');
    setResetInfo('');
    setMode('forgot');
  };

  const handleForgotSubmit = async (e: FormEvent | { preventDefault: () => void }) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);
    try {
      const { data } = await authApi.forgotPassword(resetEmail);
      setResetInfo(data.message || t('driverLogin.genericCodeMessage'));
      setMode('reset');
    } catch {
      // Nunca reveles si el correo existe o no -- mismo mensaje en ambos casos.
      setResetInfo(t('driverLogin.genericCodeMessage'));
      setMode('reset');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (newPassword.length < 8) { setResetError(t('driverLogin.passwordMinLengthError')); return; }
    if (newPassword !== confirmPassword) { setResetError(t('driverLogin.passwordMismatchError')); return; }
    setResetLoading(true);
    try {
      await authApi.resetPassword(resetEmail, resetCode, newPassword);
      setEmail(resetEmail);
      setPassword('');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
      setResetInfo('');
      setError('');
      setMode('login');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setResetError(msg || t('driverLogin.resetFailedError'));
    } finally {
      setResetLoading(false);
    }
  };

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
          setError(t('driverLogin.driversOnlyError'));
          localStorage.removeItem('osi_token');
          localStorage.removeItem('osi_user');
          setLoading(false);
          return;
        }
      }
      // Preserva el ?order=<id> si el driver llego aqui desde el link de un correo
      // (ej. "Ver orden") -- sin esto, el login lo mandaba siempre a la pantalla
      // general y perdia la orden especifica a la que queria ir.
      const search = window.location.search;
      navigate(search ? `/driver${search}` : '/driver');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || t('driverLogin.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <Link to="/app" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> {t('driverLogin.backToPortalSelect')}
          </Link>
          <button onClick={toggleLang} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors">
            <Languages className="w-4 h-4" /> {lang.toUpperCase()}
          </button>
        </div>
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-blue-500/30">
            <Truck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">{t('driverLogin.title')}</h1>
          <p className="text-slate-400 mt-2">{t('driverLogin.subtitle')}</p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {[
            { icon: Package, text: t('driverLogin.pillOrders') },
            { icon: MapPin, text: t('driverLogin.pillNav') },
            { icon: Star, text: t('driverLogin.pillPerformance') },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 bg-slate-700/50 rounded-full px-3 py-1.5 text-xs text-slate-300">
              <Icon className="w-3 h-3 text-blue-400" />
              {text}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-sm mx-auto">
          {mode === 'login' && (<>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{t('driverLogin.welcomeBack')}</h2>
          <p className="text-sm text-gray-500 mb-5">{t('driverLogin.signInSubtitle')}</p>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-2xl mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('driverLogin.email')}</label>
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
              <label className="label">{t('driverLogin.password')}</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('driverLogin.password')}
                  required
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button type="button" onClick={goToForgot} className="text-xs text-blue-500 hover:text-blue-600 font-medium mt-1.5">
                {t('driverLogin.forgotPassword')}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2 text-base mt-2"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('driverLogin.signingIn')}</>
                : t('driverLogin.signIn')
              }
            </button>
          </form>

          {/* Demo */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-2 uppercase tracking-wide font-medium">{t('driverLogin.demoDriver')}</p>
            <button
              type="button"
              onClick={() => { setEmail('carlos.r@osilogistics.com'); setPassword('Driver123!'); }}
              className="w-full text-sm font-medium py-2.5 px-4 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors flex items-center gap-2"
            >
              <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">CR</div>
              {t('driverLogin.demoDriverLabel')}
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-4">
            {t('driverLogin.noAccount')}{' '}
            <Link to="/register?portal=driver" className="text-blue-500 hover:text-blue-600 font-medium">{t('driverLogin.registerHere')}</Link>
          </p>
          </>)}

          {mode === 'forgot' && (
            <>
              <button type="button" onClick={() => setMode('login')} className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 text-xs mb-3">
                <ArrowLeft className="w-3 h-3" /> {t('driverLogin.backToSignIn')}
              </button>
              <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                <KeyRound className="w-5 h-5 text-blue-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{t('driverLogin.resetPasswordTitle')}</h2>
              <p className="text-sm text-gray-500 mb-5">{t('driverLogin.resetPasswordSubtitle')}</p>

              {resetError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-2xl mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{resetError}</span>
                </div>
              )}

              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="label">{t('driverLogin.email')}</label>
                  <input
                    className="input"
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    autoFocus
                    autoComplete="email"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2 text-base mt-2"
                >
                  {resetLoading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('driverLogin.sending')}</>
                    : t('driverLogin.sendCode')
                  }
                </button>
              </form>
            </>
          )}

          {mode === 'reset' && (
            <>
              <button type="button" onClick={() => setMode('forgot')} className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-600 text-xs mb-3">
                <ArrowLeft className="w-3 h-3" /> {t('driverLogin.back')}
              </button>
              <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center mb-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">{t('driverLogin.enterCodeTitle')}</h2>
              {resetInfo && <p className="text-sm text-gray-500 mb-5">{resetInfo}</p>}

              {resetError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3 rounded-2xl mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{resetError}</span>
                </div>
              )}

              <form onSubmit={handleResetSubmit} className="space-y-4">
                <div>
                  <label className="label">{t('driverLogin.sixDigitCode')}</label>
                  <input
                    className="input text-center tracking-[0.4em] font-bold"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={resetCode}
                    onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">{t('driverLogin.newPassword')}</label>
                  <input
                    className="input"
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder={t('driverLogin.minChars')}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="label">{t('driverLogin.confirmPassword')}</label>
                  <input
                    className="input"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder={t('driverLogin.repeatPassword')}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-bold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2 text-base mt-2"
                >
                  {resetLoading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('driverLogin.saving')}</>
                    : t('driverLogin.changePassword')
                  }
                </button>
                <button type="button" onClick={handleForgotSubmit} disabled={resetLoading} className="w-full text-xs text-blue-500 hover:text-blue-600 font-medium">
                  {t('driverLogin.resendCode')}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-xs text-slate-600 mt-6 text-center">
          {t('driverLogin.isDispatcher')}{' '}
          <Link to="/dispatcher" className="text-orange-400 hover:text-orange-300 font-medium">{t('driverLogin.dispatcherPortal')}</Link>
        </p>
      </div>
    </div>
  );
}

