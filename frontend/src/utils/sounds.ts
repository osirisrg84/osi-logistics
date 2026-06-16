export function playSuccessChime(): void {
  try {
    const ctx = new AudioContext();
    const t = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, t);
    master.connect(ctx.destination);

    // E5, A5 — bright ascending confirmation ding
    [659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const s = t + i * 0.09;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.32, s + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.4);
      osc.connect(g);
      g.connect(master);
      osc.start(s);
      osc.stop(s + 0.45);
    });
  } catch { /* AudioContext unavailable */ }
}
