# HETIC Pinball

A top-down Three.js pinball game, built as a [Fliphetic](https://github.com/PANDORMedia/fliphetic)
app for the virtual pinball cabinet. It drives **all three cabinet screens**,
plays itself in an attract demo when left alone, and is controlled by a
keyboard or an ESP32 button box.

## The three screens

| Screen | Shows |
|--------|-------|
| `playfield` | The game itself: an orthographic top-down pinball table. |
| `backglass` | Matrix-rain backglass art with the live score and HETIC progress. |
| `dmd` | A dot-matrix display: live score, ball, and messages. |

The playfield broadcasts live game state to a small relay service; the DMD and
backglass poll it. All three screens are served by one nginx service.

## Controls

| Action | Keys |
|--------|------|
| Left flipper | Left Shift, A, or Left Arrow |
| Right flipper | Right Shift, L, or Right Arrow |
| Plunger | **Hold** Space to charge, release to launch |
| Start game | Enter or S |
| Nudge table | Down Arrow or N |

Controls are defined in `site/config/buttons.json`. Edit that file to remap
them; it is also the contract for the ESP32 button box (see `firmware/`). The
game works with a plain keyboard now; the ESP32 is optional.

## Gameplay

* The plunger is a proper shooter circuit: charge it, launch the ball up the
  lane, and a one-way gate keeps the ball in play once it is out.
* Hit the three pop bumpers and the slingshots for points.
* Knock down the five **HETIC** targets to light them; light all five for a
  25,000 point bonus.
* Three balls per game. When left alone the game runs an attract demo and
  plays itself; any key starts a real game.

## Project layout

```
fliphetic.toml             Fliphetic app manifest (three screens)
deploy/
  docker-compose.yml       nginx (game) + node (relay)
  nginx.conf               serves the game, proxies /state to the relay
relay/server.js            tiny in-memory state relay (no dependencies)
site/
  index.html               shell for the three screens
  style.css                Matrix-themed styling
  vendor/three.module.js   Three.js (vendored, no CDN dependency)
  js/
    main.js                screen router (?screen=)
    game.js                playfield: scene, state machine, attract AI
    physics.js             2D pinball physics
    table.js               table layout and Three.js meshes
    input.js               keyboard / ESP32 input
    net.js                 state channel to the DMD and backglass
    dmd.js                 dot-matrix screen
    backglass.js           backglass screen
  config/buttons.json      button map (keyboard + ESP32)
firmware/
  pinball_buttons.ino      ESP32-S2/S3 USB HID keyboard sketch
  README.md                wiring and flashing notes
```

## Run locally

```sh
docker compose -f deploy/docker-compose.yml up -d
docker compose -f deploy/docker-compose.yml port game 80
```

Open the printed URL for the playfield, add `/?screen=dmd` or
`/?screen=backglass` for the other screens.

## Deploy to a cabinet

Register this repository's git URL on the Fliphetic dashboard, then load the
app. It claims all three screens.
