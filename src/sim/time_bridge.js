/**
 * time_bridge.js — Timing Bridge Layer (Public API)
 *
 * This is the ONLY module that other parts of the simulator should
 * call for timing operations.
 *
 * RESPONSIBILITIES:
 *   - Provide SDK-named timing functions to the simulation layer
 *   - Manage simulation clock lifecycle (start/stop/reset)
 *   - Shield consumers from async implementation details
 *
 * DATA FLOW:
 *   SimulatorBridge.run()  → time_bridge.startTimer()  → time_sim.resetClock()
 *   SimulatorBridge.stop() → time_bridge.stopTimer()   → time_sim.stopClock()
 *   Future C code          → time_bridge.sleep_ms()    → time_sim.sleepMs()
 *
 * DOES NOT:
 *   - Handle MicroPython timing (that runs inside the WASM worker)
 *   - Touch the DOM or UI
 *   - Manage GPIO or any other peripheral
 */

import {
    resetClock,
    stopClock,
    isClockRunning,
    timeUs64,
    timeMs,
    sleepMs,
    sleepUs,
    busyWaitUs
} from './time_sim.js';
import { debug } from './serial_bridge.js';

// ---------- Lifecycle ----------

/**
 * Start the simulation timer.
 * Called when simulation begins (run button pressed).
 * Resets the clock to zero.
 */
export function startTimer() {
    resetClock();
    debug('time_bridge', 'Simulation clock started');
}

/**
 * Stop the simulation timer.
 * Called when simulation ends (stop button pressed).
 */
export function stopTimer() {
    stopClock();
    debug('time_bridge', 'Simulation clock stopped');
}

/**
 * Check if the simulation timer is currently running.
 *
 * @returns {boolean}
 */
export function isTimerRunning() {
    return isClockRunning();
}

// ---------- SDK-Style Timing API ----------
// These function names match the Pico SDK exactly.
// They delegate to time_sim.js for the actual implementation.

/**
 * Sleep for the given number of milliseconds.
 * Mirrors: sleep_ms(uint32_t ms)
 *
 * Non-blocking internally (returns a Promise).
 * UI remains responsive during the sleep.
 *
 * @param {number} ms — milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep_ms(ms) {
    return sleepMs(ms);
}

/**
 * Sleep for the given number of microseconds.
 * Mirrors: sleep_us(uint64_t us)
 *
 * Browser precision limitation: minimum ~1ms real delay.
 * Sub-millisecond sleeps yield one event loop tick.
 *
 * @param {number} us — microseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep_us(us) {
    return sleepUs(us);
}

/**
 * Get elapsed time since simulation start, in microseconds.
 * Mirrors: time_us_64()
 *
 * @returns {number} — microseconds since sim start
 */
export function time_us_64() {
    return timeUs64();
}

/**
 * Get elapsed time since simulation start, in milliseconds.
 * Convenience function (not in real Pico SDK).
 *
 * @returns {number} — milliseconds since sim start
 */
export function time_ms() {
    return timeMs();
}

/**
 * Busy-wait for precise microsecond timing (short bursts only).
 * Mirrors: busy_wait_us(uint64_t us)
 *
 * WARNING: Blocks the calling thread. Only use for very short durations.
 *
 * @param {number} us — microseconds to busy-wait
 */
export function busy_wait_us(us) {
    busyWaitUs(us);
}
