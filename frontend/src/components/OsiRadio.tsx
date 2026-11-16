import { useState } from 'react';

// OSI Fleet Radio X7 — walkie-talkie de mano (radio de comunicacion bidireccional, como los de flota: "10-4").
// SVG vectorial: cuerpo de goma con antena helicoidal unida al cuerpo, perillas VOL/CH y boton de emergencia arriba,
// palanca PTT lateral, rejilla de bocina con ranuras, pantalla con espectro, teclas de funcion, microfono y tornillos.
// Cambia de cian a rojo al transmitir. Todo se anima solo con CSS.

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
@keyframes osiRSlot { 0%,100%{opacity:.25} 50%{opacity:1} }
@keyframes osiRAmb { 0%,100%{opacity:.5} 50%{opacity:.95} }
@keyframes osiRLed { 0%,100%{opacity:.75} 50%{opacity:1} }
@keyframes osiRSheen { 0%{transform:translateX(-50px) skewX(-20deg)} 32%,100%{transform:translateX(190px) skewX(-20deg)} }
@keyframes osiRScan { 0%{transform:translateY(-4px)} 100%{transform:translateY(60px)} }
@keyframes osiRBlink { 0%,49%{opacity:1} 50%,100%{opacity:.15} }
.osiR-bar{transform-box:fill-box;transform-origin:50% 100%}
.osiR-sheen{animation:osiRSheen 5.5s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){ .osiR-anim,.osiR-bar,.osiR-sheen{animation:none!important} }
`;

const BARS = 20;
const pad2 = (n: number) => String(n).padStart(2, '0');

export default function OsiRadio({ isRecording, seconds, onToggle, labels }: { isRecording: boolean; seconds: number; onToggle: () => void; labels: OsiRadioLabels }) {
  const [pressed, setPressed] = useState(false);
  const tx = isRecording;
  const acc = tx ? '#ff4d4d' : '#38bdf8'; // color de estado (cian en espera, rojo al transmitir)
  const ptt1 = tx ? '#ff6b6b' : '#ffa24d';
  const ptt2 = tx ? '#b91c1c' : '#c2570c';
  const hot = tx ? '#ef4444' : '#f97316';
  const timer = `${Math.floor(seconds / 60)}:${pad2(seconds % 60)}`;
  const ribs = (x: number, y: number, w: number, n: number, gap: number, op = 0.22) =>
    Array.from({ length: n }, (_, i) => <rect key={i} x={x} y={y + i * gap} width={w} height="1.2" rx=".6" fill="#fff" opacity={op} />);
  const press = pressed ? 'translate(0 1.6)' : undefined;

  return (
    <div style={{ position: 'relative', width: 'min(250px, 66vw)', margin: '0 auto', userSelect: 'none' }}>
      <style>{CSS}</style>
      <svg viewBox="0 -14 240 444" width="100%" role="img" aria-label="OSI Fleet Radio" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <radialGradient id="osiRamb" cx="50%" cy="48%" r="55%"><stop offset="0" stopColor={acc} stopOpacity=".26" /><stop offset=".55" stopColor={acc} stopOpacity=".07" /><stop offset="1" stopColor={acc} stopOpacity="0" /></radialGradient>
          <linearGradient id="osiRbody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2a3342" /><stop offset=".45" stopColor="#121824" /><stop offset="1" stopColor="#05070c" /></linearGradient>
          <pattern id="osiRtex" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="none" /><circle cx="1" cy="1" r=".55" fill="#fff" opacity=".05" /><circle cx="3" cy="3" r=".55" fill="#000" opacity=".25" /></pattern>
          <linearGradient id="osiRedge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={acc} stopOpacity=".9" /><stop offset=".5" stopColor="#7c8cff" stopOpacity=".35" /><stop offset="1" stopColor={acc} stopOpacity=".75" /></linearGradient>
          <linearGradient id="osiRface" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d1320" /><stop offset="1" stopColor="#070a12" /></linearGradient>
          <linearGradient id="osiRchrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4f7fb" /><stop offset=".45" stopColor="#9fa9b9" /><stop offset=".55" stopColor="#d9e0ea" /><stop offset="1" stopColor="#566071" /></linearGradient>
          <linearGradient id="osiRrubber" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#05070c" /><stop offset=".4" stopColor="#2b3445" /><stop offset=".6" stopColor="#1c2433" /><stop offset="1" stopColor="#04060a" /></linearGradient>
          <linearGradient id="osiRant" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#03050a" /><stop offset=".35" stopColor="#2e394d" /><stop offset=".55" stopColor="#151c2a" /><stop offset="1" stopColor="#020308" /></linearGradient>
          <radialGradient id="osiRknob" cx="35%" cy="25%" r="85%"><stop offset="0" stopColor="#4d596c" /><stop offset=".5" stopColor="#1c2433" /><stop offset="1" stopColor="#06080e" /></radialGradient>
          <linearGradient id="osiRlcd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#031017" /><stop offset="1" stopColor="#010609" /></linearGradient>
          <linearGradient id="osiRglass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".2" /><stop offset=".4" stopColor="#fff" stopOpacity="0" /></linearGradient>
          <linearGradient id="osiRptt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={ptt1} /><stop offset=".55" stopColor={hot} /><stop offset="1" stopColor={ptt2} /></linearGradient>
          <linearGradient id="osiRkey" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2b3548" /><stop offset="1" stopColor="#0f1520" /></linearGradient>
          <pattern id="osiRgrip" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(135)"><rect width="2" height="6" fill="#000" fillOpacity=".13" /></pattern>
          <pattern id="osiRmic" width="3.4" height="3.4" patternUnits="userSpaceOnUse"><rect width="3.4" height="3.4" fill="#04070d" /><circle cx="1.7" cy="1.7" r=".85" fill="#2a3a58" /></pattern>
          <clipPath id="osiRlcdClip"><rect x="44" y="166" width="152" height="56" rx="7" /></clipPath>
          <clipPath id="osiRbtnClip"><rect x="40" y="272" width="160" height="50" rx="14" /></clipPath>
          <filter id="osiRglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
          <filter id="osiRdrop" x="-20%" y="-10%" width="140%" height="130%"><feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#000" floodOpacity=".85" /></filter>
        </defs>

        {/* brillo ambiental y sombra de suelo */}
        <circle cx="120" cy="210" r="175" fill="url(#osiRamb)" className="osiR-anim" style={{ animation: 'osiRAmb 3.4s ease-in-out infinite' }} />
        <ellipse cx="120" cy="426" rx="88" ry="7" fill="#000" opacity=".6" filter="url(#osiRglow)" />

        {/* ANTENA de goma, unida al cuerpo por una base reforzada (sobre el hombro derecho) */}
        <g transform="rotate(4 187 52)">
          <path d="M178.5 52 L180.6 -3 Q187 -14 193.4 -3 L195.5 52 Z" fill="url(#osiRant)" />
          {Array.from({ length: 11 }, (_, i) => <rect key={i} x={180.4 + i * 0.15} y={2 + i * 4.5} width={13 - i * 0.3} height="1.1" fill="#fff" opacity={0.14} />)}
          <rect x="182.4" y="-6" width="2" height="56" fill="#fff" opacity=".14" />
          <rect x="177" y="44" width="20" height="10" rx="3" fill="url(#osiRrubber)" stroke="#000" strokeOpacity=".5" />
          <rect x="175" y="50" width="24" height="6" rx="2" fill="url(#osiRchrome)" />
        </g>

        {/* perillas VOL / CH y boton de emergencia sobre el hombro */}
        {[{ x: 34, l: 'VOL' }, { x: 80, l: 'CH' }].map((k) => (
          <g key={k.l}>
            <rect x={k.x} y="26" width="40" height="30" rx="6" fill="url(#osiRknob)" stroke="#000" strokeOpacity=".55" />
            {Array.from({ length: 14 }, (_, i) => <rect key={i} x={k.x + 4 + i * 2.5} y="28" width="1" height="26" fill="#000" opacity=".35" />)}
            <rect x={k.x + 3} y="27" width="34" height="3" rx="1.5" fill="#fff" opacity=".22" />
            <rect x={k.x + 18} y="33" width="3" height="10" rx="1.5" fill={acc} />
            <rect x={k.x + 18} y="33" width="3" height="10" rx="1.5" fill={acc} filter="url(#osiRglow)" opacity=".8" />
          </g>
        ))}
        <rect x="132" y="31" width="30" height="22" rx="8" fill="#1a0d05" stroke="#000" strokeOpacity=".6" />
        <rect x="135" y="34" width="24" height="16" rx="6" fill={hot} />
        <rect x="135" y="34" width="24" height="16" rx="6" fill={hot} filter="url(#osiRglow)" opacity=".7" />
        <rect x="138" y="36" width="18" height="4" rx="2" fill="#fff" opacity=".4" />

        {/* CUERPO: goma texturizada + borde de luz */}
        <g filter="url(#osiRdrop)">
          <rect x="18" y="48" width="204" height="372" rx="30" fill="url(#osiRbody)" />
        </g>
        <rect x="18" y="48" width="204" height="372" rx="30" fill="url(#osiRtex)" />
        <rect x="18" y="48" width="204" height="372" rx="30" fill="none" stroke="url(#osiRedge)" strokeWidth="1.5" />
        <rect x="18" y="48" width="204" height="372" rx="30" fill="none" stroke={acc} strokeOpacity=".3" strokeWidth="4.5" filter="url(#osiRglow)" />
        <rect x="20" y="50" width="200" height="368" rx="28" fill="none" stroke="#fff" strokeOpacity=".09" />
        {/* estrias de agarre en los costados */}
        {ribs(21, 250, 6, 10, 8, 0.16)}{ribs(213, 250, 6, 10, 8, 0.16)}

        {/* palanca PTT LATERAL (goma estriada), AHORA POR ENCIMA del cuerpo para que se vea completa, con el mismo naranja vivo del PTT */}
        <g transform={pressed ? 'translate(2 0)' : undefined}>
          <rect x="3" y="128" width="26" height="92" rx="9" fill="url(#osiRrubber)" stroke="#000" strokeOpacity=".6" />
          <rect x="3" y="128" width="26" height="92" rx="9" fill="url(#osiRtex)" />
          <rect x="3.5" y="128.5" width="25" height="91" rx="8.5" fill="none" stroke="#fff" strokeOpacity=".16" />
          {ribs(7, 138, 14, 7, 11, 0.13)}
          <rect x="9" y="150" width="14" height="48" rx="5" fill="#2a0f03" stroke="#000" strokeOpacity=".6" />
          <rect x="10.5" y="151.5" width="11" height="45" rx="4" fill="url(#osiRptt)" />
          <rect x="10.5" y="151.5" width="11" height="45" rx="4" fill={hot} filter="url(#osiRglow)" opacity=".75" />
          <rect x="12.5" y="154" width="3" height="40" rx="1.5" fill="#fff" opacity=".5" />
        </g>

        {/* PLACA FRONTAL empotrada */}
        <rect x="30" y="68" width="180" height="338" rx="22" fill="url(#osiRface)" stroke="#000" strokeOpacity=".7" strokeWidth="1.2" />
        <rect x="31" y="69" width="178" height="336" rx="21" fill="none" stroke="#fff" strokeOpacity=".08" />
        {[[38, 76], [202, 76], [38, 398], [202, 398]].map(([cx, cy], i) => (
          <g key={i}><circle cx={cx} cy={cy} r="2.8" fill="#4b5565" /><path d={`M${cx - 1.4} ${cy}h2.8M${cx} ${cy - 1.4}v2.8`} stroke="#1b2230" strokeWidth=".6" /></g>
        ))}

        {/* LED de estado */}
        <circle cx="48" cy="86" r="8" fill={tx ? '#ff3b3b' : '#22e07a'} opacity=".35" filter="url(#osiRglow)" />
        <circle cx="48" cy="86" r="3.8" fill={tx ? '#ff5a5a' : '#34f08d'} className="osiR-anim" style={{ animation: tx ? 'osiRBlink .9s steps(1) infinite' : 'osiRLed 2.6s ease-in-out infinite' }} />
        <circle cx="48" cy="86" r="1.3" fill="#fff" opacity=".85" />
        <text x="58" y="88.4" fontSize="5.6" fontWeight="800" letterSpacing="1.6" fill="#8fa3bf" opacity=".65" fontFamily="Inter,Arial,sans-serif">{tx ? 'TX' : 'RX'}</text>
        <text x="202" y="88.4" textAnchor="end" fontSize="5.2" fontWeight="800" letterSpacing="1.6" fill="#8fa3bf" opacity=".5" fontFamily="Inter,Arial,sans-serif">VHF · FM</text>

        {/* REJILLA de bocina con ranuras */}
        <rect x="40" y="96" width="160" height="58" rx="12" fill="#02050a" stroke="#1b2536" strokeWidth="1.2" />
        <rect x="40" y="96" width="160" height="58" rx="12" fill={acc} opacity={tx ? 0.14 : 0.05} />
        {Array.from({ length: 8 }, (_, i) => (
          <g key={i}>
            <rect x="52" y={103 + i * 6} width="136" height="3" rx="1.5" fill="#000" />
            <rect x="52" y={106 + i * 6} width="136" height="0.8" rx=".4" fill="#fff" opacity=".07" />
            {tx && <rect x="52" y={103 + i * 6} width="136" height="3" rx="1.5" fill="#ff5a5a" className="osiR-anim" style={{ animation: `osiRSlot ${0.5 + (i % 4) * 0.12}s ease-in-out ${i * 0.06}s infinite` }} />}
          </g>
        ))}

        {/* PANTALLA con marco cromado */}
        <rect x="40" y="162" width="160" height="64" rx="11" fill="url(#osiRchrome)" opacity=".85" />
        <rect x="43" y="165" width="154" height="58" rx="8.5" fill="#05070c" />
        <rect x="44" y="166" width="152" height="56" rx="7" fill="url(#osiRlcd)" />
        <g clipPath="url(#osiRlcdClip)">
          <rect x="44" y="166" width="152" height="56" fill={acc} opacity={tx ? 0.07 : 0.035} />
          <text x="52" y="181" fontSize="11" fontWeight="800" fill={acc} fontFamily="ui-monospace,Menlo,Consolas,monospace" style={{ filter: `drop-shadow(0 0 4px ${acc})` }}>CH 01</text>
          <text x="92" y="181" fontSize="6.2" fontWeight="700" letterSpacing="1.2" fill={acc} opacity=".6" fontFamily="ui-monospace,Menlo,Consolas,monospace">FLEET</text>
          {[0, 1, 2, 3].map((i) => <rect key={i} x={148 + i * 4.4} y={181 - (3 + i * 2.2)} width="3" height={3 + i * 2.2} rx=".6" fill={i < 3 || tx ? acc : '#12303f'} opacity={0.95} />)}
          <rect x="167" y="173.6" width="15" height="7.6" rx="1.6" fill="none" stroke={acc} strokeOpacity=".7" strokeWidth=".9" />
          <rect x="182.6" y="175.8" width="1.6" height="3.2" rx=".6" fill={acc} opacity=".7" />
          {[0, 1, 2, 3].map((i) => <rect key={i} x={168.6 + i * 3.2} y="175.2" width="2.2" height="4.8" fill={acc} opacity={0.9} />)}
          {Array.from({ length: BARS }, (_, i) => {
            const h = 14 + ((i * 37) % 9) * 1.1;
            return (
              <rect key={i} className="osiR-bar osiR-anim" x={50 + i * 7.2} y={210 - h} width="4.6" height={h} rx="1" fill={acc} opacity={tx ? 0.95 : 0.45}
                style={{ animation: tx ? `osiRBar ${0.26 + (i % 7) * 0.07}s ease-in-out ${i * 0.03}s infinite alternate` : `osiRIdle ${1.8 + (i % 5) * 0.35}s ease-in-out ${i * 0.07}s infinite` }} />
            );
          })}
          <text x="52" y="219.4" fontSize="6" fontWeight="700" fill={acc} opacity=".65" fontFamily="ui-monospace,Menlo,Consolas,monospace">154.310 MHz</text>
          <text x="190" y="219.4" textAnchor="end" fontSize="6.8" fontWeight="800" fill={tx ? '#ff7a7a' : acc} opacity={tx ? 1 : 0.65} fontFamily="ui-monospace,Menlo,Consolas,monospace" style={{ filter: tx ? 'drop-shadow(0 0 4px #ff4d4d)' : undefined }}>{tx ? `TX ${timer}` : 'STANDBY'}</text>
          <rect x="44" y="166" width="152" height="56" fill="url(#osiRglass)" />
          <rect x="44" y="164" width="152" height="3" fill={acc} opacity=".22" className="osiR-anim" style={{ animation: 'osiRScan 4.5s linear infinite' }} />
        </g>

        {/* TECLAS de funcion */}
        {[{ x: 40, l: 'MENU' }, { x: 96, l: 'SCAN' }, { x: 152, l: 'CALL' }].map((k) => (
          <g key={k.l}>
            <rect x={k.x} y="234" width="48" height="20" rx="7" fill="#02050a" />
            <rect x={k.x + 1.5} y="235" width="45" height="17" rx="6" fill="url(#osiRkey)" stroke="#000" strokeOpacity=".5" />
            <rect x={k.x + 5} y="236" width="38" height="3" rx="1.5" fill="#fff" opacity=".13" />
            <text x={k.x + 24} y="246.6" textAnchor="middle" fontSize="5.8" fontWeight="800" letterSpacing="1.4" fill="#9fb2cf" fontFamily="Inter,Arial,sans-serif">{k.l}</text>
          </g>
        ))}

        {/* BOTON PTT principal: en la parte baja del radio (pulgar) */}
        <g transform="translate(0 44)"><g transform={press}>
          <rect x="34" y="266" width="172" height="62" rx="18" fill="#03060c" stroke="#fff" strokeOpacity=".05" />
          <rect x="40" y="272" width="160" height="50" rx="14" fill={hot} opacity=".5" filter="url(#osiRglow)" />
          <rect x="40" y="272" width="160" height="50" rx="14" fill="url(#osiRptt)" stroke="#000" strokeOpacity=".35" />
          <rect x="40" y="272" width="160" height="50" rx="14" fill="url(#osiRgrip)" />
          <rect x="40" y="272" width="160" height="22" rx="14" fill="#fff" opacity=".2" />
          {/* el brillo que cruza queda RECORTADO dentro del boton (antes se salia por el cuerpo) */}
          <g clipPath="url(#osiRbtnClip)" style={{ pointerEvents: 'none', opacity: tx ? 0 : 1 }}>
            <g className="osiR-sheen"><rect x="40" y="272" width="26" height="50" fill="#fff" opacity=".28" /></g>
          </g>
          {[0, 1, 2, 3].map((i) => <rect key={`l${i}`} x="50" y={282 + i * 8} width="3" height="5" rx="1.4" fill="#fff" opacity=".4" />)}
          {[0, 1, 2, 3].map((i) => <rect key={`r${i}`} x="187" y={282 + i * 8} width="3" height="5" rx="1.4" fill="#fff" opacity=".4" />)}
          <circle cx="120" cy="281" r="2.6" fill="#fff" opacity={tx ? 1 : 0.75} className="osiR-anim" style={{ animation: tx ? 'osiRBlink .8s steps(1) infinite' : undefined }} />
          <text x="120" y="304" textAnchor="middle" fontSize="17" fontWeight="900" letterSpacing="5" fill="#fff" fillOpacity=".96" fontFamily="'Arial Black',Arial,sans-serif">PTT</text>
          <text x="120" y="315" textAnchor="middle" fontSize="5.2" fontWeight="800" letterSpacing="1.6" fill="#fff" fillOpacity=".72" fontFamily="Inter,Arial,sans-serif">{(tx ? labels.transmitting : labels.pushToTalk).toUpperCase()}</text>
        </g></g>

        {/* MICROFONO + marca */}
        <circle cx="120" cy="293" r="8.5" fill="#02050a" stroke="#1b2536" />
        <circle cx="120" cy="293" r="7" fill="url(#osiRmic)" />
        <text x="120" y="268" textAnchor="middle" fontSize="6.6" fontWeight="800" letterSpacing="2.6" fill="#7e8da6" opacity=".75" fontFamily="Inter,Arial,sans-serif">OSI · FLEET X7</text>
        <text x="120" y="277" textAnchor="middle" fontSize="4.8" fontWeight="700" letterSpacing="2" fill="#7e8da6" opacity=".45" fontFamily="Inter,Arial,sans-serif">TWO-WAY RADIO</text>
        <text x="120" y="397" textAnchor="middle" fontSize="6.4" fontWeight="800" letterSpacing="1.6" fill={tx ? '#ff7a7a' : '#fdba74'} opacity={tx ? 1 : 0.8} fontFamily="Inter,Arial,sans-serif" className="osiR-anim" style={{ animation: tx ? 'osiRBlink 1.1s steps(1) infinite' : undefined }}>{(tx ? labels.tapToStop : labels.tapToRecord).toUpperCase()}</text>
      </svg>

      {/* zonas tactiles (accesibles por teclado): boton PTT principal y palanca lateral */}
      {[{ l: '14.2%', t: '72.9%', w: '71.7%', h: '14%', r: 18 }, { l: '2%', t: '32.4%', w: '9.6%', h: '19.8%', r: 9 }].map((z, i) => (
        <button
          key={i}
          type="button"
          onClick={onToggle}
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerLeave={() => setPressed(false)}
          onPointerCancel={() => setPressed(false)}
          aria-label={tx ? labels.tapToStop : labels.tapToRecord}
          aria-pressed={tx}
          tabIndex={i === 0 ? 0 : -1}
          className="touch-none"
          style={{ position: 'absolute', left: z.l, top: z.t, width: z.w, height: z.h, borderRadius: z.r, background: 'transparent', border: 0, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
        />
      ))}
      <p style={{ margin: '6px 0 0', textAlign: 'center', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#64748b' }}>{labels.secureChannel}</p>
    </div>
  );
}
