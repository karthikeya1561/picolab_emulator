/**
 * gpio_sim.js — GPIO State Engine
 *
 * This is the core GPIO hardware simulation for the Pico W simulator.
 * It manages the state of all 30 GPIO pins (GP0–GP29) in a structured,
 * SDK-accurate manner.
 *
 * RESPONSIBILITIES:
 *   - Track pin state: initialized, direction, output value, pull config
 *   - Track external drive state (null = floating, 0/1 = driven)
 *   - Provide read/write methods that mirror real Pico SDK behavior
 *   - Apply pull-resistor defaults when a pin is floating (not externally driven)
 *   - Fire a callback when an output pin changes (so the bridge can react)
 *   - Detect input value edges and fire IRQ callbacks (Step 5)
 *
 * INPUT PIN MODEL (Step 4):
 *   Each input pin has two layers:
 *     1. externalDrive — set by external hardware (buttons, wires, etc.)
 *        - null  = pin is floating (no external signal)
 *        - 0 / 1 = pin is actively driven LOW / HIGH
 *     2. pull — internal pull-up/pull-down resistor config
 *        - PULL_UP   = floating pin reads HIGH (1)
 *        - PULL_DOWN = floating pin reads LOW (0)
 *        - PULL_NONE = floating pin reads LOW (0, indeterminate)
 *
 *   readPin() resolves the effective value:
 *     externalDrive !== null → return externalDrive
 *     externalDrive === null → return pull default
 *
 * INTERRUPT MODEL (Step 5):
 *   Each pin can have edge-triggered IRQs:
 *     - irqMask    — bitmask: EDGE_RISE (0x1), EDGE_FALL (0x2), or both (0x3)
 *     - irqEnabled — whether IRQ detection is active
 *     - previousValue — last effective value, used for edge comparison
 *
 *   When setInputValue() changes the effective value:
 *     0 → 1 and EDGE_RISE in mask  → fire irqCallback(pin, EDGE_RISE)
 *     1 → 0 and EDGE_FALL in mask  → fire irqCallback(pin, EDGE_FALL)
 *
 * DOES NOT:
 *   - Touch the DOM or UI
 *   - Communicate with the Web Worker
 *   - Handle SharedArrayBuffer
 *   - Perform circuit analysis (that stays in SimulatorBridge)
 *
 * This module is the "truth" for GPIO pin state on the main thread.
 */

// ---------- Constants (match Pico SDK) ----------
export const GPIO_IN = 0;
export const GPIO_OUT = 1;

export const PULL_NONE = 0;
export const PULL_UP = 1;
export const PULL_DOWN = 2;

// IRQ edge types (Step 5) — match gpio.h
export const GPIO_IRQ_EDGE_RISE = 0x1;
export const GPIO_IRQ_EDGE_FALL = 0x2;

const NUM_PINS = 30; // GP0–GP29

// ---------- Pin State Array ----------

/**
 * Each pin is an object:
 *   initialized    : boolean      — has gpio_init been called?
 *   direction      : number       — GPIO_IN (0) or GPIO_OUT (1)
 *   outputValue    : number       — last written output (0 or 1)
 *   externalDrive  : number|null  — external input signal (null = floating, 0/1 = driven)
 *   pull           : number       — PULL_NONE, PULL_UP, or PULL_DOWN
 *   irqMask        : number       — bitmask of enabled edge types (Step 5)
 *   irqEnabled     : boolean      — whether IRQ is active for this pin (Step 5)
 *   previousValue  : number       — last effective input value for edge detection (Step 5)
 *
 * The effective input value is computed by readPin(), not stored directly.
 * When externalDrive is null, readPin uses the pull config as the default.
 */
function createDefaultPin() {
    return {
        initialized: false,
        direction: GPIO_IN,
        outputValue: 0,
        externalDrive: null, // null = floating (no external signal)
        pull: PULL_NONE,
        irqMask: 0,          // No edges enabled (Step 5)
        irqEnabled: false,   // IRQ not active (Step 5)
        previousValue: 0     // Last effective value for edge detection (Step 5)
    };
}

const pins = [];
for (let i = 0; i < NUM_PINS; i++) {
    pins.push(createDefaultPin());
}

// ---------- Callbacks ----------

/**
 * Optional callback fired when an output pin changes value.
 * Signature: onOutputChange(pin, value)
 *   pin   — GPIO number (0–29)
 *   value — new output value (0 or 1)
 *
 * Set via setOnOutputChange().
 */
let onOutputChange = null;

export function setOnOutputChange(callback) {
    onOutputChange = callback;
}

/**
 * Global IRQ callback fired when an input pin edge is detected.
 * Signature: irqCallback(pin, events)
 *   pin    — GPIO number (0–29)
 *   events — bitmask of detected edges (GPIO_IRQ_EDGE_RISE / GPIO_IRQ_EDGE_FALL)
 *
 * On real hardware, the Pico supports a single global GPIO IRQ callback.
 * Set via setIrqCallback().
 */
let irqCallback = null;

export function setIrqCallback(callback) {
    irqCallback = callback;
}

// ---------- SDK-Style Functions ----------

/**
 * Initialize a GPIO pin.
 * Mirrors: gpio_init(uint gpio)
 */
export function initPin(pin) {
    if (pin < 0 || pin >= NUM_PINS) return;
    pins[pin].initialized = true;
}

/**
 * Set pin direction.
 * Mirrors: gpio_set_dir(uint gpio, bool out)
 *
 * @param {number} pin — GPIO number (0–29)
 * @param {number} dir — GPIO_IN (0) or GPIO_OUT (1)
 */
export function setDirection(pin, dir) {
    if (pin < 0 || pin >= NUM_PINS) return;
    pins[pin].direction = dir;
}

/**
 * Write a value to an output pin.
 * Mirrors: gpio_put(uint gpio, bool value)
 *
 * Only meaningful for output pins, but we store the value regardless
 * (matches real hardware behavior).
 *
 * @param {number} pin   — GPIO number (0–29)
 * @param {number} value — 0 or 1
 */
export function writePin(pin, value) {
    if (pin < 0 || pin >= NUM_PINS) return;

    const prev = pins[pin].outputValue;
    pins[pin].outputValue = value ? 1 : 0;

    // Notify if output actually changed
    if (pins[pin].outputValue !== prev && onOutputChange) {
        onOutputChange(pin, pins[pin].outputValue);
    }
}

/**
 * Read the current value of a pin.
 * Mirrors: gpio_get(uint gpio)
 *
 * - For OUTPUT pins: returns the last written output value.
 * - For INPUT pins: uses the external drive model:
 *     1. If externally driven (externalDrive is 0 or 1), return that value.
 *     2. If floating (externalDrive is null), return the pull resistor default:
 *        - PULL_UP   → 1 (HIGH)
 *        - PULL_DOWN → 0 (LOW)
 *        - PULL_NONE → 0 (indeterminate, default LOW)
 *
 * @param {number} pin — GPIO number (0–29)
 * @returns {number} — 0 or 1
 */
export function readPin(pin) {
    if (pin < 0 || pin >= NUM_PINS) return 0;

    if (pins[pin].direction === GPIO_OUT) {
        return pins[pin].outputValue;
    }

    // INPUT mode: check external drive first
    if (pins[pin].externalDrive !== null) {
        return pins[pin].externalDrive;
    }

    // Pin is floating — return pull resistor default
    if (pins[pin].pull === PULL_UP) return 1;
    if (pins[pin].pull === PULL_DOWN) return 0;
    return 0; // PULL_NONE: floating with no pull, indeterminate → default LOW
}

/**
 * Set the external drive value for a pin.
 * Called by the bridge when external hardware changes (button press/release, wiring).
 * This is NOT a Pico SDK function — it's a simulator-internal operation.
 *
 * Also performs edge detection for IRQ support (Step 5):
 *   - Captures effective value BEFORE and AFTER the change
 *   - If an edge is detected and IRQ is enabled, fires the global callback
 *
 * @param {number} pin        — GPIO number (0–29)
 * @param {number|null} value — 0 or 1 (driven), or null (floating / released)
 */
export function setInputValue(pin, value) {
    if (pin < 0 || pin >= NUM_PINS) return;

    // Capture effective value BEFORE the change (for edge detection)
    const oldEffective = readPin(pin);

    // Apply new external drive
    // null/undefined = floating (no external signal)
    // 0 or 1 = actively driven by external hardware
    pins[pin].externalDrive = (value === null || value === undefined)
        ? null
        : (value ? 1 : 0);

    // Capture effective value AFTER the change
    const newEffective = readPin(pin);

    // Edge detection and IRQ firing (Step 5)
    checkAndFireIrq(pin, oldEffective, newEffective);

    // Update previous value for future edge comparisons
    pins[pin].previousValue = newEffective;
}

/**
 * Set pull-up/pull-down configuration.
 * Mirrors: gpio_pull_up / gpio_pull_down / gpio_disable_pulls
 *
 * Only sets the pull config. The effective input value is resolved
 * dynamically by readPin() — when the pin is floating (externalDrive is null),
 * readPin returns the pull default (PULL_UP → 1, PULL_DOWN → 0).
 *
 * @param {number} pin  — GPIO number (0–29)
 * @param {number} pull — PULL_NONE, PULL_UP, or PULL_DOWN
 */
export function setPull(pin, pull) {
    if (pin < 0 || pin >= NUM_PINS) return;
    pins[pin].pull = pull;
    // No immediate side effects — readPin() checks pull dynamically
}

/**
 * Get the full state of a single pin (for debugging / watch panels).
 *
 * @param {number} pin — GPIO number (0–29)
 * @returns {object|null} — copy of pin state, or null if invalid
 */
export function getPinState(pin) {
    if (pin < 0 || pin >= NUM_PINS) return null;
    return { ...pins[pin] };
}

/**
 * Get a snapshot of all pin output values.
 * Returns a plain object: { 0: true/false, 1: true/false, ... }
 * This replaces the old `this.pinStates` object in SimulatorBridge.
 *
 * @returns {object} — map of GPIO number → boolean (HIGH = true)
 */
export function getOutputStates() {
    const states = {};
    for (let i = 0; i < NUM_PINS; i++) {
        if (pins[i].outputValue) {
            states[i] = true;
        }
    }
    return states;
}

/**
 * Check if a specific pin's output is HIGH.
 * Direct replacement for `this.pinStates[gpNum]` in SimulatorBridge.
 *
 * @param {number} pin — GPIO number (0–29)
 * @returns {boolean}
 */
export function isPinHigh(pin) {
    if (pin < 0 || pin >= NUM_PINS) return false;
    return pins[pin].outputValue === 1;
}

/**
 * Reset all pins to default state.
 * Called on simulation stop or system reset.
 * Also clears the global IRQ callback.
 */
export function resetAll() {
    for (let i = 0; i < NUM_PINS; i++) {
        pins[i] = createDefaultPin();
    }
    irqCallback = null;
}

// ---------- IRQ Configuration (Step 5) ----------

/**
 * Configure edge-triggered IRQ for a pin.
 * Mirrors: gpio_set_irq_enabled_with_callback (partially)
 *
 * @param {number} pin     — GPIO number (0–29)
 * @param {number} mask    — bitmask: GPIO_IRQ_EDGE_RISE (0x1), GPIO_IRQ_EDGE_FALL (0x2), or both
 * @param {boolean} enabled — true to enable, false to disable
 */
export function setIrq(pin, mask, enabled) {
    if (pin < 0 || pin >= NUM_PINS) return;
    pins[pin].irqMask = mask;
    pins[pin].irqEnabled = enabled;
    // Snapshot the current effective value so the first edge is detected correctly
    pins[pin].previousValue = readPin(pin);
}

/**
 * Get the IRQ configuration for a pin (for debugging / watch panels).
 *
 * @param {number} pin — GPIO number (0–29)
 * @returns {object|null} — { irqMask, irqEnabled, previousValue } or null
 */
export function getIrqConfig(pin) {
    if (pin < 0 || pin >= NUM_PINS) return null;
    return {
        irqMask: pins[pin].irqMask,
        irqEnabled: pins[pin].irqEnabled,
        previousValue: pins[pin].previousValue
    };
}

// ---------- Internal: Edge Detection ----------

/**
 * Check for value edges and fire the global IRQ callback if conditions are met.
 * This is called internally by setInputValue() after applying a new drive value.
 *
 * Edge types:
 *   RISING  (0 → 1): old=0, new=1, checked against GPIO_IRQ_EDGE_RISE
 *   FALLING (1 → 0): old=1, new=0, checked against GPIO_IRQ_EDGE_FALL
 *
 * @param {number} pin      — GPIO number (0–29)
 * @param {number} oldValue — effective value before the change
 * @param {number} newValue — effective value after the change
 */
function checkAndFireIrq(pin, oldValue, newValue) {
    // No change = no edge
    if (oldValue === newValue) return;

    // IRQ must be enabled for this pin
    if (!pins[pin].irqEnabled) return;

    // No callback registered
    if (!irqCallback) return;

    // Determine which edge occurred
    let events = 0;
    if (oldValue === 0 && newValue === 1) {
        // Rising edge (0 → 1)
        events = GPIO_IRQ_EDGE_RISE;
    } else if (oldValue === 1 && newValue === 0) {
        // Falling edge (1 → 0)
        events = GPIO_IRQ_EDGE_FALL;
    }

    // Only fire if the detected edge matches the pin's IRQ mask
    if (events & pins[pin].irqMask) {
        irqCallback(pin, events);
    }
}
