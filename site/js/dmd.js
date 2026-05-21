// dmd.js
// Dot-matrix display: live score, ball and HETIC progress, a scrolling
// marquee, cyber-glitch bursts, and matrix-style ASCII animations that play
// on game events.

import { subscribe } from './net.js';

export function start() {
  const root = document.getElementById('dmd-screen');
  root.innerHTML = `
    <div class="dmd-panel">
      <div class="dmd-noise" id="dmd-noise"></div>
      <div class="dmd-head">
        <span id="dmd-head-l">HETIC PINBALL</span>
        <span id="dmd-head-r">&#9670; &#9670; &#9670;</span>
      </div>
      <div class="dmd-score" id="dmd-score">0</div>
      <pre class="dmd-fx" id="dmd-fx"></pre>
      <div class="dmd-hetic" id="dmd-hetic">
        <span>H</span><span>E</span><span>T</span><span>I</span><span>C</span>
      </div>
      <div class="dmd-marquee"><div class="dmd-marquee-track" id="dmd-marquee"></div></div>
    </div>`;

  const scoreEl = document.getElementById('dmd-score');
  const headL = document.getElementById('dmd-head-l');
  const noiseEl = document.getElementById('dmd-noise');
  const marqueeEl = document.getElementById('dmd-marquee');
  const fxEl = document.getElementById('dmd-fx');
  const heticSpans = Array.from(document.querySelectorAll('#dmd-hetic span'));

  // --- ASCII animation engine ---------------------------------------------
  const W = 40;
  const H = 9;
  function grid(fn) {
    let s = '';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) s += fn(x, y);
      if (y < H - 1) s += '\n';
    }
    return s;
  }
  function explodeFrames() {
    const cx = W / 2;
    const cy = H / 2;
    const ring = '◆+*░▓01';
    const frames = [];
    for (let f = 0; f < 16; f++) {
      const r = f * 1.9;
      frames.push(grid((x, y) => {
        const d = Math.hypot(x - cx, (y - cy) * 2);
        if (Math.abs(d - r) < 1.7) return ring[(x + y + f) % ring.length];
        if (d < r - 2 && Math.random() < 0.12) return '.';
        return ' ';
      }));
    }
    return frames;
  }
  function glitchFrames() {
    const g = '▓▒░01/\\|<>◆#@$%';
    const frames = [];
    for (let f = 0; f < 14; f++) {
      const dens = 0.9 - f * 0.06;
      frames.push(grid(() => (Math.random() < dens ? g[(Math.random() * g.length) | 0] : ' ')));
    }
    return frames;
  }
  function waveFrames() {
    const ch = '◆=*+';
    const frames = [];
    for (let f = 0; f < 14; f++) {
      frames.push(grid((x, y) => {
        const wy = H / 2 + Math.sin((x / W) * Math.PI * 3 + f * 0.6) * (H / 2 - 1);
        const dy = Math.abs(y - wy);
        if (dy < 0.9) return ch[(x + f) % ch.length];
        if (dy < 2.2) return '.';
        return ' ';
      }));
    }
    return frames;
  }
  function rainFrames() {
    const g = 'HETICPINBALL01◆';
    const cols = new Array(W).fill(0).map(() => Math.random() * -H);
    const frames = [];
    for (let f = 0; f < 16; f++) {
      frames.push(grid((x, y) => {
        const head = cols[x];
        if (y <= head && y > head - 4) return g[(x + y + f) % g.length];
        return ' ';
      }));
      for (let x = 0; x < W; x++) cols[x] += 1;
    }
    return frames;
  }

  let fxTimer = null;
  function playFx(kind) {
    const frames =
      kind === 'glitch' ? glitchFrames()
      : kind === 'wave' ? waveFrames()
      : kind === 'rain' ? rainFrames()
      : explodeFrames();
    if (fxTimer) clearInterval(fxTimer);
    let i = 0;
    fxEl.classList.add('active');
    fxTimer = setInterval(() => {
      if (i >= frames.length) {
        clearInterval(fxTimer);
        fxTimer = null;
        fxEl.classList.remove('active');
        fxEl.textContent = '';
        return;
      }
      fxEl.textContent = frames[i++];
    }, 68);
  }

  // --- glitch helpers ------------------------------------------------------
  function glitchScore() {
    scoreEl.classList.remove('glitch');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('glitch');
  }
  function glitchBurst() {
    noiseEl.classList.remove('burst');
    void noiseEl.offsetWidth;
    noiseEl.classList.add('burst');
  }

  // --- live state ----------------------------------------------------------
  let snap = { mode: 'attract', score: 0, ball: 1, balls: 3, message: '', hetic: [] };
  let lastScore = 0;
  let lastMarquee = '';
  let lastMessage = '';
  let lastMode = '';
  let lastTilt = false;

  subscribe((s) => {
    if ((s.score || 0) !== lastScore) {
      lastScore = s.score || 0;
      glitchScore();
    }
    if (s.tilt && !lastTilt) {
      glitchScore();
      glitchBurst();
      playFx('glitch');
    }
    lastTilt = !!s.tilt;

    if (s.mode !== lastMode) {
      if (s.mode === 'playing') playFx('rain');
      lastMode = s.mode;
    }

    if (s.message && s.message !== lastMessage) {
      if (/COMPLETE/i.test(s.message)) playFx('explode');
      else if (/^[HETIC]$/.test(s.message)) playFx('wave');
      lastMessage = s.message;
    }
    snap = s;
  });

  setInterval(() => {
    if (Math.random() < 0.7) {
      glitchBurst();
      if (Math.random() < 0.45) glitchScore();
    }
  }, 2100);

  const ATTRACT_MARQUEE =
    '◆ HETIC PINBALL ◆ INSERT COIN ◆ PRESS START ' +
    '◆ 1 COIN  1 PLAY ◆ FLIP TO SURVIVE ◆ LIGHT THE TARGETS ◆ ';

  function setMarquee(text) {
    if (text === lastMarquee) return;
    lastMarquee = text;
    marqueeEl.textContent = text;
  }

  function render() {
    scoreEl.textContent = (snap.score || 0).toLocaleString('en-US');
    if (snap.tilt) {
      headL.textContent = 'T I L T';
      setMarquee('◆ TILT ◆ TILT ◆ TILT ◆ EASY ON THE NUDGE ◆ ');
    } else if (snap.mode === 'playing') {
      headL.textContent = `BALL ${snap.ball || 1} / ${snap.balls || 3}`;
      setMarquee(`◆ ${snap.message || 'SHOOT THE TARGETS'} ◆ ` +
        `SCORE ${(snap.score || 0).toLocaleString('en-US')} ◆ `);
    } else if (snap.mode === 'gameover') {
      headL.textContent = 'GAME OVER';
      setMarquee(`◆ GAME OVER ◆ FINAL SCORE ` +
        `${(snap.score || 0).toLocaleString('en-US')} ◆ PRESS START ◆ `);
    } else {
      headL.textContent = 'HETIC PINBALL';
      setMarquee(ATTRACT_MARQUEE);
    }
    heticSpans.forEach((sp, i) => {
      sp.classList.toggle('lit', !!(snap.hetic && snap.hetic[i]));
    });
    requestAnimationFrame(render);
  }
  render();
}
