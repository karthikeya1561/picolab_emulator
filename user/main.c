#include "pico/stdio.h"
#include "pico/time.h"
#include "hardware/gpio.h"
#include "hardware/pwm.h"
#include "pico/cyw43_arch.h"
#include "net/http_client.h"
#include "net/mqtt_client.h"
#include "fs/fs.h"

#define LED 15

void on_mqtt_msg(const char *topic, const char *msg) {
    printf("MQTT Message [%s]: %s\n", topic, msg);
}

int main() {
    stdio_init_all();
    printf("--- PicoLab Simulator Steps 6-10 Test ---\n");

    // Step 10: Filesystem
    fs_init();
    if (!fs_exists("boot.txt")) {
        fs_write("boot.txt", "PicoLab Booted", 14);
        printf("Created boot.txt\n");
    } else {
        char buf[32];
        fs_read("boot.txt", buf, sizeof(buf));
        printf("Flash content: %s\n", buf);
    }

    // Step 6: PWM
    gpio_init(LED);
    uint slice = pwm_gpio_to_slice_num(LED);
    pwm_set_wrap(slice, 255);
    pwm_set_enabled(slice, true);
    printf("PWM Initialized on GPIO %d\n", LED);

    // Step 7: Wi-Fi
    if (cyw43_arch_init()) {
        printf("WiFi init failed\n");
    } else {
        printf("Connecting to WiFi...\n");
        cyw43_arch_wifi_connect_timeout_ms("Simulated-SSID", "password", 0, 10000);
        printf("WiFi Connected!\n");
    }

    // Step 8: HTTP
    char resp[128];
    printf("Fetching HTTP...\n");
    int len = http_get("https://jsonplaceholder.typicode.com/todos/1", resp, sizeof(resp));
    if (len > 0) printf("HTTP Response: %s\n", resp);

    // Step 9: MQTT
    mqtt_init("pico_client");
    mqtt_connect("broker.hivemq.com", 8000);
    mqtt_subscribe("pico/test", on_mqtt_msg);
    mqtt_publish("pico/test", "PicoLab Online");

    int fade = 0;
    int dir = 1;

    while (1) {
        // Fade LED using PWM
        pwm_set_gpio_level(LED, fade);
        fade += dir * 5;
        if (fade <= 0 || fade >= 255) dir = -dir;

        sleep_ms(20);

        static int counter = 0;
        if (++counter % 250 == 0) {
            printf("Uptime: %llu us\n", time_us_64());
            mqtt_publish("pico/status", "Still alive");
        }
    }
}
