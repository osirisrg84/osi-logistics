import { useState } from 'react';

// OSI Fleet Radio X7 — radio walkie-talkie en SVG: cuerpo de fibra de carbono con borde de luz neon, perillas mecanizadas con
// arco de LED, bocina hexagonal, pantalla OLED con espectro de audio en vivo, boton PTT con relieve y anillos de transmision.
// Todo es vectorial (nitido en cualquier pantalla) y se anima solo con CSS (sin librerias). Cambia de cian a rojo al transmitir.

export interface OsiRadioLabels {
  fleetRadio: string;
  secureChannel: string;
  pushToTalk: string;
  transmitting: string;
  tapToRecord: string;
  tapToStop: string;
}

const CSS = `
@keyframes osiRBar { 0%{transform:scaleY(.18)} 100%{transform:scaleY(1)} }
@keyframes osiRIdle { 0%,100%{transform:scaleY(.12)} 50%{transform:scaleY(.3)} }
@keyframes osiRRing { 0%{transform:scale(.35);opacity:.85} 100%{transform:scale(1.15);opacity:0} }
@keyframes osiRAmb { 0%,100%{opacity:.55} 50%{opacity:1} }
@keyframes osiRLed { 0%,100%{opacity:.75} 50%{opacity:1} }
@keyframes osiRSheen { 0%{transform:translateX(-90px) skewX(-20deg)} 30%,100%{transform:translateX(210px) skewX(-20deg)} }
@keyframes osiRScan { 0%{transform:translateY(-4px)} 100%{transform:translateY(62px)} }
@keyframes osiRBlink { 0%,49%{opacity:1} 50%,100%{opacity:.15} }
.osiR-bar{transform-box:fill-box;transform-origin:50% 100%}
.osiR-ring{transform-box:fill-box;transform-origin:50% 50%}
.osiR-sheen{animation:osiRSheen 5.5s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){ .osiR-anim,.osiR-bar,.osiR-ring,.osiR-sheen{animation:none!important} }
`;

const BARS = 22;
const pad2 = (n: number) => String(n).padStart(2, '0');

export default function OsiRadio({ isRecording, seconds, onToggle, labels }: { isRecording: boolean; seconds: number; onToggle: () => void; labels: OsiRadioLabels }) {
  const [pressed, setPressed] = useState(false);
  const tx = isRecording;
  const acc = tx ? '#ff4d4d' : '#38bdf8'; // color de estado (cian en espera, rojo al transmitir)
  const accSoft = tx ? 'rgba(255,77,77,' : 'rgba(56,189,248,';
  const ptt1 = tx ? '#ff6b6b' : '#ffa24d';
  const ptt2 = tx ? '#b91c1c' : '#c2570c';
  const timer = `${Math.floor(seconds / 60)}:${pad2(seconds % 60)}`;
  const knobDots = Array.from({ length: 11 }, (_, i) => ({ a: -135 + (270 * i) / 10, on: i < 7 }));

  return (
    <div style={{ position: 'relative', width: 'min(250px, 66vw)', margin: '0 auto', userSelect: 'none' }}>
      <style>{CSS}</style>
      <svg viewBox="0 0 240 412" width="100%" role="img" aria-label="OSI Fleet Radio" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <radialGradient id="osiRamb" cx="50%" cy="46%" r="55%">
            <stop offset="0" stopColor={acc} stopOpacity=".28" /><stop offset=".55" stopColor={acc} stopOpacity=".08" /><stop offset="1" stopColor={acc} stopOpacity="0" />
          </radialGradient>
          <pattern id="osiRcarb" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#090d17" /><rect width="3" height="3" fill="#10162a" /><rect x="3" y="3" width="3" height="3" fill="#10162a" />
          </pattern>
          <linearGradient id="osiRbody" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".10" /><stop offset=".35" stopColor="#fff" stopOpacity=".02" /><stop offset="1" stopColor="#000" stopOpacity=".55" />
          </linearGradient>
          <linearGradient id="osiRedge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={acc} stopOpacity=".95" /><stop offset=".5" stopColor="#8b5cf6" stopOpacity=".5" /><stop offset="1" stopColor={acc} stopOpacity=".85" />
          </linearGradient>
          <linearGradient id="osiRchrome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f4f7fb" /><stop offset=".45" stopColor="#aab4c3" /><stop offset=".55" stopColor="#d9e0ea" /><stop offset="1" stopColor="#5b6676" />
          </linearGradient>
          <linearGradient id="osiRant" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#05080f" /><stop offset=".45" stopColor="#2a3446" /><stop offset="1" stopColor="#05080f" />
          </linearGradient>
          <radialGradient id="osiRknob" cx="35%" cy="28%" r="80%">
            <stop offset="0" stopColor="#4a5568" /><stop offset=".5" stopColor="#1b2230" /><stop offset="1" stopColor="#06080e" />
          </radialGradient>
          <linearGradient id="osiRknobRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e9eef5" /><stop offset=".5" stopColor="#8794a6" /><stop offset="1" stopColor="#2b3442" />
          </linearGradient>
          <pattern id="osiRhex" width="5" height="4.4" patternUnits="userSpaceOnUse">
            <rect width="5" height="4.4" fill="#04070d" /><circle cx="1.25" cy="1.1" r="1.05" fill="#22385c" /><circle cx="3.75" cy="3.3" r="1.05" fill="#22385c" />
          </pattern>
          <linearGradient id="osiRlcd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#031017" /><stop offset="1" stopColor="#010609" /></linearGradient>
          <linearGradient id="osiRglass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".22" /><stop offset=".4" stopColor="#fff" stopOpacity="0" /></linearGradient>
          <linearGradient id="osiRptt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={ptt1} /><stop offset=".55" stopColor={tx ? '#ef4444' : '#f97316'} /><stop offset="1" stopColor={ptt2} /></linearGradient>
          <pattern id="osiRgrip" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(135)"><rect width="6" height="6" fill="none" /><rect width="2" height="6" fill="#000" fillOpacity=".12" /></pattern>
          <clipPath id="osiRlcdClip"><rect x="34" y="250" width="172" height="62" rx="10" /></clipPath>
          <filter id="osiRglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
          <filter id="osiRdrop" x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity=".8" /></filter>
        </defs>

        {/* brillo ambiental y sombra de suelo */}
        <circle cx="120" cy="200" r="170" fill="url(#osiRamb)" className="osiR-anim" style={{ animation: 'osiRAmb 3.4s ease-in-out infinite' }} />
        <ellipse cx="120" cy="406" rx="86" ry="7" fill="#000" opacity=".55" filter="url(#osiRglow)" />

        {/* antena con segmentos y punta luminosa */}
        <g transform="rotate(6 190 56)">
          <rect x="184" y="6" width="12" height="54" rx="5" fill="url(#osiRant)" />
          {[14, 22, 30, 38, 46].map((y) => <rect key={y} x="184" y={y} width="12" height="1.4" fill="#fff" opacity=".12" />)}
          <circle cx="190" cy="6" r="5.5" fill={acc} opacity=".55" filter="url(#osiRglow)" />
          <circle cx="190" cy="6" r="3.6" fill="#fff" opacity=".9" />
        </g>

        {/* barra lateral (PTT lateral) */}
        <rect x="6" y="122" width="10" height="64" rx="4" fill={tx ? '#ef4444' : '#f97316'} />
        <rect x="6" y="122" width="10" height="64" rx="4" fill={tx ? '#ef4444' : '#f97316'} filter="url(#osiRglow)" opacity=".7" />
        {[142, 152, 162].map((y) => <rect key={y} x="9" y={y} width="4" height="1.6" rx=".8" fill="#fff" opacity=".4" />)}

        {/* cuerpo */}
        <g filter="url(#osiRdrop)">
          <rect x="14" y="52" width="212" height="346" rx="30" fill="url(#osiRcarb)" />
          <rect x="14" y="52" width="212" height="346" rx="30" fill="url(#osiRbody)" />
        </g>
        <rect x="14" y="52" width="212" height="346" rx="30" fill="none" stroke="url(#osiRedge)" strokeWidth="1.6" />
        <rect x="14" y="52" width="212" height="346" rx="30" fill="none" stroke={acc} strokeOpacity=".35" strokeWidth="5" filter="url(#osiRglow)" />
        <rect x="16" y="54" width="208" height="342" rx="28" fill="none" stroke="#fff" strokeOpacity=".10" />

        {/* franja cromada superior con tornillos y marca */}
        <rect x="40" y="62" width="160" height="15" rx="7.5" fill="url(#osiRchrome)" />
        <circle cx="52" cy="69.5" r="3" fill="#4b5565" /><path d="M50.6 69.5h2.8M52 68.1v2.8" stroke="#1b2230" strokeWidth=".6" />
        <circle cx="188" cy="69.5" r="3" fill="#4b5565" /><path d="M186.6 69.5h2.8M188 68.1v2.8" stroke="#1b2230" strokeWidth=".6" />
        <text x="120" y="72.6" textAnchor="middle" fontSize="6.6" fontWeight="800" letterSpacing="2.6" fill="#2f3a4b" fontFamily="Inter,Arial,sans-serif">OSI · FLEET X7</text>

        {/* LED de estado */}
        <circle cx="120" cy="104" r="9" fill={tx ? '#ff3b3b' : '#22e07a'} opacity=".35" filter="url(#osiRglow)" />
        <circle cx="120" cy="104" r="4.6" fill={tx ? '#ff5a5a' : '#34f08d'} className="osiR-anim" style={{ animation: tx ? 'osiRBlink .9s steps(1) infinite' : 'osiRLed 2.6s ease-in-out infinite' }} />
        <circle cx="120" cy="104" r="1.6" fill="#fff" opacity=".85" />
        <text x="120" y="122" textAnchor="middle" fontSize="5.4" fontWeight="800" letterSpacing="1.8" fill="#8fa3bf" opacity=".6" fontFamily="Inter,Arial,sans-serif">{tx ? 'TX' : 'RX'}</text>

        {/* perillas VOL (izq) y CH (der) */}
        {[{ x: 58, rot: -40, label: 'VOL' }, { x: 182, rot: 35, label: 'CH' }].map((k) => (
          <g key={k.label}>
            {knobDots.map((d, i) => {
              const r = 28, rad = ((d.a - 90) * Math.PI) / 180;
              return <circle key={i} cx={k.x + r * Math.cos(rad)} cy={108 + r * Math.sin(rad)} r="1.5" fill={d.on ? acc : '#1c2536'} opacity={d.on ? 0.95 : 1} />;
            })}
            <circle cx={k.x} cy="108" r="22" fill="url(#osiRknobRing)" />
            <circle cx={k.x} cy="108" r="20" fill="none" stroke="#0b0f18" strokeWidth="3" strokeDasharray="1.2 1.9" opacity=".75" />
            <circle cx={k.x} cy="108" r="16" fill="url(#osiRknob)" />
            <circle cx={k.x} cy="108" r="16" fill="none" stroke="#fff" strokeOpacity=".16" />
            <g transform={`rotate(${k.rot} ${k.x} 108)`}><rect x={k.x - 1.4} y="94.5" width="2.8" height="8" rx="1.4" fill={acc} /><rect x={k.x - 1.4} y="94.5" width="2.8" height="8" rx="1.4" fill={acc} filter="url(#osiRglow)" /></g>
            <text x={k.x} y="146" textAnchor="middle" fontSize="6" fontWeight="800" letterSpacing="1.8" fill="#8fa3bf" opacity=".6" fontFamily="Inter,Arial,sans-serif">{k.label}</text>
          </g>
        ))}

        {/* bocina hexagonal con anillos de transmision */}
        <circle cx="120" cy="200" r="48" fill="url(#osiRchrome)" opacity=".85" />
        <circle cx="120" cy="200" r="45" fill="#03060b" />
        <circle cx="120" cy="200" r="42" fill="url(#osiRhex)" />
        <circle cx="120" cy="200" r="42" fill={acc} opacity={tx ? 0.22 : 0.07} />
        <circle cx="120" cy="200" r="42" fill="none" stroke={acc} strokeOpacity={tx ? 0.9 : 0.35} strokeWidth="1.2" />
        {tx && [0, 1, 2].map((i) => (
          <circle key={i} cx="120" cy="200" r="42" fill="none" stroke="#ff6b6b" strokeWidth="1.6" className="osiR-ring" style={{ animation: `osiRRing 1.5s ease-out ${i * 0.45}s infinite` }} />
        ))}
        <ellipse cx="104" cy="178" rx="20" ry="9" fill="#fff" opacity=".05" transform="rotate(-24 104 178)" />

        {/* pantalla OLED */}
        <rect x="34" y="250" width="172" height="62" rx="10" fill="url(#osiRlcd)" stroke="#16263a" strokeWidth="1.4" />
        <g clipPath="url(#osiRlcdClip)">
          <rect x="34" y="250" width="172" height="62" fill={acc} opacity={tx ? 0.07 : 0.035} />
          {/* encabezado de la pantalla */}
          <text x="44" y="266" fontSize="11" fontWeight="800" fill={acc} fontFamily="ui-monospace,Menlo,Consolas,monospace" style={{ filter: `drop-shadow(0 0 4px ${acc})` }}>CH 01</text>
          <text x="86" y="266" fontSize="6.4" fontWeight="700" letterSpacing="1.2" fill={acc} opacity=".6" fontFamily="ui-monospace,Menlo,Consolas,monospace">FLEET</text>
          {[0, 1, 2, 3].map((i) => <rect key={i} x={162 + i * 4.6} y={266 - (3 + i * 2.2)} width="3" height={3 + i * 2.2} rx=".6" fill={i < 3 || tx ? acc : '#12303f'} opacity={i < 3 || tx ? 0.95 : 1} />)}
          <rect x="182" y="258.6" width="15" height="7.6" rx="1.6" fill="none" stroke={acc} strokeOpacity=".7" strokeWidth=".9" />
          <rect x="197.6" y="260.8" width="1.6" height="3.2" rx=".6" fill={acc} opacity=".7" />
          {[0, 1, 2, 3].map((i) => <rect key={i} x={183.6 + i * 3.2} y="260.2" width="2.2" height="4.8" fill={acc} opacity={0.9} />)}
          {/* espectro de audio */}
          {Array.from({ length: BARS }, (_, i) => {
            const h = 20 + ((i * 37) % 9) * 1.4;
            return (
              <rect key={i} className="osiR-bar osiR-anim" x={44 + i * 7.2} y={296 - h} width="4.6" height={h} rx="1" fill={acc} opacity={tx ? 0.95 : 0.45}
                style={{ animation: tx ? `osiRBar ${0.26 + (i % 7) * 0.07}s ease-in-out ${i * 0.03}s infinite alternate` : `osiRIdle ${1.8 + (i % 5) * 0.35}s ease-in-out ${i * 0.07}s infinite` }} />
            );
          })}
          <line x1="40" x2="200" y1="297.4" y2="297.4" stroke={acc} strokeOpacity=".4" strokeWidth=".8" />
          <text x="44" y="307.4" fontSize="6.4" fontWeight="700" fill={acc} opacity=".65" fontFamily="ui-monospace,Menlo,Consolas,monospace">154.310 MHz</text>
          <text x="198" y="307.4" textAnchor="end" fontSize="7" fontWeight="800" fill={tx ? '#ff7a7a' : acc} opacity={tx ? 1 : 0.65} fontFamily="ui-monospace,Menlo,Consolas,monospace" style={{ filter: tx ? 'drop-shadow(0 0 4px #ff4d4d)' : undefined }}>{tx ? `TX ${timer}` : 'STANDBY'}</text>
          {/* lineas de barrido y brillo del cristal */}
          <rect x="34" y="250" width="172" height="62" fill="url(#osiRglass)" />
          <rect x="34" y="248" width="172" height="3" fill={acc} opacity=".25" className="osiR-anim" style={{ animation: 'osiRScan 4.5s linear infinite' }} />
        </g>
        <rect x="34" y="250" width="172" height="62" rx="10" fill="none" stroke="#fff" strokeOpacity=".07" />

        {/* boton PTT */}
        <g transform={pressed ? 'translate(0 1.5)' : undefined}>
          <rect x="30" y="322" width="180" height="54" rx="16" fill="#03060c" stroke="#fff" strokeOpacity=".05" />
          <rect x="36" y="328" width="168" height="42" rx="12" fill={tx ? '#ef4444' : '#f97316'} opacity=".55" filter="url(#osiRglow)" />
          <rect x="36" y="328" width="168" height="42" rx="12" fill="url(#osiRptt)" stroke="#000" strokeOpacity=".35" />
          <rect x="36" y="328" width="168" height="42" rx="12" fill="url(#osiRgrip)" />
          <rect x="36" y="328" width="168" height="19" rx="12" fill="#fff" opacity=".22" />
          <rect x="36" y="328" width="60" height="42" rx="12" fill="none" />
          <g className="osiR-sheen" style={{ pointerEvents: 'none', opacity: tx ? 0 : 1 }}><rect x="36" y="328" width="26" height="42" fill="#fff" opacity=".25" /></g>
          {[0, 1, 2, 3].map((i) => <rect key={`l${i}`} x="46" y={337 + i * 7} width="3" height="4.4" rx="1.4" fill="#fff" opacity=".4" />)}
          {[0, 1, 2, 3].map((i) => <rect key={`r${i}`} x="191" y={337 + i * 7} width="3" height="4.4" rx="1.4" fill="#fff" opacity=".4" />)}
          <circle cx="120" cy="338" r="2.6" fill="#fff" opacity={tx ? 1 : 0.75} className="osiR-anim" style={{ animation: tx ? 'osiRBlink .8s steps(1) infinite' : undefined }} />
          <text x="120" y="356" textAnchor="middle" fontSize="15" fontWeight="900" letterSpacing="5" fill="#fff" fillOpacity=".96" fontFamily="'Arial Black',Arial,sans-serif" style={{ textShadow: '0 2px 5px rgba(0,0,0,.6)' }}>PTT</text>
          <text x="120" y="366" textAnchor="middle" fontSize="5.2" fontWeight="800" letterSpacing="1.6" fill="#fff" fillOpacity=".7" fontFamily="Inter,Arial,sans-serif">{(tx ? labels.transmitting : labels.pushToTalk).toUpperCase()}</text>
        </g>
        <text x="120" y="390" textAnchor="middle" fontSize="6.6" fontWeight="800" letterSpacing="1.6" fill={tx ? '#ff7a7a' : '#fdba74'} opacity={tx ? 1 : 0.8} fontFamily="Inter,Arial,sans-serif" className="osiR-anim" style={{ animation: tx ? 'osiRBlink 1.1s steps(1) infinite' : undefined }}>{(tx ? labels.tapToStop : labels.tapToRecord).toUpperCase()}</text>
      </svg>

      {/* zona tactil del PTT (accesible por teclado) */}
      <button
        type="button"
        onClick={onToggle}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        aria-label={tx ? labels.tapToStop : labels.tapToRecord}
        aria-pressed={tx}
        className="touch-none"
        style={{ position: 'absolute', left: '12.5%', top: '78.2%', width: '75%', height: '13.6%', borderRadius: 14, background: 'transparent', border: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
      />
      <p style={{ margin: '6px 0 0', textAlign: 'center', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#64748b' }}>{labels.secureChannel}</p>
    </div>
  );
}

