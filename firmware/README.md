# ESP32 button box firmware

The HETIC Pinball cabinet buttons are read by an ESP32 that presents itself to
the cabinet PC as a **USB HID keyboard**. Pressing a physical button sends a
key; the game maps that key to an action.

This means you do not need the ESP32 to play. A plain USB keyboard works right
now (see the controls below). The ESP32 just replaces the keyboard with real
arcade buttons later.

## The shared contract: `buttons.json`

`site/config/buttons.json` is the single source of truth. Each button has:

| Field | Used by | Meaning |
|-------|---------|---------|
| `gpio` | firmware | The ESP32 pin the button is wired to. |
| `keys` | game | `KeyboardEvent.code` values the game listens for. Any of them triggers the action. |
| `keys[0]` | firmware | The HID key the firmware emits for that button. |
| `action` | game | The game action (`flipperLeft`, `flipperRight`, `plunger`, `start`, `nudge`). |
| `active_low` | firmware | `true` means the button is wired to GND and read with an internal pull-up. |

If you change pins or keys, edit `buttons.json` and the table in
`pinball_buttons.ino` to match.

## Keyboard controls (no ESP32 needed)

| Action | Keys |
|--------|------|
| Left flipper | Left Shift, A, or Left Arrow |
| Right flipper | Right Shift, L, or Right Arrow |
| Launch ball (plunger) | Space |
| Start game | Enter or S |
| Nudge table | Down Arrow or N |

When left alone the game runs an attract demo and plays itself. Any key starts
a real game.

## Flashing the firmware

`pinball_buttons.ino` is an Arduino sketch for an **ESP32-S2 or ESP32-S3**
(these have native USB device support; a classic ESP32 does not).

1. In Arduino IDE, install the ESP32 board package and select your S2/S3 board.
2. Set **Tools > USB Mode** to **USB-OTG (TinyUSB)**.
3. Wire each arcade button between its `gpio` pin and GND. The firmware uses
   internal pull-ups, so no external resistors are needed.
4. Upload the sketch.

The board then enumerates as a keyboard. Plug it into the cabinet PC and the
buttons drive the game exactly like the keyboard keys above.

To automate the build, see the ESP32 firmware page in the Fliphetic
documentation for a GitHub Actions workflow.
