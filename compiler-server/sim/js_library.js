/**
 * js_library.js — Emscripten JS Library
 *
 * This file defines all the JS functions that the C bridge files
 * call via `extern`. Emscripten links these at compile time using
 * the --js-library flag.
 *
 * At runtime, these functions are injected into the WASM Module
 * and communicate with the browser's sim engines via postMessage
 * or direct global function calls.
 *
 * ARCHITECTURE:
 *   C code → extern js_*() → this library → Module._sim_* callbacks
 *   The browser sets Module._sim_* before instantiation.
 */

mergeInto(LibraryManager.library, {

    // ========== GPIO ==========

    js_gpio_init: function (pin) {
        if (Module._sim_gpio_init) Module._sim_gpio_init(pin);
    },

    js_gpio_set_dir: function (pin, dir) {
        if (Module._sim_gpio_set_dir) Module._sim_gpio_set_dir(pin, dir);
    },

    js_gpio_put: function (pin, value) {
        if (Module._sim_gpio_put) Module._sim_gpio_put(pin, value);
    },

    js_gpio_get: function (pin) {
        if (Module._sim_gpio_get) return Module._sim_gpio_get(pin);
        return 0;
    },

    js_gpio_pull_up: function (pin) {
        if (Module._sim_gpio_pull_up) Module._sim_gpio_pull_up(pin);
    },

    js_gpio_pull_down: function (pin) {
        if (Module._sim_gpio_pull_down) Module._sim_gpio_pull_down(pin);
    },

    js_gpio_disable_pulls: function (pin) {
        if (Module._sim_gpio_disable_pulls) Module._sim_gpio_disable_pulls(pin);
    },

    js_gpio_set_irq: function (pin, mask, enabled) {
        if (Module._sim_gpio_set_irq) Module._sim_gpio_set_irq(pin, mask, enabled);
    },

    js_gpio_set_function: function (pin, fn) {
        if (Module._sim_gpio_set_function) Module._sim_gpio_set_function(pin, fn);
    },

    // ========== STDIO ==========

    js_stdio_init: function () {
        if (Module._sim_stdio_init) Module._sim_stdio_init();
    },

    js_print: function (ptr) {
        var str = UTF8ToString(ptr);
        if (Module._sim_print) Module._sim_print(str);
    },

    // ========== TIME ==========

    js_sleep_ms__async: true,  /* Asyncify marker */
    js_sleep_ms: function (ms) {
        /* Handled by Emscripten Asyncify — calls emscripten_sleep internally */
    },

    js_sleep_us__async: true,
    js_sleep_us: function (us) {
        /* Handled by Emscripten Asyncify */
    },

    js_time_us_64: function () {
        if (Module._sim_time_us_64) return Module._sim_time_us_64();
        return performance.now() * 1000;
    },

    // ========== PWM ==========

    js_pwm_gpio_to_slice: function (gpio) {
        return Math.floor(gpio / 2);
    },

    js_pwm_set_wrap: function (slice, wrap) {
        if (Module._sim_pwm_set_wrap) Module._sim_pwm_set_wrap(slice, wrap);
    },

    js_pwm_set_level: function (slice, channel, level) {
        if (Module._sim_pwm_set_level) Module._sim_pwm_set_level(slice, channel, level);
    },

    js_pwm_set_enabled: function (slice, enabled) {
        if (Module._sim_pwm_set_enabled) Module._sim_pwm_set_enabled(slice, enabled);
    },

    // ========== Wi-Fi ==========

    js_wifi_init: function () {
        if (Module._sim_wifi_init) return Module._sim_wifi_init();
        return 0;
    },

    js_wifi_deinit: function () {
        if (Module._sim_wifi_deinit) Module._sim_wifi_deinit();
    },

    js_wifi_enable_sta: function () {
        if (Module._sim_wifi_enable_sta) Module._sim_wifi_enable_sta();
    },

    js_wifi_connect: function (ssidPtr, pwPtr, timeout) {
        var ssid = UTF8ToString(ssidPtr);
        var pw = UTF8ToString(pwPtr);
        if (Module._sim_wifi_connect) return Module._sim_wifi_connect(ssid, pw, timeout);
        return 0;
    },

    js_wifi_set_led: function (gpio, value) {
        if (Module._sim_wifi_set_led) Module._sim_wifi_set_led(gpio, value);
    },

    // ========== Reset ==========

    js_reset: function (type) {
        if (Module._sim_reset) Module._sim_reset(type);
    },

    js_watchdog_caused_reboot: function () {
        if (Module._sim_watchdog_caused_reboot) return Module._sim_watchdog_caused_reboot();
        return 0;
    },

    // ========== Filesystem ==========

    js_fs_init: function () {
        if (Module._sim_fs_init) return Module._sim_fs_init();
        return 0;
    },

    js_fs_write: function (filenamePtr, dataPtr) {
        var filename = UTF8ToString(filenamePtr);
        var data = UTF8ToString(dataPtr);
        if (Module._sim_fs_write) return Module._sim_fs_write(filename, data);
        return -2;
    },

    js_fs_read: function (filenamePtr, bufferPtr, maxLen) {
        var filename = UTF8ToString(filenamePtr);
        if (Module._sim_fs_read) return Module._sim_fs_read(filename, bufferPtr, maxLen);
        return -1;
    },

    js_fs_exists: function (filenamePtr) {
        var filename = UTF8ToString(filenamePtr);
        if (Module._sim_fs_exists) return Module._sim_fs_exists(filename);
        return 0;
    },

    js_fs_delete: function (filenamePtr) {
        var filename = UTF8ToString(filenamePtr);
        if (Module._sim_fs_delete) return Module._sim_fs_delete(filename);
        return -1;
    },

    // ========== HTTP ==========

    js_http_get__async: true,
    js_http_get: function (urlPtr, responsePtr, maxLen) {
        var url = UTF8ToString(urlPtr);
        if (Module._sim_http_get) return Module._sim_http_get(url, responsePtr, maxLen);
        return -1;
    },

    // ========== MQTT ==========

    js_mqtt_init: function () {
        if (Module._sim_mqtt_init) return Module._sim_mqtt_init();
        return 0;
    },

    js_mqtt_connect__async: true,
    js_mqtt_connect: function (urlPtr, clientIdPtr) {
        var url = UTF8ToString(urlPtr);
        var clientId = UTF8ToString(clientIdPtr);
        if (Module._sim_mqtt_connect) return Module._sim_mqtt_connect(url, clientId);
        return -1;
    },

    js_mqtt_publish: function (topicPtr, messagePtr, qos, retain) {
        var topic = UTF8ToString(topicPtr);
        var message = UTF8ToString(messagePtr);
        if (Module._sim_mqtt_publish) return Module._sim_mqtt_publish(topic, message, qos, retain);
        return -2;
    },

    js_mqtt_subscribe__async: true,
    js_mqtt_subscribe: function (topicPtr) {
        var topic = UTF8ToString(topicPtr);
        if (Module._sim_mqtt_subscribe) return Module._sim_mqtt_subscribe(topic);
        return -3;
    },

    js_mqtt_disconnect: function () {
        if (Module._sim_mqtt_disconnect) Module._sim_mqtt_disconnect();
    },

    js_mqtt_is_connected: function () {
        if (Module._sim_mqtt_is_connected) return Module._sim_mqtt_is_connected();
        return 0;
    }
});
