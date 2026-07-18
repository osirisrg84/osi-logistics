import { useState } from 'react';
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
  const { canInstall, promptInstall, needsManualInstall, showManualFallback, isIOS, isDesktop } = useInstallPrompt();
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

  // Manual install needed (Safari/Firefox, or Chrome hasn't fired beforeinstallprompt yet)
  if (needsManualInstall || showManualFallback) {
    const desktopInstructions = (
      <div className="space-y-2">
        <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
          Mira la <strong>barra de dirección</strong> de tu navegador — Chrome muestra un ícono{' '}
          <span className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">⊕</span> o{' '}
          <span className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">↓</span>{' '}
          a la derecha para instalar la app.
        </p>
        <p className="text-xs text-gray-400 dark:text-slate-500 leading-relaxed">
          También puedes ir a <span className="font-mono text-[11px] bg-gray-100 dark:bg-slate-700 px-1 rounded">⋮ → Instalar OSI Logistics</span>
        </p>
      </div>
    );

    const mobileInstructions = isIOS
      ? 'Toca el botón Compartir (□↑) y luego "Agregar a pantalla de inicio".'
      : 'Toca el menú ⋮ del navegador y selecciona "Instalar app" o "Agregar a pantalla de inicio".';

    return (
      <div className="relative">
        <button
          onClick={() => setShowGuide(v => !v)}
          title="Instalar app"
          className={className || 'flex items-center gap-1 px-2 py-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-xs font-medium'}
        >
          {isDesktop ? <Monitor className={iconClassName} /> : <DownloadCloud className={iconClassName} />}
          {variant === 'labeled' && <span>Install</span>}
        </button>

        {showGuide && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 z-50 p-4">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-bold text-gray-900 dark:text-white">Instalar OSI Logistics</p>
              <button onClick={() => setShowGuide(false)}>
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
            {isDesktop ? desktopInstructions : (
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{mobileInstructions}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}
