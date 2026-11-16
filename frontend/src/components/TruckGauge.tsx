import { useId } from 'react';

// Reloj de tablero de camion clasico (estilo Peterbilt/Kenworth): bisel cromado grueso,
// esfera negra con numeros, marcas blancas, zona de color, aguja cónica y vidrio con reflejo.
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
  /** colores de la franja del reloj: del inicio al final del recorrido */
  from?: string;
  to?: string;
  size?: number;
  onClick?: () => void;
  /** color del numero en la ventana digital (por defecto ambar) */
  valueColor?: string;
  /** color de los numeros de los extremos (por defecto gris claro) */
  edgeColor?: string;
}

export default function TruckGauge({ value, max, label, valueText, minText = '0', maxText, from = '#22c55e', to = '#f59e0b', size = 126, onClick, valueColor = '#fbbf24', edgeColor = '#e2e8f0' }: TruckGaugeProps) {
  const uid = useId().replace(/:/g, '');
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 3; // radio exterior del bisel
  const FACE = R - 9; // radio de la esfera
  const START = 135;
  const SWEEP = 270;
  const frac = Math.min(Math.max(value / (max || 1), 0), 1);
  const needle = START + SWEEP * frac;
  const tip = polar(cx, cy, FACE - 6, needle);
  const tail = polar(cx, cy, 11, needle + 180);
  const b1 = polar(cx, cy, 3.6, needle + 90);
  const b2 = polar(cx, cy, 3.6, needle - 90);
  const minor = Array.from({ length: 41 }, (_, i) => i); // 40 intervalos
  const Wrapper: 'button' | 'div' = onClick ? 'button' : 'div';
  const fs = size * 0.072;
  return (
    <Wrapper
      onClick={onClick}
      className={`flex flex-col items-center min-w-0 ${onClick ? 'active:scale-95 transition-transform' : ''}`}
      style={onClick ? { background: 'none', border: 0, padding: 0 } : undefined}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: '100%', height: 'auto', overflow: 'visible', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.55))' }} role="img" aria-label={`${label}: ${valueText}`}>
        <defs>
          {/* cromo del bisel: brillos alternados como metal pulido */}
          <linearGradient id={`bz${uid}`} x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".22" stopColor="#9aa6b8" />
            <stop offset=".5" stopColor="#3a4455" />
            <stop offset=".72" stopColor="#c7d0de" />
            <stop offset="1" stopColor="#5b667a" />
          </linearGradient>
          <linearGradient id={`bz2${uid}`} x1="0.9" y1="0" x2="0.1" y2="1">
            <stop offset="0" stopColor="#2a3342" />
            <stop offset=".5" stopColor="#8d99ac" />
            <stop offset="1" stopColor="#1b2230" />
          </linearGradient>
          <radialGradient id={`fc${uid}`} cx="50%" cy="45%" r="60%">
            <stop offset="0" stopColor="#1b1d22" />
            <stop offset=".7" stopColor="#0c0d10" />
            <stop offset="1" stopColor="#050506" />
          </radialGradient>
          <linearGradient id={`ar${uid}`} gradientUnits="userSpaceOnUse" x1={cx - FACE} y1={cy} x2={cx + FACE} y2={cy}>
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
          <radialGradient id={`hub${uid}`} cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset=".45" stopColor="#8a96aa" />
            <stop offset="1" stopColor="#2a3140" />
          </radialGradient>
          <linearGradient id={`gl${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".13" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`cl${uid}`}>
            <circle cx={cx} cy={cy} r={FACE} />
          </clipPath>
        </defs>

        {/* bisel cromado grueso */}
        <circle cx={cx} cy={cy} r={R} fill={`url(#bz${uid})`} />
        <circle cx={cx} cy={cy} r={R - 3.2} fill={`url(#bz2${uid})`} />
        <circle cx={cx} cy={cy} r={FACE + 1.6} fill="#05060a" />
        {/* esfera */}
        <circle cx={cx} cy={cy} r={FACE} fill={`url(#fc${uid})`} />

        {/* franja de color exterior (zona del reloj) */}
        <path d={arc(cx, cy, FACE - 4, START, START + SWEEP)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" strokeLinecap="butt" />
        <path d={arc(cx, cy, FACE - 4, START, START + SWEEP * Math.max(frac, 0.0001))} fill="none" stroke={`url(#ar${uid})`} strokeWidth="3" strokeLinecap="butt" style={{ transition: 'all .6s ease' }} />

        {/* marcas: 40 intervalos, mayores cada 8 (0-25-50-75-100 %) */}
        {minor.map((i) => {
          const major = i % 8 === 0;
          const mid = !major && i % 4 === 0;
          const ang = START + (SWEEP * i) / 40;
          const a = polar(cx, cy, FACE - 8, ang);
          const b = polar(cx, cy, FACE - (major ? 17 : mid ? 14 : 12), ang);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={major ? '#ffffff' : mid ? '#cbd5e1' : '#7b8598'} strokeWidth={major ? 1.9 : mid ? 1.2 : 0.8} strokeLinecap="butt" />;
        })}

        {/* numeros clasicos en las marcas mayores: minimo, 50 % y maximo */}
        <text x={polar(cx, cy, FACE - 25, START).x} y={polar(cx, cy, FACE - 25, START).y + fs * 0.35} textAnchor="middle" fontSize={fs * 0.9} fontWeight="700" fill={edgeColor}>{minText}</text>
        <text x={polar(cx, cy, FACE - 25, START + SWEEP).x} y={polar(cx, cy, FACE - 25, START + SWEEP).y + fs * 0.35} textAnchor="middle" fontSize={fs * 0.9} fontWeight="700" fill={edgeColor}>{maxText ?? max}</text>

        {/* ventana digital con el valor */}
        <rect x={cx - size * 0.18} y={cy + FACE * 0.5} width={size * 0.36} height={size * 0.15} rx="3" fill="#020304" stroke="rgba(148,163,184,.35)" strokeWidth=".8" />
        <text x={cx} y={cy + FACE * 0.5 + size * 0.11} textAnchor="middle" fontSize={size * 0.1} fontWeight="800" fill={valueColor} style={{ fontVariantNumeric: 'tabular-nums', filter: `drop-shadow(0 0 2px ${valueColor}b3)`, transition: 'fill .6s ease' }}>
          {valueText}
        </text>

        {/* aguja conica con contrapeso */}
        <g style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.7))' }}>
          <polygon points={`${tip.x},${tip.y} ${b1.x},${b1.y} ${tail.x},${tail.y} ${b2.x},${b2.y}`} fill="#ff4d2e" style={{ transition: 'all .6s ease' }} />
        </g>
        <circle cx={cx} cy={cy} r="7" fill={`url(#hub${uid})`} stroke="#0b0f18" strokeWidth="1" />
        <circle cx={cx} cy={cy} r="2.2" fill="#0b0f18" />

        {/* vidrio con reflejo */}
        <g clipPath={`url(#cl${uid})`}>
          <ellipse cx={cx - FACE * 0.12} cy={cy - FACE * 0.6} rx={FACE * 0.7} ry={FACE * 0.3} fill={`url(#gl${uid})`} />
        </g>
      </svg>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300 text-center leading-tight mt-3">{label}</p>
    </Wrapper>
  );
}
