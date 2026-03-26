/*
 * ============================================================
 * mqtt_client.h — Pico W MQTT Client (Documentation Reference)
 * ============================================================
 *
 * This file documents the target C API for MQTT operations.
 * It provides publish/subscribe messaging for IoT applications.
 *
 * THIS FILE IS NOT COMPILED OR EXECUTED.
 * It exists as the architectural reference for the simulator's
 * MQTT layer. All JS implementations in sim/mqtt_sim.js and
 * sim/mqtt_bridge.js follow the naming and behavior defined here.
 *
 * SIMULATOR BEHAVIOR:
 *   - Uses WebSocket MQTT via the mqtt.js library
 *   - Compatible with HiveMQ, EMQX, Mosquitto (ws:// or wss://)
 *   - Single client instance per simulation
 *   - Subscriptions stored with callbacks, routed on message
 *   - WebSockets bypass CORS (unlike HTTP fetch)
 *
 * DEPENDENCIES:
 *   - Wi-Fi should be "connected" (Step 7) for realism
 *   - npm package: mqtt
 *
 * BROKER EXAMPLES:
 *   - wss://broker.hivemq.com:8884/mqtt  (public, free)
 *   - ws://broker.emqx.io:8083/mqtt      (public, free)
 *   - ws://localhost:9001                 (local Mosquitto)
 *
 * EDGE CASES:
 *   - Some brokers require TLS (use wss:// instead of ws://)
 *   - Public brokers may impose rate limits or topic restrictions
 *   - Client ID must be unique per connection to the same broker
 *   - QoS 2 support depends on broker configuration
 *   - Retained messages persist at broker until overwritten
 *
 * ============================================================
 * Phase 2 — Step 9 (MQTT)
 * ============================================================
 */

#ifndef PICO_MQTT_CLIENT_H
#define PICO_MQTT_CLIENT_H

#include <stdint.h>

/* ============================================================
 * Error Codes
 * ============================================================ */

/* Operation completed successfully */
#define MQTT_OK            0

/* Connection failed (broker unreachable, auth error, etc.) */
#define MQTT_ERR_CONN     -1

/* Publish failed (not connected, topic invalid, etc.) */
#define MQTT_ERR_PUB      -2

/* Subscribe failed (not connected, topic invalid, etc.) */
#define MQTT_ERR_SUB      -3

/* Client not initialized */
#define MQTT_ERR_INIT     -4

/* ============================================================
 * Callback Type
 * ============================================================ */

/*
 * Callback function type for incoming MQTT messages.
 *
 * @param topic   — topic the message was received on
 * @param message — message payload (null-terminated string)
 */
typedef void (*mqtt_message_callback_t)(const char *topic, const char *message);

/* ============================================================
 * API Functions
 * ============================================================ */

/*
 * Initialize the MQTT client.
 * Must be called before mqtt_connect().
 *
 * @return MQTT_OK (0) on success
 */
int mqtt_init(void);

/*
 * Connect to an MQTT broker via WebSocket.
 *
 * @param broker_url — WebSocket URL (e.g., "wss://broker.hivemq.com:8884/mqtt")
 * @param client_id  — unique client identifier (e.g., "pico_sim_001")
 * @return MQTT_OK (0) on success, MQTT_ERR_CONN (-1) on failure
 */
int mqtt_connect(const char *broker_url, const char *client_id);

/*
 * Publish a message to a topic.
 *
 * @param topic   — MQTT topic (e.g., "lab/sensor/temp")
 * @param message — message payload (null-terminated string)
 * @param qos     — quality of service (0, 1, or 2)
 * @param retain  — if true, broker retains the message
 * @return MQTT_OK (0) on success, MQTT_ERR_PUB (-2) on failure
 */
int mqtt_publish(const char *topic, const char *message, int qos, int retain);

/*
 * Subscribe to a topic with a message callback.
 * Supports MQTT wildcards: + (single level), # (multi level).
 *
 * @param topic    — MQTT topic or pattern (e.g., "lab/+/status")
 * @param callback — function called when a message arrives on this topic
 * @return MQTT_OK (0) on success, MQTT_ERR_SUB (-3) on failure
 */
int mqtt_subscribe(const char *topic, mqtt_message_callback_t callback);

/*
 * Disconnect from the MQTT broker.
 * All subscriptions are cleared.
 */
void mqtt_disconnect(void);

/*
 * Check if the MQTT client is currently connected.
 *
 * @return 1 if connected, 0 if not
 */
int mqtt_is_connected(void);

#endif /* PICO_MQTT_CLIENT_H */
