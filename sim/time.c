#include "pico/time.h"

/* JS hooks */
extern void sim_sleep_ms(uint32_t ms);
extern uint64_t sim_get_time_us(void);

void sleep_ms(uint32_t ms) {
    sim_sleep_ms(ms);
}

void sleep_us(uint64_t us) {
    sim_sleep_ms(us / 1000);
}

uint64_t time_us_64(void) {
    return sim_get_time_us();
}
