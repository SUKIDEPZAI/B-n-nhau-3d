// Âm thanh tổng hợp bằng WebAudio (không cần file ngoài).
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.active = 0; }
  unlock() {
    try {
      if (this.ctx) { this.ctx.resume?.(); return; }
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(this.ctx.destination);
      const n = this.ctx.sampleRate;
      this.buf = this.ctx.createBuffer(1, n, n);
      const d = this.buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch { this.ctx = null; }
  }
  _out(gain, pan) {
    const c = this.ctx, g = c.createGain(); g.gain.value = gain;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(this.master); } else g.connect(this.master);
    return g;
  }
  _burst(dur, f0, f1, gain, pan, q = 0.7) {
    const c = this.ctx; if (!c || this.active > 12) return;
    const t = c.currentTime, s = c.createBufferSource(); s.buffer = this.buf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, f1), t + dur);
    const g = this._out(0, pan); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    this.active++; s.onended = () => this.active--;
  }
  _tone(f0, f1, dur, gain, type = 'sine', pan = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime, o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this._out(0, pan); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.02);
  }
  /** kind: ak12 | mp7 | pistol ; vol 0..1 theo khoảng cách */
  shot(kind, vol = 1, pan = 0) {
    if (!this.ctx || vol < 0.03) return;
    if (kind === 'pistol') { this._burst(0.11, 5200, 500, 0.55 * vol, pan); this._tone(220, 70, 0.1, 0.35 * vol, 'sine', pan); }
    else if (kind === 'mp7') { this._burst(0.09, 7000, 700, 0.5 * vol, pan); this._tone(260, 80, 0.07, 0.25 * vol, 'sine', pan); }
    else { this._burst(0.16, 6000, 350, 0.75 * vol, pan); this._tone(150, 45, 0.14, 0.5 * vol, 'sine', pan); }
  }
  explode(vol = 1, pan = 0) { this._burst(0.9, 2400, 80, 1.1 * vol, pan, 1); this._tone(90, 28, 0.7, 0.9 * vol, 'sine', pan); }
  hit(head) { this._tone(head ? 1900 : 1300, head ? 1500 : 900, 0.06, 0.25, 'square'); }
  hurt() { this._tone(180, 90, 0.12, 0.35, 'sawtooth'); }
  click() { this._tone(900, 500, 0.03, 0.18, 'square'); }
  reload() { this._tone(520, 260, 0.05, 0.2, 'square'); setTimeout(() => this._tone(700, 360, 0.05, 0.22, 'square'), 650); }
  pick() { this._tone(600, 1200, 0.12, 0.25, 'triangle'); }
  ping() { this._tone(880, 880, 0.12, 0.2, 'triangle'); setTimeout(() => this._tone(1320, 1320, 0.14, 0.2, 'triangle'), 110); }
  scan() { this._tone(300, 1500, 0.5, 0.2, 'sine'); }
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, f, 0.25, 0.25, 'triangle'), i * 140)); }
}
