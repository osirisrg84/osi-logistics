import { renderToStaticMarkup } from 'react-dom/server';
import { isColombia } from '../utils/taxId';

// Banderas como SVG propio (los emojis de bandera no se ven en Windows: salen como letras "US").
// Solo los paises que opera OSI: Estados Unidos y Colombia (dispatchers), Estados Unidos y Canada (drivers).

export type CountryCode = 'US' | 'CO' | 'CA';

export function countryCode(country?: string | null): CountryCode | null {
  const c = (country || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (isColombia(country)) return 'CO';
  if (['canada', 'ca'].includes(c)) return 'CA';
  if (['united states', 'usa', 'us', 'u.s.', 'u.s.a.', 'estados unidos', 'eeuu', 'ee.uu.'].includes(c)) return 'US';
  return null;
}

const LABEL: Record<CountryCode, string> = { US: 'United States', CO: 'Colombia', CA: 'Canada' };

export default function CountryFlag({ country, className = '' }: { country?: string | null; className?: string }) {
  const code = countryCode(country);
  if (!code) return null;
  return (
    <svg
      viewBox="0 0 20 14" width="20" height="14" role="img" aria-label={LABEL[code]}
      className={`inline-block flex-shrink-0 rounded-[2px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.25)] ${className}`}
    >
      <title>{LABEL[code]}</title>
      {code === 'US' && (
        <>
          <rect width="20" height="14" fill="#fff" />
          {[0, 2, 4, 6, 8, 10, 12].map(y => <rect key={y} y={y} width="20" height="1" fill="#B22234" />)}
          <rect width="9" height="7.5" fill="#3C3B6E" />
          {[[1.6, 1.4], [4.5, 1.4], [7.4, 1.4], [3, 3.7], [6, 3.7], [1.6, 6], [4.5, 6], [7.4, 6]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="0.55" fill="#fff" />
          ))}
        </>
      )}
      {code === 'CO' && (
        <>
          <rect width="20" height="7" fill="#FCD116" />
          <rect y="7" width="20" height="3.5" fill="#003893" />
          <rect y="10.5" width="20" height="3.5" fill="#CE1126" />
        </>
      )}
      {code === 'CA' && (
        <>
          <rect width="20" height="14" fill="#fff" />
          <rect width="5" height="14" fill="#D52B1E" />
          <rect x="15" width="5" height="14" fill="#D52B1E" />
          <path fill="#D52B1E" d="M10 2.2l.9 1.9 1.1-.4-.5 2.3 1.5-.8-.2 1.4 1.2.3-1.6 1.5.2.6-2.1-.4v3h-1v-3l-2.1.4.2-.6L6 6.9l1.2-.3-.2-1.4 1.5.8-.5-2.3 1.1.4z" />
        </>
      )}
    </svg>
  );
}

/** La bandera como texto HTML, para meterla dentro de los iconos del mapa (Leaflet no usa React). */
export function countryFlagHtml(country?: string | null): string {
  return countryCode(country) ? renderToStaticMarkup(<CountryFlag country={country} />) : '';
}
