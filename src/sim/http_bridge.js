/**
 * http_bridge.js — HTTP Client Bridge Layer (Public API)
 *
 * This is the ONLY module that SimulatorBridge.js and other parts of
 * the simulator should call for HTTP operations.
 *
 * DATA FLOW:
 *   User code → http_bridge.httpGet(url, maxLen)
 *                 → http_sim.fetchGet(url, maxLen)
 *                 → browser fetch()
 *                 → serial_bridge.print("[HTTP] ...")
 *
 * RESPONSIBILITIES:
 *   - Provide SDK-named functions matching http_client.h
 *   - Validate inputs before passing to http_sim
 *   - Check Wi-Fi connection status (warning only, does not block)
 *   - Print status messages to Serial Monitor
 *   - Route cleanup calls to http_sim on simulation stop
 *
 * DOES NOT:
 *   - Perform fetch() directly (that's http_sim.js)
 *   - Touch the DOM or UI
 *   - Modify GPIO, PWM, or Wi-Fi state
 */

import {
    fetchGet,
    resetAll,
    HTTP_OK,
    HTTP_ERR_NETWORK,
    HTTP_ERR_TIMEOUT,
    HTTP_ERR_CORS,
    HTTP_ERR_STATUS
} from './http_sim.js';

import { print, debug } from './serial_bridge.js';
import { wifiIsConnected } from './wifi_bridge.js';

// ---------- SDK-Style Functions ----------

/**
 * Perform an HTTP GET request.
 * Mirrors: http_get(url, response, max_len)
 *
 * Checks Wi-Fi status (prints warning if not connected),
 * executes the request via http_sim, and logs the result
 * to Serial Monitor.
 *
 * @param {string} url     — target URL
 * @param {number} maxLen  — max response length (default 4096)
 * @returns {Promise<{status: number, body: string}>}
 *   - status: 0 on success, negative on error
 *   - body: response text or error message
 */
export async function httpGet(url, maxLen = 4096) {
    // --- Input validation ---
    if (!url || typeof url !== 'string') {
        print('[HTTP] ERROR: Invalid URL');
        return { status: HTTP_ERR_NETWORK, body: 'Invalid URL' };
    }

    // --- Wi-Fi check (warning only) ---
    if (!wifiIsConnected()) {
        print('[HTTP] WARNING: Wi-Fi not connected (request may still work in simulator)');
    }

    debug(`[HTTP] GET ${url}`);

    // --- Execute request ---
    const result = await fetchGet(url, maxLen);

    // --- Log result to Serial Monitor ---
    switch (result.status) {
        case HTTP_OK:
            print(`[HTTP] 200 OK — received ${result.body.length} bytes`);
            break;
        case HTTP_ERR_CORS:
            print(`[HTTP] ERROR: CORS policy blocked request to ${url}`);
            print('[HTTP] TIP: Use CORS-enabled APIs (e.g., ThingSpeak, jsonplaceholder)');
            break;
        case HTTP_ERR_TIMEOUT:
            print(`[HTTP] ERROR: Request timed out (10s) for ${url}`);
            break;
        case HTTP_ERR_STATUS:
            print(`[HTTP] ERROR: ${result.body}`);
            break;
        case HTTP_ERR_NETWORK:
        default:
            print(`[HTTP] ERROR: Network failure — ${result.body}`);
            break;
    }

    return { status: result.status, body: result.body };
}

// ---------- Query Functions ----------

/**
 * Check if the last HTTP request succeeded.
 * Convenience function for user code.
 *
 * @param {number} status — status code from httpGet()
 * @returns {boolean} — true if status === HTTP_OK
 */
export function httpIsSuccess(status) {
    return status === HTTP_OK;
}

// ---------- Lifecycle ----------

/**
 * Reset all HTTP state.
 * Aborts in-flight requests and clears tracking.
 * Called on simulation stop or system reset.
 */
export function resetHttp() {
    resetAll();
}

// ---------- Re-export constants ----------

export {
    HTTP_OK,
    HTTP_ERR_NETWORK,
    HTTP_ERR_TIMEOUT,
    HTTP_ERR_CORS,
    HTTP_ERR_STATUS
};
