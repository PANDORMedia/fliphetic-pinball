/*
 * HETIC Pinball — ESP32 button-box firmware.
 *
 * Classic ESP32. Reads the cabinet buttons (each wired between a GPIO and
 * GND, read with an internal pull-up) and emits the live state as one JSON
 * line over USB serial at 115200 baud. The `bridge` service reads that and
 * the game streams it.
 *
 * Reporting is event-driven: a line is sent the instant a debounced button
 * changes, plus a slow heartbeat so liveness is visible. This keeps flipper
 * latency low.
 *
 * Keep this table in sync with site/config/buttons.json ("gpio" -> pin).
 * All pins here are 0-33 and use internal pull-ups; GPIO 34-39 are input-only
 * with no pull-up and would need an external resistor.
 */
#include <Arduino.h>

static const uint32_t BAUD         = 115200;
static const uint32_t DEBOUNCE_MS  = 8;     // matches buttons.json debounce_ms
static const uint32_t HEARTBEAT_MS = 250;   // max gap between reports when idle

struct Button {
  const char *id;
  uint8_t     pin;
  bool        stable;     // debounced state, true = pressed
  bool        lastRead;
  uint32_t    changedAt;
};

// --- edit to match site/config/buttons.json --------------------------------
Button buttons[] = {
  { "black-left",        16, false, false, 0 },
  { "white-left",         4, false, false, 0 },
  { "front-left-green",  17, false, false, 0 },
  { "front-left-yellow", 18, false, false, 0 },
  { "front-left-red",    19, false, false, 0 },
  { "black-right",       13, false, false, 0 },
  { "white-right",       25, false, false, 0 },
  { "front-white",       33, false, false, 0 },
  { "plunger",           32, false, false, 0 },
};
const int N = sizeof(buttons) / sizeof(buttons[0]);

uint32_t lastReport = 0;

// one JSON state line
void report() {
  Serial.print("{\"buttons\":{");
  for (int i = 0; i < N; i++) {
    Serial.print('"');
    Serial.print(buttons[i].id);
    Serial.print("\":");
    Serial.print(buttons[i].stable ? "true" : "false");
    if (i < N - 1) Serial.print(',');
  }
  Serial.print("},\"up\":");
  Serial.print(millis());
  Serial.println("}");
}

void setup() {
  Serial.begin(BAUD);
  for (int i = 0; i < N; i++) {
    pinMode(buttons[i].pin, INPUT_PULLUP);
  }
}

void loop() {
  uint32_t now = millis();
  bool dirty = false;

  // debounced button read (active-low: pressed reads LOW)
  for (int i = 0; i < N; i++) {
    bool pressed = digitalRead(buttons[i].pin) == LOW;
    if (pressed != buttons[i].lastRead) {
      buttons[i].lastRead = pressed;
      buttons[i].changedAt = now;
    }
    if (now - buttons[i].changedAt >= DEBOUNCE_MS && buttons[i].stable != pressed) {
      buttons[i].stable = pressed;
      dirty = true;
    }
  }

  // report immediately on any change, otherwise on a slow heartbeat
  if (dirty || now - lastReport >= HEARTBEAT_MS) {
    lastReport = now;
    report();
  }
}
