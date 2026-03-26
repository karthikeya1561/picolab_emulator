/*
 * ============================================================
 * gpio.h — Pico SDK GPIO Interface (Documentation Reference)
 * ============================================================
 *
 * This file documents the target C API for GPIO operations.
 * It mirrors the real Raspberry Pi Pico SDK hardware/gpio.h
 *
 * THIS FILE IS NOT COMPILED OR EXECUTED.
 * It exists as the architectural reference for the simulator's
 * GPIO layer. All JS implementations in sim/gpio_sim.js and
 * sim/gpio_bridge.js follow the naming and behavior defined here.
 *
 * When the online compiler (Phase 3, Step 12) is implemented,
 * this file will be used as the actual header for compiling
 * user C code to WASM.
 *
 * ============================================================
 * Real Pico SDK Reference:
 *   https://www.raspberrypi.com/documentation/pico-sdk/hardware.html#group_hardware_gpio
 * ============================================================
 */

#ifndef HARDWARE_GPIO_H
#define HARDWARE_GPIO_H

/* ---- Pin Direction Constants ---- */
#define GPIO_IN   0
#define GPIO_OUT  1

/* ---- Interrupt Edge Types (Step 5) ---- */
#define GPIO_IRQ_EDGE_RISE  0x1
#define GPIO_IRQ_EDGE_FALL  0x2

/* ---- Callback Type for Interrupts (Step 5) ---- */
typedef void (*gpio_irq_callback_t)(uint gpio, uint32_t events);

/* ============================================================
 * STEP 1 — Core GPIO (Implemented)
 * ============================================================ */

/*
 * Initialize a GPIO pin for use.
 * Must be called before any other GPIO function on that pin.
 *
 * @param gpio — GPIO number (0–29)
 */
void gpio_init(int gpio);

/*
 * Set the direction of a GPIO pin.
 *
 * @param gpio — GPIO number (0–29)
 * @param dir  — GPIO_IN (0) or GPIO_OUT (1)
 */
void gpio_set_dir(int gpio, int dir);

/*
 * Write a value to a GPIO output pin.
 *
 * @param gpio  — GPIO number (0–29)
 * @param value — 0 (LOW) or 1 (HIGH)
 */
void gpio_put(int gpio, int value);

/*
 * Read the current value of a GPIO pin.
 * - Output pins: returns last written value
 * - Input pins: returns current electrical state
 *
 * @param gpio — GPIO number (0–29)
 * @return     — 0 or 1
 */
int gpio_get(int gpio);

/* ============================================================
 * STEP 4 — Input Pull Resistors (Implemented)
 * ============================================================ */

/*
 * Enable internal pull-up resistor.
 * When enabled and pin is floating, gpio_get() returns 1.
 *
 * @param gpio — GPIO number (0–29)
 */
void gpio_pull_up(int gpio);

/*
 * Enable internal pull-down resistor.
 * When enabled and pin is floating, gpio_get() returns 0.
 *
 * @param gpio — GPIO number (0–29)
 */
void gpio_pull_down(int gpio);

/*
 * Disable all pull resistors on a pin.
 *
 * @param gpio — GPIO number (0–29)
 */
void gpio_disable_pulls(int gpio);

/* ============================================================
 * STEP 5 — Interrupts (Current Step)
 * ============================================================ */

/*
 * Enable GPIO interrupts with a callback.
 * The callback fires on the specified edge event(s).
 *
 * @param gpio       — GPIO number (0–29)
 * @param event_mask — GPIO_IRQ_EDGE_RISE, GPIO_IRQ_EDGE_FALL, or both
 * @param enabled    — true to enable, false to disable
 * @param callback   — function pointer for the ISR
 */
void gpio_set_irq_enabled_with_callback(
    uint gpio,
    uint32_t event_mask,
    bool enabled,
    gpio_irq_callback_t callback
);

/*
 * Acknowledge (clear) a GPIO interrupt.
 *
 * @param gpio   — GPIO number (0–29)
 * @param events — event flags to acknowledge
 */
void gpio_acknowledge_irq(uint gpio, uint32_t events);

#endif /* HARDWARE_GPIO_H */
