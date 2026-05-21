// music.js
// Background music for the playfield: one track on the title/attract screen,
// another while playing, crossfaded. Press M to mute.

const VOLUME = 0.55;
const FADE = 1.0; // higher = faster crossfade

export class Music {
  constructor() {
    this.tracks = {};
    this.mode = 'attract'; // 'attract' | 'play'
    this.muted = false;
  }

  load() {
    this.tracks.attract = this._track('assets/the-office.mp3');
    this.tracks.play = this._track('assets/ngup.mp3');
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.toggleMute();
    });
  }

  _track(src) {
    const a = new Audio(src);
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0;
    return a;
  }

  // 'attract' for the title screen, 'play' while a game is running
  setMode(mode) {
    this.mode = mode;
  }

  toggleMute() {
    this.muted = !this.muted;
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
      const want = (!this.muted && name === this.mode) ? VOLUME : 0;
      a.volume = Math.max(0, Math.min(1, a.volume + (want - a.volume) * k));
      if (a.volume > 0.01 && a.paused) a.play().catch(() => {});
      else if (a.volume <= 0.01 && !a.paused) a.pause();
    }
  }
}

export const music = new Music();
