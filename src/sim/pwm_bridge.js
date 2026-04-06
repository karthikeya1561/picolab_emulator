/**
 * pwm_bridge.js — PWM Bridge Layer (Public API)
 *
 * This is the ONLY module that SimulatorBridge.js and other parts of
 * the simulator should call for PWM operations.
 *
 * DATA FLOW:
 *   User code → pwm_bridge.pwmSetGpioLevel(gpio, level)
 *                → pwm_sim.setLevel(slice, channel, level)
 *
 *   SimulatorBridge.updateCircuit()
 *                → pwm_bridge.isPinPwm(gpio)  → pwm_sim.isPwmActive()
 *                → pwm_bridge.getPwmDutyCycle(gpio) → pwm_sim.getDutyCycle()
 *                → setLedBrightness(led, duty)
 *
 * RESPONSIBILITIES:
 *   - Provide SDK-named functions matching pwm.h declarations
 *   - Route PWM config to pwm_sim
 *   - Provide query functions for updateCircuit
 *
 * DOES NOT:
 *   - Touch the DOM or UI
 *   - Modify GPIO state
 *   - Handle LED brightness (that's in LED.js via SimulatorBridge)
 */

import {
    gpioToSlice,
    gpioToChannel,
    setWrap,
    setLevel,
    setEnabled,
    getDutyCycle,
    isPwmActive,
    getSliceState,
    resetAll
} from './pwm_sim.js';

// ---------- SDK-Style Functions ----------

/**
 * Get the PWM slice number for a GPIO pin.
 * Mirrors: pwm_gpio_to_slice_num()
 *
 * @param {number} gpio — GPIO number (0–29)
 * @returns {number} — slice number (0–7)
 */
export function pwmGpioToSliceNum(gpio) {
    return gpioToSlice(gpio);
}

/**
 * Set the wrap (TOP) value for a PWM slice.
 * Mirrors: pwm_set_wrap()
 *
 * @param {number} sliceNum — slice number (0–7)
 * @param {number} wrap     — wrap value (0–65535)
 */
export function pwmSetWrap(sliceNum, wrap) {
    setWrap(sliceNum, wrap);
}

/**
 * Set the compare level for a specific channel.
 * Mirrors: pwm_set_chan_level()
 *
 * @param {number} sliceNum — slice number (0–7)
 * @param {number} channel  — 0 (A) or 1 (B)
 * @param {number} level    — compare level (0–65535)
 */
export function pwmSetChanLevel(sliceNum, channel, level) {
    setLevel(sliceNum, channel, level);
}

/**
 * Set the PWM level for a GPIO pin directly.
 * Convenience function — determines slice/channel from GPIO number.
 * Mirrors: pwm_set_gpio_level()
 *
 * @param {number} gpio  — GPIO number (0–29)
 * @param {number} level — compare level (0–65535)
 */
export function pwmSetGpioLevel(gpio, level) {
    const slice = gpioToSlice(gpio);
    const channel = gpioToChannel(gpio);
    if (slice >= 0) {
        setLevel(slice, channel, level);
    }
}

/**
 * Enable or disable a PWM slice.
 * Mirrors: pwm_set_enabled()
 *
 * @param {number} sliceNum — slice number (0–7)
 * @param {boolean} enabled — true to enable, false to disable
 */
export function pwmSetEnabled(sliceNum, enabled) {
    setEnabled(sliceNum, enabled);
}

// ---------- Query Functions (for SimulatorBridge) ----------

/**
 * Get the duty cycle for a GPIO pin (0.0–1.0).
 * Used by SimulatorBridge.updateCircuit() to set LED brightness.
 *
 * @param {number} gpio — GPIO number (0–29)
 * @returns {number} — duty cycle (0.0 to 1.0)
 */
export function getPwmDutyCycle(gpio) {
    return getDutyCycle(gpio);
}

/**
 * Check if a GPIO pin has active PWM output.
 * Used by SimulatorBridge.updateCircuit() to decide between
 * digital ON/OFF and PWM brightness.
 *
 * @param {number} gpio — GPIO number (0–29)
 * @returns {boolean}
 */
export function isPinPwm(gpio) {
    return isPwmActive(gpio);
}

/**
 * Get the full state of a PWM slice (for debugging / watch panels).
 *
 * @param {number} sliceNum — slice number (0–7)
 * @returns {object|null}
 */
export function querySliceState(sliceNum) {
    return getSliceState(sliceNum);
}

// ---------- Lifecycle ----------

/**
 * Reset all PWM slices to default state.
 * Called on simulation stop or system reset.
 */
export function resetPwm() {
    resetAll();
}
