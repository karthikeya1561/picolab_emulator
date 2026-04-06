/*
 * ============================================================
 * time.h — Pico SDK Timing Interface (Documentation Reference)
 * ============================================================
 *
 * This file documents the target C API for timing operations.
 * It mirrors the real Raspberry Pi Pico SDK pico/time.h
 *
 * THIS FILE IS NOT COMPILED OR EXECUTED.
 * It exists as the architectural reference for the simulator's
 * timing layer. All JS implementations in sim/time_sim.js and
 * sim/time_bridge.js follow the naming and behavior defined here.
 *
 * When the online compiler (Phase 3, Step 12) is implemented,
 * this file will be used as the actual header for compiling
 * user C code to WASM via Emscripten.
 *
 * KEY SIMULATOR BEHAVIOR:
 *   - sleep_ms() and sleep_us() are non-blocking internally
 *     (they yield to the browser event loop via Promises)
 *   - Emscripten's Asyncify will make them appear synchronous
 *     to compiled C code while keeping the UI responsive
 *   - time_us_64() uses performance.now() for microsecond precision
 *
 * ============================================================
 * Real Pico SDK Reference:
 *   https://www.raspberrypi.com/documentation/pico-sdk/high_level.html#group_pico_time
 * ============================================================
 */

#ifndef PICO_TIME_H
#define PICO_TIME_H

#include <stdint.h>

/* ============================================================
 * STEP 2 — Core Timing (Current Step)
 * ============================================================ */

/*
 * Sleep for the specified number of milliseconds.
 * Blocks execution for the given duration.
 *
 * Simulator behavior: Non-blocking internally (async Promise).
 * The browser UI remains responsive during the sleep.
 *
 * @param ms — number of milliseconds to sleep
 */
void sleep_ms(uint32_t ms);

/*
 * Sleep for the specified number of microseconds.
 * Blocks execution for the given duration.
 *
 * Simulator behavior: Browser minimum resolution is ~1ms.
 * Sub-millisecond sleeps yield one event loop tick.
 *
 * @param us — number of microseconds to sleep
 */
void sleep_us(uint64_t us);

/*
 * Get the current time in microseconds since boot.
 *
 * Simulator: Returns microseconds since simulation start,
 * measured via performance.now() (~0.1µs precision).
 *
 * @return — 64-bit microsecond timestamp
 */
uint64_t time_us_64(void);

/*
 * Busy-wait for a precise number of microseconds.
 * Uses a spin loop — blocks the calling thread completely.
 * Only suitable for very short durations (< 10ms).
 *
 * @param us — number of microseconds to busy-wait
 */
void busy_wait_us(uint64_t us);

#endif /* PICO_TIME_H */
