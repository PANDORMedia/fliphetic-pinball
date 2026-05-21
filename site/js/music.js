// music.js
// Background music for the playfield: one track on the title/attract screen,
// another while playing, crossfaded.
//   M               mute / unmute
//   -  (Minus)       volume down
//   =  (Equal/Plus)  volume up

const FADE = 1.0; // crossfade speed

export class Music {
  constructor() {
    this.tracks = {};
    this.mode = 'attract'; // 'attract' | 'play'
    this.muted = false;
    this.volume = 0.55;
    this.loaded = false;
  }

  // Called synchronously at startup so the key handler is always live.
  load() {
    if (this.loaded) return;
    this.loaded = true;
    this.tracks.attract = this._track('assets/the-office.mp3');
    this.tracks.play = this._track('assets/ngup.mp3');
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        this.muted = !this.muted;
      } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        this.setVolume(this.volume - 0.12);
      } else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        this.setVolume(this.volume + 0.12);
      }
    });
  }

  _track(src) {
    const a = new Audio(src);
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0;
    return a;
  }

  setMode(mode) {
    this.mode = mode;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.volume > 0) this.muted = false; // turning it up un-mutes
  }

  // try to start playback (call after a user gesture; kiosks also autoplay)
  unlock() {
    for (const a of Object.values(this.tracks)) {
      if (a.paused) a.play().catch(() => {});
    }
  }

  update(dt) {
    const k = Math.min(1, dt * FADE);
    for (const [name, a] of Object.entries(this.tracks)) {
      const want = (!this.muted && name === this.mode) ? this.volume : 0;
      a.volume = Math.max(0, Math.min(1, a.volume + (want - a.volume) * k));
      if (a.volume > 0.01 && a.paused) a.play().catch(() => {});
      else if (a.volume <= 0.01 && !a.paused) a.pause();
    }
  }
}

export const music = new Music();
