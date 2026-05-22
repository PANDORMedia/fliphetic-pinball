// game.js
// HETIC Pinball playfield: top-down orthographic Three.js scene, game state
// machine, attract-mode auto-play, variable plunger, tilt, sound, screen
// shake and hit FX, plus live state broadcast to the DMD and backglass.

import * as THREE from 'three';
import { World } from './physics.js';
import { createTable } from './table.js';
import { Input } from './input.js';
import { publisher } from './net.js';
import { audio } from './audio.js';
import { music } from './music.js';

export function start() {
  const canvas = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02070b);

  // centred on the table; resize() frames it to fill the screen
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
    ball: document.getElementById('ball'),
    message: document.getElementById('message'),
    attract: document.getElementById('attract'),
    plunger: document.getElementById('plunger-fill'),
    mult: document.getElementById('mult'),
    heticMode: document.getElementById('hetic-mode'),
    hetic: Array.from(document.querySelectorAll('#playfield-screen .hetic-letter')),
  };

  const STATE = { ATTRACT: 'attract', PLAYING: 'playing', GAMEOVER: 'gameover' };
  let mode = STATE.ATTRACT;
  let score = 0;
  let ballNum = 1;
  let ballPhase = 'lane';
  let laneTimer = 0;
  let drainTimer = 0;
  let gameoverTimer = 0;
  let plungerCharge = 0;
  let stuckRefX = 48;
  let stuckRefY = 11;
  let stuckRefTime = 0;
  let stuckNudges = 0;
  let ambientTimer = 0;
  let shake = 0;
  let tiltMeter = 0;
  let tiltFlash = 0;   // seconds left on the TILT flash (feedback only)
  const hetic = [false, false, false, false, false];
  const flipperWas = [false, false];
  let message = '';
  let messageTimer = 0;
  let multiplier = 1;   // 1, or 3 during HETIC MODE
  let multTimer = 0;    // seconds left of X3

  const pushState = publisher();

  function setMessage(text, secs = 2.4) {
    message = text;
    messageTimer = secs;
  }

  function addScore(n) {
    score += Math.round(n * multiplier);
  }

  function spawnBall() {
    world.resetBall(table.meta.ballStart);
    ballPhase = 'lane';
    laneTimer = 0;
    plungerCharge = 0;
    stuckRefX = table.meta.ballStart.x;
    stuckRefY = table.meta.ballStart.y;
    stuckRefTime = 0;
    stuckNudges = 0;
    tiltMeter = 0;
    tiltFlash = 0;
    table.trailClear();
  }

  function launch(power) {
    if (ballPhase !== 'lane') return;
    world.ball.vel.x = (Math.random() * 2 - 1) * 3;
    world.ball.vel.y = 220 + power * 90;
    ballPhase = 'play';
    audio.launch();
    table.burst(table.meta.ballStart.x, table.meta.ballStart.y + 4, 18);
  }

  function resetTargets() {
    for (let i = 0; i < 5; i++) hetic[i] = false;
    for (const t of table.targetMeshes) t.lit = false;
  }

  function startGame() {
    mode = STATE.PLAYING;
    score = 0;
    ballNum = 1;
    multiplier = 1;
    multTimer = 0;
    resetTargets();
    spawnBall();
    setMessage('BALL 1');
    audio.start();
  }

  function enterAttract() {
    mode = STATE.ATTRACT;
    score = 0;
    ballNum = 1;
    multiplier = 1;
    multTimer = 0;
    resetTargets();
    spawnBall();
    message = '';
  }

  function gameOver() {
    mode = STATE.GAMEOVER;
    gameoverTimer = 6.5;
    multiplier = 1;
    multTimer = 0;
    setMessage('GAME OVER', 6.5);
  }

  function doTilt() {
    // A hard nudge — flash TILT for feedback only. No lock-out: the flippers
    // stay live and the ball is not drained.
    tiltFlash = 3;
    tiltMeter = 0;
    setMessage('TILT', 3);
    shake = 3.2;
    audio.drain();
  }

  const input = new Input();
  function wireInput() {
    const poke = () => {
      audio.unlock();
      music.unlock();
      if (mode === STATE.ATTRACT) startGame();
    };
    input.onPress('start', poke);
    input.onPress('flipperLeft', poke);
    input.onPress('flipperRight', poke);
    input.onPress('plunger', poke);
    input.onPress('nudge', () => {
      audio.unlock();
      music.unlock();
      world.ball.vel.x += (Math.random() * 2 - 1) * 10;
      world.ball.vel.y += 11;
      shake = Math.max(shake, 0.6);
      if (mode === STATE.PLAYING) {
        tiltMeter += 0.34;
        if (tiltMeter > 0.62 && tiltMeter < 1) setMessage('CAREFUL!', 1);
      }
    });
  }

  function consumeEvents() {
    const bx = world.ball.pos.x;
    const by = world.ball.pos.y;
    for (const ev of world.events) {
      if (ev.type === 'flipper') {
        table.burst(ev.x, ev.y, 8);
      } else if (ev.type === 'bumper') {
        addScore(750);
        ev.obj._pulse = 1;
        audio.bumper();
        table.burst(bx, by, 26);
        shake = Math.max(shake, 0.8);
      } else if (ev.type === 'slingshot') {
        addScore(120);
        audio.slingshot();
        table.burst(bx, by, 14);
        shake = Math.max(shake, 0.45);
      } else if (ev.type === 'target') {
        const i = ev.obj.letterIndex;
        if (!hetic[i]) {
          hetic[i] = true;
          addScore(1500);
          setMessage(ev.obj.letter);
          audio.target();
          const tm = table.targetMeshes[i];
          if (tm) tm.lit = true;
        } else {
          addScore(250);
          audio.target();
        }
        table.burst(bx, by, 28);
        shake = Math.max(shake, 0.6);
        if (hetic.every(Boolean)) {
          addScore(25000);          // x3 too if re-completed mid-mode
          multiplier = 3;
          multTimer = 30;
          setMessage('HETIC MODE  X3', 3.5);
          audio.jackpot();
          shake = 3.4;
          for (let k = 0; k < 12; k++) {
            table.burst(6 + Math.random() * 36, 28 + Math.random() * 64, 34);
          }
          const hm = el.heticMode;
          if (hm) {
            hm.classList.remove('show');
            void hm.offsetWidth;
            hm.classList.add('show');
          }
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
    world.flippers[0].pressed = descending && lowField && b.pos.x > 4 && b.pos.x < 23;
    world.flippers[1].pressed = descending && lowField && b.pos.x >= 21 && b.pos.x < 40;
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
    if (ballPhase !== 'drain') table.trailPush(b.pos.x, b.pos.y);

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
    table.animate(dt);

    // screen shake
    shake = Math.max(0, shake - dt * 6);
    if (shake > 0.01) {
      table.group.position.set(
        (Math.random() * 2 - 1) * shake,
        (Math.random() * 2 - 1) * shake, 0,
      );
    } else {
      table.group.position.set(0, 0, 0);
    }
  }

  function updateHud(dt) {
    el.ball.textContent = mode === STATE.PLAYING ? `BALL ${ballNum} / 3` : 'HETIC PINBALL';
    if (messageTimer > 0) {
      messageTimer -= dt;
      el.message.textContent = message;
      el.message.style.opacity = '1';
    } else {
      el.message.style.opacity = '0';
    }
    el.attract.style.display = mode === STATE.ATTRACT ? 'flex' : 'none';
    const golden = multiplier === 3;
    document.body.classList.toggle('golden', golden);
    if (el.mult) {
      el.mult.textContent = golden ? `X3  ${Math.ceil(multTimer)}S` : '';
    }
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
      hetic: hetic.slice(), tilt: tiltFlash > 0,
      mult: multiplier, multTime: Math.ceil(multTimer),
      ts: Date.now(),
    });
  }

  const SUBSTEPS = 8;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    if (mode === STATE.ATTRACT) {
      attractAI(dt);
      // ambient fireworks keep the attract playfield alive
      ambientTimer -= dt;
      if (ambientTimer <= 0) {
        table.burst(8 + Math.random() * 32, 34 + Math.random() * 56, 18);
        ambientTimer = 0.8 + Math.random() * 1.2;
      }
    } else if (mode === STATE.PLAYING) {
      playingControl(dt);
      tiltMeter = Math.max(0, tiltMeter - dt * 0.45);
      if (tiltFlash > 0) tiltFlash = Math.max(0, tiltFlash - dt);
      if (tiltMeter >= 1 && ballPhase === 'play') doTilt();
      if (input.idleMs() > 25000) enterAttract();
    } else {
      world.flippers[0].pressed = false;
      world.flippers[1].pressed = false;
    }

    for (let i = 0; i < 2; i++) {
      const pressed = world.flippers[i].pressed;
      if (pressed && !flipperWas[i]) audio.flipper();
      flipperWas[i] = pressed;
    }

    for (let i = 0; i < SUBSTEPS; i++) world.step(dt / SUBSTEPS);
    consumeEvents();

    if (multTimer > 0) {
      multTimer -= dt;
      if (multTimer <= 0) {
        multTimer = 0;
        multiplier = 1;
        setMessage('X3 ENDED', 2);
      }
    }

    if (ballPhase === 'play' && world.ball.pos.x > 44.5 && world.ball.pos.y < 38) {
      const sp = Math.hypot(world.ball.vel.x, world.ball.vel.y);
      if (sp < 16) { ballPhase = 'lane'; plungerCharge = 0; }
    }

    // stuck-ball recovery: position-based, so it also catches a ball
    // rattling in place (not just a motionless one). If the ball stays
    // within 9 units of a reference point too long, nudge it loose; if
    // nudges fail, respawn.
    if (ballPhase === 'play') {
      const b = world.ball.pos;
      if (Math.hypot(b.x - stuckRefX, b.y - stuckRefY) > 9) {
        stuckRefX = b.x;
        stuckRefY = b.y;
        stuckRefTime = 0;
        stuckNudges = 0;
      } else {
        stuckRefTime += dt;
        if (stuckRefTime > 3.2) {
          if (stuckNudges < 2) {
            world.ball.vel.x += (b.x < 23 ? 1 : -1) * 26;
            world.ball.vel.y -= 28;
            stuckNudges += 1;
            stuckRefTime = 1.0;
          } else {
            spawnBall();
          }
        }
      }
    }

    if (ballPhase === 'play' && world.ball.pos.y < table.meta.drainY) {
      ballPhase = 'drain';
      drainTimer = 1.3;
      world.ball.vel.x = 0;
      world.ball.vel.y = 0;
      audio.drain();
      table.trailClear();
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

    music.setMode(mode === STATE.PLAYING ? 'play' : 'attract');
    music.update(dt);

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
    // Fill the screen with the table width (54 wide, centred on x=27); the
    // vertical extent follows the aspect, so on the 9:16 cabinet the table
    // fills the display edge-to-edge with no border.
    const HALF_W = 27;
    camera.left = -HALF_W;
    camera.right = HALF_W;
    camera.top = HALF_W / aspect;
    camera.bottom = -HALF_W / aspect;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  music.load(); // synchronous so the M / volume keys are always live
  input.load().then(() => {
    wireInput();
    audio.unlock();
    music.unlock();
    resize();
    requestAnimationFrame(frame);
  });
}
