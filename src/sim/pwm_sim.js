/**
 * pwm_sim.js — PWM State Engine
 *
 * This is the core PWM hardware simulation for the Pico W simulator.
 * It manages 8 PWM slices, each with 2 channels (A and B), matching
 * the real Pico's PWM hardware.
 *
 * RESPONSIBILITIES:
 *   - Track slice state: wrap value, channel levels, enabled flag
 *   - Map GPIO pins to slices/channels (Pico hardware mapping)
 *   - Calculate duty cycle as level / (wrap + 1)
 *   - Report whether a GPIO has active PWM
 *
 * DOES NOT:
 *   - Generate actual waveforms or timing signals
 *   - Touch the DOM or UI
 *   - Communicate with the Web Worker
 *   - Modify GPIO state (PWM is a separate layer)
 *
 * PICO PWM MAPPING:
 *   Slice   = floor(GPIO / 2)
 *   Channel = GPIO % 2   (0 = A, 1 = B)
 *
 * This module is the "truth" for PWM state on the main thread.
 */

// ---------- Constants ----------

const NUM_SLICES = 8;    // Pico has 8 PWM slices
const NUM_CHANNELS = 2;  // Each slice has 2 channels (A, B)
const DEFAULT_WRAP = 65535; // 16-bit counter max

// ---------- Slice State ----------

/**
 * Each slice is an object:
 *   wrap     : number   — counter wrap (TOP) value (0–65535)
 *   levels   : number[] — compare level per channel [A, B] (0–65535)
 *   enabled  : boolean  — whether the slice is running
 */
function createDefaultSlice() {
    return {
        wrap: DEFAULT_WRAP,
        levels: [0, 0],  // [Channel A, Channel B]
        enabled: false
    };
}

const slices = [];
for (let i = 0; i < NUM_SLICES; i++) {
    slices.push(createDefaultSlice());
}

// ---------- GPIO ↔ Slice Mapping ----------

/**
 * Get the PWM slice number for a GPIO pin.
 * Mirrors: pwm_gpio_to_slice_num()
 *
 * Mapping: slice = floor(gpio / 2)
 *
 * @param {number} gpio — GPIO number (0–29)
 * @returns {number} — slice number (0–7), or -1 if out of PWM range
 */
export function gpioToSlice(gpio) {
    const slice = Math.floor(gpio / 2);
    if (slice < 0 || slice >= NUM_SLICES) return -1;
    return slice;
}

/**
 * Get the PWM channel for a GPIO pin.
 *
 * Mapping: channel = gpio % 2  (0 = A, 1 = B)
 *
 * @param {number} gpio — GPIO number (0–29)
 * @returns {number} — 0 (channel A) or 1 (channel B)
 */
export function gpioToChannel(gpio) {
    return gpio % 2;
}

// ---------- Slice Configuration ----------

/**
 * Set the wrap (TOP) value for a PWM slice.
 * The counter counts from 0 to wrap, then resets.
 * Mirrors: pwm_set_wrap()
 *
 * @param {number} slice — slice number (0–7)
 * @param {number} wrap  — wrap value (0–65535)
 */
export function setWrap(slice, wrap) {
    if (slice < 0 || slice >= NUM_SLICES) return;
    slices[slice].wrap = Math.max(0, Math.min(65535, wrap));
}

/**
 * Set the compare level for a specific channel.
 * Duty cycle = level / (wrap + 1).
 * Mirrors: pwm_set_chan_level()
 *
 * @param {number} slice   — slice number (0–7)
 * @param {number} channel — 0 (A) or 1 (B)
 * @param {number} level   — compare level (0–65535)
 */
export function setLevel(slice, channel, level) {
    if (slice < 0 || slice >= NUM_SLICES) return;
    if (channel < 0 || channel >= NUM_CHANNELS) return;
    slices[slice].levels[channel] = Math.max(0, Math.min(65535, level));
}

/**
 * Enable or disable a PWM slice.
 * Mirrors: pwm_set_enabled()
 *
 * @param {number} slice    — slice number (0–7)
 * @param {boolean} enabled — true to enable, false to disable
 */
export function setEnabled(slice, enabled) {
    if (slice < 0 || slice >= NUM_SLICES) return;
    slices[slice].enabled = !!enabled;
}

// ---------- Duty Cycle Queries ----------

/**
 * Get the duty cycle for a GPIO pin as a value from 0.0 to 1.0.
 * Returns 0 if the pin's slice is not enabled.
 *
 * Calculation: level / (wrap + 1)
 *
 * @param {number} gpio — GPIO number (0–29)
 * @returns {number} — duty cycle (0.0 to 1.0)
 */
export function getDutyCycle(gpio) {
    const slice = gpioToSlice(gpio);
    if (slice < 0 || !slices[slice].enabled) return 0;

    const channel = gpioToChannel(gpio);
    const level = slices[slice].levels[channel];
    const wrap = slices[slice].wrap;

    // Avoid division by zero
    if (wrap === 0) return level > 0 ? 1 : 0;

    return Math.min(1, level / (wrap + 1));
}

/**
 * Check if a GPIO pin has active PWM output.
 * Active means: the slice is enabled AND the level is > 0.
 *
 * @param {number} gpio — GPIO number (0–29)
 * @returns {boolean}
 */
export function isPwmActive(gpio) {
    const slice = gpioToSlice(gpio);
    if (slice < 0 || !slices[slice].enabled) return false;

    const channel = gpioToChannel(gpio);
    return slices[slice].levels[channel] > 0;
}

/**
 * Get the full state of a slice (for debugging / watch panels).
 *
 * @param {number} slice — slice number (0–7)
 * @returns {object|null}
 */
export function getSliceState(slice) {
    if (slice < 0 || slice >= NUM_SLICES) return null;
    return { ...slices[slice], levels: [...slices[slice].levels] };
}

// ---------- Lifecycle ----------

/**
 * Reset all PWM slices to default state.
 * Called on simulation stop or system reset.
 */
export function resetAll() {
    for (let i = 0; i < NUM_SLICES; i++) {
        slices[i] = createDefaultSlice();
    }
}
