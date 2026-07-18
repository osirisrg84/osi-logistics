import { Download } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

interface InstallAppButtonProps {
  className?: string;
  iconClassName?: string;
  /** Render nothing but the icon (for icon-only toolbars) vs. icon + label. */
  variant?: 'icon' | 'labeled';
}

export default function InstallAppButton({
  className = '',
  iconClassName = 'w-4 h-4',
  variant = 'icon',
}: InstallAppButtonProps) {
  const { canInstall, promptInstall } = useInstallPrompt();

  if (!canInstall) return null;

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
