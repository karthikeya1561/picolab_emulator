#include "pico/cyw43_arch.h"

/* JS hooks */
extern int sim_wifi_init(void);
extern int sim_wifi_connect(const char *ssid);

int cyw43_arch_init(void) {
    return sim_wifi_init();
}

void cyw43_arch_enable_sta_mode(void) {
    // no-op for simulator
}

int cyw43_arch_wifi_connect_timeout_ms(
    const char *ssid,
    const char *pass,
    int auth,
    int timeout_ms
) {
    return sim_wifi_connect(ssid);
}
