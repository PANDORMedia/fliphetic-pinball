// game.js
// HETIC Pinball: scene setup, game state machine, attract-mode auto-play,
// scoring, and the main loop.

import * as THREE from 'three';
import { World } from './physics.js';
import { createTable } from './table.js';
import { Input } from './input.js';

// --- renderer / scene / camera ---------------------------------------------

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02070b);
scene.fog = new THREE.Fog(0x02070b, 80, 210);

const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 700);
const camBase = new THREE.Vector3(27, 90, -22);
const camTarget = new THREE.Vector3(27, 0, 52);

scene.add(new THREE.AmbientLight(0x2c4a39, 0.8));
const lampA = new THREE.PointLight(0x6effa6, 0.7, 260);
lampA.position.set(27, 62, 38);
const lampB = new THREE.PointLight(0x39ffa0, 0.55, 240);
lampB.position.set(27, 52, 92);
scene.add(lampA, lampB);

// --- world + table ----------------------------------------------------------

const world = new World();
const table = createTable(world);
scene.add(table.group);
world.resetBall(table.meta.ballStart);

// --- digital rain backdrop --------------------------------------------------

function makeRain() {
  const N = 340;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const spd = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = Math.random() * 150 - 48;
    pos[i * 3 + 1] = Math.random() * 135;
    pos[i * 3 + 2] = 100 + Math.random() * 70;
    spd[i] = 12 + Math.random() * 34;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x4dff86, size: 0.9, transparent: true, opacity: 0.5,
    depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  return {
    pts,
    update(dt) {
      const p = geo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        p[i * 3 + 1] -= spd[i] * dt;
        if (p[i * 3 + 1] < -6) p[i * 3 + 1] = 135;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
const rain = makeRain();
scene.add(rain.pts);

// --- DOM overlay ------------------------------------------------------------

const el = {
  score: document.getElementById('score'),
  ball: document.getElementById('ball'),
  message: document.getElementById('message'),
  attract: document.getElementById('attract'),
  hetic: Array.from(document.querySelectorAll('.hetic-letter')),
};

// --- game state -------------------------------------------------------------

const STATE = { ATTRACT: 'attract', PLAYING: 'playing', GAMEOVER: 'gameover' };
let state = STATE.ATTRACT;
let score = 0;
let ballNum = 1;
let ballPhase = 'lane'; // lane | play | drain
let laneTimer = 0;
let drainTimer = 0;
let gameoverTimer = 0;
const hetic = [false, false, false, false, false];
let message = '';
let messageTimer = 0;
let clock = 0;

function setMessage(text, secs = 2.2) {
  message = text;
  messageTimer = secs;
}

function spawnBall() {
  world.resetBall(table.meta.ballStart);
  ballPhase = 'lane';
  laneTimer = 0;
}

function launch() {
  if (ballPhase !== 'lane') return;
  world.ball.vel.x = (Math.random() * 2 - 1) * 4;
  world.ball.vel.y = 124;
  ballPhase = 'play';
}

function resetTargets() {
  for (let i = 0; i < 5; i++) hetic[i] = false;
  for (const t of table.targetMeshes) t.lit = false;
}

function startGame() {
  state = STATE.PLAYING;
  score = 0;
  ballNum = 1;
  resetTargets();
  spawnBall();
  setMessage('BALL 1');
}

function enterAttract() {
  state = STATE.ATTRACT;
  score = 0;
  ballNum = 1;
  resetTargets();
  spawnBall();
  message = '';
}

function gameOver() {
  state = STATE.GAMEOVER;
  gameoverTimer = 6.5;
  setMessage('GAME OVER', 6.5);
}

// --- input ------------------------------------------------------------------

const input = new Input();

function wireInput() {
  const poke = () => {
    if (state === STATE.ATTRACT) startGame();
  };
  input.onPress('start', poke);
  input.onPress('flipperLeft', poke);
  input.onPress('flipperRight', poke);
  input.onPress('plunger', () => {
    poke();
    launch();
  });
  input.onPress('nudge', () => {
    // a small shove, like nudging a real cabinet
    world.ball.vel.x += (Math.random() * 2 - 1) * 8;
    world.ball.vel.y += 9;
  });
}

// --- scoring ----------------------------------------------------------------

function consumeEvents() {
  for (const ev of world.events) {
    if (ev.type === 'bumper') {
      score += 750;
      ev.obj._pulse = 1;
    } else if (ev.type === 'slingshot') {
      score += 120;
    } else if (ev.type === 'target') {
      const i = ev.obj.letterIndex;
      if (!hetic[i]) {
        hetic[i] = true;
        score += 1500;
        setMessage('HETIC ' + ev.obj.letter);
        const tm = table.targetMeshes[i];
        if (tm) tm.lit = true;
      } else {
        score += 250;
      }
      if (hetic.every(Boolean)) {
        score += 25000;
        setMessage('HETIC COMPLETE  +25000', 3);
        resetTargets();
      }
    }
  }
  world.events.length = 0;
}

// --- AI ---------------------------------------------------------------------

function attractAI(dt) {
  if (ballPhase === 'lane') {
    laneTimer += dt;
    if (laneTimer > 0.9) launch();
    world.flippers[0].pressed = false;
    world.flippers[1].pressed = false;
    return;
  }
  const b = world.ball;
  const descending = b.vel.y < 12;
  const inRange = b.pos.y > 9 && b.pos.y < 36;
  world.flippers[0].pressed =
    descending && inRange && b.pos.x > 7 && b.pos.x < 26;
  world.flippers[1].pressed =
    descending && inRange && b.pos.x >= 24 && b.pos.x < 43;
}

function playingControl() {
  world.flippers[0].pressed = input.isHeld('flipperLeft');
  world.flippers[1].pressed = input.isHeld('flipperRight');
}

// --- per-frame visuals ------------------------------------------------------

function updateVisuals(dt) {
  const b = world.ball;
  table.ballMesh.visible = ballPhase !== 'drain';
  table.ballGlow.visible = ballPhase !== 'drain';
  table.ballMesh.position.set(b.pos.x, world.ball.radius, b.pos.y);
  table.ballGlow.position.set(b.pos.x, world.ball.radius + 1.5, b.pos.y);

  for (const side of ['left', 'right']) {
    const fm = table.flipperMeshes[side];
    fm.group.rotation.y = -fm.flipper.angle;
    fm.mat.emissiveIntensity = fm.flipper.pressed ? 2.2 : 1.0;
  }

  for (const bm of table.bumperMeshes) {
    const pulse = bm.circle._pulse || 0;
    bm.mesh.material.emissiveIntensity = 1.0 + pulse * 2.4;
    const s = 1 + pulse * 0.18;
    bm.cap.scale.setScalar(s);
    if (bm.circle._pulse > 0) bm.circle._pulse = Math.max(0, pulse - dt * 3.2);
  }

  for (const tm of table.targetMeshes) {
    tm.mesh.material.emissiveIntensity = tm.lit ? 1.9 : 0.25;
  }

  rain.update(dt);

  // gentle camera drift, stronger in attract
  const amp = state === STATE.ATTRACT ? 3.2 : 1.1;
  camera.position.set(
    camBase.x + Math.sin(clock * 0.32) * amp,
    camBase.y + Math.sin(clock * 0.5) * 1.6,
    camBase.z,
  );
  camera.lookAt(camTarget);
}

function updateHud(dt) {
  el.score.textContent = score.toLocaleString('en-US');
  el.ball.textContent =
    state === STATE.PLAYING ? `BALL ${ballNum} / 3` : 'HETIC PINBALL';

  if (messageTimer > 0) {
    messageTimer -= dt;
    el.message.textContent = message;
    el.message.style.opacity = '1';
  } else {
    el.message.style.opacity = '0';
  }

  el.attract.style.display = state === STATE.ATTRACT ? 'flex' : 'none';

  el.hetic.forEach((node, i) => {
    node.classList.toggle('lit', hetic[i]);
  });
}

// --- main loop --------------------------------------------------------------

const SUBSTEPS = 7;
let last = performance.now();

function frame(now) {
  const dt = Math.min((now - last) / 1000, 1 / 30);
  last = now;
  clock += dt;

  if (state === STATE.ATTRACT) {
    attractAI(dt);
  } else if (state === STATE.PLAYING) {
    playingControl();
    if (input.idleMs() > 25000) enterAttract();
  } else {
    world.flippers[0].pressed = false;
    world.flippers[1].pressed = false;
  }

  for (let i = 0; i < SUBSTEPS; i++) world.step(dt / SUBSTEPS);
  consumeEvents();

  if (ballPhase === 'play' && world.ball.pos.y < table.meta.drainY) {
    ballPhase = 'drain';
    drainTimer = 1.3;
    world.ball.vel.x = 0;
    world.ball.vel.y = 0;
    if (state === STATE.PLAYING) setMessage('BALL LOST');
  }

  if (ballPhase === 'drain') {
    drainTimer -= dt;
    if (drainTimer <= 0) {
      if (state === STATE.PLAYING) {
        if (ballNum < 3) {
          ballNum += 1;
          spawnBall();
          setMessage('BALL ' + ballNum);
        } else {
          gameOver();
        }
      } else {
        spawnBall();
      }
    }
  }

  if (state === STATE.GAMEOVER) {
    gameoverTimer -= dt;
    if (gameoverTimer <= 0) enterAttract();
  }

  updateVisuals(dt);
  updateHud(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// --- resize -----------------------------------------------------------------

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// --- boot -------------------------------------------------------------------

input.load().then(() => {
  wireInput();
  resize();
  requestAnimationFrame(frame);
});
