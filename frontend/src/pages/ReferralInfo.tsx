import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Languages, Share2, UserPlus, TrendingDown, Gift } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import osiLogo from '../assets/osi-logo.jpeg';

function Step({ icon: Icon, title, text, color }: { icon: any; title: string; text: string; color: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm font-bold text-white mb-0.5">{title}</p>
        <p className="text-sm text-slate-400 leading-snug">{text}</p>
      </div>
    </div>
  );
}

export default function ReferralInfo() {
  const { t } = useTranslation();
  const { lang, toggle: toggleLang } = useLanguage();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const registerLink = ref ? `/driver/register?ref=${ref}` : '/driver/register';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-start px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <Link to={registerLink} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> {t('referralInfo.back')}
          </Link>
          <button onClick={toggleLang} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors">
            <Languages className="w-4 h-4 hidden sm:block" /> {lang.toUpperCase()}
          </button>
        </div>

        <div className="text-center mb-7">
          <img src={osiLogo} alt="OSI Logistics" className="h-[60px] w-auto object-contain mx-auto mb-4 rounded-xl shadow-lg shadow-black/30" />
          <h1 className="text-2xl font-bold text-white">{t('referralInfo.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{t('referralInfo.subtitle')}</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-5 mb-6">
          <Step
            icon={Share2}
            color="bg-blue-500/15 text-blue-400"
            title={t('referralInfo.step1Title')}
            text={t('referralInfo.step1Text')}
          />
          <Step
            icon={UserPlus}
            color="bg-cyan-500/15 text-cyan-400"
            title={t('referralInfo.step2Title')}
            text={t('referralInfo.step2Text')}
          />
          <Step
            icon={TrendingDown}
            color="bg-emerald-500/15 text-emerald-400"
            title={t('referralInfo.step3Title')}
            text={t('referralInfo.step3Text')}
          />
          <Step
            icon={Gift}
            color="bg-amber-500/15 text-amber-400"
            title={t('referralInfo.step4Title')}
            text={t('referralInfo.step4Text')}
          />
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3.5 mb-6">
          <p className="text-xs text-emerald-300 leading-snug">{t('referralInfo.example')}</p>
        </div>

        <Link
          to={registerLink}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2 text-base shadow-xl shadow-blue-500/20"
        >
          {t('referralInfo.registerBtn')}
        </Link>
      </div>
    </div>
  );
}
