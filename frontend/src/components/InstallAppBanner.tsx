import { useState } from 'react';
import { Download, X, Share, MoreVertical } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

interface InstallAppBannerProps {
  dismissKey: string;
  variant?: 'light' | 'dark';
}

export default function InstallAppBanner({ dismissKey, variant = 'light' }: InstallAppBannerProps) {
  const { canInstall, promptInstall, showManualFallback, needsManualInstall, isIOS, isDesktop } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissKey) === '1');

  const visible = canInstall || showManualFallback || needsManualInstall;
  if (!visible || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  const isDark = variant === 'dark';

  const base = isDark
    ? 'mb-3 rounded-2xl px-4 py-3.5 bg-white/6 border border-white/10 flex items-start gap-3'
    : 'mb-3 card flex items-start gap-3';

  const iconBg   = isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-orange-100 text-orange-600';
  const title    = isDark ? 'text-white' : 'text-gray-900 dark:text-white';
  const body     = isDark ? 'text-slate-300' : 'text-gray-500 dark:text-slate-400';
  const closeBtn = isDark ? 'text-slate-400 hover:bg-white/10' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700';

  // Native install available — show a direct install button
  if (canInstall) {
    return (
      <div className={base}>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Download className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${title}`}>Instalar app</p>
          <p className={`text-xs mt-0.5 ${body}`}>Agrega OSI Logistics a tu pantalla de inicio.</p>
          <button
            onClick={async () => { const ok = await promptInstall(); if (ok) dismiss(); }}
            className={`mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${isDark ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
          >
            Instalar ahora
          </button>
        </div>
        <button onClick={dismiss} className={`p-1 rounded flex-shrink-0 ${closeBtn}`} title="Descartar">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Chrome hasn't fired beforeinstallprompt yet — show manual guide
  const instructions = isIOS
    ? <p className={`text-xs mt-0.5 ${body}`}>Toca <Share className="w-3 h-3 inline -mt-0.5" /> Compartir y elige "Agregar a inicio".</p>
    : isDesktop
      ? <p className={`text-xs mt-0.5 ${body}`}>Haz clic en el ícono <strong>⊕</strong> de la barra de dirección de Chrome para instalar.</p>
      : <p className={`text-xs mt-0.5 ${body}`}>Toca el menú <MoreVertical className="w-3 h-3 inline -mt-0.5" /> del navegador y elige "Instalar" o "Agregar a pantalla de inicio".</p>;

  return (
    <div className={base}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Download className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${title}`}>Instalar app</p>
        {instructions}
      </div>
      <button onClick={dismiss} className={`p-1 rounded flex-shrink-0 ${closeBtn}`} title="Descartar">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
