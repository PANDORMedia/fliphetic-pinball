// backglass.js
// Backglass art screen. Matrix rain behind a HETIC PINBALL wordmark, with the
// live score, ball count and HETIC progress polled from the playfield.

import { subscribe } from './net.js';

export function start() {
  const root = document.getElementById('backglass-screen');
  root.innerHTML = `
    <canvas id="bg-rain"></canvas>
    <div class="bg-wrap">
      <div class="bg-title">HETIC</div>
      <div class="bg-title bg-title-2">PINBALL</div>
      <div class="bg-sub">&#9670; &#9670; &#9670;</div>
      <div class="bg-scoreline">
        <div class="bg-box"><label>SCORE</label><div id="bg-score">0</div></div>
        <div class="bg-box"><label>BALL</label><div id="bg-ball">1 / 3</div></div>
      </div>
      <div class="bg-hetic" id="bg-hetic">
        <span>H</span><span>E</span><span>T</span><span>I</span><span>C</span>
      </div>
      <div class="bg-status" id="bg-status">PRESS START</div>
    </div>`;

  // --- matrix rain ---------------------------------------------------------
  const canvas = document.getElementById('bg-rain');
  const ctx = canvas.getContext('2d');
  const GLYPHS = 'HETIC01アカサタナハマ0123456789';
  let cols = [];
  function sizeRain() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const n = Math.floor(canvas.width / 22);
    cols = new Array(n).fill(0).map(() => Math.random() * -60);
  }
  sizeRain();
  window.addEventListener('resize', sizeRain);
  function drawRain() {
    ctx.fillStyle = 'rgba(2,8,5,0.16)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '20px monospace';
    for (let i = 0; i < cols.length; i++) {
      const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      const x = i * 22;
      const y = cols[i] * 22;
      ctx.fillStyle = '#b6ffb6';
      ctx.fillText(ch, x, y);
      ctx.fillStyle = 'rgba(77,255,134,0.55)';
      ctx.fillText(ch, x, y - 22);
      if (y > canvas.height && Math.random() > 0.975) cols[i] = 0;
      cols[i] += 1;
    }
  }

  // --- live state ----------------------------------------------------------
  const scoreEl = document.getElementById('bg-score');
  const ballEl = document.getElementById('bg-ball');
  const statusEl = document.getElementById('bg-status');
  const heticSpans = Array.from(document.querySelectorAll('#bg-hetic span'));

  let snap = { mode: 'attract', score: 0, ball: 1, balls: 3, message: '', hetic: [] };
  subscribe((s) => { snap = s; });

  function render() {
    drawRain();
    scoreEl.textContent = (snap.score || 0).toLocaleString('en-US');
    ballEl.textContent = `${snap.ball || 1} / ${snap.balls || 3}`;
    if (snap.mode === 'playing') {
      statusEl.textContent = snap.message || 'GAME ON';
      statusEl.classList.remove('pulse');
    } else if (snap.mode === 'gameover') {
      statusEl.textContent = 'GAME OVER';
      statusEl.classList.remove('pulse');
    } else {
      statusEl.textContent = 'PRESS START';
      statusEl.classList.add('pulse');
    }
    heticSpans.forEach((sp, i) => {
      sp.classList.toggle('lit', !!(snap.hetic && snap.hetic[i]));
    });
    requestAnimationFrame(render);
  }
  render();
}
