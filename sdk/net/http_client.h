/*
 * ============================================================
 * http_client.h — Pico W HTTP Client (Documentation Reference)
 * ============================================================
 *
 * This file documents the target C API for HTTP client operations.
 * It provides a simple HTTP GET interface for Pico W firmware.
 *
 * THIS FILE IS NOT COMPILED OR EXECUTED.
 * It exists as the architectural reference for the simulator's
 * HTTP layer. All JS implementations in sim/http_sim.js and
 * sim/http_bridge.js follow the naming and behavior defined here.
 *
 * SIMULATOR BEHAVIOR:
 *   - Uses browser fetch() API under the hood
 *   - Subject to browser CORS policy
 *   - Only CORS-enabled APIs work (ThingSpeak, public REST, etc.)
 *   - Response text is truncated to max_len bytes
 *   - Non-blocking internally (async fetch)
 *   - Requires Wi-Fi to be "connected" (Step 7) for realism,
 *     but the browser's real network is always used
 *
 * DEPENDENCIES:
 *   - Wi-Fi must be initialized (cyw43_arch_init + connect)
 *   - stdio for printf output of status messages
 *
 * ============================================================
 * Phase 2 — Step 8 (HTTP Client)
 * ============================================================
 */

#ifndef PICO_HTTP_CLIENT_H
#define PICO_HTTP_CLIENT_H

#include <stdint.h>

/* ============================================================
 * Error Codes
 * ============================================================ */

/* Request completed successfully */
#define HTTP_OK              0

/* Network error (DNS failure, connection refused, etc.) */
#define HTTP_ERR_NETWORK    -1

/* Request timed out */
#define HTTP_ERR_TIMEOUT    -2

/* CORS policy blocked the request (simulator-specific) */
#define HTTP_ERR_CORS       -3

/* HTTP server returned an error status (4xx, 5xx) */
#define HTTP_ERR_STATUS     -4

/* ============================================================
 * API Functions
 * ============================================================ */

/*
 * Perform an HTTP GET request.
 *
 * Sends a GET request to the specified URL and stores the
 * response body in the provided buffer. The response is
 * truncated to max_len - 1 bytes and null-terminated.
 *
 * In the simulator, this uses the browser's fetch() API.
 * On real hardware, this would use lwIP + TLS.
 *
 * @param url       — target URL (null-terminated string)
 * @param response  — buffer to store response body
 * @param max_len   — maximum bytes to store (including null terminator)
 * @return HTTP_OK (0) on success, negative error code on failure
 */
int http_get(const char *url, char *response, int max_len);

#endif /* PICO_HTTP_CLIENT_H */
