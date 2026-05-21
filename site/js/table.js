// table.js
// HETIC pinball table layout (physics bodies) and Three.js meshes.
// Render convention: the playfield lies in the X-Y plane (X = table width,
// Y = up-the-table). Z is height above the playfield, toward the top-down
// orthographic camera. Physics (x, y) maps straight to render (x, y).

import * as THREE from 'three';
import { Flipper } from './physics.js';

export const GREEN = 0x5dd86a;
export const GREEN_BRIGHT = 0xb6ffb6;
export const GREEN_DIM = 0x1d6a2a;

const WALL_H = 2.6;
const WALL_T = 1.1;

// --- procedural textures ----------------------------------------------------

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(210,255,210,1)');
  grad.addColorStop(0.28, 'rgba(120,255,150,0.65)');
  grad.addColorStop(1, 'rgba(0,40,10,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function letterTexture(letter) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#03130a';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#c6ffc6';
  g.font = 'bold 96px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 64, 72);
  return new THREE.CanvasTexture(c);
}

// --- mesh helpers -----------------------------------------------------------
// A segment is drawn as a thin box in the X-Y plane, standing WALL_H tall in Z.

function segmentMesh(a, b, color, emissiveIntensity, height) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const h = height ?? WALL_H;
  const geo = new THREE.BoxGeometry(len, WALL_T, h);
  const mat = new THREE.MeshStandardMaterial({
    color, emissive: color,
    emissiveIntensity: emissiveIntensity ?? 0.85,
    roughness: 0.4, metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, h / 2);
  mesh.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
  return mesh;
}

// --- table construction -----------------------------------------------------

export function createTable(world) {
  const group = new THREE.Group();
  const sharedGlow = glowTexture();

  const meta = {
    drainY: 5,
    ballStart: { x: 48, y: 11 },
    width: 54,
    height: 104,
  };

  // playfield slab
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(54, 104, 2),
    new THREE.MeshStandardMaterial({ color: 0x06160c, roughness: 0.9, metalness: 0.15 }),
  );
  floor.position.set(27, 52, -1);
  group.add(floor);

  // faint grid, rotated into the X-Y plane
  const grid = new THREE.GridHelper(108, 54, GREEN_DIM, 0x0c2c16);
  grid.rotation.x = Math.PI / 2;
  grid.position.set(27, 52, 0.05);
  grid.material.opacity = 0.45;
  grid.material.transparent = true;
  group.add(grid);

  // --- walls ---------------------------------------------------------------
  const walls = [
    [{ x: 3, y: 10 }, { x: 3, y: 92 }], // left
    [{ x: 3, y: 92 }, { x: 12, y: 99 }], // top arch left
    [{ x: 12, y: 99 }, { x: 42, y: 99 }], // top
    [{ x: 42, y: 99 }, { x: 52, y: 93 }], // top arch right
    [{ x: 52, y: 8 }, { x: 52, y: 96 }], // shooter lane outer
    [{ x: 44, y: 8 }, { x: 44, y: 84 }], // shooter lane divider (solid part)
    [{ x: 44, y: 8 }, { x: 52, y: 8 }], // shooter lane floor
    [{ x: 3, y: 40 }, { x: 11, y: 16 }], // left funnel
    [{ x: 44, y: 40 }, { x: 36, y: 16 }], // right funnel
  ];
  for (const [a, b] of walls) {
    world.segments.push({ a, b, restitution: 0.4, radius: 0, kind: 'wall' });
    group.add(segmentMesh(a, b, GREEN, 0.7));
  }

  // --- shooter lane one-way gate ------------------------------------------
  // Above the solid divider: the ball may pass from the lane into the
  // playfield (moving -x) but is blocked coming back. A proper shooter
  // circuit: launch up the lane, out through the gate, never back down.
  {
    const a = { x: 44, y: 84 };
    const b = { x: 44, y: 95 };
    world.segments.push({
      a, b, restitution: 0.3, radius: 0, kind: 'gate',
      passDir: { x: -1, y: 0 },
    });
    const m = segmentMesh(a, b, GREEN_BRIGHT, 0.6, WALL_H * 0.5);
    m.material.transparent = true;
    m.material.opacity = 0.4;
    group.add(m);
  }

  // --- slingshots ----------------------------------------------------------
  for (const [a, b] of [
    [{ x: 13, y: 33 }, { x: 16, y: 21 }],
    [{ x: 41, y: 33 }, { x: 38, y: 21 }],
  ]) {
    world.segments.push({
      a, b, restitution: 0.6, radius: 0.6, kind: 'slingshot', kick: 34, cool: 0,
    });
    group.add(segmentMesh(a, b, GREEN_BRIGHT, 1.4, WALL_H + 0.5));
  }

  // --- bumpers -------------------------------------------------------------
  const bumperMeshes = [];
  for (const p of [{ x: 14, y: 68 }, { x: 28, y: 79 }, { x: 33, y: 63 }]) {
    const radius = 3.6;
    const circle = {
      pos: { x: p.x, y: p.y }, radius, restitution: 0.5,
      kind: 'bumper', kick: 30, cool: 0,
    };
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 4.4, 30),
      new THREE.MeshStandardMaterial({
        color: GREEN, emissive: GREEN, emissiveIntensity: 1.0,
        roughness: 0.35, metalness: 0.3,
      }),
    );
    ring.rotation.x = Math.PI / 2; // stand the cylinder along Z
    ring.position.set(p.x, p.y, 2.2);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.5, radius * 0.5, 5.2, 24),
      new THREE.MeshStandardMaterial({
        color: GREEN_BRIGHT, emissive: GREEN_BRIGHT, emissiveIntensity: 1.6,
        roughness: 0.3,
      }),
    );
    cap.rotation.x = Math.PI / 2;
    cap.position.set(p.x, p.y, 2.8);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sharedGlow, color: GREEN, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0.5,
    }));
    glow.position.set(p.x, p.y, 5);
    glow.scale.set(radius * 4, radius * 4, 1);

    group.add(ring, cap, glow);
    circle.mesh = ring;
    world.circles.push(circle);
    bumperMeshes.push({ circle, mesh: ring, cap });
  }

  // --- HETIC target bank ---------------------------------------------------
  const targetMeshes = [];
  ['H', 'E', 'T', 'I', 'C'].forEach((ch, i) => {
    const x = 8 + i * 7.5;
    const y = 89;
    const a = { x: x - 1.8, y };
    const b = { x: x + 1.8, y };
    const seg = {
      a, b, restitution: 0.5, radius: 0.5, kind: 'target',
      letterIndex: i, letter: ch, cool: 0,
    };
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 1.6, 3.4),
      new THREE.MeshStandardMaterial({
        color: 0x0a2814, emissive: GREEN, emissiveIntensity: 0.25,
        roughness: 0.5, map: letterTexture(ch),
      }),
    );
    mesh.position.set(x, y, 1.7);
    group.add(mesh);
    seg.mesh = mesh;
    world.segments.push(seg);
    targetMeshes.push({ seg, mesh, lit: false });
  });

  // --- flippers ------------------------------------------------------------
  const D2R = Math.PI / 180;
  const flipperMeshes = {};
  for (const def of [
    {
      side: 'left', pivot: { x: 12, y: 18 }, length: 11, radius: 1.5,
      restAngle: -28 * D2R, activeAngle: 22 * D2R, slew: 17,
    },
    {
      side: 'right', pivot: { x: 36, y: 18 }, length: 11, radius: 1.5,
      restAngle: 208 * D2R, activeAngle: 158 * D2R, slew: 17,
    },
  ]) {
    const f = new Flipper(def);
    world.flippers.push(f);

    const pivotGroup = new THREE.Group();
    pivotGroup.position.set(def.pivot.x, def.pivot.y, 1.6);

    const mat = new THREE.MeshStandardMaterial({
      color: GREEN, emissive: GREEN, emissiveIntensity: 1.0,
      roughness: 0.3, metalness: 0.35,
    });
    const batGeo = new THREE.BoxGeometry(def.length, def.radius * 2, 2.6);
    batGeo.translate(def.length / 2, 0, 0);
    pivotGroup.add(new THREE.Mesh(batGeo, mat));

    const knob = new THREE.Mesh(
      new THREE.CylinderGeometry(def.radius * 1.3, def.radius * 1.3, 2.8, 18),
      mat,
    );
    knob.rotation.x = Math.PI / 2;
    pivotGroup.add(knob);

    pivotGroup.rotation.z = f.angle;
    group.add(pivotGroup);
    flipperMeshes[def.side] = { flipper: f, group: pivotGroup, mat };
  }

  // --- ball ----------------------------------------------------------------
  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(world.ball.radius, 26, 20),
    new THREE.MeshStandardMaterial({
      color: 0xe6ffe9, emissive: GREEN, emissiveIntensity: 0.45,
      roughness: 0.12, metalness: 0.9,
    }),
  );
  const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sharedGlow, color: GREEN_BRIGHT, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, opacity: 0.75,
  }));
  ballGlow.scale.set(9, 9, 1);
  group.add(ballMesh, ballGlow);

  return { group, meta, flipperMeshes, bumperMeshes, targetMeshes, ballMesh, ballGlow };
}
