// backglass.js
// Pure spectacle + the cabinet's hype man. No score (the DMD shows that):
// reactive commentary callouts, cyber fireworks, screen flash and camera
// kicks. Matrix-green phosphor throughout, framed by a CRT filter overlay.

import * as THREE from 'three';
import { subscribe } from './net.js';

export function start() {
  const root = document.getElementById('backglass-screen');
  const canvas = document.createElement('canvas');
  root.appendChild(canvas);
  // Matrix CRT filter: scanlines + vignette + green phosphor wash
  const crt = document.createElement('div');
  crt.className = 'bg-crt';
  root.appendChild(crt);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x01040a);
  scene.fog = new THREE.Fog(0x01040a, 55, 150);

  // Camera kept well back so the whole composition fits a 16:9 frame.
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 360);

  scene.add(new THREE.AmbientLight(0x224838, 0.7));
  const lamp = new THREE.PointLight(0x6effa6, 1.2, 280);
  lamp.position.set(0, 6, 44);
  scene.add(lamp);

  const texLoader = new THREE.TextureLoader();

  function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(210,255,210,1)');
    grad.addColorStop(0.3, 'rgba(120,255,150,0.6)');
    grad.addColorStop(1, 'rgba(0,40,10,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const glow = glowTexture();

  // --- far backdrop (bg.png) ----------------------------------------------
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 108),
    new THREE.MeshBasicMaterial({
      map: texLoader.load('assets/bg.png'), transparent: true, opacity: 0.28,
      depthWrite: false,
    }),
  );
  backdrop.position.set(0, 0, -50);
  scene.add(backdrop);

  // --- Matrix code rain ----------------------------------------------------
  const rainCanvas = document.createElement('canvas');
  rainCanvas.width = 1024;
  rainCanvas.height = 576;
  const rctx = rainCanvas.getContext('2d');
  rctx.fillStyle = '#000';
  rctx.fillRect(0, 0, 1024, 576);
  const GLYPHS = 'HETICPINBALL0123456789アカサタナハ◆◇';
  const COLW = 17;
  const rainCols = new Array(Math.floor(1024 / COLW)).fill(0)
    .map(() => Math.random() * -40);
  const rainTex = new THREE.CanvasTexture(rainCanvas);
  function drawRain(speed) {
    rctx.fillStyle = 'rgba(1,6,3,0.18)';
    rctx.fillRect(0, 0, 1024, 576);
    rctx.font = '15px monospace';
    for (let i = 0; i < rainCols.length; i++) {
      const x = i * COLW;
      const y = rainCols[i] * 18;
      rctx.fillStyle = '#c8ffcf';
      rctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], x, y);
      rctx.fillStyle = 'rgba(77,255,134,0.5)';
      rctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], x, y - 18);
      if (y > 576 && Math.random() > 0.97) rainCols[i] = 0;
      rainCols[i] += speed;
    }
    rainTex.needsUpdate = true;
  }
  const rainPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(170, 98),
    new THREE.MeshBasicMaterial({
      map: rainTex, transparent: true, opacity: 0.78,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  rainPlane.position.set(0, 0, -26);
  scene.add(rainPlane);

  // --- wireframe core ------------------------------------------------------
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(9, 1),
    new THREE.MeshBasicMaterial({ color: 0x5dd86a, wireframe: true, transparent: true, opacity: 0.5 }),
  );
  core.position.set(0, 0, -4);
  scene.add(core);
  const coreInner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(5, 0),
    new THREE.MeshBasicMaterial({ color: 0x0c3a1c, wireframe: true, transparent: true, opacity: 0.5 }),
  );
  coreInner.position.copy(core.position);
  scene.add(coreInner);

  // --- HETIC badge (boot.png) ---------------------------------------------
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshBasicMaterial({
      map: texLoader.load('assets/boot.png'), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  badge.position.set(0, 9, 2);
  scene.add(badge);

  // --- commentary callout --------------------------------------------------
  const calloutCanvas = document.createElement('canvas');
  calloutCanvas.width = 1024;
  calloutCanvas.height = 256;
  const cctx = calloutCanvas.getContext('2d');
  const calloutTex = new THREE.CanvasTexture(calloutCanvas);
  const callout = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 11),
    new THREE.MeshBasicMaterial({
      map: calloutTex, transparent: true, depthWrite: false, opacity: 0,
    }),
  );
  callout.position.set(0, -11, 2);
  scene.add(callout);
  let calloutLife = 0;
  let calloutMax = 1;

  function showCallout(text, important) {
    if (!important && calloutLife > 0.85) return;
    cctx.clearRect(0, 0, 1024, 256);
    cctx.textAlign = 'center';
    cctx.textBaseline = 'middle';
    cctx.shadowColor = '#5dd86a';
    cctx.shadowBlur = 42;
    // shrink the font until the text fits the canvas (so it never overflows)
    let size = 168;
    cctx.font = `bold ${size}px monospace`;
    while (size > 38 && cctx.measureText(text).width > 940) {
      size -= 8;
      cctx.font = `bold ${size}px monospace`;
    }
    cctx.lineWidth = 9;
    cctx.strokeStyle = '#0c3a1c';
    cctx.strokeText(text, 512, 140);
    cctx.fillStyle = '#c6ffc6';
    cctx.fillText(text, 512, 140);
    calloutTex.needsUpdate = true;
    calloutLife = calloutMax = 2.1;
  }

  // --- cyber fireworks (green phosphor) -----------------------------------
  const fw = [];
  for (let i = 0; i < 170; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow, color: 0xb6ffb6, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0,
    }));
    sp.visible = false;
    scene.add(sp);
    fw.push({ sp, life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
  }
  function firework(count, big) {
    const ox = (Math.random() * 2 - 1) * 16;
    const oy = (Math.random() * 2 - 1) * 9;
    const oz = -2 + Math.random() * 6;
    let made = 0;
    for (const p of fw) {
      if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI - Math.PI / 2;
      const s = (big ? 22 : 13) + Math.random() * (big ? 18 : 10);
      p.x = ox; p.y = oy; p.z = oz;
      p.vx = Math.cos(a) * Math.cos(e) * s;
      p.vy = Math.sin(e) * s;
      p.vz = Math.sin(a) * Math.cos(e) * s * 0.5;
      p.life = p.max = 0.7 + Math.random() * 0.6;
      p.sp.material.color.setHex(Math.random() < 0.4 ? 0x5dd86a : 0xb6ffb6);
      if (++made >= count) break;
    }
  }

  // --- screen flash --------------------------------------------------------
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(280, 170),
    new THREE.MeshBasicMaterial({
      color: 0x5dd86a, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  flash.position.set(0, 0, 26);
  scene.add(flash);
  let flashLevel = 0;
  let camKick = 0;

  // --- live reaction -------------------------------------------------------
  let energetic = false;
  let pulse = 0;
  let lastScore = -1;
  let lastMessage = '';
  let lastMode = '';
  let lastTilt = false;
  let nextMilestone = 50000;
  const HIT_WORDS = ['NICE', 'BOOM', 'POW', 'YEAH', 'CLEAN HIT', 'GET SOME'];
  const BIG_WORDS = ['HUGE', 'MASSIVE', 'COMBO', 'INSANE', 'CRUSH IT'];
  const pick = (a) => a[(Math.random() * a.length) | 0];

  subscribe((s) => {
    energetic = s.mode === 'playing';
    if (s.mode !== lastMode) {
      if (s.mode === 'playing') showCallout('GAME ON', true);
      else if (s.mode === 'gameover') showCallout('GAME OVER', true);
      lastMode = s.mode;
    }
    if (s.tilt && !lastTilt) {
      showCallout('T I L T', true);
      flashLevel = 1; camKick = 1.4;
    }
    lastTilt = !!s.tilt;
    if (s.message && s.message !== lastMessage) {
      showCallout(s.message, true);
      if (/COMPLETE/i.test(s.message)) {
        for (let k = 0; k < 4; k++) firework(32, true);
        flashLevel = 1; camKick = 1.2;
      } else if (/HETIC/i.test(s.message)) {
        firework(20, false); pulse = 1;
      }
      lastMessage = s.message;
    }
    if (lastScore >= 0) {
      const d = (s.score || 0) - lastScore;
      if (d > 0) {
        pulse = 1;
        if (d >= 5000) {
          showCallout(pick(BIG_WORDS));
          firework(28, true); flashLevel = Math.max(flashLevel, 0.7); camKick = 0.9;
        } else if (d >= 600) {
          if (Math.random() < 0.45) showCallout(pick(HIT_WORDS));
          firework(11, false);
        }
        if ((s.score || 0) >= nextMilestone) {
          showCallout(nextMilestone.toLocaleString('en-US') + ' PTS', true);
          for (let k = 0; k < 3; k++) firework(28, true);
          flashLevel = 1; camKick = 1.1;
          nextMilestone += 50000;
        }
      }
    }
    lastScore = s.score || 0;
  });

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let clock = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    clock += dt;
    pulse = Math.max(0, pulse - dt * 2);
    flashLevel = Math.max(0, flashLevel - dt * 3.5);
    camKick = Math.max(0, camKick - dt * 4);

    drawRain(energetic ? 1.5 : 0.9);

    core.rotation.x += dt * 0.3;
    core.rotation.y += dt * 0.42;
    coreInner.rotation.x -= dt * 0.5;
    coreInner.rotation.y -= dt * 0.62;
    core.scale.setScalar(1 + pulse * 0.2 + Math.sin(clock * 1.6) * 0.04);
    core.material.opacity = 0.42 + pulse * 0.4 + Math.sin(clock * 2) * 0.1;

    badge.position.y = 9 + Math.sin(clock * 1.1) * 1.1;
    badge.rotation.z = Math.sin(clock * 0.5) * 0.06;
    badge.scale.setScalar(1 + pulse * 0.1);

    rainPlane.material.opacity = 0.66 + pulse * 0.24;
    flash.material.opacity = flashLevel * 0.5;

    if (calloutLife > 0) {
      calloutLife -= dt;
      const age = calloutMax - calloutLife;
      let scl = 1;
      if (age < 0.22) scl = 0.4 + (age / 0.22) * 0.85;
      else if (age < 0.4) scl = 1.25 - ((age - 0.22) / 0.18) * 0.25;
      const fade = calloutLife < 0.5 ? calloutLife / 0.5 : 1;
      callout.scale.setScalar(scl);
      callout.material.opacity = fade;
      callout.position.y = -11 + Math.sin(clock * 6) * 0.3;
    } else {
      callout.material.opacity = 0;
    }

    for (const p of fw) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vx *= 0.94; p.vz *= 0.94;
      p.vy = p.vy * 0.94 - 9 * dt;
      const f = Math.max(0, p.life / p.max);
      p.sp.visible = p.life > 0;
      p.sp.position.set(p.x, p.y, p.z);
      p.sp.material.opacity = f;
      p.sp.scale.setScalar(1 + (1 - f) * 4);
    }

    camera.position.set(
      Math.sin(clock * 0.25) * 4 + (Math.random() * 2 - 1) * camKick,
      Math.sin(clock * 0.34) * 2.4 + (Math.random() * 2 - 1) * camKick,
      50 - pulse * 2,
    );
    camera.lookAt(0, 0, -2);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
