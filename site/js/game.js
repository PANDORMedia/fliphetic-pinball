// game.js
// HETIC Pinball playfield: top-down orthographic Three.js scene, game state
// machine, attract-mode auto-play, variable plunger, sound, and live state
// broadcast to the DMD and backglass screens.

import * as THREE from 'three';
import { World } from './physics.js';
import { createTable } from './table.js';
import { Input } from './input.js';
import { publisher } from './net.js';
import { audio } from './audio.js';

export function start() {
  const canvas = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02070b);

  // Orthographic, straight down -Z: a true top-down view, no perspective.
  const VIEW_HALF = 56;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 900);
  camera.position.set(27, 52, 320);
  camera.up.set(0, 1, 0);
  camera.lookAt(27, 52, 0);

  scene.add(new THREE.AmbientLight(0x33564a, 0.95));
  const dir = new THREE.DirectionalLight(0x9effc4, 0.85);
  dir.position.set(10, 30, 160);
  scene.add(dir);
  const lamp = new THREE.PointLight(0x6effa6, 0.6, 360);
  lamp.position.set(27, 58, 90);
  scene.add(lamp);

  const world = new World();
  const table = createTable(world);
  scene.add(table.group);
  world.resetBall(table.meta.ballStart);

  const el = {
    score: document.getElementById('score'),
    ball: document.getElementById('ball'),
    message: document.getElementById('message'),
    attract: document.getElementById('attract'),
    plunger: document.getElementById('plunger-fill'),
    hetic: Array.from(document.querySelectorAll('#playfield-screen .hetic-letter')),
  };

  const STATE = { ATTRACT: 'attract', PLAYING: 'playing', GAMEOVER: 'gameover' };
  let mode = STATE.ATTRACT;
  let score = 0;
  let ballNum = 1;
  let ballPhase = 'lane'; // lane | play | drain
  let laneTimer = 0;
  let drainTimer = 0;
  let gameoverTimer = 0;
  let plungerCharge = 0;
  let stuckTimer = 0;
  const hetic = [false, false, false, false, false];
  const flipperWas = [false, false];
  let message = '';
  let messageTimer = 0;

  const pushState = publisher();

  function setMessage(text, secs = 2.4) {
    message = text;
    messageTimer = secs;
  }

  function spawnBall() {
    world.resetBall(table.meta.ballStart);
    ballPhase = 'lane';
    laneTimer = 0;
    plungerCharge = 0;
    stuckTimer = 0;
  }

  function launch(power) {
    if (ballPhase !== 'lane') return;
    world.ball.vel.x = (Math.random() * 2 - 1) * 3;
    // 150 already clears the lane and the top arch with margin; power adds punch
    world.ball.vel.y = 150 + power * 44;
    ballPhase = 'play';
    audio.launch();
  }

  function resetTargets() {
    for (let i = 0; i < 5; i++) hetic[i] = false;
    for (const t of table.targetMeshes) t.lit = false;
  }

  function startGame() {
    mode = STATE.PLAYING;
    score = 0;
    ballNum = 1;
    resetTargets();
    spawnBall();
    setMessage('BALL 1');
    audio.start();
  }

  function enterAttract() {
    mode = STATE.ATTRACT;
    score = 0;
    ballNum = 1;
    resetTargets();
    spawnBall();
    message = '';
  }

  function gameOver() {
    mode = STATE.GAMEOVER;
    gameoverTimer = 6.5;
    setMessage('GAME OVER', 6.5);
  }

  const input = new Input();
  function wireInput() {
    const poke = () => {
      audio.unlock();
      if (mode === STATE.ATTRACT) startGame();
    };
    input.onPress('start', poke);
    input.onPress('flipperLeft', poke);
    input.onPress('flipperRight', poke);
    input.onPress('plunger', poke);
    input.onPress('nudge', () => {
      audio.unlock();
      world.ball.vel.x += (Math.random() * 2 - 1) * 8;
      world.ball.vel.y += 9;
    });
  }

  function consumeEvents() {
    for (const ev of world.events) {
      if (ev.type === 'bumper') {
        score += 750;
        ev.obj._pulse = 1;
        audio.bumper();
      } else if (ev.type === 'slingshot') {
        score += 120;
        audio.slingshot();
      } else if (ev.type === 'target') {
        const i = ev.obj.letterIndex;
        if (!hetic[i]) {
          hetic[i] = true;
          score += 1500;
          setMessage('HETIC ' + ev.obj.letter);
          audio.target();
          const tm = table.targetMeshes[i];
          if (tm) tm.lit = true;
        } else {
          score += 250;
          audio.target();
        }
        if (hetic.every(Boolean)) {
          score += 25000;
          setMessage('HETIC COMPLETE  +25000', 3);
          audio.jackpot();
          resetTargets();
        }
      }
    }
    world.events.length = 0;
  }

  function attractAI(dt) {
    if (ballPhase === 'lane') {
      laneTimer += dt;
      plungerCharge = Math.min(1, laneTimer / 1.3);
      world.flippers[0].pressed = false;
      world.flippers[1].pressed = false;
      if (laneTimer > 1.3) launch(0.6 + Math.random() * 0.4);
      return;
    }
    const b = world.ball;
    const descending = b.vel.y < 14;
    const lowField = b.pos.y > 9 && b.pos.y < 36;
    world.flippers[0].pressed = descending && lowField && b.pos.x > 7 && b.pos.x < 26;
    world.flippers[1].pressed = descending && lowField && b.pos.x >= 24 && b.pos.x < 43;
  }

  function playingControl(dt) {
    world.flippers[0].pressed = input.isHeld('flipperLeft');
    world.flippers[1].pressed = input.isHeld('flipperRight');
    if (ballPhase === 'lane') {
      if (input.isHeld('plunger')) {
        plungerCharge = Math.min(1, plungerCharge + dt * 1.2);
      } else if (plungerCharge > 0.02) {
        launch(plungerCharge);
        plungerCharge = 0;
      }
    }
  }

  function updateVisuals(dt) {
    const b = world.ball;
    table.ballMesh.visible = ballPhase !== 'drain';
    table.ballGlow.visible = ballPhase !== 'drain';
    table.ballMesh.position.set(b.pos.x, b.pos.y, world.ball.radius);
    table.ballGlow.position.set(b.pos.x, b.pos.y, world.ball.radius + 2);

    for (const side of ['left', 'right']) {
      const fm = table.flipperMeshes[side];
      fm.group.rotation.z = fm.flipper.angle;
      fm.mat.emissiveIntensity = fm.flipper.pressed ? 2.3 : 1.0;
    }
    for (const bm of table.bumperMeshes) {
      const pulse = bm.circle._pulse || 0;
      bm.mesh.material.emissiveIntensity = 1.0 + pulse * 2.4;
      bm.cap.scale.setScalar(1 + pulse * 0.2);
      if (pulse > 0) bm.circle._pulse = Math.max(0, pulse - dt * 3.2);
    }
    for (const tm of table.targetMeshes) {
      tm.mesh.material.emissiveIntensity = tm.lit ? 1.9 : 0.25;
    }
    if (table.animate) table.animate(dt);
  }

  function updateHud(dt) {
    el.score.textContent = score.toLocaleString('en-US');
    el.ball.textContent = mode === STATE.PLAYING ? `BALL ${ballNum} / 3` : 'HETIC PINBALL';
    if (messageTimer > 0) {
      messageTimer -= dt;
      el.message.textContent = message;
      el.message.style.opacity = '1';
    } else {
      el.message.style.opacity = '0';
    }
    el.attract.style.display = mode === STATE.ATTRACT ? 'flex' : 'none';
    if (el.plunger) {
      el.plunger.style.height = (plungerCharge * 100).toFixed(0) + '%';
      el.plunger.parentElement.style.opacity = ballPhase === 'lane' ? '1' : '0.25';
    }
    el.hetic.forEach((node, i) => node.classList.toggle('lit', hetic[i]));
  }

  function broadcast() {
    pushState({
      mode, score, ball: ballNum, balls: 3,
      message: messageTimer > 0 ? message : '',
      hetic: hetic.slice(), ts: Date.now(),
    });
  }

  const SUBSTEPS = 8;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    if (mode === STATE.ATTRACT) {
      attractAI(dt);
    } else if (mode === STATE.PLAYING) {
      playingControl(dt);
      if (input.idleMs() > 25000) enterAttract();
    } else {
      world.flippers[0].pressed = false;
      world.flippers[1].pressed = false;
    }

    // flipper sound on the press edge (covers attract AI too)
    for (let i = 0; i < 2; i++) {
      const pressed = world.flippers[i].pressed;
      if (pressed && !flipperWas[i]) audio.flipper();
      flipperWas[i] = pressed;
    }

    for (let i = 0; i < SUBSTEPS; i++) world.step(dt / SUBSTEPS);
    consumeEvents();

    // ball settled back in the shooter lane: allow a fresh plunge
    if (ballPhase === 'play' && world.ball.pos.x > 44.5 && world.ball.pos.y < 38) {
      const sp = Math.hypot(world.ball.vel.x, world.ball.vel.y);
      if (sp < 16) { ballPhase = 'lane'; plungerCharge = 0; }
    }

    // stuck-ball watchdog: never leave the cabinet wedged
    if (ballPhase === 'play') {
      const sp = Math.hypot(world.ball.vel.x, world.ball.vel.y);
      stuckTimer = sp < 7 ? stuckTimer + dt : 0;
      if (stuckTimer > 5) spawnBall();
    }

    if (ballPhase === 'play' && world.ball.pos.y < table.meta.drainY) {
      ballPhase = 'drain';
      drainTimer = 1.3;
      world.ball.vel.x = 0;
      world.ball.vel.y = 0;
      audio.drain();
      if (mode === STATE.PLAYING) setMessage('BALL LOST');
    }

    if (ballPhase === 'drain') {
      drainTimer -= dt;
      if (drainTimer <= 0) {
        if (mode === STATE.PLAYING) {
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

    if (mode === STATE.GAMEOVER) {
      gameoverTimer -= dt;
      if (gameoverTimer <= 0) enterAttract();
    }

    updateVisuals(dt);
    updateHud(dt);
    broadcast();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.top = VIEW_HALF;
    camera.bottom = -VIEW_HALF;
    camera.right = VIEW_HALF * aspect;
    camera.left = -VIEW_HALF * aspect;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  input.load().then(() => {
    wireInput();
    audio.unlock();
    resize();
    requestAnimationFrame(frame);
  });
}
