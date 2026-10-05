// Timbre neutral de "te llego algo nuevo" -- a diferencia de playSuccessChime
// (que suena a "lograste algo", para acciones que el propio usuario hizo),
// este es para notificaciones que llegan solas por socket: la campanita del
// dispatcher y el panel de avisos del driver, que hasta ahora sonaban en
// completo silencio.
export function playNotificationPing(): void {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, t); // B5
    osc.frequency.exponentialRampToValueAtTime(1318.51, t + 0.08); // E6
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  } catch { /* AudioContext unavailable */ }
}

export function playSuccessChime(): void {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;

    // E5, A5 — bright ascending confirmation ding
    [659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const s = t + i * 0.09;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.36, s + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.4);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(s);
      osc.stop(s + 0.45);
    });
  } catch { /* AudioContext unavailable */ }
}
