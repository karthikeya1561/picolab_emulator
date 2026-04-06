/*
 * hardware/pwm.h — PWM API for Emscripten compilation
 */

#ifndef HARDWARE_PWM_H
#define HARDWARE_PWM_H

#include "pico/types.h"

uint pwm_gpio_to_slice_num(uint gpio);
void pwm_set_wrap(uint slice_num, uint16_t wrap);
void pwm_set_chan_level(uint slice_num, uint chan, uint16_t level);
void pwm_set_gpio_level(uint gpio, uint16_t level);
void pwm_set_enabled(uint slice_num, bool enabled);

/* gpio_set_function is declared in hardware/gpio.h */

#endif /* HARDWARE_PWM_H */
