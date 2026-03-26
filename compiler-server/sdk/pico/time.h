/*
 * pico/time.h — Timing API for Emscripten compilation
 */

#ifndef PICO_TIME_H
#define PICO_TIME_H

#include "pico/types.h"

void     sleep_ms(uint32_t ms);
void     sleep_us(uint64_t us);
uint64_t time_us_64(void);
void     busy_wait_us(uint64_t us);

#endif /* PICO_TIME_H */
