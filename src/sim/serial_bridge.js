/**
 * serial_bridge.js — Serial Bridge Layer (Public API)
 *
 * This is the ONLY module that SimulatorBridge.js and other sim layers
 * should call for serial/stdio output operations.
 *
 * DATA FLOW:
 *   Worker stdout      → SimulatorBridge.onmessage → serial_bridge.print()
 *                                                      → serial_sim.write()
 *                                                        → DOM (#output)
 *
 *   System messages    → serial_bridge.printSystem()  → serial_sim.write()
 *   Error messages     → serial_bridge.printError()   → serial_sim.write()
 *   Internal debug     → serial_bridge.debug()        → console.log() (dev only)
 *
 * RESPONSIBILITIES:
 *   - Provide SDK-named output functions to the simulation layer
 *   - Route user-facing output to serial_sim for DOM rendering
 *   - Route internal debug output to browser console (not user-visible)
 *   - Manage serial lifecycle (init/clear)
 *
 * DOES NOT:
 *   - Touch the DOM directly (delegates to serial_sim)
 *   - Communicate with the Web Worker
 *   - Handle GPIO, timing, or any other peripheral
 */

import {
    init,
    write,
    clear,
    reset,
    isInitialized
} from './serial_sim.js';

// ---------- Lifecycle ----------

/**
 * Initialize the serial output system.
 * Binds to the Serial Monitor DOM element.
 * Mirrors: stdio_init_all() from pico/stdio.h
 *
 * @param {HTMLElement} outputElement — the #output DOM element
 */
export function initSerial(outputElement) {
    init(outputElement);
}

/**
 * Clear all serial output from the Serial Monitor.
 */
export function clearSerial() {
    clear();
}

/**
 * Reset the serial system (called on simulation stop).
 */
export function resetSerial() {
    reset();
}

// ---------- User-Facing Output ----------

/**
 * Print text to the Serial Monitor.
 * This is the primary output function for user firmware stdout.
 * Mirrors: printf() / puts() from pico/stdio.h
 *
 * @param {string} text — the text to display
 */
export function print(text) {
    write(text, 'info');
}

/**
 * Print an error message to the Serial Monitor.
 * Displayed with red styling and [Error] prefix.
 *
 * @param {string} text — the error message
 */
export function printError(text) {
    write(text, 'error');
}

/**
 * Print a warning message to the Serial Monitor.
 * Displayed with amber styling and [Warning] prefix.
 * Used for circuit validation (e.g., unconnected GPIO pins).
 *
 * @param {string} text — the warning message
 */
export function printWarning(text) {
    write(text, 'warning');
}

/**
 * Print a system message to the Serial Monitor.
 * Displayed with blue styling and [System] prefix.
 * Used for simulator lifecycle messages (init, stop, etc.)
 *
 * @param {string} text — the system message
 */
export function printSystem(text) {
    write(text, 'system');
}

// ---------- Internal Debug Output ----------

/**
 * Log a debug message to the browser console.
 * This is for internal simulator debugging ONLY — not shown in the
 * Serial Monitor. Replaces direct console.log/console.warn calls
 * in hardware sim layers (gpio_bridge, time_bridge, etc.)
 *
 * @param {string} tag — module identifier (e.g., 'time_bridge', 'gpio_bridge')
 * @param {string} message — the debug message
 */
export function debug(tag, message) {
    console.log(`[${tag}] ${message}`);
}
