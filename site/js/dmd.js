// dmd.js
// Dot-matrix display screen. Polls the playfield's state and shows score,
// ball, messages and HETIC progress in a classic green DMD style.

import { subscribe } from './net.js';

export function start() {
  const root = document.getElementById('dmd-screen');
  root.innerHTML = `
    <div class="dmd-panel">
      <div class="dmd-head">
        <span id="dmd-head-l">HETIC PINBALL</span>
        <span id="dmd-head-r">&#9670; &#9670; &#9670;</span>
      </div>
      <div class="dmd-score" id="dmd-score">0</div>
      <div class="dmd-msg" id="dmd-msg">PUSH START</div>
      <div class="dmd-hetic" id="dmd-hetic">
        <span>H</span><span>E</span><span>T</span><span>I</span><span>C</span>
      </div>
    </div>`;

  const scoreEl = document.getElementById('dmd-score');
  const msgEl = document.getElementById('dmd-msg');
  const headL = document.getElementById('dmd-head-l');
  const heticSpans = Array.from(document.querySelectorAll('#dmd-hetic span'));

  let snap = { mode: 'attract', score: 0, ball: 1, balls: 3, message: '', hetic: [] };
  subscribe((s) => { snap = s; });

  const attractLines = [
    'PUSH START', 'INSERT COIN', 'HETIC PINBALL',
    '1 COIN  1 PLAY', 'FLIP TO SURVIVE',
  ];
  let attractIdx = 0;
  setInterval(() => { attractIdx = (attractIdx + 1) % attractLines.length; }, 2600);

  function render() {
    scoreEl.textContent = (snap.score || 0).toLocaleString('en-US');
    if (snap.mode === 'playing') {
      headL.textContent = `BALL ${snap.ball || 1} / ${snap.balls || 3}`;
      msgEl.textContent = snap.message || 'SHOOT AGAIN';
    } else if (snap.mode === 'gameover') {
      headL.textContent = 'GAME OVER';
      msgEl.textContent = snap.message || 'GAME OVER';
    } else {
      headL.textContent = 'HETIC PINBALL';
      msgEl.textContent = attractLines[attractIdx];
    }
    heticSpans.forEach((sp, i) => {
      sp.classList.toggle('lit', !!(snap.hetic && snap.hetic[i]));
    });
    requestAnimationFrame(render);
  }
  render();
}
