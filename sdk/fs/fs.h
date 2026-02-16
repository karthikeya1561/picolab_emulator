#ifndef FS_H
#define FS_H

int fs_init(void);

int fs_write(
    const char *filename,
    const char *data,
    int len
);

int fs_read(
    const char *filename,
    char *buffer,
    int max_len
);

int fs_exists(const char *filename);

#endif
