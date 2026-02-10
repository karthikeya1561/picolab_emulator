#ifndef HARDWARE_PWM_H
#define HARDWARE_PWM_H

#include <stdint.h>
#include <stdbool.h>

// Standard Pico SDK typedefs (simplified)
typedef unsigned int uint;

uint pwm_gpio_to_slice_num(uint gpio);

void pwm_set_wrap(uint slice_num, uint16_t wrap);
void pwm_set_gpio_level(uint gpio, uint16_t level);
void pwm_set_enabled(uint slice_num, bool enabled);

// IOCTL for direct hardware access (simulated)
// Not strictly SDK but useful for advanced sim if needed later
// void pwm_config_set_wrap(pwm_config *c, uint16_t wrap);

#endif
