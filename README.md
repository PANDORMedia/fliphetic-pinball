# HETIC Pinball

A Matrix-themed Three.js pinball game, built as a [Fliphetic](https://github.com/PANDORMedia/fliphetic)
app for the virtual pinball cabinet. It runs on the playfield screen, plays
itself in an attract demo when left alone, and is controlled by a keyboard or
an ESP32 button box.

## Controls

| Action | Keys |
|--------|------|
| Left flipper | Left Shift, A, or Left Arrow |
| Right flipper | Right Shift, L, or Right Arrow |
| Launch ball | Space |
| Start game | Enter or S |
| Nudge table | Down Arrow or N |

The controls are defined in `site/config/buttons.json`. Edit that file to
remap them. The same file is the contract for the ESP32 button box (see
`firmware/`). The game works with a plain keyboard right now; the ESP32 is
optional.

## Attract mode

When no input is received the game enters attract mode and plays itself: the
ball auto-launches and a simple AI works the flippers. Any key starts a real
game (three balls). After a game over, or after 25 seconds of no input during
a game, it returns to attract mode.

## Gameplay

* Hit the three pop bumpers for points.
* The slingshots above the flippers kick the ball back into play.
* Knock down the five **HETIC** targets across the top to light them. Light all
  five for a 25,000 point bonus.

## Project layout

```
fliphetic.toml            the Fliphetic app manifest
deploy/docker-compose.yml  serves site/ with nginx
site/
  index.html               page shell, import map, HUD overlay
  style.css                Matrix-themed HUD styling
  vendor/three.module.js   Three.js (vendored, no CDN dependency)
  js/
    physics.js             2D pinball physics
    table.js               table layout and Three.js meshes
    input.js               loads buttons.json, keyboard to actions
    game.js                state machine, attract AI, main loop
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

Open the printed URL in a browser. The game also runs by opening `site/` with
any static file server.

## Deploy to a cabinet

Register this repository's git URL on the Fliphetic dashboard, then load the
app. It claims the `playfield` screen.
