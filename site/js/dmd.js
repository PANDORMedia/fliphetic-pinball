// dmd.js
// Dot-matrix display screen: live score, ball and HETIC progress, with a
// scrolling marquee and cyber-glitch bursts.

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
      <div class="dmd-hetic" id="dmd-hetic">
        <span>H</span><span>E</span><span>T</span><span>I</span><span>C</span>
      </div>
      <div class="dmd-marquee"><div class="dmd-marquee-track" id="dmd-marquee"></div></div>
    </div>`;

  const scoreEl = document.getElementById('dmd-score');
  const headL = document.getElementById('dmd-head-l');
  const noiseEl = document.getElementById('dmd-noise');
  const marqueeEl = document.getElementById('dmd-marquee');
  const heticSpans = Array.from(document.querySelectorAll('#dmd-hetic span'));

  let snap = { mode: 'attract', score: 0, ball: 1, balls: 3, message: '', hetic: [] };
  let lastScore = 0;
  let lastMarquee = '';

  function glitchScore() {
    scoreEl.classList.remove('glitch');
    void scoreEl.offsetWidth; // restart the animation
    scoreEl.classList.add('glitch');
  }
  function glitchBurst() {
    noiseEl.classList.remove('burst');
    void noiseEl.offsetWidth;
    noiseEl.classList.add('burst');
  }

  let lastTilt = false;
  subscribe((s) => {
    if ((s.score || 0) !== lastScore) {
      lastScore = s.score || 0;
      glitchScore();
    }
    if (s.tilt && !lastTilt) { glitchScore(); glitchBurst(); }
    lastTilt = !!s.tilt;
    snap = s;
  });

  // periodic cyber-glitch bursts so the panel is never static
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
