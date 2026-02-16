#include "fs/fs.h"

/* JS hooks */
extern int sim_fs_init(void);
extern int sim_fs_write(
    const char *name,
    const char *data,
    int len
);
extern int sim_fs_read(
    const char *name,
    char *buf,
    int max_len
);
extern int sim_fs_exists(const char *name);

int fs_init(void) {
    return sim_fs_init();
}

int fs_write(const char *filename, const char *data, int len) {
    return sim_fs_write(filename, data, len);
}

int fs_read(const char *filename, char *buffer, int max_len) {
    return sim_fs_read(filename, buffer, max_len);
}

int fs_exists(const char *filename) {
    return sim_fs_exists(filename);
}
