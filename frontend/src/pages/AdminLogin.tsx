import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, Eye, EyeOff, AlertCircle, ArrowLeft, Users, BarChart3, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  setAppManifest, setThemeColor, setFavicon,
  ADMIN_MANIFEST, DISPATCH_MANIFEST, ADMIN_COLOR, DISPATCH_COLOR, ADMIN_FAVICON, DISPATCH_FAVICON,
} from '../utils/appManifest';

export default function AdminLogin() {
  useEffect(() => {
    setAppManifest(ADMIN_MANIFEST);
    setThemeColor(ADMIN_COLOR);
    setFavicon(ADMIN_FAVICON);
    return () => {
      setAppManifest(DISPATCH_MANIFEST);
      setThemeColor(DISPATCH_COLOR);
      setFavicon(DISPATCH_FAVICON);
    };
  }, []);

  const { t } = useTranslation();
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
          setError(t('adminLogin.errorAdminOnly'));
          localStorage.removeItem('osi_token');
          localStorage.removeItem('osi_user');
          setLoading(false);
          return;
        }
      }
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || t('adminLogin.errorInvalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-in">
        <Link to="/" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> {t('adminLogin.backToPortalSelect')}
        </Link>

        {/* Logo */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-600 rounded-2xl mb-4 shadow-2xl shadow-purple-500/30">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t('adminLogin.heroTitle')}</h1>
          <p className="text-slate-400 text-sm mt-1">{t('adminLogin.heroSubtitle')}</p>
        </div>

        {/* Feature list */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { icon: Users, label: t('adminLogin.featureUserManagement') },
            { icon: BarChart3, label: t('adminLogin.featureFullAnalytics') },
            { icon: Settings, label: t('adminLogin.featureSystemConfig') },
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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('adminLogin.signInTitle')}</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6 ml-4">{t('adminLogin.restrictedAccess')}</p>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">{t('adminLogin.adminEmailLabel')}</label>
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
              <label className="label">{t('adminLogin.passwordLabel')}</label>
              <div className="relative">
                <input
                  className="input pr-10 focus:ring-purple-500/30 focus:border-purple-400"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={t('adminLogin.passwordPlaceholder')}
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
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('adminLogin.authenticating')}</>
                : <><Shield className="w-4 h-4" /> {t('adminLogin.accessConsole')}</>
              }
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col gap-1 text-center">
            <p className="text-xs text-gray-400">
              {t('adminLogin.dispatcherPrompt')}{' '}
              <Link to="/dispatcher" className="text-orange-500 hover:text-orange-600 font-medium">{t('adminLogin.dispatcherPortalLink')}</Link>
            </p>
            <p className="text-xs text-gray-400">
              {t('adminLogin.driverPrompt')}{' '}
              <Link to="/driver/login" className="text-blue-500 hover:text-blue-600 font-medium">{t('adminLogin.driverPortalLink')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

