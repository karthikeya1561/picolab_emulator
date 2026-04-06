/*
 * ============================================================
 * watchdog.h — Pico SDK Watchdog Interface (Documentation Reference)
 * ============================================================
 *
 * This file documents the target C API for watchdog operations.
 * It mirrors the real Raspberry Pi Pico SDK hardware/watchdog.h
 *
 * THIS FILE IS NOT COMPILED OR EXECUTED.
 * It exists as the architectural reference for the simulator's
 * reset layer. The JS implementations in sim/reset_sim.js and
 * sim/reset_bridge.js follow the naming and behavior defined here.
 *
 * SIMULATOR BEHAVIOR:
 *   - watchdog_reboot() triggers a watchdog-style reset
 *   - Clears all volatile state (GPIO, PWM, WiFi, timers)
 *   - Preserves filesystem (localStorage = flash)
 *   - Worker is terminated and firmware restarts from main()
 *   - delay_ms parameter is accepted but ignored (instant reset)
 *
 * RESET BEHAVIOR MATRIX:
 *   | Event           | RAM | GPIO | WiFi | Flash |
 *   |-----------------|-----|------|------|-------|
 *   | Watchdog reset  | ❌  | ❌   | ❌   | ✅    |
 *   | Soft reset      | ❌  | ❌   | ❌   | ✅    |
 *   | Power cycle     | ❌  | ❌   | ❌   | ✅    |
 *
 * ============================================================
 * Real Pico SDK Reference:
 *   https://www.raspberrypi.com/documentation/pico-sdk/hardware.html#group_hardware_watchdog
 * ============================================================
 */

#ifndef HARDWARE_WATCHDOG_H
#define HARDWARE_WATCHDOG_H

/* ============================================================
 * STEP 11 — Reset & Power Cycle
 * ============================================================ */

/*
 * Trigger a watchdog reboot.
 *
 * On real hardware, this configures the watchdog timer to
 * reset the processor after delay_ms milliseconds.
 *
 * In the simulator, this triggers an immediate reset:
 *   - All GPIO pins reset to default
 *   - All PWM slices cleared
 *   - WiFi disconnected
 *   - Timers stopped and restarted
 *   - Serial monitor shows reset message
 *   - Firmware restarts from main()
 *   - Filesystem (flash) is preserved
 *
 * @param pc       — program counter to reboot to (ignored in sim)
 * @param sp       — stack pointer to set (ignored in sim)
 * @param delay_ms — delay in ms before reset (ignored in sim, instant)
 */
void watchdog_reboot(uint32_t pc, uint32_t sp, uint32_t delay_ms);

/*
 * Enable the watchdog timer.
 *
 * On real hardware, this starts the watchdog countdown.
 * If watchdog_update() is not called before the timeout,
 * the processor resets.
 *
 * In the simulator, this is a no-op (included for API compatibility).
 *
 * @param delay_ms — watchdog timeout in milliseconds
 * @param pause_on_debug — whether to pause watchdog during debug (ignored)
 */
void watchdog_enable(uint32_t delay_ms, bool pause_on_debug);

/*
 * Reset the watchdog countdown.
 *
 * Must be called periodically to prevent watchdog reset.
 * In the simulator, this is a no-op.
 */
void watchdog_update(void);

/*
 * Check if the last reboot was caused by the watchdog.
 *
 * In the simulator, this always returns false (for now).
 *
 * @return — true if last reset was watchdog-triggered
 */
bool watchdog_caused_reboot(void);

#endif /* HARDWARE_WATCHDOG_H */
