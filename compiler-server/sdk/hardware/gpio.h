/*
 * hardware/gpio.h — GPIO API for Emscripten compilation
 */

#ifndef HARDWARE_GPIO_H
#define HARDWARE_GPIO_H

#include "pico/types.h"

#define GPIO_IN   0
#define GPIO_OUT  1

#define GPIO_IRQ_EDGE_RISE  0x1
#define GPIO_IRQ_EDGE_FALL  0x2

typedef void (*gpio_irq_callback_t)(uint gpio, uint32_t events);

void gpio_init(int gpio);
void gpio_set_dir(int gpio, int dir);
void gpio_put(int gpio, int value);
int  gpio_get(int gpio);
void gpio_pull_up(int gpio);
void gpio_pull_down(int gpio);
void gpio_disable_pulls(int gpio);
void gpio_set_irq_enabled_with_callback(uint gpio, uint32_t event_mask, bool enabled, gpio_irq_callback_t callback);
void gpio_acknowledge_irq(uint gpio, uint32_t events);

/* PWM function constant */
#define GPIO_FUNC_PWM 4
void gpio_set_function(uint gpio, uint fn);

#endif /* HARDWARE_GPIO_H */
