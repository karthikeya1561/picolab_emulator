#include "net/http_client.h"

/* JS hook */
extern int sim_http_get(
    const char *url,
    char *response,
    int max_len
);

int http_get(const char *url, char *response, int max_len) {
    return sim_http_get(url, response, max_len);
}
