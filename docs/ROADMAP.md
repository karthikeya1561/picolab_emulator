# CircuitFlow Pico W Simulator — Architecture Roadmap

> **Version:** 1.0  
> **Status:** Active Reference Document  
> **Last Updated:** 2026-02-24  
> **Rule:** Every implementation prompt must begin with:  
> *"Refer to `docs/ROADMAP.md`. We are currently implementing Phase X – Step Y. Do not deviate from roadmap structure."*

---

## Table of Contents

1. [Architectural Principles](#architectural-principles)
2. [Strict Rules](#strict-rules)
3. [Layer Definitions](#layer-definitions)
4. [Final Folder Structure](#final-folder-structure)
5. [Phase 1 — Core SDK Layer](#phase-1--core-sdk-layer)
6. [Phase 2 — Advanced Hardware](#phase-2--advanced-hardware)
7. [Phase 3 — System Control](#phase-3--system-control)
8. [Phase 4 — Platform-Level Features](#phase-4--platform-level-features)
9. [Step-by-Step Reference](#step-by-step-reference)

---

## Architectural Principles

1. **SDK-Accurate API Surface** — All function names, macros, and type signatures must match the real Raspberry Pi Pico SDK. User code written for real hardware must run unchanged in the simulator.

2. **Layer Separation** — Every feature has exactly three layers:
   - **SDK header** (`sdk/`) — declares the API (what the user sees)
   - **Bridge file** (`sim/*.c`) — implements the API by calling JS hooks
   - **Sim engine** (`sim/*_sim.js`) — provides the browser-side behavior

3. **Wrapper-First Migration** — New SDK modules wrap existing behavior before replacing it. No existing functionality is removed until the new layer is proven stable.

4. **Modular & Scalable** — Each hardware peripheral gets its own header, bridge, and sim engine. No monolithic files. No cross-layer imports except through defined interfaces.

5. **Backward Compatibility** — Every step must pass the full regression checklist before the next step begins. The simulator must remain functional at all times.

6. **Browser-Safe Execution** — The JS thread must never block. All blocking operations (sleep, network) are implemented as async under the hood while appearing synchronous to user code.

7. **Real Hardware Path** — Code that runs in the simulator must be exportable to real Pico W hardware with zero modifications to user source files.

---

## Strict Rules

> **These rules are NON-NEGOTIABLE across all phases and steps.**

| # | Rule | Rationale |
|---|------|-----------|
| 1 | **No UI rewrites** | The existing `index.html`, canvas, SVG components, and wiring system are proven and working. Never replace them. |
| 2 | **No breaking existing simulation** | `SimulatorBridge.js`, `worker.js`, and the FakePin system must continue to function during migration. New layers sit alongside, not on top of. |
| 3 | **Gradual migration only** | One step at a time. Each step is independently testable. No multi-step jumps. |
| 4 | **Modular architecture** | One file per concern. No merging of GPIO + Timer + Serial into a single file. |
| 5 | **SDK-style layering** | User code → SDK header → C bridge → JS sim engine. This chain is mandatory for every peripheral. |
| 6 | **No JS in user code** | User writes C (or MicroPython). The simulator translates. Users must never call JavaScript directly. |
| 7 | **No hard-coded pin numbers in UI logic** | The wiring system and connection graph determine which pins affect which components. |
| 8 | **Clean folder organization** | Files go in their designated layer folder. No exceptions. |
| 9 | **Pico SDK naming conventions** | `gpio_init`, `gpio_put`, `sleep_ms`, `pwm_set_wrap` — not `initGpio`, `setPinHigh`, `delay`. |
| 10 | **Flash survives reset, RAM does not** | This behavioral rule applies to all reset/reboot features. |

---

## Layer Definitions

### `sdk/` — SDK API Layer

**Purpose:** Declares the public API that user firmware code includes.

**Contains:**
- Header files (`.h`) that mirror the real Pico SDK
- Macro definitions (`GPIO_IN`, `GPIO_OUT`, `GPIO_IRQ_EDGE_RISE`, etc.)
- Function declarations (no implementations)
- Type definitions and callback typedefs

**Rules:**
- Must match real Pico SDK function signatures exactly
- No simulator-specific code allowed here
- No JavaScript, no browser APIs
- Users include these headers in their C code

**Subfolder structure:**
```
sdk/
├── hardware/        ← Hardware peripheral headers
│   ├── gpio.h
│   ├── pwm.h
│   ├── watchdog.h
│   └── ...
├── pico/            ← System-level headers
│   ├── stdlib.h
│   ├── time.h
│   ├── stdio.h
│   ├── bootrom.h
│   └── cyw43_arch.h
├── net/             ← Network headers
│   ├── http_client.h
│   └── mqtt_client.h
├── fs/              ← Filesystem headers
│   └── fs.h
└── debug/           ← Debug headers
    └── debug.h
```

---

### `sim/` — Simulation Engine Layer

**Purpose:** Implements both the C bridge files (SDK → JS) and the JavaScript simulation engines that emulate hardware behavior in the browser.

**Contains:**
- **C bridge files** (`.c`) — implement SDK functions by calling `extern` JS hooks
- **JS sim engines** (`*_sim.js`) — the actual browser-side hardware emulation

**Rules:**
- C bridge files only call `extern` JS functions, nothing else
- JS sim engines manage state, fire events, and update UI
- Each peripheral has exactly one `.c` bridge and one `_sim.js` engine
- Sim engines are the only layer allowed to call browser APIs (`setTimeout`, `fetch`, `localStorage`, DOM)

**Files:**
```
sim/
├── gpio.c              ← C bridge for GPIO
├── gpio_sim.js         ← JS GPIO state machine
├── time.c              ← C bridge for timing
├── time_sim.js         ← JS timing engine
├── stdio.c             ← C bridge for serial
├── serial_sim.js       ← JS serial output engine
├── gpio_irq.c          ← C bridge for interrupts
├── irq_sim.js          ← JS interrupt engine
├── pwm.c               ← C bridge for PWM
├── pwm_sim.js          ← JS PWM engine
├── cyw43_arch.c        ← C bridge for Wi-Fi
├── wifi_sim.js         ← JS Wi-Fi engine
├── http_client.c       ← C bridge for HTTP
├── http_sim.js         ← JS HTTP engine (fetch)
├── mqtt_client.c       ← C bridge for MQTT
├── mqtt_sim.js         ← JS MQTT engine (WebSocket)
├── fs.c                ← C bridge for filesystem
├── fs_sim.js           ← JS filesystem (localStorage)
├── reset.c             ← C bridge for reset/reboot
├── reset_sim.js        ← JS reset engine
└── debug.c             ← C bridge for debugger
```

---

### `user/` — User Firmware Layer

**Purpose:** Contains user-written firmware code that targets the Pico W.

**Contains:**
- `main.c` — the user's primary firmware file
- Additional user source files as needed

**Rules:**
- Only standard C and Pico SDK includes allowed
- No JavaScript, no simulator-specific code
- Must compile and run on real Pico W hardware without modification
- This is the "purity test" for SDK accuracy

---

### UI Layer (Existing — Do Not Modify)

**Purpose:** The existing browser UI for the simulator.

**Contains:**
- `index.html` — full page layout (Tailwind CSS)
- `src/app.js` — main entry, Monaco editor, UI bindings
- `src/canvas/` — SVG canvas, component management, zoom, drag
- `src/components/` — LED, Resistor, PushButton, Pico pin data
- `src/wires/` — wire path rendering
- `src/simulation/` — SimulatorBridge (circuit tracing, worker comms)
- `src/backend/` — Web Worker (MicroPython WASM, FakePin)
- `src/utils/` — color maps, logging
- `src/frontend/` — CSS

**Rules:**
- **DO NOT REWRITE** any of these files unless a step explicitly requires a minimal, backward-compatible modification
- New SDK/sim layers connect to the UI through the existing `SimulatorBridge` and `worker.js` interfaces
- Visual components remain SVG-based
- Wiring system remains click-to-connect

---

## Final Folder Structure

```
pico-sim/
├── sdk/                            ← SDK API headers (Pico SDK compatible)
│   ├── hardware/
│   │   ├── gpio.h                  ← Step 1, 4, 5
│   │   ├── pwm.h                   ← Step 6
│   │   └── watchdog.h              ← Step 11
│   ├── pico/
│   │   ├── stdlib.h                ← Step 1
│   │   ├── time.h                  ← Step 2
│   │   ├── stdio.h                 ← Step 3
│   │   ├── bootrom.h               ← Step 11
│   │   └── cyw43_arch.h            ← Step 7
│   ├── net/
│   │   ├── http_client.h           ← Step 8
│   │   └── mqtt_client.h           ← Step 9
│   ├── fs/
│   │   └── fs.h                    ← Step 10
│   └── debug/
│       └── debug.h                 ← Step 16
│
├── sim/                            ← C bridges + JS simulation engines
│   ├── gpio.c / gpio_sim.js        ← Step 1, 4
│   ├── gpio_irq.c / irq_sim.js    ← Step 5
│   ├── time.c / time_sim.js        ← Step 2
│   ├── stdio.c / serial_sim.js     ← Step 3
│   ├── pwm.c / pwm_sim.js          ← Step 6
│   ├── cyw43_arch.c / wifi_sim.js  ← Step 7
│   ├── http_client.c / http_sim.js ← Step 8
│   ├── mqtt_client.c / mqtt_sim.js ← Step 9
│   ├── fs.c / fs_sim.js            ← Step 10
│   ├── reset.c / reset_sim.js      ← Step 11
│   └── debug.c                     ← Step 16
│
├── user/                           ← User firmware (real Pico W compatible)
│   └── main.c
│
├── compiler-server/                ← Step 12: online compiler backend
│   ├── server.js
│   ├── sdk/
│   ├── build/
│   └── user/
│
├── hardware-build/                 ← Step 17: real Pico W export
│   ├── CMakeLists.txt
│   ├── pico_sdk_import.cmake
│   └── build/
│
├── docs/                           ← Documentation
│   └── ROADMAP.md                  ← This file (permanent reference)
│
├── src/                            ← Existing UI layer (DO NOT REWRITE)
│   ├── app.js
│   ├── canvas/
│   ├── components/
│   ├── simulation/
│   ├── wires/
│   ├── backend/
│   ├── frontend/
│   └── utils/
│
├── mp/                             ← MicroPython WASM (existing)
├── public/
├── index.html                      ← Existing UI (DO NOT REWRITE)
├── vite.config.js
└── package.json
```

---

## Phase 1 — Core SDK Layer

> **Goal:** Establish the foundational SDK architecture. GPIO, timing, serial, input, and interrupts — the five pillars of any embedded system.

### Step 1 — GPIO Output (Foundation)

**Implements:** `gpio_init()`, `gpio_set_dir()`, `gpio_put()`, `gpio_get()`

**Files created:**
| File | Layer | Purpose |
|------|-------|---------|
| `sdk/hardware/gpio.h` | SDK | GPIO API declarations + macros |
| `sdk/pico/stdlib.h` | SDK | Standard library include |
| `sim/gpio.c` | Bridge | SDK function → JS extern calls |
| `sim/gpio_sim.js` | Engine | Pin state machine (30 pins), LED update |
| `user/main.c` | User | Test: LED blink on GP15 |

**Success criteria:**
- [ ] GPIO API names match Pico SDK exactly
- [ ] LED changes visually on UI
- [ ] No JS functions visible in user code
- [ ] C code compiles unchanged for real Pico W

---

### Step 2 — Timing

**Implements:** `sleep_ms()`, `sleep_us()`, `time_us_64()`

**Files created:**
| File | Layer | Purpose |
|------|-------|---------|
| `sdk/pico/time.h` | SDK | Timing API declarations |
| `sim/time.c` | Bridge | Timing SDK → JS |
| `sim/time_sim.js` | Engine | `performance.now()`-based timing |

**Key constraint:** `sleep_ms()` must yield the browser event loop (async internally) but appear synchronous to C code.

**Success criteria:**
- [ ] `sleep_ms()` works correctly
- [ ] Timing is stable and accurate
- [ ] UI does not freeze during sleep
- [ ] Code runs unchanged on real Pico W

---

### Step 3 — Serial / stdio

**Implements:** `stdio_init_all()`, `printf()`, `puts()`

**Files created:**
| File | Layer | Purpose |
|------|-------|---------|
| `sdk/pico/stdio.h` | SDK | Serial API declarations |
| `sim/stdio.c` | Bridge | printf/puts → JS |
| `sim/serial_sim.js` | Engine | Routes output to Serial Monitor UI |

**Success criteria:**
- [ ] `stdio_init_all()` exists and is callable
- [ ] `printf()` works with format strings
- [ ] Output appears in Serial Monitor panel
- [ ] Code runs unchanged on real Pico W

---

### Step 4 — GPIO Inputs (Buttons & Pull Resistors)

**Implements:** `gpio_get()` (input mode), `gpio_pull_up()`, `gpio_pull_down()`, `gpio_disable_pulls()`

**Files modified:**
| File | Change |
|------|--------|
| `sdk/hardware/gpio.h` | Add pull function declarations |
| `sim/gpio.c` | Add pull function bridges |
| `sim/gpio_sim.js` | Add input state logic, pull-up/pull-down defaults |

**Success criteria:**
- [ ] Button press → `gpio_get()` returns 0 (with pull-up)
- [ ] Button release → `gpio_get()` returns 1 (with pull-up)
- [ ] Pull-up and pull-down behave correctly
- [ ] No hard-coded pin numbers in input handling

---

### Step 5 — GPIO Interrupts (IRQ)

**Implements:** `gpio_set_irq_enabled_with_callback()`, `gpio_acknowledge_irq()`, edge types (`GPIO_IRQ_EDGE_RISE`, `GPIO_IRQ_EDGE_FALL`)

**Files created/modified:**
| File | Layer | Purpose |
|------|-------|---------|
| `sdk/hardware/gpio.h` | SDK | Add IRQ macros, callback typedef, function declarations |
| `sim/gpio_irq.c` | Bridge | IRQ config → JS, global callback storage |
| `sim/gpio_sim.js` | Engine | Edge detection on `setInput()`, fires C callback via `ccall` |

**Success criteria:**
- [ ] Falling edge triggers callback immediately
- [ ] Rising edge triggers callback immediately
- [ ] No polling loop required in user code
- [ ] Callback function runs in C context

---

## Phase 2 — Advanced Hardware

> **Goal:** Add PWM, Wi-Fi, HTTP, MQTT, and filesystem. This phase transforms the simulator from a GPIO toy into a full IoT platform.

### Step 6 — PWM (Pulse Width Modulation)

**Implements:** `pwm_gpio_to_slice_num()`, `pwm_set_wrap()`, `pwm_set_gpio_level()`, `pwm_set_enabled()`

**Files created:**
| File | Layer | Purpose |
|------|-------|---------|
| `sdk/hardware/pwm.h` | SDK | PWM API declarations |
| `sim/pwm.c` | Bridge | PWM SDK → JS |
| `sim/pwm_sim.js` | Engine | 8 slice state, duty cycle → LED opacity |

**Visualization:** PWM duty cycle maps to LED opacity (0.0–1.0).

**Success criteria:**
- [ ] LED smoothly fades in/out
- [ ] 8 PWM slices tracked independently
- [ ] No UI freeze during fade loops
- [ ] `pwm_gpio_to_slice_num()` matches real Pico mapping (`floor(gpio/2)`)

---

### Step 7 — Wi-Fi (Pico W CYW43)

**Implements:** `cyw43_arch_init()`, `cyw43_arch_enable_sta_mode()`, `cyw43_arch_wifi_connect_timeout_ms()`

**Files created:**
| File | Layer | Purpose |
|------|-------|---------|
| `sdk/pico/cyw43_arch.h` | SDK | Wi-Fi API declarations |
| `sim/cyw43_arch.c` | Bridge | Wi-Fi SDK → JS |
| `sim/wifi_sim.js` | Engine | Simulated connection state, fake IP |

**Key design:** Wi-Fi "connects" instantly in the simulator. The browser's real network stack is used for actual HTTP/MQTT in later steps.

**Success criteria:**
- [ ] `cyw43_arch_init()` returns 0 (success)
- [ ] Wi-Fi status shows "Connected" in UI
- [ ] Fake IP assigned (`192.168.1.50`)
- [ ] Code runs unchanged on real Pico W

---

### Step 8 — HTTP Client

**Implements:** `http_get(url, response, max_len)`

**Files created:**
| File | Layer | Purpose |
|------|-------|---------|
| `sdk/net/http_client.h` | SDK | HTTP API declaration |
| `sim/http_client.c` | Bridge | HTTP SDK → JS |
| `sim/http_sim.js` | Engine | Browser `fetch()` wrapper |

**Limitation:** Subject to browser CORS policy. Only CORS-enabled APIs work (ThingSpeak, public REST endpoints).

**Success criteria:**
- [ ] Real HTTP GET request succeeds from user code
- [ ] Response data appears in Serial Monitor
- [ ] Non-blocking under the hood
- [ ] Graceful error handling on network failure

---

### Step 9 — MQTT

**Implements:** `mqtt_init()`, `mqtt_connect()`, `mqtt_publish()`, `mqtt_subscribe()`

**Files created:**
| File | Layer | Purpose |
|------|-------|---------|
| `sdk/net/mqtt_client.h` | SDK | MQTT API declarations + callback typedef |
| `sim/mqtt_client.c` | Bridge | MQTT SDK → JS, callback storage |
| `sim/mqtt_sim.js` | Engine | WebSocket MQTT client (Paho.js) |

**Broker:** Uses WebSocket MQTT (port 8000/8083). Compatible with HiveMQ, EMQX, Mosquitto.

**Success criteria:**
- [ ] Publish messages to real broker
- [ ] Subscribe and receive messages
- [ ] Callback fires on incoming message
- [ ] Works across browser tabs (multi-device)

---

### Step 10 — Filesystem (Flash Persistence)

**Implements:** `fs_init()`, `fs_write()`, `fs_read()`, `fs_exists()`

**Files created:**
| File | Layer | Purpose |
|------|-------|---------|
| `sdk/fs/fs.h` | SDK | Filesystem API declarations |
| `sim/fs.c` | Bridge | FS SDK → JS |
| `sim/fs_sim.js` | Engine | `localStorage`-backed virtual filesystem |

**Key behavior:** Data persists across page reloads (simulates flash). Data survives reset but not explicit `localStorage.clear()`.

**Success criteria:**
- [ ] Write file → reload page → file still exists
- [ ] Read returns correct data
- [ ] `fs_exists()` returns correct status
- [ ] Multiple files supported independently

---

## Phase 3 — System Control

> **Goal:** Reset behavior, online compilation, and project sharing. This phase transforms the simulator into a usable tool.

### Step 11 — Reset, Boot & Power Cycle

**Implements:** `reset_usb_boot()`, `watchdog_reboot()`

**Files created:**
| File | Layer | Purpose |
|------|-------|---------|
| `sdk/pico/bootrom.h` | SDK | `reset_usb_boot()` declaration |
| `sdk/hardware/watchdog.h` | SDK | `watchdog_reboot()` declaration |
| `sim/reset.c` | Bridge | Reset SDK → JS |
| `sim/reset_sim.js` | Engine | Clears RAM state, restarts `main()`, preserves flash |

**Reset behavior matrix:**

| Event | RAM | GPIO | Wi-Fi | Flash |
|-------|-----|------|-------|-------|
| Soft reset | ❌ Cleared | ❌ Cleared | ❌ Cleared | ✅ Kept |
| Watchdog reset | ❌ Cleared | ❌ Cleared | ❌ Cleared | ✅ Kept |
| Power cycle (page reload) | ❌ Cleared | ❌ Cleared | ❌ Cleared | ✅ Kept |

**Success criteria:**
- [ ] `watchdog_reboot()` restarts `main()` cleanly
- [ ] GPIO state resets to defaults after reboot
- [ ] Flash data survives reboot
- [ ] Serial monitor shows fresh boot output

---

### Step 12 — Online Compiler (C → WASM)

**Architecture:** Server-side compilation using Emscripten.

**Components:**
| Component | Purpose |
|-----------|---------|
| `compiler-server/server.js` | Node.js Express server with `/compile` endpoint |
| `compiler-server/sdk/` | Fake Pico SDK headers (for Emscripten) |
| Emscripten toolchain | `emcc` compiles user C → WASM + JS glue |

**Flow:** Browser editor → POST `/compile` → Emscripten builds → returns WASM → browser loads & runs.

**Success criteria:**
- [ ] User edits C code in Monaco editor
- [ ] Clicks Run → code compiles server-side
- [ ] WASM loads in browser
- [ ] Serial + GPIO work as expected

---

### Step 13 — MicroPython Support

**Architecture:** MicroPython WASM VM + JS module registration.

**Modules to implement:**

| Python Module | Maps To |
|---------------|---------|
| `machine.Pin` | `gpio_sim.js` (PicoGPIO) |
| `machine.PWM` | `pwm_sim.js` (PWMSim) |
| `time` | `time_sim.js` (TimeSim) |
| `network.WLAN` | `wifi_sim.js` (WiFiSim) |
| `print()` | `serial_sim.js` (SerialSim) |

**Note:** MicroPython WASM (`mp/micropython.mjs` + `.wasm`) already exists in the project. This step extends it with proper Pico W module bindings.

**Success criteria:**
- [ ] Python code runs in browser
- [ ] `Pin`, `PWM`, `time.sleep` work correctly
- [ ] LED blinks from Python code
- [ ] `print()` output appears in Serial Monitor
- [ ] Same code runs on real Pico W MicroPython

---

### Step 14 — Project Save & Share

**Data model:**
```json
{
  "version": 1,
  "language": "c | python",
  "code": "...",
  "board": "pico_w",
  "connections": { ... }
}
```

**Features:**
| Feature | Implementation |
|---------|---------------|
| Auto-save | `localStorage` on every edit |
| Load on startup | Restores last project automatically |
| Share link | Project JSON → Base64 → URL parameter `?p=...` |
| Load from link | Detects `?p=` on startup, restores project |

**Success criteria:**
- [ ] Project persists across page reloads
- [ ] Share link generates a copyable URL
- [ ] Opening shared link loads the full project
- [ ] Both C and Python projects supported

---

## Phase 4 — Platform-Level Features

> **Goal:** Polish, professional tooling, multi-device support, and hardware export. This phase transforms the simulator into a platform.

### Step 15 — Drag-and-Drop Wiring Polish

**Enhancements to existing wiring system:**
- Connection model (`Connections.map`) becomes the single source of truth
- GPIO output only affects wired components (no hard-coded pin → LED mapping)
- Button input only affects wired GPIO pins
- SVG wires rendered interactively on pin click-and-drag

**Success criteria:**
- [ ] Pins connect visually
- [ ] Wires render cleanly on the SVG canvas
- [ ] GPIO output affects only connected devices
- [ ] Button input works through wiring, not through hard-coded pins

---

### Step 16 — Debugger

**Features:**
| Feature | Description |
|---------|-------------|
| Pause / Resume | Halts execution at next checkpoint |
| Step | Advances one checkpoint at a time |
| Breakpoints | Named checkpoints in user code via `debug_checkpoint("label")` |
| GPIO Watch | Shows real-time pin states while paused |
| System Watch | Shows Wi-Fi, MQTT, FS state |

**Files created:**
| File | Layer | Purpose |
|------|-------|---------|
| `sdk/debug/debug.h` | SDK | `debug_checkpoint()` declaration |
| `sim/debug.c` | Bridge | Checkpoint SDK → JS |
| Debugger controller (JS) | Engine | Pause/step/breakpoint logic |

**Success criteria:**
- [ ] Program pauses at breakpoints
- [ ] Step executes one checkpoint
- [ ] Resume continues normally
- [ ] GPIO and Wi-Fi state visible during pause
- [ ] Works for both C and Python

---

### Step 17 — Export to Real Pico W (UF2)

**C Export:**
- Backend builds user code with real Pico SDK + ARM toolchain
- Generates `.uf2` file
- User downloads and drag-drops to Pico W

**Python Export:**
- Downloads `main.py` directly
- User copies to Pico W via Thonny or USB

**Success criteria:**
- [ ] C code compiles with real Pico SDK
- [ ] Valid `.uf2` file generated
- [ ] UF2 runs correctly on real Pico W
- [ ] Python export provides ready-to-run `main.py`

---

### Step 18 — Multi-Device Simulation

**Architecture:**
- Each simulator instance has a unique device ID
- All instances share an MQTT broker
- Devices communicate via MQTT topics
- Independent GPIO, Wi-Fi, and filesystem per device

**Implementation:** Multiple `<iframe>` instances or separate browser tabs, each running an independent simulator connected to the same MQTT broker.

**Success criteria:**
- [ ] Multiple Pico W instances run simultaneously
- [ ] MQTT messages flow between instances in real-time
- [ ] One device can control another via MQTT
- [ ] Each device has independent state

---

### Step 19 — Classroom Dashboard

**Features:**
| Feature | How |
|---------|-----|
| Device presence | Each device publishes heartbeat via MQTT |
| Live monitoring | Teacher subscribes to `lab/+/status` |
| Remote reset | Teacher publishes to `lab/<id>/cmd` |
| Log collection | Student serial output published to `lab/<id>/log` |
| Basic grading | Automated GPIO state checks |

**Classroom modes:**

| Mode | Behavior |
|------|----------|
| Demo | Teacher controls all devices |
| Lab | Students work independently |
| Exam | No reset, no shared logs |
| Practice | Unlimited resets, full access |

**Success criteria:**
- [ ] Teacher sees all student devices
- [ ] Live GPIO / Wi-Fi state visible per student
- [ ] Teacher can reset any student device
- [ ] Student logs arrive at teacher dashboard
- [ ] Basic grading rule works

---

### Step 20 — Final Cleanup & Performance

**Tasks:**
- [ ] Remove all `console.log` debug output
- [ ] Audit and minimize bundle size
- [ ] Mobile-responsive layout adjustments
- [ ] Touch event support for wiring on mobile
- [ ] Performance profiling (target: 60fps canvas, <100ms response)
- [ ] Security review: sandbox user code execution
- [ ] Documentation: API reference for SDK headers
- [ ] README update with setup instructions

---

## Step-by-Step Reference (Quick Lookup)

| Step | Name | Phase | Key APIs |
|------|------|-------|----------|
| 1 | GPIO Output | 1 | `gpio_init`, `gpio_set_dir`, `gpio_put`, `gpio_get` |
| 2 | Timing | 1 | `sleep_ms`, `sleep_us`, `time_us_64` |
| 3 | Serial / stdio | 1 | `stdio_init_all`, `printf`, `puts` |
| 4 | GPIO Input | 1 | `gpio_pull_up`, `gpio_pull_down`, `gpio_get` (input mode) |
| 5 | Interrupts | 1 | `gpio_set_irq_enabled_with_callback`, `gpio_acknowledge_irq` |
| 6 | PWM | 2 | `pwm_gpio_to_slice_num`, `pwm_set_wrap`, `pwm_set_gpio_level` |
| 7 | Wi-Fi | 2 | `cyw43_arch_init`, `cyw43_arch_wifi_connect_timeout_ms` |
| 8 | HTTP | 2 | `http_get` |
| 9 | MQTT | 2 | `mqtt_init`, `mqtt_connect`, `mqtt_publish`, `mqtt_subscribe` |
| 10 | Filesystem | 2 | `fs_init`, `fs_write`, `fs_read`, `fs_exists` |
| 11 | Reset & Reboot | 3 | `reset_usb_boot`, `watchdog_reboot` |
| 12 | Online Compiler | 3 | Server-side Emscripten build |
| 13 | MicroPython | 3 | `machine.Pin`, `time`, `network.WLAN` |
| 14 | Save & Share | 3 | Project JSON, URL encoding |
| 15 | Wiring Polish | 4 | Connection graph, wire-driven GPIO |
| 16 | Debugger | 4 | `debug_checkpoint`, pause/step/breakpoints |
| 17 | UF2 Export | 4 | Real Pico SDK build, `.uf2` generation |
| 18 | Multi-Device | 4 | MQTT mesh, device isolation |
| 19 | Classroom | 4 | Teacher dashboard, remote control, grading |
| 20 | Final Cleanup | 4 | Performance, security, documentation |

---

> **This document is the single source of truth for the architecture migration.**  
> Every implementation prompt must reference it.  
> No deviation without explicit discussion and approval.
