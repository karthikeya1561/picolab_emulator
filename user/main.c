#include "hardware/gpio.h"
#include "pico/time.h"
#include "pico/stdio.h"

#define BTN 14
#define LED 15

int main() {
    stdio_init_all();

    gpio_init(LED);
    gpio_set_dir(LED, GPIO_OUT);

    gpio_init(BTN);
    gpio_set_dir(BTN, GPIO_IN);
    gpio_pull_up(BTN); // Default high

    int count = 0;

    while (1) {
        if (gpio_get(BTN) == 0) { // Pressed (Low)
            gpio_put(LED, 1);
            printf("Button pressed! count=%d\n", count++);
        } else {
            gpio_put(LED, 0);
        }
        sleep_ms(50);
    }
}
