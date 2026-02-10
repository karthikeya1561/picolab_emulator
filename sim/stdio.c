#include "pico/stdio.h"
#include <stdarg.h>
#include <stdio.h>

/* JS-provided function */
extern void sim_serial_write(const char *msg);

void stdio_init_all(void) {
    // nothing needed for simulator
}

int puts(const char *s) {
    sim_serial_write(s);
    sim_serial_write("\n");
    return 0;
}

int printf(const char *fmt, ...) {
    char buffer[256];
    va_list args;
    va_start(args, fmt);
    vsnprintf(buffer, sizeof(buffer), fmt, args);
    va_end(args);

    sim_serial_write(buffer);
    return 0;
}
