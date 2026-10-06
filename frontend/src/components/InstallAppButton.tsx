import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, X, DownloadCloud, Monitor } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

interface InstallAppButtonProps {
  className?: string;
  iconClassName?: string;
  variant?: 'icon' | 'labeled';
}

export default function InstallAppButton({
  className = '',
  iconClassName = 'w-4 h-4',
  variant = 'icon',
}: InstallAppButtonProps) {
  const { t } = useTranslation();
  const { canInstall, promptInstall, needsManualInstall, showManualFallback, isIOS, isDesktop } = useInstallPrompt();
  const [showGuide, setShowGuide] = useState(false);

  // Native install prompt captured — show direct install button
  if (canInstall) {
    if (variant === 'labeled') {
      return (
        <button
          onClick={promptInstall}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors ${className}`}
        >
          <Download className={iconClassName} />
          {t('common.install.title')}
        </button>
      );
    }
    return (
      <button
        onClick={promptInstall}
        title={t('common.install.title')}
        className={className || 'p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors'}
      >
        <Download className={iconClassName} />
      </button>
    );
  }

  // Chrome/Edge detected but beforeinstallprompt hasn't fired yet
  if (showManualFallback) {
    if (isDesktop) {
      // On desktop: show a labeled button pointing to the address bar icon
      return (
        <div className="relative">
          <button
            onClick={() => setShowGuide(v => !v)}
            title={t('common.install.title')}
            className={className || 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors'}
          >
            <Monitor className="w-3.5 h-3.5" />
            {variant !== 'icon' && <span>{t('common.install.installBtnShort')}</span>}
          </button>

          {showGuide && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{t('common.install.guideTitle')}</p>
                <button onClick={() => setShowGuide(false)}>
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
                  <span className="text-blue-500 text-lg leading-none mt-0.5">⊕</span>
                  <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                    {t('common.install.desktopGuideBody')}
                  </p>
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {t('common.install.desktopGuideHint')}
                </p>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Mobile fallback
    const instructions = isIOS
      ? t('common.install.mobileIosInstructions')
      : t('common.install.mobileAndroidInstructions');

    return (
      <div className="relative">
        <button
          onClick={() => setShowGuide(v => !v)}
          title={t('common.install.title')}
          className={className || 'flex items-center gap-1 px-2 py-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-xs font-medium'}
        >
          <DownloadCloud className={iconClassName} />
          {variant === 'labeled' && <span>{t('common.install.installBtnShort')}</span>}
        </button>

        {showGuide && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-900 dark:text-white">{t('common.install.guideTitle')}</p>
              <button onClick={() => setShowGuide(false)}>
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{instructions}</p>
          </div>
        )}
      </div>
    );
  }

  // Safari/Firefox — no native prompt API
  if (needsManualInstall) {
    const instructions = isIOS
      ? t('common.install.mobileIosInstructions')
      : t('common.install.mobileAndroidInstructions');

    return (
      <div className="relative">
        <button
          onClick={() => setShowGuide(v => !v)}
          title={t('common.install.title')}
          className={className || 'p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors'}
        >
          <DownloadCloud className={iconClassName} />
        </button>
        {showGuide && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-900 dark:text-white">{t('common.install.guideTitle')}</p>
              <button onClick={() => setShowGuide(false)}>
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{instructions}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
