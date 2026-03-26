/*
 * ============================================================
 * cyw43_arch.h — Pico W Wi-Fi Interface (Documentation Reference)
 * ============================================================
 *
 * This file documents the target C API for CYW43 Wi-Fi operations.
 * It mirrors the real Raspberry Pi Pico SDK pico/cyw43_arch.h
 *
 * THIS FILE IS NOT COMPILED OR EXECUTED.
 * It exists as the architectural reference for the simulator's
 * Wi-Fi layer. All JS implementations in sim/wifi_sim.js and
 * sim/wifi_bridge.js follow the naming and behavior defined here.
 *
 * SIMULATOR BEHAVIOR:
 *   - Wi-Fi "connects" instantly (no real radio simulation)
 *   - Fake IP address assigned: 192.168.1.50
 *   - CYW43 hardware is NOT emulated — only SDK-level state
 *   - Status messages printed to Serial Monitor
 *   - Real networking (HTTP/MQTT) comes in Steps 8–9
 *
 * ============================================================
 * Real Pico SDK Reference:
 *   https://www.raspberrypi.com/documentation/pico-sdk/networking.html
 * ============================================================
 */

#ifndef PICO_CYW43_ARCH_H
#define PICO_CYW43_ARCH_H

/* ============================================================
 * STEP 7 — Wi-Fi (Current Step)
 * ============================================================ */

/*
 * Initialize the CYW43 Wi-Fi driver.
 * Must be called before any other Wi-Fi function.
 *
 * @return 0 on success, non-zero on failure
 */
int cyw43_arch_init(void);

/*
 * De-initialize the CYW43 driver and free resources.
 */
void cyw43_arch_deinit(void);

/*
 * Enable Station (STA) mode.
 * In STA mode, the Pico W connects to an existing access point.
 * Must be called after cyw43_arch_init().
 */
void cyw43_arch_enable_sta_mode(void);

/*
 * Connect to a Wi-Fi network with a timeout.
 *
 * @param ssid        — network name (null-terminated string)
 * @param pw          — password (null-terminated string, or NULL for open)
 * @param auth        — authentication type (e.g., CYW43_AUTH_WPA2_AES_PSK)
 * @param timeout_ms  — connection timeout in milliseconds
 * @return 0 on success, non-zero on failure/timeout
 */
int cyw43_arch_wifi_connect_timeout_ms(const char *ssid, const char *pw, uint32_t auth, uint32_t timeout_ms);

/*
 * Control the onboard LED on the Pico W.
 * The onboard LED is connected to the CYW43 chip (not a GPIO).
 *
 * @param wl_gpio — CYW43 GPIO number (0 for onboard LED)
 * @param value   — true for ON, false for OFF
 */
void cyw43_arch_gpio_put(int wl_gpio, bool value);

/* Authentication type constants */
#define CYW43_AUTH_WPA2_AES_PSK  0x00400004
#define CYW43_AUTH_OPEN          0x00000000

/* CYW43 onboard LED GPIO */
#define CYW43_WL_GPIO_LED_PIN    0

#endif /* PICO_CYW43_ARCH_H */
