/**
 * time_sim.js — Timing Simulation Engine
 *
 * Provides Pico SDK–accurate timing functions for the simulator.
 * All timing is based on performance.now() which gives microsecond-
 * precision timestamps in the browser.
 *
 * RESPONSIBILITIES:
 *   - Track simulation start time (for time_us_64)
 *   - Provide non-blocking sleep that yields to the browser event loop
 *   - Expose elapsed-time queries
 *
 * DOES NOT:
 *   - Touch the DOM or UI
 *   - Communicate with the Web Worker
 *   - Handle MicroPython timing (that's done by the WASM runtime)
 *
 * KEY DESIGN DECISION:
 *   sleep_ms() and sleep_us() return Promises. They appear synchronous
 *   to compiled C code (via Emscripten's Asyncify in the future) but
 *   never block the browser's main thread.
 *
 *   For the current MicroPython path, Python's time.sleep() is handled
 *   by the MicroPython WASM runtime inside the worker. This module is
 *   the foundation for the C compilation path (Phase 3, Step 12).
 */

// ---------- Simulation Clock ----------

/**
 * Timestamp (in microseconds) when the simulation started.
 * Set by resetClock(). All time_us readings are relative to this.
 */
let simStartUs = 0;

/**
 * Whether the simulation clock is currently running.
 */
let clockRunning = false;

// ---------- Clock Management ----------

/**
 * Reset and start the simulation clock.
 * Called when simulation starts (run button pressed).
 * Sets the reference point for time_us_64().
 */
export function resetClock() {
    simStartUs = performance.now() * 1000; // Convert ms → µs
    clockRunning = true;
}

/**
 * Stop the simulation clock.
 * Called when simulation stops.
 */
export function stopClock() {
    clockRunning = false;
}

/**
 * Check if the simulation clock is running.
 *
 * @returns {boolean}
 */
export function isClockRunning() {
    return clockRunning;
}

// ---------- SDK-Style Timing Functions ----------

/**
 * Get elapsed time since simulation start, in microseconds.
 * Mirrors: time_us_64() from pico/time.h
 *
 * Uses performance.now() which provides sub-millisecond precision.
 * Returns a 64-bit-safe integer (JavaScript can handle up to 2^53).
 *
 * @returns {number} — microseconds since simulation start
 */
export function timeUs64() {
    if (!clockRunning) return 0;
    const nowUs = performance.now() * 1000;
    return Math.floor(nowUs - simStartUs);
}

/**
 * Get elapsed time since simulation start, in milliseconds.
 * Convenience function (not in Pico SDK, but useful for the simulator).
 *
 * @returns {number} — milliseconds since simulation start
 */
export function timeMs() {
    if (!clockRunning) return 0;
    return Math.floor((performance.now() * 1000 - simStartUs) / 1000);
}

/**
 * Sleep for the specified number of milliseconds.
 * Mirrors: sleep_ms(uint32_t ms) from pico/time.h
 *
 * CRITICAL: This returns a Promise. It does NOT block the browser thread.
 * When compiled C code uses this (via Emscripten Asyncify), the C execution
 * pauses but the browser event loop continues — UI stays responsive.
 *
 * @param {number} ms — milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleepMs(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, Math.max(0, ms));
    });
}

/**
 * Sleep for the specified number of microseconds.
 * Mirrors: sleep_us(uint64_t us) from pico/time.h
 *
 * Browser setTimeout has a minimum resolution of ~1ms (4ms in background tabs).
 * For sub-millisecond sleeps, we use the best available precision but the
 * actual delay may be longer. This is acceptable for simulation purposes.
 *
 * @param {number} us — microseconds to sleep
 * @returns {Promise<void>}
 */
export function sleepUs(us) {
    const ms = us / 1000;
    return new Promise(resolve => {
        if (ms >= 1) {
            setTimeout(resolve, Math.floor(ms));
        } else {
            // Sub-millisecond: yield one event loop tick
            // Real sub-ms timing isn't possible in browsers, but we
            // yield control to avoid blocking
            setTimeout(resolve, 0);
        }
    });
}

/**
 * Busy-wait for a precise number of microseconds (up to ~10ms).
 * NOT recommended for general use — blocks the thread.
 * Only useful for hardware-accurate timing in very short bursts.
 *
 * @param {number} us — microseconds to busy-wait
 */
export function busyWaitUs(us) {
    const startUs = performance.now() * 1000;
    while ((performance.now() * 1000 - startUs) < us) {
        // Spin — intentionally blocking for precision
    }
}
