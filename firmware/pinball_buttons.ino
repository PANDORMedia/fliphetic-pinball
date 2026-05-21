/*
 * HETIC Pinball - ESP32 button box firmware.
 *
 * The ESP32-S2 / ESP32-S3 presents itself to the cabinet PC as a USB HID
 * keyboard. Each arcade button is wired between a GPIO pin and GND. When a
 * button is pressed the firmware sends the matching key, which the pinball
 * game (site/js/input.js) maps to a game action.
 *
 * Keep this table in sync with site/config/buttons.json:
 *   buttons.json "gpio"    -> the `pin` field below
 *   buttons.json "keys[0]" -> the `key` field below
 *
 * Board: any ESP32-S2 or ESP32-S3 dev board. In Arduino IDE, select the
 * board and set "USB Mode" to "USB-OTG (TinyUSB)". A classic ESP32 has no
 * native USB device support; use an S2/S3, or a BLE keyboard library.
 */

#include "USB.h"
#include "USBHIDKeyboard.h"

USBHIDKeyboard Keyboard;

struct Button {
  const char *id;
  uint8_t pin;     // matches buttons.json "gpio"
  uint8_t key;     // HID key, matches buttons.json "keys[0]"
  bool stable;     // debounced state, true = pressed
  bool lastRead;
  uint32_t changedAt;
};

// Edit this table to match site/config/buttons.json.
Button buttons[] = {
  { "flipper-left",  12, KEY_LEFT_SHIFT,  false, false, 0 },
  { "flipper-right", 14, KEY_RIGHT_SHIFT, false, false, 0 },
  { "plunger",       27, ' ',             false, false, 0 },
  { "start",         26, KEY_RETURN,      false, false, 0 },
  { "nudge",         25, KEY_DOWN_ARROW,  false, false, 0 },
};
const int BUTTON_COUNT = sizeof(buttons) / sizeof(buttons[0]);
const uint32_t DEBOUNCE_MS = 8;

void setup() {
  for (int i = 0; i < BUTTON_COUNT; i++) {
    pinMode(buttons[i].pin, INPUT_PULLUP); // active_low: pressed reads LOW
  }
  Keyboard.begin();
  USB.begin();
}

void loop() {
  uint32_t now = millis();
  for (int i = 0; i < BUTTON_COUNT; i++) {
    bool pressed = digitalRead(buttons[i].pin) == LOW;
    if (pressed != buttons[i].lastRead) {
      buttons[i].lastRead = pressed;
      buttons[i].changedAt = now;
    }
    if (now - buttons[i].changedAt >= DEBOUNCE_MS &&
        pressed != buttons[i].stable) {
      buttons[i].stable = pressed;
      if (pressed) Keyboard.press(buttons[i].key);
      else         Keyboard.release(buttons[i].key);
    }
  }
  delay(2); // ~250 Hz poll, matches buttons.json "poll_hz"
}
