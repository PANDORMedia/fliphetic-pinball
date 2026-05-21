// net.js
// Tiny state channel between the playfield screen and the DMD / backglass.
// The playfield POSTs game state to /state; the others poll GET /state.
// nginx proxies /state to the relay service (see deploy/nginx.conf).

const PATH = 'state';

// Returns a function the playfield calls every frame with the latest state.
// Posts are throttled so we send roughly every `minIntervalMs`.
export function publisher(minIntervalMs = 140) {
  let latest = null;
  let sending = false;
  let lastSent = 0;

  async function flush() {
    if (sending || latest === null) return;
    const now = performance.now();
    if (now - lastSent < minIntervalMs) return;
    lastSent = now;
    sending = true;
    const body = JSON.stringify(latest);
    latest = null;
    try {
      await fetch(PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } catch (e) {
      /* relay not reachable: the game still runs standalone */
    }
    sending = false;
  }

  setInterval(flush, 50);
  return (state) => {
    latest = state;
  };
}

// Polls /state and calls cb with the parsed object. Tolerant of a missing
// relay: errors are swallowed so the DMD / backglass keep their last view.
export function subscribe(cb, intervalMs = 180) {
  async function poll() {
    try {
      const res = await fetch(PATH, { cache: 'no-store' });
      if (res.ok) {
        const text = await res.text();
        if (text) cb(JSON.parse(text));
      }
    } catch (e) {
      /* relay not reachable yet */
    }
  }
  poll();
  return setInterval(poll, intervalMs);
}
