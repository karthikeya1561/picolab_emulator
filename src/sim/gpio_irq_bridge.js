/**
 * gpio_irq_bridge.js — GPIO Interrupt Bridge Layer (Public API)
 *
 * This module provides the public API for GPIO interrupt operations.
 * It is the ONLY module that should be called by external code
 * (SimulatorBridge, future C bridge, etc.) for interrupt setup.
 *
 * DATA FLOW:
 *   User code calls enableIrq(pin, mask, enabled, callback)
 *     → gpio_sim.setIrq(pin, mask, enabled)
 *     → gpio_sim.setIrqCallback(callback)
 *
 *   When setInputValue detects an edge:
 *     → gpio_sim.checkAndFireIrq() (internal)
 *       → irqCallback(pin, events)
 *
 * RESPONSIBILITIES:
 *   - Provide SDK-named functions matching gpio.h declarations
 *   - Route IRQ config to gpio_sim
 *   - Re-export IRQ constants for consumers
 *
 * DOES NOT:
 *   - Touch the DOM or UI
 *   - Communicate with the Web Worker
 *   - Handle edge detection (that's in gpio_sim)
 *   - Modify pin values
 */

import {
    setIrq,
    setIrqCallback,
    getIrqConfig,
    GPIO_IRQ_EDGE_RISE,
    GPIO_IRQ_EDGE_FALL
} from './gpio_sim.js';

// Re-export constants so consumers only need to import from this bridge
export { GPIO_IRQ_EDGE_RISE, GPIO_IRQ_EDGE_FALL };

// ---------- IRQ Setup ----------

/**
 * Enable GPIO interrupts with a callback.
 * Mirrors: gpio_set_irq_enabled_with_callback()
 *
 * On real Pico hardware, there is a SINGLE global GPIO IRQ callback.
 * Calling this multiple times replaces the callback, but each pin
 * has its own mask and enabled state.
 *
 * @param {number} pin        — GPIO number (0–29)
 * @param {number} eventMask  — GPIO_IRQ_EDGE_RISE (0x1), GPIO_IRQ_EDGE_FALL (0x2), or both (0x3)
 * @param {boolean} enabled   — true to enable, false to disable
 * @param {function} callback — function(pin, events) called on edge detection
 */
export function enableIrq(pin, eventMask, enabled, callback) {
    // Register the global callback (single callback, like real hardware)
    if (callback) {
        setIrqCallback(callback);
    }

    // Configure per-pin IRQ mask and enabled state
    setIrq(pin, eventMask, enabled);
}

// ---------- IRQ Acknowledgment ----------

/**
 * Acknowledge (clear) a GPIO interrupt.
 * Mirrors: gpio_acknowledge_irq()
 *
 * On real hardware, this clears the interrupt flag so the ISR doesn't
 * re-trigger. In the simulator, edge detection is event-driven (not
 * flag-based), so this is a no-op stub for API compatibility.
 *
 * @param {number} pin    — GPIO number (0–29)
 * @param {number} events — event flags to acknowledge
 */
export function acknowledgeIrq(pin, events) {
    // No-op in simulator — edges are event-driven, not flag-based.
    // This exists for API compatibility with real Pico SDK code.
}

// ---------- State Queries ----------

/**
 * Get the IRQ configuration for a pin (for debugging / watch panels).
 *
 * @param {number} pin — GPIO number (0–29)
 * @returns {object|null} — { irqMask, irqEnabled, previousValue }
 */
export function queryIrqConfig(pin) {
    return getIrqConfig(pin);
}
