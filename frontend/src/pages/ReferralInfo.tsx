import { useEffect } from 'react';
import { setThemeColor } from '../utils/appManifest';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Share2, UserPlus, TrendingDown, Gift } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// Esta pagina usa el mismo diseno que osilogistics.com (fondo oscuro, verde #97f048, Russo One + Cantarell,
// tarjetas con borde verde arriba y botones redondeados). No usa el estilo de la app.
const SITE_LOGO = 'https://d1yei2z3i6k35z.cloudfront.net/13421204/6afb568e90e5e8.91981144_osi-logo-fondo-oscuro.svg';
const GREEN = '#97F048';
const HEAD = "'Russo One', Arial, sans-serif";
const BODY = "Cantarell, Arial, sans-serif";

function Step({ icon: Icon, title, text, n }: { icon: any; title: string; text: string; n: number }) {
  return (
    <div
      className="rounded-2xl p-5 flex gap-4 items-start"
      style={{ background: '#262626', border: '1px solid #333', borderTop: `3px solid ${GREEN}` }}
    >
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: GREEN, color: '#111' }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[11px] font-bold tracking-widest mb-0.5" style={{ color: GREEN }}>0{n}</p>
        <p className="text-lg mb-1 leading-tight" style={{ fontFamily: HEAD, color: GREEN }}>{title}</p>
        <p className="text-[15px] leading-snug" style={{ color: '#cfcfcf' }}>{text}</p>
      </div>
    </div>
  );
}

export default function ReferralInfo() {
  // Fuentes del sitio principal + color de la barra del navegador igual que el sitio
  useEffect(() => {
    const prevTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content || '#f97316';
    setThemeColor('#1b1b1b');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cantarell:wght@400;700&family=Russo+One&display=swap';
    document.head.appendChild(link);
    return () => { setThemeColor(prevTheme); link.remove(); };
  }, []);
  const { t } = useTranslation();
  const { lang, toggle: toggleLang } = useLanguage();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const registerLink = ref ? `/driver/register?ref=${ref}` : '/driver/register';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#1b1b1b', color: '#fff', fontFamily: BODY }}>
      {/* barra superior como la del sitio */}
      <header
        className="flex items-center justify-between px-5 min-h-[64px]"
        style={{ borderBottom: `2px solid ${GREEN}`, background: '#1b1b1b' }}
      >
        <Link to={registerLink} className="inline-flex items-center gap-1.5 text-sm transition-colors" style={{ color: '#d8d8d8' }}>
          <ArrowLeft className="w-4 h-4" /> {t('referralInfo.back')}
        </Link>
        <button
          onClick={toggleLang}
          className="text-xs font-bold px-3.5 py-1.5 rounded-full"
          style={{ border: `1.5px solid ${GREEN}`, color: GREEN, background: 'transparent' }}
        >
          {lang.toUpperCase()}
        </button>
      </header>

      <main
        className="flex-1 px-5 pt-10 pb-12"
        style={{ background: 'radial-gradient(ellipse at top,#26331a 0,#1b1b1b 55%)' }}
      >
        <div className="w-full max-w-lg mx-auto">
          <div className="text-center mb-8">
            <img src={SITE_LOGO} alt="OSI Logistics" className="h-[56px] w-auto object-contain mx-auto mb-6" />
            <h1 className="text-3xl leading-tight text-balance" style={{ fontFamily: HEAD, color: GREEN }}>
              {t('referralInfo.title')}
            </h1>
            <p className="text-[17px] mt-3 leading-snug" style={{ color: '#d8d8d8' }}>{t('referralInfo.subtitle')}</p>
          </div>

          <div className="space-y-4 mb-6">
            <Step n={1} icon={Share2} title={t('referralInfo.step1Title')} text={t('referralInfo.step1Text')} />
            <Step n={2} icon={UserPlus} title={t('referralInfo.step2Title')} text={t('referralInfo.step2Text')} />
            <Step n={3} icon={TrendingDown} title={t('referralInfo.step3Title')} text={t('referralInfo.step3Text')} />
            <Step n={4} icon={Gift} title={t('referralInfo.step4Title')} text={t('referralInfo.step4Text')} />
          </div>

          <div
            className="rounded-2xl px-5 py-4 mb-7"
            style={{ background: 'rgba(151,240,72,.08)', border: '1px solid rgba(151,240,72,.35)' }}
          >
            <p className="text-sm leading-snug" style={{ color: '#d8f5b8' }}>{t('referralInfo.example')}</p>
          </div>

          <Link
            to={registerLink}
            className="w-full font-bold py-4 rounded-full transition-colors flex items-center justify-center text-base hover:bg-white"
            style={{ background: GREEN, color: '#111', fontFamily: BODY, boxShadow: '0 10px 30px rgba(151,240,72,.18)' }}
          >
            {t('referralInfo.registerBtn')}
          </Link>
        </div>
      </main>
    </div>
  );
}
