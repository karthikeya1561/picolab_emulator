/*
 * http_client.c — C Bridge for HTTP operations
 */

#include "net/http_client.h"
#include <string.h>

extern int js_http_get(const char *url, char *response, int max_len);

int http_get(const char *url, char *response, int max_len) {
    return js_http_get(url, response, max_len);
}
