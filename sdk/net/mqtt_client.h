#ifndef MQTT_CLIENT_H
#define MQTT_CLIENT_H

#include <stdint.h>

typedef void (*mqtt_callback_t)(const char *topic, const char *msg);

int mqtt_init(const char *client_id);
int mqtt_connect(const char *broker_url, int port);
int mqtt_publish(const char *topic, const char *msg);
int mqtt_subscribe(const char *topic, mqtt_callback_t cb);

#endif
