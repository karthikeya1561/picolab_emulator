/**
 * serial_sim.js — Serial Output Engine
 *
 * This is the core serial output simulation for the Pico W simulator.
 * It manages all text output that appears in the Serial Monitor panel.
 *
 * RESPONSIBILITIES:
 *   - Render formatted output lines to the Serial Monitor DOM element
 *   - Support multiple output types: info, error, system
 *   - Track initialization state (mirrors stdio_init_all behavior)
 *   - Provide clear/reset functionality
 *
 * DOES NOT:
 *   - Communicate with the Web Worker
 *   - Handle GPIO or any other peripheral
 *   - Manage the Serial Monitor UI layout (that stays in index.html)
 *
 * This module is the "truth" for serial output rendering.
 * All output to the Serial Monitor MUST go through this module.
 */

// ---------- State ----------

/**
 * Reference to the Serial Monitor DOM element (#output).
 * Set via init(). All output is appended here.
 */
let outputElement = null;

/**
 * Whether stdio has been initialized.
 * Mirrors the real Pico SDK requirement that stdio_init_all()
 * must be called before printf/puts work.
 */
let initialized = false;

// ---------- Initialization ----------

/**
 * Initialize the serial output engine.
 * Binds to the Serial Monitor DOM element.
 *
 * @param {HTMLElement} element — the #output DOM element
 */
export function init(element) {
    outputElement = element;
    initialized = true;
}

/**
 * Check if the serial engine is initialized.
 *
 * @returns {boolean}
 */
export function isInitialized() {
    return initialized && outputElement !== null;
}

// ---------- Output Rendering ----------

/**
 * Write a line of text to the Serial Monitor.
 * This is the single rendering function — all output goes through here.
 *
 * @param {string} text — the text to display
 * @param {string} type — "info" | "error" | "system"
 */
export function write(text, type = 'info') {
    if (!outputElement) return;

    const div = document.createElement('div');
    div.className = 'flex gap-3 items-start group animate-in fade-in slide-in-from-bottom-1 duration-300';

    const timestamp = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    let colorClass = 'text-gray-300';
    let typeLabel = '';

    if (type === 'error') {
        colorClass = 'text-red-400 font-bold';
        typeLabel = '<span class="text-red-500 shrink-0 select-none">[Error]</span>';
    } else if (type === 'warning') {
        colorClass = 'text-amber-400';
        typeLabel = '<span class="text-amber-500 shrink-0 select-none">[Warning]</span>';
    } else if (type === 'system') {
        colorClass = 'text-blue-400 italic';
        typeLabel = '<span class="text-blue-500 shrink-0 select-none">[System]</span>';
    } else {
        typeLabel = `<span class="text-gray-600 shrink-0 select-none">[${timestamp}]</span>`;
    }

    div.innerHTML = `${typeLabel}<span class="${colorClass} break-all font-mono">${text}</span>`;
    outputElement.appendChild(div);
    outputElement.scrollTop = outputElement.scrollHeight;
}

// ---------- Lifecycle ----------

/**
 * Clear all output from the Serial Monitor.
 */
export function clear() {
    if (outputElement) {
        outputElement.innerHTML = '';
    }
}

/**
 * Reset the serial engine.
 * Clears output and resets initialization state.
 * Called on simulation stop or system reset.
 */
export function reset() {
    initialized = false;
}
