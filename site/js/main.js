// main.js
// Screen router. The Fliphetic manifest points each cabinet screen at this
// page with a ?screen= query param; we load the matching view.
//   (default)         -> playfield (the Three.js game)
//   ?screen=dmd       -> dot-matrix score display
//   ?screen=backglass -> backglass art

const screen = (new URLSearchParams(location.search).get('screen') || 'playfield')
  .toLowerCase();
document.body.dataset.screen = screen;

if (screen === 'dmd') {
  import('./dmd.js').then((m) => m.start());
} else if (screen === 'backglass') {
  import('./backglass.js').then((m) => m.start());
} else {
  import('./game.js').then((m) => m.start());
}
