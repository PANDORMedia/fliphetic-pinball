// table.js
// Defines the HETIC pinball table layout (physics bodies) and builds the
// Three.js meshes for it. Matrix theme: near-black playfield, glowing green.

import * as THREE from 'three';
import { Flipper } from './physics.js';

export const GREEN = 0x5dd86a;
export const GREEN_BRIGHT = 0xb6ffb6;
export const GREEN_DIM = 0x1d6a2a;

const WALL_H = 3.2;
const WALL_T = 1.2;

// --- procedural textures ----------------------------------------------------

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(200,255,200,1)');
  grad.addColorStop(0.25, 'rgba(120,255,150,0.7)');
  grad.addColorStop(1, 'rgba(0,40,10,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function letterTexture(letter) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#04140a';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#b6ffb6';
  g.font = 'bold 92px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 64, 70);
  return new THREE.CanvasTexture(c);
}

// --- mesh helpers -----------------------------------------------------------

function segmentMesh(a, b, height, color, emissiveIntensity) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const geo = new THREE.BoxGeometry(len, height, WALL_T);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: emissiveIntensity ?? 0.9,
    roughness: 0.4,
    metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((a.x + b.x) / 2, height / 2, (a.y + b.y) / 2);
  mesh.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
  return mesh;
}

// --- table construction -----------------------------------------------------

export function createTable(world) {
  const group = new THREE.Group();
  const sharedGlow = glowTexture();

  const meta = {
    drainY: 5,
    ballStart: { x: 48, y: 9 },
    bounds: { minX: 0, maxX: 54, minY: 0, maxY: 102 },
  };

  // playfield slab
  const floorGeo = new THREE.BoxGeometry(54, 2, 104);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x06160c,
    roughness: 0.85,
    metalness: 0.2,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set(27, -1, 51);
  group.add(floor);

  // faint grid on the playfield
  const grid = new THREE.GridHelper(108, 54, GREEN_DIM, 0x0c2c16);
  grid.position.set(27, 0.06, 51);
  grid.material.opacity = 0.5;
  grid.material.transparent = true;
  group.add(grid);

  // --- walls ---------------------------------------------------------------
  const walls = [
    [{ x: 3, y: 10 }, { x: 3, y: 90 }], // left
    [{ x: 44, y: 6 }, { x: 44, y: 82 }], // divider playfield / lane
    [{ x: 52, y: 6 }, { x: 52, y: 90 }], // lane outer
    [{ x: 44, y: 6 }, { x: 52, y: 6 }], // lane floor (ball rests here before launch)
    [{ x: 3, y: 90 }, { x: 12, y: 98 }], // top arch left
    [{ x: 12, y: 98 }, { x: 42, y: 98 }], // top
    [{ x: 42, y: 98 }, { x: 52, y: 90 }], // top arch right
    [{ x: 3, y: 38 }, { x: 11, y: 16 }], // left funnel
    [{ x: 44, y: 38 }, { x: 36, y: 16 }], // right funnel
  ];
  for (const [a, b] of walls) {
    world.segments.push({ a, b, restitution: 0.4, radius: 0, kind: 'wall' });
    group.add(segmentMesh(a, b, WALL_H, GREEN, 0.7));
  }

  // --- slingshots ----------------------------------------------------------
  const slings = [
    [{ x: 13, y: 33 }, { x: 16, y: 21 }],
    [{ x: 41, y: 33 }, { x: 38, y: 21 }],
  ];
  for (const [a, b] of slings) {
    world.segments.push({
      a, b, restitution: 0.6, radius: 0.6, kind: 'slingshot', kick: 34, cool: 0,
    });
    group.add(segmentMesh(a, b, WALL_H + 0.6, GREEN_BRIGHT, 1.3));
  }

  // --- bumpers -------------------------------------------------------------
  const bumperPos = [
    { x: 14, y: 68 },
    { x: 28, y: 78 },
    { x: 33, y: 62 },
  ];
  const bumperMeshes = [];
  for (const p of bumperPos) {
    const radius = 3.6;
    const circle = {
      pos: { x: p.x, y: p.y }, radius, restitution: 0.5,
      kind: 'bumper', kick: 30, cool: 0,
    };
    const geo = new THREE.CylinderGeometry(radius, radius * 1.05, 4.4, 28);
    const mat = new THREE.MeshStandardMaterial({
      color: GREEN, emissive: GREEN, emissiveIntensity: 1.0,
      roughness: 0.35, metalness: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.x, 2.2, p.y);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, 5.2, 24),
      new THREE.MeshStandardMaterial({
        color: GREEN_BRIGHT, emissive: GREEN_BRIGHT, emissiveIntensity: 1.6,
        roughness: 0.3,
      }),
    );
    cap.position.set(p.x, 2.6, p.y);

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: sharedGlow, color: GREEN, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false, opacity: 0.55,
      }),
    );
    glow.position.set(p.x, 4.5, p.y);
    glow.scale.set(radius * 4, radius * 4, 1);

    group.add(mesh, cap, glow);
    circle.mesh = mesh;
    circle.cap = cap;
    world.circles.push(circle);
    bumperMeshes.push({ circle, mesh, cap, base: 1.0 });
  }

  // --- HETIC target bank ---------------------------------------------------
  const letters = ['H', 'E', 'T', 'I', 'C'];
  const targetMeshes = [];
  letters.forEach((ch, i) => {
    const x = 8 + i * 7.5;
    const y = 88;
    const a = { x: x - 1.7, y };
    const b = { x: x + 1.7, y };
    const seg = {
      a, b, restitution: 0.5, radius: 0.5, kind: 'target',
      letterIndex: i, letter: ch, cool: 0,
    };
    const geo = new THREE.BoxGeometry(3.4, 3.6, 1.4);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a2814, emissive: GREEN, emissiveIntensity: 0.25,
      roughness: 0.5,
      map: letterTexture(ch),
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 1.8, y);
    group.add(mesh);
    seg.mesh = mesh;
    world.segments.push(seg);
    targetMeshes.push({ seg, mesh, lit: false });
  });

  // --- flippers ------------------------------------------------------------
  const D2R = Math.PI / 180;
  const flipperDefs = [
    {
      side: 'left', pivot: { x: 12, y: 18 }, length: 11, radius: 1.5,
      restAngle: -28 * D2R, activeAngle: 20 * D2R, slew: 16,
    },
    {
      side: 'right', pivot: { x: 36, y: 18 }, length: 11, radius: 1.5,
      restAngle: 208 * D2R, activeAngle: 160 * D2R, slew: 16,
    },
  ];
  const flipperMeshes = {};
  for (const def of flipperDefs) {
    const f = new Flipper(def);
    world.flippers.push(f);

    const pivotGroup = new THREE.Group();
    pivotGroup.position.set(def.pivot.x, 1.7, def.pivot.y);

    const geo = new THREE.BoxGeometry(def.length, 2.4, def.radius * 2);
    geo.translate(def.length / 2, 0, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: GREEN, emissive: GREEN, emissiveIntensity: 1.0,
      roughness: 0.3, metalness: 0.35,
    });
    const bat = new THREE.Mesh(geo, mat);
    pivotGroup.add(bat);

    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(def.radius * 1.3, def.radius * 1.3, 2.6, 18),
      mat,
    );
    pivotGroup.add(knob);

    pivotGroup.rotation.y = -f.angle;
    group.add(pivotGroup);
    flipperMeshes[def.side] = { flipper: f, group: pivotGroup, mat };
  }

  // --- ball ----------------------------------------------------------------
  const ballGeo = new THREE.SphereGeometry(world.ball.radius, 24, 18);
  const ballMat = new THREE.MeshStandardMaterial({
    color: 0xdfffe4, emissive: GREEN, emissiveIntensity: 0.4,
    roughness: 0.15, metalness: 0.9,
  });
  const ballMesh = new THREE.Mesh(ballGeo, ballMat);
  const ballGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sharedGlow, color: GREEN_BRIGHT, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0.7,
    }),
  );
  ballGlow.scale.set(9, 9, 1);
  group.add(ballMesh, ballGlow);

  return {
    group,
    meta,
    flipperMeshes,
    bumperMeshes,
    targetMeshes,
    ballMesh,
    ballGlow,
  };
}
