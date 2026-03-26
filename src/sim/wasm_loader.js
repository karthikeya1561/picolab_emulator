/**
 * wasm_loader.js — WASM Firmware Loader
 *
 * Manages the lifecycle of compiled C firmware (WASM):
 *   - Compiles C code via the compiler server (/compile)
 *   - Loads compiled single-file JS (WASM embedded)
 *   - Wires up JS library callbacks to existing sim bridges
 *   - Ensures only one WASM instance runs at a time
 *   - Provides clean unload/reload
 *
 * DATA FLOW:
 *   SimulatorBridge.runC() → compileCode() → loadWasm()
 *   WASM Module → js_library → Module._sim_* → sim bridges
 */

import { handlePinAction, initSharedMemory } from './gpio_bridge.js';
import {
    writePin, readPin, initPin, setDirection,
    setPull, PULL_UP, PULL_DOWN, PULL_NONE
} from './gpio_sim.js';
import { initSerial, print, debug } from './serial_bridge.js';
import { time_us_64, startTimer } from './time_bridge.js';
import { pwmSetWrap, pwmSetChanLevel, pwmSetEnabled } from './pwm_bridge.js';
import {
    wifiInit, wifiDeinit, wifiEnableStaMode, wifiConnect
} from './wifi_bridge.js';
import { performReset } from './reset_bridge.js';
import { wasWatchdogReset } from './reset_sim.js';

// ---------- State ----------

let currentModule = null;
let isRunning = false;

// ---------- Public API ----------

/**
 * Compile C code via the compiler server.
 *
 * @param {string} code — user C source code
 * @returns {Promise<{js: string} | {error: string}>}
 */
export async function compileCode(code) {
    const response = await fetch('/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
    });

    if (!response.ok) {
        throw new Error(`Compiler server error: ${response.status}`);
    }

    return response.json();
}

/**
 * Load and run compiled WASM firmware from a single JS file.
 * (WASM is embedded in the JS via Emscripten -sSINGLE_FILE=1)
 *
 * @param {string} jsGlue — Emscripten JS code (with embedded WASM)
 * @returns {Promise<void>}
 */
export async function loadWasm(jsGlue) {
    // 1. Unload previous instance if running
    if (isRunning) {
        unloadWasm();
    }

    // 2. Patch import.meta.url references (they break in blob context)
    const patchedJs = jsGlue.replace(
        /import\.meta\.url/g,
        `'${window.location.href}'`
    );

    // 3. Create a blob URL for the JS module
    const blob = new Blob([patchedJs], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    try {
        // 4. Import the ES6 module factory from the blob
        const moduleFactory = await import(/* @vite-ignore */ blobUrl);
        const createModule = moduleFactory.default;

        if (typeof createModule !== 'function') {
            throw new Error('WASM module factory not found in compiled output. Check emcc flags.');
        }

        // 5. Configure Module with sim bridge callbacks
        const moduleConfig = {
            noInitialRun: false,

            // Wire GPIO
            _sim_gpio_init: (pin) => {
                initPin(pin);
                setDirection(pin, 0); // default INPUT
            },
            _sim_gpio_set_dir: (pin, dir) => setDirection(pin, dir),
            _sim_gpio_put: (pin, value) => {
                writePin(pin, value);
                handlePinAction(pin, value ? 'ON' : 'OFF');
            },
            _sim_gpio_get: (pin) => readPin(pin),
            _sim_gpio_pull_up: (pin) => setPull(pin, PULL_UP),
            _sim_gpio_pull_down: (pin) => setPull(pin, PULL_DOWN),
            _sim_gpio_disable_pulls: (pin) => setPull(pin, PULL_NONE),
            _sim_gpio_set_irq: (pin, mask, enabled) => { /* TODO */ },
            _sim_gpio_set_function: (pin, fn) => { /* no-op */ },

            // Wire Serial
            _sim_stdio_init: () => { /* already initialized */ },
            _sim_print: (str) => print(str),

            // Wire Time
            _sim_time_us_64: () => time_us_64(),

            // Wire PWM
            _sim_pwm_set_wrap: (slice, wrap) => pwmSetWrap(slice, wrap),
            _sim_pwm_set_level: (slice, ch, level) => pwmSetChanLevel(slice, ch, level),
            _sim_pwm_set_enabled: (slice, en) => pwmSetEnabled(slice, en),

            // Wire WiFi
            _sim_wifi_init: () => wifiInit(),
            _sim_wifi_deinit: () => wifiDeinit(),
            _sim_wifi_enable_sta: () => wifiEnableStaMode(),
            _sim_wifi_connect: (ssid, pw, timeout) => wifiConnect(ssid, pw, timeout),
            _sim_wifi_set_led: (gpio, value) => handlePinAction(25, value ? 'ON' : 'OFF'),

            // Wire Reset
            _sim_reset: (type) => performReset(type),
            _sim_watchdog_caused_reboot: () => wasWatchdogReset() ? 1 : 0,

            // Wire Filesystem (basic — uses localStorage)
            _sim_fs_init: () => 0,
            _sim_fs_write: (filename, data) => {
                try { localStorage.setItem('pico_fs:' + filename, data); return 0; }
                catch (e) { return -2; }
            },
            _sim_fs_read: (filename, bufferPtr, maxLen) => {
                const data = localStorage.getItem('pico_fs:' + filename);
                if (!data) return -1;
                const encoder = new TextEncoder();
                const bytes = encoder.encode(data.substring(0, maxLen - 1));
                const view = new Uint8Array(currentModule.HEAPU8.buffer, bufferPtr, maxLen);
                view.set(bytes);
                view[bytes.length] = 0;
                return 0;
            },
            _sim_fs_exists: (filename) => localStorage.getItem('pico_fs:' + filename) !== null ? 1 : 0,
            _sim_fs_delete: (filename) => {
                if (localStorage.getItem('pico_fs:' + filename) === null) return -1;
                localStorage.removeItem('pico_fs:' + filename);
                return 0;
            },

            // Emscripten print routing
            print: (text) => print(text),
            printErr: (text) => debug('wasm', text)
        };

        // 6. Instantiate the module
        currentModule = await createModule(moduleConfig);
        isRunning = true;

        console.log('[wasm_loader] WASM firmware loaded and running');

    } finally {
        URL.revokeObjectURL(blobUrl);
    }
}

/**
 * Unload the current WASM firmware instance.
 */
export function unloadWasm() {
    if (currentModule) {
        currentModule = null;
    }
    isRunning = false;
    console.log('[wasm_loader] WASM firmware unloaded');
}

/**
 * Check if a WASM firmware is currently running.
 * @returns {boolean}
 */
export function isWasmRunning() {
    return isRunning;
}

/**
 * Detect if code is C (vs Python).
 *
 * @param {string} code — source code text
 * @returns {boolean} — true if code appears to be C
 */
export function isCCode(code) {
    const trimmed = code.trim();
    return (
        trimmed.includes('#include') ||
        /\bint\s+main\s*\(/.test(trimmed) ||
        /\bvoid\s+main\s*\(/.test(trimmed) ||
        trimmed.includes('stdio_init_all') ||
        trimmed.includes('gpio_init(')
    );
}
