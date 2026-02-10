#include "hardware/pwm.h"

/* JS Hooks */
extern void sim_pwm_set_wrap(uint slice, uint16_t wrap);
extern void sim_pwm_set_gpio_level(uint gpio, uint16_t level);
extern void sim_pwm_set_enabled(uint slice, bool enabled);

uint pwm_gpio_to_slice_num(uint gpio) {
    return gpio >> 1; // Simplified slice mapping (0-7 for 0-15)
}

void pwm_set_wrap(uint slice_num, uint16_t wrap) {
    sim_pwm_set_wrap(slice_num, wrap);
}

void pwm_set_gpio_level(uint gpio, uint16_t level) {
    sim_pwm_set_gpio_level(gpio, level);
}

void pwm_set_enabled(uint slice_num, bool enabled) {
    sim_pwm_set_enabled(slice_num, enabled);
}
