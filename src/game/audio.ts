/**
 * Procedural audio (Web Audio API) — no sample files to download or license.
 * Room tone, footsteps and two UI cues. Starts only after a user gesture.
 */
class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  start(volume: number) {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = (this.ctx = new Ctor());
    this.master = ctx.createGain();
    this.master.gain.value = volume;
    this.master.connect(ctx.destination);

    // 2 s of white noise, reused by every voice.
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Room tone: low-passed noise (air handling) + a faint mains hum.
    const air = ctx.createBufferSource();
    air.buffer = this.noise;
    air.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.06;
    air.connect(lp).connect(airGain).connect(this.master);
    air.start();

    const hum = ctx.createOscillator();
    hum.frequency.value = 100;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.004;
    hum.connect(humGain).connect(this.master);
    hum.start();
  }

  /** Shared graph for other sound sources (voices). Starts the context if needed. */
  graph(): { ctx: AudioContext; out: AudioNode } | null {
    if (!this.ctx) this.start(0.6);
    if (!this.ctx || !this.master) return null;
    void this.ctx.resume();
    return { ctx: this.ctx, out: this.master };
  }

  setVolume(volume: number) {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
  }

  suspend() {
    void this.ctx?.suspend();
  }

  /** Start on the first user gesture of a page that has no other way to start sound (browsers require one). */
  unlock(volume: number) {
    if (!this.ctx) this.start(volume);
    else void this.ctx.resume();
  }

  private burst(freq: number, q: number, gain: number, duration: number) {
    if (!this.ctx || !this.master || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random(), duration + 0.02);
  }

  /** One step; `level` (0..1) is how near the walker is. */
  footstep(hard: boolean, level = 1) {
    if (level < 0.02) return;
    this.burst(hard ? 1100 + Math.random() * 300 : 520 + Math.random() * 160, 1.2, (hard ? 0.16 : 0.11) * level, 0.09);
  }

  /** Latch click + a short low creak; `level` (0..1) is how near the door is. */
  door(opening: boolean, level = 1) {
    this.burst(opening ? 1800 : 900, 6, 0.3 * level, 0.05);
    this.burst(opening ? 320 : 180, 2.5, 0.22 * level, opening ? 0.35 : 0.16);
    if (!opening) setTimeout(() => this.burst(140, 3, 0.5 * level, 0.12), 260);
  }

  /** A hall getting up or sitting down: a few chairs, not quite together, and clothes. */
  hall(rising: boolean) {
    for (let i = 0; i < 4; i++) setTimeout(() => this.burst(rising ? 380 + Math.random() * 160 : 300 + Math.random() * 120, 1.4, 0.1 + Math.random() * 0.05, 0.2 + Math.random() * 0.1), i * 140 + Math.random() * 90);
    setTimeout(() => this.burst(2400, 0.7, 0.04, 0.4), 80);
  }

  /** A quiet tap for a choice made on screen. */
  tick() {
    this.burst(2200, 3, 0.06, 0.03);
  }

  /** Chair legs on laminate. */
  chair() {
    this.burst(420, 1.5, 0.18, 0.22);
  }

  /** Thermal receipt printer: a run of short ticks. */
  printer() {
    for (let i = 0; i < 14; i++) setTimeout(() => this.burst(2600 + (i % 3) * 300, 8, 0.1, 0.035), i * 55);
  }

  /** Rubber die landing on paper over a desk. */
  stamp() {
    this.burst(160, 2, 0.7, 0.09);
    this.burst(900, 1, 0.12, 0.05);
  }

  /** A cover or a sheet being turned. */
  paper() {
    this.burst(3200, 0.8, 0.09, 0.16);
  }

  knock() {
    this.burst(240, 4, 0.5, 0.12);
    setTimeout(() => this.burst(220, 4, 0.42, 0.12), 170);
  }

  chime() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    for (const [i, f] of [659.25, 987.77].entries()) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.07, t + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.6);
      o.connect(g).connect(this.master);
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 0.65);
    }
  }
}

export const audio = new AudioSystem();
