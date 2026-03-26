/**
 * mqtt_sim.js — MQTT WebSocket Engine
 *
 * Core MQTT simulation engine for the Pico W simulator.
 * Uses the mqtt.js npm package for WebSocket MQTT communication.
 *
 * RESPONSIBILITIES:
 *   - Manage a single MQTT client instance
 *   - Track connection state (disconnected → connecting → connected)
 *   - Store subscriptions with callbacks in a Map
 *   - Route incoming messages to matching subscription callbacks
 *   - Handle connection errors, reconnection, and cleanup
 *
 * DOES NOT:
 *   - Print to Serial Monitor (that's mqtt_bridge.js)
 *   - Check Wi-Fi state (that's mqtt_bridge.js)
 *   - Touch the DOM or UI
 *   - Modify GPIO, PWM, Wi-Fi, or HTTP state
 *
 * BROKER COMPATIBILITY:
 *   - HiveMQ:    wss://broker.hivemq.com:8884/mqtt
 *   - EMQX:      ws://broker.emqx.io:8083/mqtt
 *   - Mosquitto:  ws://localhost:9001
 *   - Any broker supporting MQTT over WebSocket
 */

import mqtt from 'mqtt';

// ---------- Constants ----------

/** Error codes matching sdk/net/mqtt_client.h */
const MQTT_OK = 0;
const MQTT_ERR_CONN = -1;
const MQTT_ERR_PUB = -2;
const MQTT_ERR_SUB = -3;
const MQTT_ERR_INIT = -4;

// ---------- State ----------

/**
 * MQTT engine state:
 *   initialized   : boolean — has mqtt_init() been called?
 *   client        : mqtt.Client|null — the active MQTT client instance
 *   connected     : boolean — is the client connected to a broker?
 *   connecting    : boolean — is a connection attempt in progress?
 *   brokerUrl     : string — current broker URL
 *   clientId      : string — current client ID
 *   subscriptions : Map<string, function> — topic → callback
 *   onConnect     : function|null — external connect handler (set by bridge)
 *   onDisconnect  : function|null — external disconnect handler (set by bridge)
 *   onError       : function|null — external error handler (set by bridge)
 *   onMessage     : function|null — external message handler (set by bridge)
 */
const state = {
    initialized: false,
    client: null,
    connected: false,
    connecting: false,
    brokerUrl: '',
    clientId: '',
    subscriptions: new Map(),
    onConnect: null,
    onDisconnect: null,
    onError: null,
    onMessage: null
};

// ---------- Init ----------

/**
 * Initialize the MQTT engine.
 * Must be called before connect().
 *
 * @returns {number} — MQTT_OK (0)
 */
export function init() {
    state.initialized = true;
    return MQTT_OK;
}

// ---------- Connect ----------

/**
 * Connect to an MQTT broker via WebSocket.
 * If already connected, disconnects first.
 *
 * @param {string} brokerUrl — WebSocket URL (ws:// or wss://)
 * @param {string} clientId  — unique client identifier
 * @param {object} [opts]    — optional: { username, password, keepalive }
 * @returns {Promise<number>} — MQTT_OK on success, MQTT_ERR_CONN on failure
 */
export function connect(brokerUrl, clientId, opts = {}) {
    if (!state.initialized) return Promise.resolve(MQTT_ERR_INIT);

    // Disconnect existing client if any
    if (state.client) {
        try { state.client.end(true); } catch (_) { /* ignore */ }
        state.client = null;
        state.connected = false;
    }

    state.brokerUrl = brokerUrl || '';
    state.clientId = clientId || `pico_sim_${Date.now()}`;
    state.connecting = true;

    return new Promise((resolve) => {
        try {
            const client = mqtt.connect(brokerUrl, {
                clientId: state.clientId,
                clean: true,
                connectTimeout: 10000,
                reconnectPeriod: 0,  // No auto-reconnect (user controls this)
                username: opts.username || undefined,
                password: opts.password || undefined,
                keepalive: opts.keepalive || 60
            });

            // --- Connection successful ---
            client.on('connect', () => {
                state.connected = true;
                state.connecting = false;
                state.client = client;

                if (state.onConnect) {
                    state.onConnect(brokerUrl, state.clientId);
                }

                resolve(MQTT_OK);
            });

            // --- Connection error ---
            client.on('error', (err) => {
                state.connecting = false;

                if (state.onError) {
                    state.onError(err.message || 'Unknown error');
                }

                // If we haven't resolved yet (initial connection failed)
                if (!state.connected) {
                    try { client.end(true); } catch (_) { /* ignore */ }
                    resolve(MQTT_ERR_CONN);
                }
            });

            // --- Disconnected ---
            client.on('close', () => {
                const wasConnected = state.connected;
                state.connected = false;
                state.connecting = false;

                if (wasConnected && state.onDisconnect) {
                    state.onDisconnect();
                }
            });

            // --- Incoming message ---
            client.on('message', (topic, payload) => {
                const message = payload.toString();

                // Route to specific subscription callback
                for (const [subTopic, callback] of state.subscriptions) {
                    if (topicMatches(subTopic, topic)) {
                        try {
                            callback(topic, message);
                        } catch (err) {
                            if (state.onError) {
                                state.onError(`Callback error: ${err.message}`);
                            }
                        }
                    }
                }

                // Also fire global message handler (for bridge logging)
                if (state.onMessage) {
                    state.onMessage(topic, message);
                }
            });

            // Safety timeout — if connect hasn't resolved in 10s, fail
            setTimeout(() => {
                if (state.connecting) {
                    state.connecting = false;
                    try { client.end(true); } catch (_) { /* ignore */ }
                    resolve(MQTT_ERR_CONN);
                }
            }, 10000);

        } catch (err) {
            state.connecting = false;
            if (state.onError) {
                state.onError(err.message || 'Connection exception');
            }
            resolve(MQTT_ERR_CONN);
        }
    });
}

// ---------- Publish ----------

/**
 * Publish a message to a topic.
 *
 * @param {string} topic   — MQTT topic
 * @param {string} message — message payload
 * @param {number} [qos=0] — quality of service (0, 1, 2)
 * @param {boolean} [retain=false] — retain flag
 * @returns {number} — MQTT_OK on success, MQTT_ERR_PUB on failure
 */
export function publish(topic, message, qos = 0, retain = false) {
    if (!state.client || !state.connected) return MQTT_ERR_PUB;
    if (!topic || typeof topic !== 'string') return MQTT_ERR_PUB;

    try {
        state.client.publish(topic, message, {
            qos: qos,
            retain: !!retain
        });
        return MQTT_OK;
    } catch (err) {
        if (state.onError) {
            state.onError(`Publish error: ${err.message}`);
        }
        return MQTT_ERR_PUB;
    }
}

// ---------- Subscribe ----------

/**
 * Subscribe to a topic with a callback.
 * Supports MQTT wildcards: + (single level), # (multi level).
 *
 * @param {string} topic      — MQTT topic or pattern
 * @param {function} callback — called with (topic, message) on incoming message
 * @returns {number} — MQTT_OK on success, MQTT_ERR_SUB on failure
 */
export function subscribe(topic, callback) {
    if (!state.client || !state.connected) return MQTT_ERR_SUB;
    if (!topic || typeof topic !== 'string') return MQTT_ERR_SUB;
    if (typeof callback !== 'function') return MQTT_ERR_SUB;

    try {
        state.client.subscribe(topic, { qos: 0 });
        state.subscriptions.set(topic, callback);
        return MQTT_OK;
    } catch (err) {
        if (state.onError) {
            state.onError(`Subscribe error: ${err.message}`);
        }
        return MQTT_ERR_SUB;
    }
}

// ---------- Disconnect ----------

/**
 * Disconnect from the broker and clear subscriptions.
 */
export function disconnect() {
    if (state.client) {
        try {
            state.client.end(true);
        } catch (_) { /* ignore */ }
        state.client = null;
    }
    state.connected = false;
    state.connecting = false;
    state.subscriptions.clear();
}

// ---------- Queries ----------

/**
 * Check if the MQTT client is connected.
 *
 * @returns {boolean}
 */
export function isConnected() {
    return state.connected;
}

/**
 * Get a snapshot of the MQTT state.
 *
 * @returns {object}
 */
export function getStatus() {
    return {
        initialized: state.initialized,
        connected: state.connected,
        connecting: state.connecting,
        brokerUrl: state.brokerUrl,
        clientId: state.clientId,
        subscriptionCount: state.subscriptions.size
    };
}

// ---------- Event Handlers ----------

/**
 * Set external event handlers (called by bridge layer).
 *
 * @param {object} handlers — { onConnect, onDisconnect, onError, onMessage }
 */
export function setHandlers(handlers) {
    if (handlers.onConnect) state.onConnect = handlers.onConnect;
    if (handlers.onDisconnect) state.onDisconnect = handlers.onDisconnect;
    if (handlers.onError) state.onError = handlers.onError;
    if (handlers.onMessage) state.onMessage = handlers.onMessage;
}

// ---------- Lifecycle ----------

/**
 * Reset all MQTT state.
 * Disconnects client and clears everything.
 * Called on simulation stop or system reset.
 */
export function resetAll() {
    disconnect();
    state.initialized = false;
    state.brokerUrl = '';
    state.clientId = '';
    state.onConnect = null;
    state.onDisconnect = null;
    state.onError = null;
    state.onMessage = null;
}

// ---------- Internal Helpers ----------

/**
 * Check if an MQTT topic matches a subscription pattern.
 * Supports + (single level) and # (multi level) wildcards.
 *
 * @param {string} pattern — subscription topic pattern
 * @param {string} topic   — actual message topic
 * @returns {boolean}
 */
function topicMatches(pattern, topic) {
    // Exact match (fast path)
    if (pattern === topic) return true;

    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    for (let i = 0; i < patternParts.length; i++) {
        const p = patternParts[i];

        // # matches everything from here on
        if (p === '#') return true;

        // + matches exactly one level
        if (p === '+') {
            if (i >= topicParts.length) return false;
            continue;
        }

        // Exact segment match required
        if (i >= topicParts.length || p !== topicParts[i]) return false;
    }

    // Pattern and topic must have same number of levels (unless # was used)
    return patternParts.length === topicParts.length;
}

// ---------- Exported Constants ----------

export {
    MQTT_OK,
    MQTT_ERR_CONN,
    MQTT_ERR_PUB,
    MQTT_ERR_SUB,
    MQTT_ERR_INIT
};
