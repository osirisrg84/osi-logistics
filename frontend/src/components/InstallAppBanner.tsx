import { useState } from 'react';
import { Download, X, Share, MoreVertical } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

interface InstallAppBannerProps {
  /** Distinct localStorage key per portal so dismissing one doesn't hide the other. */
  dismissKey: string;
  variant?: 'light' | 'dark';
}

export default function InstallAppBanner({ dismissKey, variant = 'light' }: InstallAppBannerProps) {
  const { needsManualInstall, isIOS } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissKey) === '1');

  if (!needsManualInstall || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  const isDark = variant === 'dark';

  return (
    <div
      className={
        isDark
          ? 'rounded-2xl px-4 py-3.5 bg-white/6 border border-white/10 flex items-start gap-3'
          : 'card flex items-start gap-3'
      }
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-orange-100 text-orange-600'}`}>
        <Download className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900 dark:text-white'}`}>Instalar app</p>
        {isIOS ? (
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-300' : 'text-gray-500 dark:text-slate-400'}`}>
            Toca <Share className="w-3 h-3 inline -mt-0.5" /> Compartir y elige "Agregar a inicio".
          </p>
        ) : (
          <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-300' : 'text-gray-500 dark:text-slate-400'}`}>
            Toca el menú <MoreVertical className="w-3 h-3 inline -mt-0.5" /> del navegador y elige "Instalar" o "Agregar a pantalla de inicio".
          </p>
        )}
      </div>
      <button
        onClick={dismiss}
        className={`p-1 rounded flex-shrink-0 ${isDark ? 'text-slate-400 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
        title="Descartar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
