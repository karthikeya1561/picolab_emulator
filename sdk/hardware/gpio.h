#ifndef HARDWARE_GPIO_H
#define HARDWARE_GPIO_H

#define GPIO_IN   0
#define GPIO_OUT  1

#define GPIO_IRQ_EDGE_RISE  0x1
#define GPIO_IRQ_EDGE_FALL  0x2

typedef void (*gpio_irq_callback_t)(uint gpio, uint32_t events);

/* Core GPIO functions */
void gpio_init(int pin);
void gpio_set_dir(int pin, int dir);
void gpio_put(int pin, int value);
int  gpio_get(int pin);

/* Pull-up/down functions */
void gpio_pull_up(int pin);
void gpio_pull_down(int pin);
void gpio_disable_pulls(int pin);

/* Interrupt functions */
void gpio_set_irq_enabled_with_callback(
    uint gpio,
    uint32_t event_mask,
    bool enabled,
    gpio_irq_callback_t callback
);

void gpio_acknowledge_irq(uint gpio, uint32_t events);

#endif
