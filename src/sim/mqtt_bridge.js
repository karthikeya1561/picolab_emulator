/**
 * mqtt_bridge.js — MQTT Client Bridge Layer (Public API)
 *
 * This is the ONLY module that SimulatorBridge.js and other parts of
 * the simulator should call for MQTT operations.
 *
 * DATA FLOW:
 *   User code → mqtt_bridge.mqttConnect(url, id)
 *                 → mqtt_sim.connect(url, id)
 *                 → WebSocket → MQTT Broker
 *                 → serial_bridge.print("[MQTT] Connected")
 *
 * RESPONSIBILITIES:
 *   - Provide SDK-named functions matching mqtt_client.h
 *   - Validate inputs before passing to mqtt_sim
 *   - Log all MQTT events to Serial Monitor
 *   - Check Wi-Fi connection status (warning only)
 *   - Route cleanup calls to mqtt_sim on simulation stop
 *
 * DOES NOT:
 *   - Manage the MQTT client directly (that's mqtt_sim.js)
 *   - Touch the DOM or UI
 *   - Modify GPIO, PWM, Wi-Fi, or HTTP state
 */

import {
    init,
    connect,
    publish,
    subscribe,
    disconnect,
    isConnected,
    getStatus,
    setHandlers,
    resetAll,
    MQTT_OK,
    MQTT_ERR_CONN,
    MQTT_ERR_PUB,
    MQTT_ERR_SUB,
    MQTT_ERR_INIT
} from './mqtt_sim.js';

import { print, debug } from './serial_bridge.js';
import { wifiIsConnected } from './wifi_bridge.js';

// ---------- Setup Event Handlers ----------

/**
 * Register event handlers so mqtt_sim can report events
 * back to the bridge for serial logging.
 */
setHandlers({
    onConnect: (brokerUrl, clientId) => {
        print(`[MQTT] Connected to ${brokerUrl}`);
        print(`[MQTT] Client ID: ${clientId}`);
    },
    onDisconnect: () => {
        print('[MQTT] Disconnected from broker');
    },
    onError: (message) => {
        print(`[MQTT] ERROR: ${message}`);
    },
    onMessage: (topic, message) => {
        debug(`[MQTT] ← ${topic}: ${message}`);
    }
});

// ---------- SDK-Style Functions ----------

/**
 * Initialize the MQTT client.
 * Mirrors: mqtt_init()
 *
 * @returns {number} — MQTT_OK (0)
 */
export function mqttInit() {
    const result = init();
    print('[MQTT] Client initialized');
    return result;
}

/**
 * Connect to an MQTT broker via WebSocket.
 * Mirrors: mqtt_connect()
 *
 * @param {string} brokerUrl — WebSocket URL (ws:// or wss://)
 * @param {string} clientId  — unique client identifier
 * @param {object} [opts]    — optional: { username, password, keepalive }
 * @returns {Promise<number>} — MQTT_OK on success, MQTT_ERR_CONN on failure
 */
export async function mqttConnect(brokerUrl, clientId, opts) {
    // --- Input validation ---
    if (!brokerUrl || typeof brokerUrl !== 'string') {
        print('[MQTT] ERROR: Invalid broker URL');
        return MQTT_ERR_CONN;
    }

    // --- Wi-Fi check (warning only) ---
    if (!wifiIsConnected()) {
        print('[MQTT] WARNING: Wi-Fi not connected (may still work in simulator)');
    }

    print(`[MQTT] Connecting to ${brokerUrl}...`);

    const result = await connect(brokerUrl, clientId, opts);

    if (result !== MQTT_OK) {
        print(`[MQTT] ERROR: Connection failed (code ${result})`);
    }

    return result;
}

/**
 * Publish a message to a topic.
 * Mirrors: mqtt_publish()
 *
 * @param {string} topic   — MQTT topic
 * @param {string} message — message payload
 * @param {number} [qos=0] — quality of service (0, 1, 2)
 * @param {boolean} [retain=false] — retain flag
 * @returns {number} — MQTT_OK on success, MQTT_ERR_PUB on failure
 */
export function mqttPublish(topic, message, qos = 0, retain = false) {
    if (!topic || typeof topic !== 'string') {
        print('[MQTT] ERROR: Invalid topic');
        return MQTT_ERR_PUB;
    }

    const result = publish(topic, String(message), qos, retain);

    if (result === MQTT_OK) {
        debug(`[MQTT] → ${topic}: ${message}`);
    } else {
        print(`[MQTT] ERROR: Publish failed — not connected`);
    }

    return result;
}

/**
 * Subscribe to a topic with a message callback.
 * Mirrors: mqtt_subscribe()
 *
 * @param {string} topic      — MQTT topic or wildcard pattern
 * @param {function} callback — called with (topic, message) on incoming message
 * @returns {number} — MQTT_OK on success, MQTT_ERR_SUB on failure
 */
export function mqttSubscribe(topic, callback) {
    if (!topic || typeof topic !== 'string') {
        print('[MQTT] ERROR: Invalid topic');
        return MQTT_ERR_SUB;
    }
    if (typeof callback !== 'function') {
        print('[MQTT] ERROR: Invalid callback');
        return MQTT_ERR_SUB;
    }

    const result = subscribe(topic, callback);

    if (result === MQTT_OK) {
        print(`[MQTT] Subscribed to "${topic}"`);
    } else {
        print(`[MQTT] ERROR: Subscribe failed — not connected`);
    }

    return result;
}

/**
 * Disconnect from the MQTT broker.
 * Mirrors: mqtt_disconnect()
 */
export function mqttDisconnect() {
    disconnect();
    print('[MQTT] Disconnected');
}

// ---------- Query Functions ----------

/**
 * Check if the MQTT client is connected.
 * Mirrors: mqtt_is_connected()
 *
 * @returns {boolean}
 */
export function mqttIsConnected() {
    return isConnected();
}

/**
 * Get MQTT status snapshot.
 *
 * @returns {object}
 */
export function mqttGetStatus() {
    return getStatus();
}

// ---------- Lifecycle ----------

/**
 * Reset all MQTT state.
 * Disconnects client and clears subscriptions.
 * Called on simulation stop or system reset.
 */
export function resetMqtt() {
    resetAll();
}

// ---------- Re-export constants ----------

export {
    MQTT_OK,
    MQTT_ERR_CONN,
    MQTT_ERR_PUB,
    MQTT_ERR_SUB,
    MQTT_ERR_INIT
};
