import { useId } from 'react';

// Reloj de tablero de camion clasico: bisel metalico, esfera oscura, marcas, arco de color y aguja.
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${p1.x} ${p1.y}`;
};

interface TruckGaugeProps {
  value: number;
  max: number;
  label: string;
  valueText: string;
  minText?: string;
  maxText?: string;
  /** colores del arco: del inicio al final del recorrido */
  from?: string;
  to?: string;
  size?: number;
  onClick?: () => void;
}

export default function TruckGauge({ value, max, label, valueText, minText = '0', maxText, from = '#22c55e', to = '#f59e0b', size = 126, onClick }: TruckGaugeProps) {
  const uid = useId().replace(/:/g, '');
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 6;
  const START = 150;
  const SWEEP = 240;
  const frac = Math.min(Math.max(value / (max || 1), 0), 1);
  const needle = START + SWEEP * frac;
  const tip = polar(cx, cy, R - 14, needle);
  const tail = polar(cx, cy, 7, needle + 180);
  const b1 = polar(cx, cy, 3.4, needle + 90);
  const b2 = polar(cx, cy, 3.4, needle - 90);
  const ticks = Array.from({ length: 25 }, (_, i) => i);
  const Wrapper: 'button' | 'div' = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`flex flex-col items-center min-w-0 ${onClick ? 'active:scale-95 transition-transform' : ''}`}
      style={onClick ? { background: 'none', border: 0, padding: 0 } : undefined}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: '100%', height: 'auto', overflow: 'visible' }} role="img" aria-label={`${label}: ${valueText}`}>
        <defs>
          <linearGradient id={`bz${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e8edf5" />
            <stop offset=".45" stopColor="#7c8aa0" />
            <stop offset=".55" stopColor="#4b586d" />
            <stop offset="1" stopColor="#c9d3e2" />
          </linearGradient>
          <radialGradient id={`fc${uid}`} cx="50%" cy="42%" r="62%">
            <stop offset="0" stopColor="#16233a" />
            <stop offset="1" stopColor="#060a14" />
          </radialGradient>
          <linearGradient id={`ar${uid}`} gradientUnits="userSpaceOnUse" x1={cx - R} y1={cy} x2={cx + R} y2={cy}>
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
        </defs>
        {/* bisel metalico */}
        <circle cx={cx} cy={cy} r={R + 4} fill={`url(#bz${uid})`} />
        <circle cx={cx} cy={cy} r={R + 0.5} fill="#0a0f1c" />
        <circle cx={cx} cy={cy} r={R - 1.5} fill={`url(#fc${uid})`} />
        {/* recorrido de fondo y arco de valor */}
        <path d={arc(cx, cy, R - 9, START, START + SWEEP)} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="5" strokeLinecap="round" />
        {frac > 0.005 && (
          <path d={arc(cx, cy, R - 9, START, START + SWEEP * frac)} fill="none" stroke={`url(#ar${uid})`} strokeWidth="5" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${to}99)`, transition: 'all .6s ease' }} />
        )}
        {/* marcas */}
        {ticks.map((i) => {
          const major = i % 6 === 0;
          const a = polar(cx, cy, R - 16, START + (SWEEP * i) / 24);
          const b = polar(cx, cy, R - (major ? 24 : 20), START + (SWEEP * i) / 24);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={major ? '#e2e8f0' : '#64748b'} strokeWidth={major ? 1.6 : 0.9} strokeLinecap="round" />;
        })}
        {/* aguja */}
        <polygon points={`${tip.x},${tip.y} ${b1.x},${b1.y} ${tail.x},${tail.y} ${b2.x},${b2.y}`} fill="#ff5a36" style={{ filter: 'drop-shadow(0 0 3px rgba(255,90,54,.8))', transition: 'all .6s ease' }} />
        <circle cx={cx} cy={cy} r="5.2" fill="#0b1220" stroke="#cbd5e1" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r="1.8" fill="#ff5a36" />
        {/* valor digital */}
        <text x={cx} y={cy + R * 0.44} textAnchor="middle" fontSize={size * 0.15} fontWeight="800" fill="#f8fafc" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {valueText}
        </text>
        <text x={polar(cx, cy, R - 9, START).x - 1} y={polar(cx, cy, R, START).y + 13} textAnchor="middle" fontSize={size * 0.075} fill="#64748b">{minText}</text>
        <text x={polar(cx, cy, R - 9, START + SWEEP).x + 1} y={polar(cx, cy, R, START + SWEEP).y + 13} textAnchor="middle" fontSize={size * 0.075} fill="#64748b">{maxText ?? max}</text>
      </svg>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300 text-center leading-tight -mt-2">{label}</p>
    </Wrapper>
  );
}
