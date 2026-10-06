import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Truck, ClipboardList, ArrowRight, MapPin } from 'lucide-react';
import osiLogo from '../assets/osi-logo.jpeg';
import { setThemeColor, NEUTRAL_COLOR, DISPATCH_COLOR } from '../utils/appManifest';

export default function Landing() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const host = window.location.hostname;
    if (host === 'dispatch.osilogistics.com') {
      navigate('/dispatcher', { replace: true });
      return;
    }
    if (host === 'driver.osilogistics.com') {
      navigate('/driver', { replace: true });
      return;
    }
    setThemeColor(NEUTRAL_COLOR);
    return () => setThemeColor(DISPATCH_COLOR);
  }, [navigate]);

  const portals = [
    {
      route: '/dispatcher',
      icon: ClipboardList,
      title: t('landing.dispatcherTitle'),
      subtitle: t('landing.dispatcherSubtitle'),
      description: t('landing.dispatcherDesc'),
      features: [t('landing.dispatcherFeature1'), t('landing.dispatcherFeature2'), t('landing.dispatcherFeature3')],
      accentColor: 'text-orange-400',
      borderHover: 'hover:border-orange-500/50',
      shadowHover: 'hover:shadow-orange-500/10',
      iconBg: 'bg-orange-500/15 group-hover:bg-orange-500/25',
      iconColor: 'text-orange-400',
      ctaColor: 'text-orange-400',
      ctaLabel: t('landing.dispatcherCta'),
      dot: 'bg-orange-400',
    },
    {
      route: '/driver',
      icon: Truck,
      title: t('landing.driverTitle'),
      subtitle: t('landing.driverSubtitle'),
      description: t('landing.driverDesc'),
      features: [t('landing.driverFeature1'), t('landing.driverFeature2'), t('landing.driverFeature3')],
      accentColor: 'text-blue-400',
      borderHover: 'hover:border-blue-500/50',
      shadowHover: 'hover:shadow-blue-500/10',
      iconBg: 'bg-blue-500/15 group-hover:bg-blue-500/25',
      iconColor: 'text-blue-400',
      ctaColor: 'text-blue-400',
      ctaLabel: t('landing.driverCta'),
      dot: 'bg-blue-400',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-12">
        <a href="https://www.osilogistics.com/" target="_blank" rel="noopener noreferrer">
          <img src={osiLogo} alt="OSI Logistics" className="h-16 sm:h-20 w-auto object-contain mx-auto mb-7 sm:mb-5 rounded-2xl shadow-2xl shadow-black/40 hover:opacity-90 transition-opacity cursor-pointer" />
        </a>
        <p className="text-slate-300 text-lg font-medium">{t('landing.tagline')}</p>
        <p className="text-slate-500 text-sm mt-0.5">{t('landing.taglineSub')}</p>
      </div>

      {/* Portal cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-2xl">
        {portals.map(p => {
          const Icon = p.icon;
          return (
            <button
              key={p.route}
              onClick={() => navigate(p.route)}
              className={`group relative bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 ${p.borderHover} rounded-2xl p-7 text-left transition-all duration-200 hover:shadow-2xl ${p.shadowHover} hover:-translate-y-0.5`}
            >
              <div className={`w-11 h-11 ${p.iconBg} rounded-xl flex items-center justify-center mb-4 transition-colors`}>
                <Icon className={`w-5 h-5 ${p.iconColor}`} />
              </div>
              <h2 className="text-lg font-bold text-white mb-0.5">{p.title}</h2>
              <p className={`text-xs font-medium mb-3 ${p.accentColor}`}>{p.subtitle}</p>
              <p className="text-slate-400 text-xs leading-relaxed mb-5">{p.description}</p>
              <div className="space-y-1.5 mb-5">
                {p.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs text-slate-400">
                    <div className={`w-1 h-1 rounded-full ${p.dot}`} />
                    {f}
                  </div>
                ))}
              </div>
              <div className={`flex items-center gap-2 text-xs font-semibold group-hover:gap-3 transition-all ${p.ctaColor}`}>
                {p.ctaLabel} <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Status */}
      <div className="flex items-center gap-6 mt-10 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
          {t('landing.systemsOperational')}
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3" />
          Miami, FL
        </div>
        <span>v2.1.0</span>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-slate-800 text-center">
        <p className="text-xs text-slate-600">© 2026 OSI Logistics, Inc.</p>
        <p className="text-xs text-slate-600 mt-0.5">Osiris Rodriguez &nbsp;|&nbsp; {t('landing.founderTitle')}</p>
      </div>
    </div>
  );
}
