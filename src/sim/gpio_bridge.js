/**
 * gpio_bridge.js — GPIO Bridge Layer (Public API)
 *
 * This is the ONLY module that SimulatorBridge.js and other parts of
 * the simulator should call for GPIO operations.
 *
 * DATA FLOW:
 *   Worker ("ON:15") → SimulatorBridge → gpio_bridge.handlePinAction()
 *                                         → gpio_sim.writePin()
 *
 *   Button press → SimulatorBridge.updateGpioInputStates()
 *                   → gpio_bridge.updateInputState()
 *                     → gpio_sim.setInputValue()
 *                     → Atomics.store() to SharedArrayBuffer
 *
 * RESPONSIBILITIES:
 *   - Translate worker messages ("ON", "OFF", "TOGGLE") into gpio_sim calls
 *   - Manage SharedArrayBuffer writes for input state sync
 *   - Provide clean API for querying pin states
 *   - Act as the single entry point for all GPIO operations
 *
 * DOES NOT:
 *   - Perform circuit analysis (BFS stays in SimulatorBridge)
 *   - Manage LED visuals (SimulatorBridge.updateCircuit handles that)
 *   - Communicate directly with the Web Worker
 */

import {
    writePin,
    readPin,
    setInputValue,
    initPin,
    setDirection,
    setPull,
    isPinHigh,
    getOutputStates,
    resetAll,
    getPinState,
    setOnOutputChange,
    GPIO_IN,
    GPIO_OUT,
    PULL_NONE,
    PULL_UP,
    PULL_DOWN
} from './gpio_sim.js';
import { debug } from './serial_bridge.js';

// Re-export constants so consumers only need to import from the bridge
export { GPIO_IN, GPIO_OUT, PULL_NONE, PULL_UP, PULL_DOWN };

// Optimization Map (Step 20)
// Prevents writing the identical byte over the Array Buffer
const lastWrittenPinState = new Map();

// ---------- Pin Initialization ----------

/**
 * Initialize a GPIO pin with direction.
 * Called when the worker sends a CREATE message (e.g., "CREATE:15:1").
 * Ensures gpio_sim marks the pin as initialized so the state inspector
 * can display it.
 *
 * @param {number} pin — GPIO number (0–29)
 * @param {number} dir — GPIO_IN (0) or GPIO_OUT (1)
 */
export function initializePin(pin, dir) {
    initPin(pin);
    setDirection(pin, dir);
    debug('gpio_bridge', `Pin GP${pin} initialized as ${dir === GPIO_OUT ? 'OUTPUT' : 'INPUT'}`);
}

// ---------- Pin Action Handling ----------

/**
 * Handle a pin output action from the worker.
 * Translates the existing message format ("ON", "OFF", "TOGGLE")
 * into structured gpio_sim state changes.
 *
 * This replaces the old inline logic in SimulatorBridge.handlePinStateChange():
 *   if (action === 'ON')     this.pinStates[gpNum] = true;
 *   else if (action === 'OFF')  this.pinStates[gpNum] = false;
 *   else if (action === 'TOGGLE') this.pinStates[gpNum] = !this.pinStates[gpNum];
 *
 * @param {number} pin    — GPIO number (0–29)
 * @param {string} action — "ON", "OFF", or "TOGGLE"
 */
export function handlePinAction(pin, action) {
    switch (action) {
        case 'ON':
            writePin(pin, 1);
            break;
        case 'OFF':
            writePin(pin, 0);
            break;
        case 'TOGGLE':
            // Read current output and flip it
            const current = isPinHigh(pin) ? 0 : 1;
            writePin(pin, current);
            break;
        default:
            debug('gpio_bridge', `Unknown action: ${action} for pin ${pin}`);
    }
}

// ---------- Input State Management ----------

/**
 * Update the input value for a GPIO pin and sync to SharedArrayBuffer.
 * Called by SimulatorBridge.updateGpioInputStates() after circuit analysis.
 *
 * The value is stored as `externalDrive` in gpio_sim:
 *   - 0 or 1 = pin is externally driven (e.g., button connects to GND)
 *   - null   = pin is floating (e.g., button released, no connection)
 *
 * For SharedArrayBuffer sync, we write the EFFECTIVE value (computed by
 * readPin, which applies pull-resistor defaults for floating pins).
 *
 * @param {number} pin            — GPIO number (0–29)
 * @param {number|null} value     — 0 or 1 (driven), or null (floating)
 * @param {Int32Array|null} sharedPins — SharedArrayBuffer view (for Atomics)
 * @param {Worker|null} worker    — fallback: post message to worker
 */
export function updateInputState(pin, value, sharedPins, worker) {
    // Update the state engine (sets externalDrive)
    setInputValue(pin, value);

    // Compute effective value (accounts for pull resistors when floating)
    const effectiveValue = readPin(pin);

    // Sync effective value to SharedArrayBuffer for instant worker access
    if (sharedPins) {
        // Step 20 - Performance bounds
        if (lastWrittenPinState.get(pin) !== effectiveValue) {
            Atomics.store(sharedPins, pin, effectiveValue);
            lastWrittenPinState.set(pin, effectiveValue);
        }
    } else if (worker) {
        // Fallback for browsers without SharedArrayBuffer
        if (lastWrittenPinState.get(pin) !== effectiveValue) {
            worker.postMessage({
                type: 'PIN_UPDATE',
                pin: pin,
                value: effectiveValue
            });
            lastWrittenPinState.set(pin, effectiveValue);
        }
    }
}

// ---------- State Queries ----------

/**
 * Check if a GPIO pin's output is currently HIGH.
 * Direct replacement for `this.pinStates[gpNum]` checks in SimulatorBridge.
 *
 * @param {number} pin — GPIO number (0–29)
 * @returns {boolean}
 */
export function isOutputHigh(pin) {
    return isPinHigh(pin);
}

/**
 * Get the full state of a pin (for debugging / watch panels).
 *
 * @param {number} pin — GPIO number (0–29)
 * @returns {object|null}
 */
export function queryPinState(pin) {
    return getPinState(pin);
}

/**
 * Get all output states as a map (for backward compatibility).
 * Returns: { 0: true, 15: true, ... } — only HIGH pins included.
 *
 * @returns {object}
 */
export function getAllOutputStates() {
    return getOutputStates();
}

// ---------- Lifecycle ----------

/**
 * Reset all GPIO pins to default state.
 * Called on simulation stop or system reset.
 */
export function resetGpio() {
    resetAll();
}

/**
 * Initialize shared memory for input state sync.
 * Called once when SharedArrayBuffer is created.
 * Sets all pins to HIGH (1) for default PULL_UP behavior.
 *
 * @param {Int32Array} sharedPins — SharedArrayBuffer view
 */
export function initSharedMemory(sharedPins) {
    if (sharedPins) {
        sharedPins.fill(1); // Default HIGH for PULL_UP
    }
}

/**
 * Register a callback for when any output pin changes.
 * Useful for future features (interrupts, PWM, logging).
 *
 * @param {function} callback — function(pin, value)
 */
export function onOutputChange(callback) {
    setOnOutputChange(callback);
}
