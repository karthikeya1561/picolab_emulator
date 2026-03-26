/*
 * hardware/watchdog.h — Watchdog API for Emscripten compilation
 */

#ifndef HARDWARE_WATCHDOG_H
#define HARDWARE_WATCHDOG_H

#include "pico/types.h"

void watchdog_reboot(uint32_t pc, uint32_t sp, uint32_t delay_ms);
void watchdog_enable(uint32_t delay_ms, bool pause_on_debug);
void watchdog_update(void);
bool watchdog_caused_reboot(void);

#endif /* HARDWARE_WATCHDOG_H */
