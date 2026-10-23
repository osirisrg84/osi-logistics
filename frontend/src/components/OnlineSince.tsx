import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Timer } from 'lucide-react';
import { parseServerDate } from '../utils/serverDate';

interface OnlineSinceProps {
  since: string | null | undefined;
  className?: string;
}

// "En línea hace X" para un driver 'available' sin carga aún -- se resetea
// en el backend en cuanto toma una carga (online_since vuelve a NULL), así
// que mientras haya un valor es tiempo de espera real, no solo "está online".
export function OnlineSince({ since, className = '' }: OnlineSinceProps) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => forceTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, [since]);

  if (!since) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400 ${className}`}>
      <Timer className="w-3 h-3" />
      {formatDistanceToNow(parseServerDate(since), { addSuffix: true })}
    </span>
  );
}
