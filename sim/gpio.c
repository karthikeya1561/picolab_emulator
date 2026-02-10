#include "hardware/gpio.h"

/* JS hooks - Defined in sim/gpio_sim.js */
extern void sim_gpio_init(int pin);
extern void sim_gpio_set_dir(int pin, int dir);
extern void sim_gpio_put(int pin, int value);
extern int  sim_gpio_get(int pin);
extern void sim_gpio_pull(int pin, int mode);
extern void sim_gpio_irq_config(uint gpio, uint32_t mask, int enabled);

/* Global IRQ Callback */
static gpio_irq_callback_t global_callback = 0;

/* Implementation of SDK functions */
void gpio_init(int pin) {
    sim_gpio_init(pin);
}

void gpio_set_dir(int pin, int dir) {
    sim_gpio_set_dir(pin, dir);
}

void gpio_put(int pin, int value) {
    sim_gpio_put(pin, value);
}

int gpio_get(int pin) {
    return sim_gpio_get(pin);
}

void gpio_pull_up(int pin) {
    sim_gpio_pull(pin, 1);
}

void gpio_pull_down(int pin) {
    sim_gpio_pull(pin, -1);
}

void gpio_disable_pulls(int pin) {
    sim_gpio_pull(pin, 0);
}

void gpio_set_irq_enabled_with_callback(
    uint gpio,
    uint32_t event_mask,
    bool enabled,
    gpio_irq_callback_t callback
) {
    global_callback = callback;
    sim_gpio_irq_config(gpio, event_mask, enabled);
}

/* Called from JS logic to fire IRQ */
void __attribute__((used))
sim_gpio_irq_fire(uint gpio, uint32_t events) {
    if (global_callback) {
        global_callback(gpio, events);
    }
}

void gpio_acknowledge_irq(uint gpio, uint32_t events) {
    /* No-op in simulator */
}
