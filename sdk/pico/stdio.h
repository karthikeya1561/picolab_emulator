/*
 * ============================================================
 * stdio.h — Pico SDK Serial/Stdio Interface (Documentation Reference)
 * ============================================================
 *
 * This file documents the target C API for serial output operations.
 * It mirrors the real Raspberry Pi Pico SDK pico/stdio.h
 *
 * THIS FILE IS NOT COMPILED OR EXECUTED.
 * It exists as the architectural reference for the simulator's
 * serial layer. All JS implementations in sim/serial_sim.js and
 * sim/serial_bridge.js follow the naming and behavior defined here.
 *
 * When the online compiler (Phase 3, Step 12) is implemented,
 * this file will be used as the actual header for compiling
 * user C code to WASM via Emscripten.
 *
 * SIMULATOR BEHAVIOR:
 *   - printf() and puts() route output to the Serial Monitor panel
 *   - stdio_init_all() initializes the serial output subsystem
 *   - Output is formatted with timestamps in the Serial Monitor
 *   - No actual UART hardware is simulated — output goes directly
 *     to the browser DOM via serial_sim.js
 *
 * ============================================================
 * Real Pico SDK Reference:
 *   https://www.raspberrypi.com/documentation/pico-sdk/runtime.html#group_pico_stdio
 * ============================================================
 */

#ifndef PICO_STDIO_H
#define PICO_STDIO_H

/* ============================================================
 * STEP 3 — Serial / stdio (Current Step)
 * ============================================================ */

/*
 * Initialize all stdio outputs.
 * Must be called before using printf() or puts().
 *
 * On real hardware, this initializes USB and/or UART stdio.
 * In the simulator, this initializes the Serial Monitor connection.
 *
 * Typically called once at the start of main().
 */
void stdio_init_all(void);

/*
 * Print a formatted string to stdout.
 *
 * Supports standard C format specifiers: %d, %s, %f, %x, etc.
 * Output appears in the Serial Monitor panel.
 *
 * @param format — printf-style format string
 * @param ...    — variable arguments matching format specifiers
 * @return       — number of characters printed
 */
int printf(const char *format, ...);

/*
 * Write a string to stdout followed by a newline.
 *
 * Simpler alternative to printf() for plain string output.
 * Output appears in the Serial Monitor panel.
 *
 * @param str — null-terminated string to output
 * @return    — non-negative on success, EOF on failure
 */
int puts(const char *str);

/*
 * Write a single character to stdout.
 *
 * @param c — character to output
 * @return  — the character written, or EOF on failure
 */
int putchar(int c);

#endif /* PICO_STDIO_H */
