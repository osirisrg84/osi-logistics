import { format as dfFormat, formatDistanceToNow as dfDistance, type FormatOptions, type FormatDistanceToNowOptions } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import i18n from '../i18n';

// Envoltorios de date-fns que usan el idioma activo de la app (es/en) para nombres de dias, meses y "hace X".
const loc = () => (i18n.language?.startsWith('en') ? enUS : es);

export function format(date: Date | number | string, pattern: string, options?: FormatOptions) {
  return dfFormat(date, pattern, { locale: loc(), ...options });
}

export function formatDistanceToNow(date: Date | number | string, options?: FormatDistanceToNowOptions) {
  return dfDistance(date, { locale: loc(), ...options });
}
