/*
 * net/http_client.h — HTTP Client API for Emscripten compilation
 */

#ifndef PICO_HTTP_CLIENT_H
#define PICO_HTTP_CLIENT_H

#include "pico/types.h"

#define HTTP_OK              0
#define HTTP_ERR_NETWORK    -1
#define HTTP_ERR_TIMEOUT    -2
#define HTTP_ERR_CORS       -3
#define HTTP_ERR_STATUS     -4

int http_get(const char *url, char *response, int max_len);

#endif /* PICO_HTTP_CLIENT_H */
