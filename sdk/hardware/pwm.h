/*
 * ============================================================
 * pwm.h — Pico SDK PWM Interface (Documentation Reference)
 * ============================================================
 *
 * This file documents the target C API for PWM operations.
 * It mirrors the real Raspberry Pi Pico SDK hardware/pwm.h
 *
 * THIS FILE IS NOT COMPILED OR EXECUTED.
 * It exists as the architectural reference for the simulator's
 * PWM layer. All JS implementations in sim/pwm_sim.js and
 * sim/pwm_bridge.js follow the naming and behavior defined here.
 *
 * SIMULATOR BEHAVIOR:
 *   - PWM duty cycle is mapped to LED brightness (opacity)
 *   - No clock-accurate waveform simulation
 *   - 8 slices × 2 channels, matching real hardware
 *   - Duty cycle = level / (wrap + 1)
 *
 * PICO PWM ARCHITECTURE:
 *   Slice = GPIO / 2    (integer division)
 *   Channel = GPIO % 2  (0 = A, 1 = B)
 *
 *   GP0  → Slice 0, Ch A    GP1  → Slice 0, Ch B
 *   GP2  → Slice 1, Ch A    GP3  → Slice 1, Ch B
 *   ...
 *   GP14 → Slice 7, Ch A    GP15 → Slice 7, Ch B
 *
 * ============================================================
 * Real Pico SDK Reference:
 *   https://www.raspberrypi.com/documentation/pico-sdk/hardware.html#group_hardware_pwm
 * ============================================================
 */

#ifndef HARDWARE_PWM_H
#define HARDWARE_PWM_H

/* ============================================================
 * STEP 6 — PWM (Current Step)
 * ============================================================ */

/*
 * Determine the PWM slice for a given GPIO pin.
 *
 * @param gpio — GPIO number (0–29)
 * @return     — slice number (0–7)
 */
uint pwm_gpio_to_slice_num(uint gpio);

/*
 * Set the wrap (TOP) value for a PWM slice.
 * The counter counts from 0 to wrap, then resets.
 *
 * @param slice_num — slice number (0–7)
 * @param wrap      — wrap value (0–65535)
 */
void pwm_set_wrap(uint slice_num, uint16_t wrap);

/*
 * Set the compare level for a specific PWM channel.
 * Duty cycle = level / (wrap + 1).
 *
 * @param slice_num — slice number (0–7)
 * @param chan      — channel (0 = A, 1 = B)
 * @param level     — compare level (0–65535)
 */
void pwm_set_chan_level(uint slice_num, uint chan, uint16_t level);

/*
 * Set the PWM level for a GPIO pin directly.
 * Convenience function that determines the slice/channel
 * from the GPIO number.
 *
 * @param gpio  — GPIO number (0–29)
 * @param level — compare level (0–65535)
 */
void pwm_set_gpio_level(uint gpio, uint16_t level);

/*
 * Enable or disable a PWM slice.
 * PWM output only occurs when the slice is enabled.
 *
 * @param slice_num — slice number (0–7)
 * @param enabled   — true to enable, false to disable
 */
void pwm_set_enabled(uint slice_num, bool enabled);

/*
 * Set the GPIO function to PWM.
 * Must be called before using PWM on a pin.
 * (In simulator, this is a no-op — included for API compatibility.)
 *
 * @param gpio — GPIO number (0–29)
 */
void gpio_set_function(uint gpio, uint fn);

/* PWM function constant for gpio_set_function */
#define GPIO_FUNC_PWM 4

#endif /* HARDWARE_PWM_H */
