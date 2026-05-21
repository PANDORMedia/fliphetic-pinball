// audio.js
// Procedural sound effects with the Web Audio API. No asset files: every
// sound is synthesised, so there is nothing to download or vendor.

class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
  }

  _ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      this.enabled = false;
      return;
    }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32;
    this.master.connect(this.ctx.destination);
  }

  // resume the context after a user gesture (kiosks also autoplay)
  unlock() {
    this._ensure();
  }

  // a single enveloped oscillator
  _blip({ type = 'square', from, to, dur, gain = 0.6, delay = 0 }) {
    if (!this.enabled) return;
    this._ensure();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env);
    env.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise({ dur, gain = 0.4, delay = 0 }) {
    if (!this.enabled) return;
    this._ensure();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const env = this.ctx.createGain();
    env.gain.value = gain;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    src.connect(hp);
    hp.connect(env);
    env.connect(this.master);
    src.start(t0);
  }

  flipper() { this._blip({ type: 'square', from: 220, to: 90, dur: 0.06, gain: 0.4 }); }
  bumper() {
    this._blip({ type: 'square', from: 680, to: 320, dur: 0.12, gain: 0.6 });
    this._blip({ type: 'sine', from: 1100, to: 600, dur: 0.1, gain: 0.3 });
  }
  slingshot() { this._blip({ type: 'sawtooth', from: 420, to: 180, dur: 0.07, gain: 0.4 }); }
  target() {
    this._blip({ type: 'sine', from: 880, to: 1320, dur: 0.14, gain: 0.5 });
    this._blip({ type: 'sine', from: 1320, to: 1760, dur: 0.12, gain: 0.35, delay: 0.07 });
  }
  launch() {
    this._blip({ type: 'sawtooth', from: 120, to: 760, dur: 0.34, gain: 0.5 });
    this._noise({ dur: 0.3, gain: 0.25 });
  }
  drain() { this._blip({ type: 'triangle', from: 320, to: 60, dur: 0.5, gain: 0.5 }); }
  start() {
    [330, 440, 587, 880].forEach((f, i) =>
      this._blip({ type: 'square', from: f, to: f, dur: 0.12, gain: 0.4, delay: i * 0.1 }));
  }
  jackpot() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      this._blip({ type: 'square', from: f, to: f, dur: 0.16, gain: 0.5, delay: i * 0.08 }));
  }
}

export const audio = new Audio();
