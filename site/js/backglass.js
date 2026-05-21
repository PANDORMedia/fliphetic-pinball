// backglass.js
// Pure spectacle: an animated 3D Matrix backglass. Heavy green code rain, a
// rotating wireframe core, the HETIC badge floating in front. No score here
// (the DMD shows that) - this screen is just epic animation. It pulses when
// the playfield scores, so it feels connected without showing numbers.

import * as THREE from 'three';
import { subscribe } from './net.js';

export function start() {
  const root = document.getElementById('backglass-screen');
  const canvas = document.createElement('canvas');
  root.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x01040a);
  scene.fog = new THREE.Fog(0x01040a, 40, 130);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 360);

  scene.add(new THREE.AmbientLight(0x224838, 0.7));
  const lamp = new THREE.PointLight(0x6effa6, 1.2, 260);
  lamp.position.set(0, 6, 40);
  scene.add(lamp);

  const texLoader = new THREE.TextureLoader();

  // --- far backdrop: HETIC badge (bg.png) ---------------------------------
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(170, 96),
    new THREE.MeshBasicMaterial({
      map: texLoader.load('assets/bg.png'), transparent: true, opacity: 0.32,
      depthWrite: false,
    }),
  );
  backdrop.position.set(0, 0, -46);
  scene.add(backdrop);

  // --- Matrix code rain (animated canvas texture) -------------------------
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
      const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      rctx.fillStyle = '#c8ffcf';
      rctx.fillText(ch, x, y);
      rctx.fillStyle = 'rgba(77,255,134,0.5)';
      rctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], x, y - 18);
      if (y > 576 && Math.random() > 0.97) rainCols[i] = 0;
      rainCols[i] += speed;
    }
    rainTex.needsUpdate = true;
  }
  const rainPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 86),
    new THREE.MeshBasicMaterial({
      map: rainTex, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  rainPlane.position.set(0, 0, -24);
  scene.add(rainPlane);

  // --- wireframe core -----------------------------------------------------
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(15, 1),
    new THREE.MeshBasicMaterial({ color: 0x5dd86a, wireframe: true, transparent: true, opacity: 0.55 }),
  );
  core.position.set(0, 0, -6);
  scene.add(core);
  const coreInner = new THREE.Mesh(
    new THREE.IcosahedronGeometry(8, 0),
    new THREE.MeshBasicMaterial({ color: 0x0c3a1c, wireframe: true, transparent: true, opacity: 0.5 }),
  );
  coreInner.position.copy(core.position);
  scene.add(coreInner);

  // --- HETIC badge (boot.png), floating in front --------------------------
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 34),
    new THREE.MeshBasicMaterial({
      map: texLoader.load('assets/boot.png'), transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  badge.position.set(0, 1, 9);
  scene.add(badge);

  // --- drifting sparks ----------------------------------------------------
  const SPARKS = 160;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(SPARKS * 3);
  for (let i = 0; i < SPARKS; i++) {
    sparkPos[i * 3] = (Math.random() - 0.5) * 130;
    sparkPos[i * 3 + 1] = (Math.random() - 0.5) * 80;
    sparkPos[i * 3 + 2] = -20 + Math.random() * 40;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: 0x9effb0, size: 0.55, transparent: true, opacity: 0.7, depthWrite: false,
  }));
  scene.add(sparks);

  // --- live reaction (no numbers shown) -----------------------------------
  let pulse = 0;
  let lastScore = -1;
  let energetic = false;
  subscribe((s) => {
    if (lastScore >= 0 && (s.score || 0) > lastScore) pulse = 1;
    lastScore = s.score || 0;
    energetic = s.mode === 'playing';
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

    drawRain(energetic ? 1.5 : 0.9);

    core.rotation.x += dt * 0.3;
    core.rotation.y += dt * 0.42;
    coreInner.rotation.x -= dt * 0.5;
    coreInner.rotation.y -= dt * 0.62;
    const coreScale = 1 + pulse * 0.18 + Math.sin(clock * 1.6) * 0.04;
    core.scale.setScalar(coreScale);
    core.material.opacity = 0.45 + pulse * 0.4 + Math.sin(clock * 2) * 0.1;

    badge.position.y = 1 + Math.sin(clock * 1.1) * 1.6;
    badge.rotation.z = Math.sin(clock * 0.5) * 0.07;
    badge.scale.setScalar(1 + pulse * 0.12 + Math.sin(clock * 2.4) * 0.02);
    badge.material.opacity = 0.85 + pulse * 0.15;

    rainPlane.material.opacity = 0.7 + pulse * 0.25;

    const p = sparkGeo.attributes.position.array;
    for (let i = 0; i < SPARKS; i++) {
      p[i * 3 + 1] += dt * (4 + (i % 5));
      if (p[i * 3 + 1] > 42) p[i * 3 + 1] = -42;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparks.rotation.z = Math.sin(clock * 0.2) * 0.1;

    camera.position.set(
      Math.sin(clock * 0.25) * 8,
      Math.sin(clock * 0.34) * 4,
      40 - pulse * 3,
    );
    camera.lookAt(0, 0, -6);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
