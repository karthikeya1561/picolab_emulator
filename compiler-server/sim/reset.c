/*
 * reset.c — C Bridge for Reset operations
 */

#include "pico/bootrom.h"
#include "hardware/watchdog.h"

extern void js_reset(int type);
extern int  js_watchdog_caused_reboot(void);

void reset_usb_boot(uint32_t usb_activity_gpio_pin_mask, uint32_t disable_interface_mask) {
    js_reset(0); /* RESET_SOFT */
}

void watchdog_reboot(uint32_t pc, uint32_t sp, uint32_t delay_ms) {
    js_reset(1); /* RESET_WATCHDOG */
}

void watchdog_enable(uint32_t delay_ms, bool pause_on_debug) {
    /* No-op in simulator */
}

void watchdog_update(void) {
    /* No-op in simulator */
}

bool watchdog_caused_reboot(void) {
    return js_watchdog_caused_reboot() ? true : false;
}
