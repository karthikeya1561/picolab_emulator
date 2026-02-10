#ifndef PICO_TIME_H
#define PICO_TIME_H

#include <stdint.h>

void sleep_ms(uint32_t ms);
void sleep_us(uint64_t us);
uint64_t time_us_64(void);

#endif
