/*
 * mqtt_client.c — C Bridge for MQTT operations
 */

#include "net/mqtt_client.h"

extern int  js_mqtt_init(void);
extern int  js_mqtt_connect(const char *url, const char *client_id);
extern int  js_mqtt_publish(const char *topic, const char *message, int qos, int retain);
extern int  js_mqtt_subscribe(const char *topic);
extern void js_mqtt_disconnect(void);
extern int  js_mqtt_is_connected(void);

int mqtt_init(void) {
    return js_mqtt_init();
}

int mqtt_connect(const char *broker_url, const char *client_id) {
    return js_mqtt_connect(broker_url, client_id);
}

int mqtt_publish(const char *topic, const char *message, int qos, int retain) {
    return js_mqtt_publish(topic, message, qos, retain);
}

int mqtt_subscribe(const char *topic, mqtt_message_callback_t callback) {
    /* Store callback association in JS side */
    return js_mqtt_subscribe(topic);
}

void mqtt_disconnect(void) {
    js_mqtt_disconnect();
}

int mqtt_is_connected(void) {
    return js_mqtt_is_connected();
}
