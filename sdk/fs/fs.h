/*
 * ============================================================
 * fs.h — Pico W Filesystem Interface (Documentation Reference)
 * ============================================================
 *
 * This file documents the target C API for filesystem operations.
 * It provides simple key-value file storage for Pico W firmware.
 *
 * THIS FILE IS NOT COMPILED OR EXECUTED.
 * It exists as the architectural reference for the simulator's
 * filesystem layer. All JS implementations in sim/fs_sim.js and
 * sim/fs_bridge.js follow the naming and behavior defined here.
 *
 * SIMULATOR BEHAVIOR:
 *   - Uses browser localStorage for persistent storage
 *   - Files stored with "pico_fs:" prefix to avoid collisions
 *   - Data persists across page reloads (simulates flash memory)
 *   - Data survives simulation reset (flash != RAM)
 *   - String-based storage (no raw binary support)
 *
 * REAL HARDWARE EQUIVALENT:
 *   - On real Pico W, this maps to littlefs on flash
 *   - Flash memory survives power cycles and resets
 *   - File names and data are string-based for simplicity
 *
 * ============================================================
 * Phase 2 — Step 10 (Filesystem / Flash Persistence)
 * ============================================================
 */

#ifndef PICO_FS_H
#define PICO_FS_H

/* ============================================================
 * Error Codes
 * ============================================================ */

/* Operation completed successfully */
#define FS_OK              0

/* File not found */
#define FS_ERR_NOT_FOUND  -1

/* Write failed (localStorage full, etc.) */
#define FS_ERR_WRITE      -2

/* Filesystem not initialized */
#define FS_ERR_INIT       -3

/* ============================================================
 * API Functions
 * ============================================================ */

/*
 * Initialize the filesystem.
 * Must be called before any other fs_ function.
 *
 * @return FS_OK (0) on success
 */
int fs_init(void);

/*
 * Write data to a file. Creates the file if it doesn't exist,
 * overwrites if it does.
 *
 * @param filename — file name (null-terminated string)
 * @param data     — data to write (null-terminated string)
 * @return FS_OK (0) on success, FS_ERR_WRITE (-2) on failure
 */
int fs_write(const char *filename, const char *data);

/*
 * Read data from a file.
 *
 * @param filename — file name (null-terminated string)
 * @param buffer   — buffer to store file contents
 * @param max_len  — maximum bytes to read (including null terminator)
 * @return FS_OK (0) on success, FS_ERR_NOT_FOUND (-1) if file missing
 */
int fs_read(const char *filename, char *buffer, int max_len);

/*
 * Check if a file exists.
 *
 * @param filename — file name (null-terminated string)
 * @return 1 if file exists, 0 if not
 */
int fs_exists(const char *filename);

/*
 * Delete a file.
 *
 * @param filename — file name (null-terminated string)
 * @return FS_OK (0) on success, FS_ERR_NOT_FOUND (-1) if file missing
 */
int fs_delete(const char *filename);

#endif /* PICO_FS_H */
