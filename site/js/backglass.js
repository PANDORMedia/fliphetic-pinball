// backglass.js
// Animated 3D backglass: an orbiting core, digital rain, a glowing HETIC
// PINBALL wordmark, and the live score / HETIC progress polled from the
// playfield.

import * as THREE from 'three';
import { subscribe } from './net.js';

export function start() {
  const root = document.getElementById('backglass-screen');
  const canvas = document.createElement('canvas');
  root.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x01040a);
  scene.fog = new THREE.Fog(0x01040a, 34, 104);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 320);

  scene.add(new THREE.AmbientLight(0x244838, 0.85));
  const lampA = new THREE.PointLight(0x6effa6, 1.1, 240);
  lampA.position.set(0, 12, 34);
  const lampB = new THREE.PointLight(0x39ffa0, 0.7, 200);
  lampB.position.set(-18, -10, 24);
  scene.add(lampA, lampB);

  // --- orbiting core -------------------------------------------------------
  const core = new THREE.Group();
  core.position.set(0, 2, 0);
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(5, 36, 26),
    new THREE.MeshStandardMaterial({
      color: 0xe6ffe9, emissive: 0x5dd86a, emissiveIntensity: 0.55,
      metalness: 0.9, roughness: 0.12,
    }),
  );
  core.add(sphere);
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(8 + i * 2.6, 0.34, 14, 90),
      new THREE.MeshStandardMaterial({
        color: 0x5dd86a, emissive: 0x5dd86a, emissiveIntensity: 1.7,
      }),
    );
    ring.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    ring.userData.spin = new THREE.Vector3(
      0.3 + Math.random() * 0.5,
      0.3 + Math.random() * 0.5,
      0.15 + Math.random() * 0.3,
    );
    core.add(ring);
    rings.push(ring);
  }
  scene.add(core);

  // --- canvas-textured labels ---------------------------------------------
  function makeLabel(worldW, worldH, draw) {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = Math.round(1024 * worldH / worldW);
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(worldW, worldH),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    function redraw(...args) {
      ctx.clearRect(0, 0, c.width, c.height);
      draw(ctx, c.width, c.height, ...args);
      tex.needsUpdate = true;
    }
    return { mesh, redraw };
  }

  const title = makeLabel(50, 16, (g, W, H) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = '#5dd86a';
    g.shadowBlur = 46;
    g.fillStyle = '#c6ffc6';
    g.font = `bold ${W * 0.2}px monospace`;
    g.fillText('HETIC', W / 2, H * 0.34);
    g.fillStyle = '#5dd86a';
    g.fillText('PINBALL', W / 2, H * 0.74);
  });
  title.mesh.position.set(0, 17, -2);
  title.redraw();
  scene.add(title.mesh);

  const scoreLabel = makeLabel(42, 11, (g, W, H, text) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = '#5dd86a';
    g.shadowBlur = 30;
    g.fillStyle = '#1d6a2a';
    g.font = `bold ${W * 0.07}px monospace`;
    g.fillText('SCORE', W / 2, H * 0.2);
    g.fillStyle = '#c6ffc6';
    g.font = `bold ${W * 0.2}px monospace`;
    g.fillText(text || '0', W / 2, H * 0.66);
  });
  scoreLabel.mesh.position.set(0, -12, 0);
  scoreLabel.redraw('0');
  scene.add(scoreLabel.mesh);

  const statusLabel = makeLabel(44, 7, (g, W, H, text) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = '#5dd86a';
    g.shadowBlur = 26;
    g.fillStyle = '#9bffae';
    g.font = `bold ${W * 0.085}px monospace`;
    g.fillText(text || 'PRESS START', W / 2, H / 2);
  });
  statusLabel.mesh.position.set(0, -19.5, 0);
  statusLabel.redraw('PRESS START');
  scene.add(statusLabel.mesh);

  // --- HETIC cubes ---------------------------------------------------------
  const cubes = [];
  ['H', 'E', 'T', 'I', 'C'].forEach((ch, i) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#02140a';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#c6ffc6';
    g.font = 'bold 92px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch, 64, 72);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a2814, emissive: 0x5dd86a, emissiveIntensity: 0.25,
      map: new THREE.CanvasTexture(c),
    });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(4.4, 4.4, 4.4), mat);
    cube.position.set((i - 2) * 6.4, -26, 0);
    scene.add(cube);
    cubes.push({ cube, mat });
  });

  // --- digital rain --------------------------------------------------------
  const RAIN = 420;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN * 3);
  const rainSpd = new Float32Array(RAIN);
  for (let i = 0; i < RAIN; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 130;
    rainPos[i * 3 + 1] = (Math.random() - 0.5) * 90;
    rainPos[i * 3 + 2] = -10 - Math.random() * 55;
    rainSpd[i] = 8 + Math.random() * 26;
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
    color: 0x4dff86, size: 0.7, transparent: true, opacity: 0.55, depthWrite: false,
  }));
  scene.add(rain);

  // --- live state ----------------------------------------------------------
  let snap = { mode: 'attract', score: 0, ball: 1, balls: 3, message: '', hetic: [] };
  let lastScore = -1;
  let lastStatus = '';
  subscribe((s) => { snap = s; });

  // --- loop ----------------------------------------------------------------
  let clock = 0;
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    clock += dt;

    sphere.rotation.y += dt * 0.6;
    sphere.rotation.x += dt * 0.25;
    for (const r of rings) {
      r.rotation.x += r.userData.spin.x * dt;
      r.rotation.y += r.userData.spin.y * dt;
      r.rotation.z += r.userData.spin.z * dt;
    }
    title.mesh.position.y = 17 + Math.sin(clock * 1.1) * 0.6;
    title.mesh.material.opacity = 0.82 + Math.sin(clock * 2.2) * 0.18;

    cubes.forEach((c, i) => {
      c.cube.rotation.y += dt * 0.7;
      const lit = !!(snap.hetic && snap.hetic[i]);
      c.mat.emissiveIntensity += ((lit ? 2.0 : 0.25) - c.mat.emissiveIntensity) * 0.15;
    });

    const p = rainGeo.attributes.position.array;
    for (let i = 0; i < RAIN; i++) {
      p[i * 3 + 1] -= rainSpd[i] * dt;
      if (p[i * 3 + 1] < -48) p[i * 3 + 1] = 48;
    }
    rainGeo.attributes.position.needsUpdate = true;

    if ((snap.score || 0) !== lastScore) {
      lastScore = snap.score || 0;
      scoreLabel.redraw(lastScore.toLocaleString('en-US'));
    }
    let status;
    if (snap.mode === 'playing') status = snap.message || `BALL ${snap.ball || 1} / 3`;
    else if (snap.mode === 'gameover') status = 'GAME OVER';
    else status = 'PRESS START';
    if (status !== lastStatus) {
      lastStatus = status;
      statusLabel.redraw(status);
    }

    camera.position.set(
      Math.sin(clock * 0.22) * 7,
      2 + Math.sin(clock * 0.33) * 2.4,
      48,
    );
    camera.lookAt(0, -3, 0);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
