/*
 * gpio.c — C Bridge for GPIO operations
 *
 * Implements Pico SDK GPIO functions by calling extern JS functions.
 * Emscripten resolves these externs via the js_library.js file.
 */

#include "hardware/gpio.h"

/* Extern JS functions (resolved by Emscripten js_library.js) */
extern void js_gpio_init(int pin);
extern void js_gpio_set_dir(int pin, int dir);
extern void js_gpio_put(int pin, int value);
extern int  js_gpio_get(int pin);
extern void js_gpio_pull_up(int pin);
extern void js_gpio_pull_down(int pin);
extern void js_gpio_disable_pulls(int pin);
extern void js_gpio_set_irq(int pin, int mask, int enabled);
extern void js_gpio_set_function(int pin, int fn);

void gpio_init(int gpio) {
    js_gpio_init(gpio);
}

void gpio_set_dir(int gpio, int dir) {
    js_gpio_set_dir(gpio, dir);
}

void gpio_put(int gpio, int value) {
    js_gpio_put(gpio, value);
}

int gpio_get(int gpio) {
    return js_gpio_get(gpio);
}

void gpio_pull_up(int gpio) {
    js_gpio_pull_up(gpio);
}

void gpio_pull_down(int gpio) {
    js_gpio_pull_down(gpio);
}

void gpio_disable_pulls(int gpio) {
    js_gpio_disable_pulls(gpio);
}

void gpio_set_irq_enabled_with_callback(uint gpio, uint32_t event_mask, bool enabled, gpio_irq_callback_t callback) {
    /* Store callback pointer for later invocation from JS */
    js_gpio_set_irq((int)gpio, (int)event_mask, enabled ? 1 : 0);
    /* Note: callback invocation from JS is handled via Module.ccall */
}

void gpio_acknowledge_irq(uint gpio, uint32_t events) {
    /* No-op in simulator — IRQ is auto-acknowledged */
}

void gpio_set_function(uint gpio, uint fn) {
    js_gpio_set_function((int)gpio, (int)fn);
}
