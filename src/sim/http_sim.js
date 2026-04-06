/**
 * http_sim.js — HTTP Fetch Engine
 *
 * Core simulation engine for HTTP requests in the Pico W simulator.
 * Uses the browser's fetch() API to make real HTTP GET requests.
 *
 * RESPONSIBILITIES:
 *   - Execute HTTP GET requests via fetch()
 *   - Handle CORS failures gracefully
 *   - Enforce request timeout (10 seconds)
 *   - Truncate response body to requested max length
 *   - Track in-flight requests for cleanup on simulation stop
 *   - Provide non-blocking async interface
 *
 * DOES NOT:
 *   - Print to Serial Monitor (that's http_bridge.js)
 *   - Check Wi-Fi state (that's http_bridge.js)
 *   - Touch the DOM or UI
 *   - Modify GPIO, PWM, or Wi-Fi state
 *
 * ERROR HANDLING:
 *   - CORS blocked → returns status HTTP_ERR_CORS (-3)
 *   - Timeout → returns status HTTP_ERR_TIMEOUT (-2)
 *   - Network error → returns status HTTP_ERR_NETWORK (-1)
 *   - HTTP error (4xx/5xx) → returns status HTTP_ERR_STATUS (-4)
 */

// ---------- Constants ----------

/** Default timeout for HTTP requests (milliseconds) */
const REQUEST_TIMEOUT_MS = 10000;

/** Error codes matching sdk/net/http_client.h */
const HTTP_OK = 0;
const HTTP_ERR_NETWORK = -1;
const HTTP_ERR_TIMEOUT = -2;
const HTTP_ERR_CORS = -3;
const HTTP_ERR_STATUS = -4;

/** Default max response length if not specified */
const DEFAULT_MAX_LEN = 4096;

// ---------- State ----------

/**
 * Set of AbortControllers for in-flight requests.
 * Used to cancel all pending requests on simulation stop.
 */
const activeControllers = new Set();

// ---------- Core Functions ----------

/**
 * Perform an HTTP GET request using browser fetch().
 *
 * @param {string} url     — target URL
 * @param {number} maxLen  — max response body length (characters)
 * @returns {Promise<{status: number, body: string, httpCode: number}>}
 *   - status: HTTP_OK (0) on success, negative error code on failure
 *   - body: response text (truncated to maxLen), or error message
 *   - httpCode: actual HTTP status code (200, 404, etc.), or 0 on network error
 */
export async function fetchGet(url, maxLen) {
    const limit = (typeof maxLen === 'number' && maxLen > 0) ? maxLen : DEFAULT_MAX_LEN;

    // Create an AbortController for timeout and cleanup
    const controller = new AbortController();
    activeControllers.add(controller);

    // Set timeout to prevent hanging requests
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal
        });

        // Clear timeout since we got a response
        clearTimeout(timeoutId);

        // Check for HTTP error status codes (4xx, 5xx)
        if (!response.ok) {
            return {
                status: HTTP_ERR_STATUS,
                body: `HTTP ${response.status} ${response.statusText}`,
                httpCode: response.status
            };
        }

        // Read response body as text
        let body = await response.text();

        // Truncate to maxLen (leaving room for null terminator in C)
        if (body.length > limit - 1) {
            body = body.substring(0, limit - 1);
        }

        return {
            status: HTTP_OK,
            body: body,
            httpCode: response.status
        };

    } catch (error) {
        clearTimeout(timeoutId);

        // AbortError means either timeout or manual abort (simulation stop)
        if (error.name === 'AbortError') {
            return {
                status: HTTP_ERR_TIMEOUT,
                body: 'Request timed out',
                httpCode: 0
            };
        }

        // TypeError is the typical signature of a CORS failure in fetch()
        // Also covers DNS failures and network-unreachable errors
        if (error.name === 'TypeError') {
            // Heuristic: CORS failures typically have specific message patterns
            const msg = error.message.toLowerCase();
            if (msg.includes('cors') || msg.includes('blocked') || msg.includes('opaque')) {
                return {
                    status: HTTP_ERR_CORS,
                    body: 'CORS policy blocked the request',
                    httpCode: 0
                };
            }
            // Other TypeErrors are generic network failures
            return {
                status: HTTP_ERR_NETWORK,
                body: error.message || 'Network error',
                httpCode: 0
            };
        }

        // Any other unexpected error
        return {
            status: HTTP_ERR_NETWORK,
            body: error.message || 'Unknown error',
            httpCode: 0
        };

    } finally {
        // Always remove controller from active set
        activeControllers.delete(controller);
    }
}

// ---------- Lifecycle ----------

/**
 * Reset HTTP engine state.
 * Aborts all in-flight requests and clears tracking.
 * Called on simulation stop or system reset.
 */
export function resetAll() {
    // Abort all in-flight requests
    for (const controller of activeControllers) {
        try {
            controller.abort();
        } catch (_) {
            // Ignore abort errors during cleanup
        }
    }
    activeControllers.clear();
}

// ---------- Exported Constants ----------

export {
    HTTP_OK,
    HTTP_ERR_NETWORK,
    HTTP_ERR_TIMEOUT,
    HTTP_ERR_CORS,
    HTTP_ERR_STATUS
};
