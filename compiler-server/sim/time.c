/*
 * time.c — C Bridge for Timing operations
 *
 * sleep_ms uses emscripten_sleep() for Asyncify-compatible non-blocking sleep.
 * time_us_64 delegates to JS performance.now()-based timing.
 */

#include "pico/time.h"
#include <emscripten.h>

extern double js_time_us_64(void);

void sleep_ms(uint32_t ms) {
    emscripten_sleep(ms);
}

void sleep_us(uint64_t us) {
    uint32_t ms = (uint32_t)(us / 1000);
    if (ms < 1) ms = 1;
    emscripten_sleep(ms);
}

uint64_t time_us_64(void) {
    return (uint64_t)js_time_us_64();
}

void busy_wait_us(uint64_t us) {
    /* In WASM, busy-wait by checking time repeatedly */
    uint64_t start = time_us_64();
    while ((time_us_64() - start) < us) {
        /* spin */
    }
}
