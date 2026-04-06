/*
 * net/mqtt_client.h — MQTT Client API for Emscripten compilation
 */

#ifndef PICO_MQTT_CLIENT_H
#define PICO_MQTT_CLIENT_H

#include "pico/types.h"

#define MQTT_OK            0
#define MQTT_ERR_CONN     -1
#define MQTT_ERR_PUB      -2
#define MQTT_ERR_SUB      -3
#define MQTT_ERR_INIT     -4

typedef void (*mqtt_message_callback_t)(const char *topic, const char *message);

int  mqtt_init(void);
int  mqtt_connect(const char *broker_url, const char *client_id);
int  mqtt_publish(const char *topic, const char *message, int qos, int retain);
int  mqtt_subscribe(const char *topic, mqtt_message_callback_t callback);
void mqtt_disconnect(void);
int  mqtt_is_connected(void);

#endif /* PICO_MQTT_CLIENT_H */
