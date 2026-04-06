/**
 * reset_sim.js — Reset State Engine
 *
 * This is the core reset simulation for the Pico W simulator.
 * It orchestrates clearing all volatile hardware state while
 * preserving persistent storage (filesystem).
 *
 * RESPONSIBILITIES:
 *   - Define reset types (soft, watchdog, power cycle)
 *   - Coordinate subsystem resets in correct order
 *   - Track reset count for diagnostics
 *   - Provide query functions for reset state
 *
 * DOES NOT:
 *   - Terminate or spawn workers (that's SimulatorBridge's job)
 *   - Touch the DOM or UI
 *   - Clear the filesystem (flash survives all resets)
 *   - Manage SharedArrayBuffer (bridge layer handles that)
 *
 * RESET BEHAVIOR MATRIX:
 *   | Event           | GPIO | PWM | WiFi | Timers | Serial | Filesystem |
 *   |-----------------|------|-----|------|--------|--------|------------|
 *   | Soft reset      | ❌   | ❌  | ❌   | ❌     | ❌     | ✅ Kept    |
 *   | Watchdog reset  | ❌   | ❌  | ❌   | ❌     | ❌     | ✅ Kept    |
 *   | Power cycle     | ❌   | ❌  | ❌   | ❌     | ❌     | ✅ Kept    |
 *
 * This module is the "truth" for reset orchestration on the main thread.
 */

import { resetAll as resetGpio } from './gpio_sim.js';
import { resetAll as resetPwm } from './pwm_sim.js';
import { resetAll as resetWifi } from './wifi_sim.js';
import { stopClock as stopTimer } from './time_sim.js';
import { reset as resetSerial } from './serial_sim.js';

// ---------- Constants ----------

/** Soft reset — clears volatile state, keeps filesystem */
export const RESET_SOFT = 0;

/** Watchdog reset — same behavior as soft reset in simulator */
export const RESET_WATCHDOG = 1;

/** Power cycle — same clearing, simulates full power-off/on */
export const RESET_POWER_CYCLE = 2;

/** Human-readable labels for logging */
const RESET_LABELS = {
    [RESET_SOFT]: 'Soft Reset',
    [RESET_WATCHDOG]: 'Watchdog Reset',
    [RESET_POWER_CYCLE]: 'Power Cycle'
};

// ---------- State ----------

/**
 * Reset state tracking:
 *   resetCount   : number  — total resets performed this session
 *   lastResetType: number  — type of the most recent reset (-1 = none)
 *   lastResetTime: number  — timestamp (ms) of the most recent reset
 */
const state = {
    resetCount: 0,
    lastResetType: -1,
    lastResetTime: 0
};

// ---------- Core Reset Function ----------

/**
 * Perform a simulator reset.
 *
 * Clears all volatile hardware state in a deterministic order:
 *   1. Stop timers (prevent further callbacks)
 *   2. Reset GPIO (clear all 30 pins)
 *   3. Reset PWM (clear all 8 slices)
 *   4. Reset WiFi (disconnect, clear state)
 *   5. Reset serial init flag (keeps DOM reference)
 *
 * DOES NOT clear:
 *   - Filesystem (localStorage persists across resets)
 *   - HTTP/MQTT state (those are cleared by their own bridges on worker termination)
 *
 * @param {number} type — RESET_SOFT, RESET_WATCHDOG, or RESET_POWER_CYCLE
 * @returns {object} — { type, label, resetCount }
 */
export function simReset(type) {
    const label = RESET_LABELS[type] || 'Unknown Reset';

    // 1. Stop timers first to prevent any pending callbacks
    stopTimer();

    // 2. Reset GPIO — clear all pin states, directions, pulls, IRQs
    resetGpio();

    // 3. Reset PWM — clear all slice configurations
    resetPwm();

    // 4. Reset WiFi — disconnect, clear connection state
    resetWifi();

    // 5. Reset serial initialization flag
    //    (The DOM element reference is preserved so we can still write after restart)
    resetSerial();

    // Update tracking state
    state.resetCount++;
    state.lastResetType = type;
    state.lastResetTime = Date.now();

    console.log(`[reset_sim] ${label} completed (total resets: ${state.resetCount})`);

    return {
        type,
        label,
        resetCount: state.resetCount
    };
}

// ---------- Queries ----------

/**
 * Get the current reset state for diagnostics.
 *
 * @returns {object} — copy of the reset state
 */
export function getResetState() {
    return { ...state };
}

/**
 * Get the label for a reset type.
 *
 * @param {number} type — RESET_SOFT, RESET_WATCHDOG, or RESET_POWER_CYCLE
 * @returns {string}
 */
export function getResetLabel(type) {
    return RESET_LABELS[type] || 'Unknown';
}

/**
 * Check if the last reset was caused by a watchdog.
 * Mirrors: watchdog_caused_reboot()
 *
 * @returns {boolean}
 */
export function wasWatchdogReset() {
    return state.lastResetType === RESET_WATCHDOG;
}
