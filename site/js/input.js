// input.js
// Loads config/buttons.json and turns input into game actions, from two
// sources at once:
//   * the keyboard — keydown/keyup (play on a plain keyboard)
//   * the cabinet ESP32 — button state streamed from the `bridge` over SSE
//     (/esp/events). The cabinet's classic ESP32 can't be a USB keyboard, so
//     it reports button state over serial and the bridge relays it here.
// An action is "held" if EITHER source holds it; onPress fires on the rising
// edge of the combined state.

export class Input {
  constructor() {
    this.keyToAction = new Map();  // KeyboardEvent.code -> action
    this.idToAction = new Map();   // ESP button id -> action
    this.kbHeld = new Set();       // actions held via the keyboard
    this.espHeld = new Set();      // actions held via the ESP32
    this.pressCbs = {};            // action -> [callback]
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
        { id: 'black-left', action: 'flipperLeft', keys: ['ShiftLeft'] },
        { id: 'black-right', action: 'flipperRight', keys: ['ShiftRight'] },
        { id: 'plunger', action: 'plunger', keys: ['Space'] },
        { id: 'white-left', action: 'start', keys: ['Enter'] },
        { id: 'white-right', action: 'nudge', keys: ['ArrowDown'] },
      ];
    }
    for (const b of this.buttons) {
      if (!b.action) continue;  // spare button — no game action
      const keys = b.keys || (b.key ? [b.key] : []);
      for (const k of keys) this.keyToAction.set(k, b.action);
      if (b.id) this.idToAction.set(b.id, b.action);
    }
    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));
    this._connectEsp();
    return this;
  }

  // --- combined held state -------------------------------------------------

  // Apply an on/off from one source; fire onPress on the combined rising edge.
  _apply(sourceSet, action, isOn) {
    if (!action) return;
    const wasHeld = this.isHeld(action);
    if (isOn) sourceSet.add(action);
    else sourceSet.delete(action);
    const nowHeld = this.isHeld(action);
    if (nowHeld) this.lastInputAt = performance.now();
    if (nowHeld && !wasHeld) {
      for (const cb of this.pressCbs[action] || []) cb();
    }
  }

  // --- keyboard ------------------------------------------------------------

  _onKey(e, isDown) {
    const action = this.keyToAction.get(e.code);
    if (!action) return;
    e.preventDefault();
    this._apply(this.kbHeld, action, isDown);
  }

  // --- ESP32 over the bridge ----------------------------------------------

  _connectEsp() {
    let es;
    try {
      es = new EventSource('esp/events');  // -> /esp/events (nginx -> bridge)
    } catch (err) {
      console.warn('input: ESP bridge unavailable', err);
      return;
    }
    es.onmessage = (ev) => {
      try { this._onEspState(JSON.parse(ev.data)); } catch (err) { /* skip */ }
    };
    // EventSource reconnects on its own if the stream drops.
  }

  _onEspState(snap) {
    if (!snap || !snap.buttons) return;
    // An action is ESP-held if ANY button mapped to it reads pressed.
    const heldNow = new Set();
    for (const [id, action] of this.idToAction) {
      if (snap.buttons[id]) heldNow.add(action);
    }
    for (const action of new Set(this.idToAction.values())) {
      this._apply(this.espHeld, action, heldNow.has(action));
    }
  }

  // --- public API ----------------------------------------------------------

  isHeld(action) {
    return this.kbHeld.has(action) || this.espHeld.has(action);
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
