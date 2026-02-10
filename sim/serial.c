#include "pico/stdio.h"

/* JS hooks */
extern void sim_serial_init(void);

void stdio_init_all(void) {
    sim_serial_init();
}
