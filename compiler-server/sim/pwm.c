/*
 * pwm.c — C Bridge for PWM operations
 */

#include "hardware/pwm.h"

extern int  js_pwm_gpio_to_slice(int gpio);
extern void js_pwm_set_wrap(int slice, int wrap);
extern void js_pwm_set_level(int slice, int channel, int level);
extern void js_pwm_set_enabled(int slice, int enabled);

uint pwm_gpio_to_slice_num(uint gpio) {
    return (uint)js_pwm_gpio_to_slice((int)gpio);
}

void pwm_set_wrap(uint slice_num, uint16_t wrap) {
    js_pwm_set_wrap((int)slice_num, (int)wrap);
}

void pwm_set_chan_level(uint slice_num, uint chan, uint16_t level) {
    js_pwm_set_level((int)slice_num, (int)chan, (int)level);
}

void pwm_set_gpio_level(uint gpio, uint16_t level) {
    int slice = js_pwm_gpio_to_slice((int)gpio);
    int channel = (int)(gpio % 2);
    js_pwm_set_level(slice, channel, (int)level);
}

void pwm_set_enabled(uint slice_num, bool enabled) {
    js_pwm_set_enabled((int)slice_num, enabled ? 1 : 0);
}
