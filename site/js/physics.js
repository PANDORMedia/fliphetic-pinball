// physics.js
// Lightweight 2D pinball physics in the table plane.
// Coordinates: x = table width, y = up-the-table. y = 0 is the drain side,
// y grows toward the top of the table. Gravity pulls toward -y.

export const vec = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  scale: (a, s) => ({ x: a.x * s, y: a.y * s }),
  dot: (a, b) => a.x * b.x + a.y * b.y,
  len: (a) => Math.hypot(a.x, a.y),
};

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

function closestOnSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby || 1e-9;
  const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / len2, 0, 1);
  return { x: a.x + abx * t, y: a.y + aby * t };
}

// A flipper is a rotating capsule pivoted at one end.
export class Flipper {
  constructor(opts) {
    this.pivot = opts.pivot;
    this.length = opts.length;
    this.radius = opts.radius;
    this.restAngle = opts.restAngle;
    this.activeAngle = opts.activeAngle;
    this.angle = opts.restAngle;
    this.angVel = 0;
    this.slew = opts.slew; // radians per second
    this.pressed = false;
    this.side = opts.side;
  }

  tip() {
    return {
      x: this.pivot.x + Math.cos(this.angle) * this.length,
      y: this.pivot.y + Math.sin(this.angle) * this.length,
    };
  }

  update(dt) {
    const target = this.pressed ? this.activeAngle : this.restAngle;
    const prev = this.angle;
    const maxStep = this.slew * dt;
    const d = target - this.angle;
    if (Math.abs(d) <= maxStep) this.angle = target;
    else this.angle += Math.sign(d) * maxStep;
    this.angVel = (this.angle - prev) / dt;
  }
}

export class World {
  constructor() {
    this.gravity = { x: 0, y: -92 };
    this.ball = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, radius: 1.15 };
    this.segments = []; // { a, b, restitution, radius, kind, kick, ... }
    this.circles = []; // { pos, radius, restitution, kind, kick, ... }
    this.flippers = [];
    this.maxSpeed = 165;
    this.events = []; // hit events for the game layer to consume
  }

  resetBall(pos) {
    this.ball.pos = { x: pos.x, y: pos.y };
    this.ball.vel = { x: 0, y: 0 };
  }

  // Run one physics substep.
  step(dt) {
    const ball = this.ball;

    for (const f of this.flippers) f.update(dt);

    ball.vel.x += this.gravity.x * dt;
    ball.vel.y += this.gravity.y * dt;

    // light air drag keeps the simulation calm
    ball.vel.x *= 0.9995;
    ball.vel.y *= 0.9995;

    const sp = Math.hypot(ball.vel.x, ball.vel.y);
    if (sp > this.maxSpeed) {
      const k = this.maxSpeed / sp;
      ball.vel.x *= k;
      ball.vel.y *= k;
    }

    ball.pos.x += ball.vel.x * dt;
    ball.pos.y += ball.vel.y * dt;

    for (const s of this.segments) {
      if (s.cool > 0) s.cool -= dt;
      this._collideSegment(s);
    }
    for (const c of this.circles) {
      if (c.cool > 0) c.cool -= dt;
      this._collideCircle(c);
    }
    for (const f of this.flippers) this._collideFlipper(f);
  }

  _reflect(nx, ny, e) {
    const ball = this.ball;
    const vn = ball.vel.x * nx + ball.vel.y * ny;
    if (vn < 0) {
      ball.vel.x -= (1 + e) * vn * nx;
      ball.vel.y -= (1 + e) * vn * ny;
      return true;
    }
    return false;
  }

  _collideSegment(s) {
    const ball = this.ball;
    const segR = s.radius || 0;
    const cp = closestOnSegment(ball.pos, s.a, s.b);
    let nx = ball.pos.x - cp.x;
    let ny = ball.pos.y - cp.y;
    let d = Math.hypot(nx, ny);
    const minD = ball.radius + segR;
    if (d >= minD) return;
    // one-way gate: transparent when the ball travels in the allowed direction
    if (s.passDir) {
      const through = ball.vel.x * s.passDir.x + ball.vel.y * s.passDir.y;
      if (through > 0) return;
    }
    if (d < 1e-6) {
      const abx = s.b.x - s.a.x;
      const aby = s.b.y - s.a.y;
      const l = Math.hypot(abx, aby) || 1;
      nx = -aby / l;
      ny = abx / l;
      d = 1e-6;
    } else {
      nx /= d;
      ny /= d;
    }
    ball.pos.x += nx * (minD - d);
    ball.pos.y += ny * (minD - d);
    const hit = this._reflect(nx, ny, s.restitution ?? 0.45);
    if (hit && s.kind === 'slingshot') {
      ball.vel.x += nx * (s.kick || 30);
      ball.vel.y += ny * (s.kick || 30);
    }
    if (hit && s.kind && s.kind !== 'wall' && (s.cool || 0) <= 0) {
      s.cool = 0.12;
      this.events.push({ type: s.kind, obj: s });
    }
  }

  _collideCircle(c) {
    const ball = this.ball;
    let nx = ball.pos.x - c.pos.x;
    let ny = ball.pos.y - c.pos.y;
    let d = Math.hypot(nx, ny);
    const minD = ball.radius + c.radius;
    if (d >= minD) return;
    if (d < 1e-6) {
      nx = 0;
      ny = 1;
      d = 1e-6;
    } else {
      nx /= d;
      ny /= d;
    }
    ball.pos.x += nx * (minD - d);
    ball.pos.y += ny * (minD - d);
    const hit = this._reflect(nx, ny, c.restitution ?? 0.5);
    if (hit && c.kind === 'bumper') {
      ball.vel.x += nx * (c.kick || 26);
      ball.vel.y += ny * (c.kick || 26);
    }
    if (hit && c.kind && (c.cool || 0) <= 0) {
      c.cool = 0.12;
      this.events.push({ type: c.kind, obj: c });
    }
  }

  _collideFlipper(f) {
    const ball = this.ball;
    const tip = f.tip();
    const cp = closestOnSegment(ball.pos, f.pivot, tip);
    let nx = ball.pos.x - cp.x;
    let ny = ball.pos.y - cp.y;
    let d = Math.hypot(nx, ny);
    const minD = ball.radius + f.radius;
    if (d >= minD) return;
    if (d < 1e-6) {
      nx = 0;
      ny = 1;
      d = 1e-6;
    } else {
      nx /= d;
      ny /= d;
    }
    ball.pos.x += nx * (minD - d);
    ball.pos.y += ny * (minD - d);
    // velocity of the contact point due to the flipper rotating
    const rx = cp.x - f.pivot.x;
    const ry = cp.y - f.pivot.y;
    const vfx = -f.angVel * ry;
    const vfy = f.angVel * rx;
    const rvx = ball.vel.x - vfx;
    const rvy = ball.vel.y - vfy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const e = 0.5;
      ball.vel.x -= (1 + e) * vn * nx;
      ball.vel.y -= (1 + e) * vn * ny;
    }
  }
}
