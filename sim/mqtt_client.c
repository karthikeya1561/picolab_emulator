#include "net/mqtt_client.h"

/* JS hooks */
extern int sim_mqtt_init(const char *client_id);
extern int sim_mqtt_connect(const char *url, int port);
extern int sim_mqtt_publish(const char *topic, const char *msg);
extern int sim_mqtt_subscribe(const char *topic);

/* Store callback */
static mqtt_callback_t user_cb = 0;

int mqtt_init(const char *client_id) {
    return sim_mqtt_init(client_id);
}

int mqtt_connect(const char *broker_url, int port) {
    return sim_mqtt_connect(broker_url, port);
}

int mqtt_publish(const char *topic, const char *msg) {
    return sim_mqtt_publish(topic, msg);
}

int mqtt_subscribe(const char *topic, mqtt_callback_t cb) {
    user_cb = cb;
    return sim_mqtt_subscribe(topic);
}

/* Called from JS when message arrives */
void __attribute__((used))
sim_mqtt_message(const char *topic, const char *msg) {
    if (user_cb) {
        user_cb(topic, msg);
    }
}
