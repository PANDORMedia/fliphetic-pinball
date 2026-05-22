# ESP32 button-box firmware

Firmware for the cabinet's classic **ESP32**. It reads the cabinet buttons and
streams their state to the pinball game.

## What it does

- Reads every button (wired between a GPIO and GND, internal pull-up).
- Emits a JSON state line over USB serial (115200 baud) the instant a
  debounced button changes, plus a heartbeat every 250 ms:

  ```json
  {"buttons":{"black-left":true,"white-left":false,"...":false},"up":48213}
  ```

The `bridge` service reads this serial stream and pushes it to the game over
SSE, so a flipper press reaches the table with no polling delay.

```
ESP32  --USB serial JSON-->  bridge  --SSE /esp/events-->  pinball game
```

## The shared contract: `buttons.json`

[`site/config/buttons.json`](../site/config/buttons.json) is the single source
of truth. The firmware reads each button's `gpio`; the game maps each button
`id` to a game `action` (`flipperLeft`, `flipperRight`, `plunger`, `start`,
`nudge`, or `null` for an unused button). `keys` keep the game playable on a
plain keyboard.

If you rewire, edit `buttons.json` **and** the `buttons[]` table in
`src/main.cpp` to match. All current pins are 0-33 and use internal pull-ups —
GPIO 34-39 are input-only and would need an external pull-up resistor.

## Building

The cabinet flashes a prebuilt binary; it does not build firmware. The binary
at `firmware/build/firmware.bin` is built and committed automatically by
[`.github/workflows/firmware.yml`](../.github/workflows/firmware.yml) (a
PlatformIO build) whenever anything under `firmware/` changes.

To build locally:

```sh
pio run --project-dir firmware
```

The manifest's `[esp32.esp32]` block points the cabinet at the committed
`firmware/build/firmware.bin` (a merged image, flashed at `0x0`).
