#ifndef CYW43_ARCH_H
#define CYW43_ARCH_H

int cyw43_arch_init(void);
void cyw43_arch_enable_sta_mode(void);

int cyw43_arch_wifi_connect_timeout_ms(
    const char *ssid,
    const char *pass,
    int auth,
    int timeout_ms
);

#endif
