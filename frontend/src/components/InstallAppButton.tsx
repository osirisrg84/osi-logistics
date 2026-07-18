import { useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
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
  const { canInstall, promptInstall, needsManualInstall, showManualFallback, isIOS } = useInstallPrompt();
  const [showGuide, setShowGuide] = useState(false);

  // Native install prompt available — show the button directly
  if (canInstall) {
    if (variant === 'labeled') {
      return (
        <button
          onClick={promptInstall}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors ${className}`}
        >
          <Download className={iconClassName} />
          Install App
        </button>
      );
    }
    return (
      <button
        onClick={promptInstall}
        title="Install App"
        className={className || 'p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors'}
      >
        <Download className={iconClassName} />
      </button>
    );
  }

  // Manual install needed (Safari/Firefox, or Chrome cooldown after uninstall)
  if (needsManualInstall || showManualFallback) {
    const instructions = isIOS
      ? 'Toca el botón Compartir (□↑) y luego "Agregar a pantalla de inicio".'
      : 'Toca el menú ⋮ del navegador y selecciona "Instalar app" o "Agregar a pantalla de inicio".';

    return (
      <div className="relative">
        <button
          onClick={() => setShowGuide(v => !v)}
          title="Instalar app"
          className={className || 'p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors'}
        >
          <Smartphone className={iconClassName} />
        </button>

        {showGuide && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-900 dark:text-white">Instalar OSI Logistics</p>
              <button onClick={() => setShowGuide(false)}>
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{instructions}</p>
            {showManualFallback && (
              <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2">
                Si acabas de desinstalar la app, Chrome puede tardar unos minutos en mostrar el botón de instalación automático.
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}
