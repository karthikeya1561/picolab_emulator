/*
 * ============================================================
 * bootrom.h — Pico SDK Boot ROM Interface (Documentation Reference)
 * ============================================================
 *
 * This file documents the target C API for boot ROM operations.
 * It mirrors the real Raspberry Pi Pico SDK pico/bootrom.h
 *
 * THIS FILE IS NOT COMPILED OR EXECUTED.
 * It exists as the architectural reference for the simulator's
 * reset layer. The JS implementations in sim/reset_sim.js and
 * sim/reset_bridge.js follow the naming and behavior defined here.
 *
 * SIMULATOR BEHAVIOR:
 *   - reset_usb_boot() triggers a soft reset of the simulator
 *   - GPIO, PWM, WiFi, and timers are cleared
 *   - Filesystem (localStorage) is preserved
 *   - The worker is terminated and firmware restarts from main()
 *
 * ============================================================
 * Real Pico SDK Reference:
 *   https://www.raspberrypi.com/documentation/pico-sdk/runtime.html#group_pico_bootrom
 * ============================================================
 */

#ifndef PICO_BOOTROM_H
#define PICO_BOOTROM_H

/* ============================================================
 * STEP 11 — Reset & Power Cycle
 * ============================================================ */

/*
 * Reset the processor and enter USB boot mode (BOOTSEL).
 *
 * On real hardware, this reboots into the USB mass storage
 * bootloader for flashing new firmware.
 *
 * In the simulator, this triggers a soft reset:
 *   - All GPIO pins reset to default
 *   - All PWM slices cleared
 *   - WiFi disconnected
 *   - Timers stopped and restarted
 *   - Serial monitor shows reset message
 *   - Firmware restarts from main()
 *   - Filesystem (flash) is preserved
 *
 * @param usb_activity_gpio_pin_mask — GPIO pin mask for USB activity LED (ignored in sim)
 * @param disable_interface_mask     — interface disable mask (ignored in sim)
 */
void reset_usb_boot(uint32_t usb_activity_gpio_pin_mask, uint32_t disable_interface_mask);

#endif /* PICO_BOOTROM_H */
