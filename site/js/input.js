// input.js
// Loads config/buttons.json and turns keyboard events into game actions.
// An ESP32 acting as a USB HID keyboard emits the keys listed in the map, so
// the same buttons.json drives both the firmware and the game.

export class Input {
  constructor() {
    this.keyToAction = new Map(); // KeyboardEvent.code -> action
    this.held = new Set(); // currently held actions
    this.pressCbs = {}; // action -> [callback]
    this.lastInputAt = performance.now();
    this.buttons = [];
  }

  async load(url = 'config/buttons.json') {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      this.buttons = data.buttons || [];
    } catch (err) {
      console.warn('input: could not load button map, using defaults', err);
      this.buttons = [
        { action: 'flipperLeft', keys: ['ShiftLeft'] },
        { action: 'flipperRight', keys: ['ShiftRight'] },
        { action: 'plunger', keys: ['Space'] },
        { action: 'start', keys: ['Enter'] },
        { action: 'nudge', keys: ['ArrowDown'] },
      ];
    }
    for (const b of this.buttons) {
      const keys = b.keys || (b.key ? [b.key] : []);
      for (const k of keys) this.keyToAction.set(k, b.action);
    }
    window.addEventListener('keydown', (e) => this._onDown(e));
    window.addEventListener('keyup', (e) => this._onUp(e));
    return this;
  }

  _onDown(e) {
    const action = this.keyToAction.get(e.code);
    if (!action) return;
    e.preventDefault();
    this.lastInputAt = performance.now();
    if (!this.held.has(action)) {
      this.held.add(action);
      for (const cb of this.pressCbs[action] || []) cb();
    }
  }

  _onUp(e) {
    const action = this.keyToAction.get(e.code);
    if (action) this.held.delete(action);
  }

  isHeld(action) {
    return this.held.has(action);
  }

  onPress(action, cb) {
    (this.pressCbs[action] = this.pressCbs[action] || []).push(cb);
  }

  idleMs() {
    return performance.now() - this.lastInputAt;
  }

  markActivity() {
    this.lastInputAt = performance.now();
  }
}
