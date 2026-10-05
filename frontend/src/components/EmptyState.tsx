import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
}

export function EmptyState({ icon: Icon, title, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center fade-in">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-gray-400 dark:text-slate-500" />
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{title}</p>
      {hint && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
