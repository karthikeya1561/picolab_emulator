/**
 * state_inspector.js — Runtime State Inspector (Step 17)
 *
 * Provides a collapsible panel that displays live simulation state
 * for debugging. Shows GPIO pin states, execution state, PWM slices,
 * WiFi status, and active canvas components.
 *
 * RESPONSIBILITIES:
 *   - Collect state snapshots from sim modules (gpio, pwm, wifi, debugger)
 *   - Render state into the inspector DOM panel
 *   - Schedule async updates via requestAnimationFrame (no perf impact)
 *   - Show/hide panel based on debugger state
 *
 * DOES NOT:
 *   - Modify simulation state
 *   - Block the main thread
 *   - Communicate with the Web Worker
 *
 * UPDATE TRIGGERS:
 *   - Debugger pauses execution
 *   - Step execution occurs
 *   - Firmware state changes (GPIO output)
 */

import { getPinState, readPin, GPIO_OUT, GPIO_IN, PULL_UP, PULL_DOWN } from './gpio_sim.js';
import { getSliceState, getDutyCycle, gpioToSlice, gpioToChannel } from './pwm_sim.js';
import { getStatus as getWifiStatus } from './wifi_sim.js';
import { isExecutionPaused } from './debugger.js';

// ---------- Module State ----------

let panelElement = null;
let contentElement = null;
let canvasManagerRef = null;
let isVisible = false;
let updateScheduled = false;

// ---------- Initialization ----------

/**
 * Initialize the state inspector.
 * Binds to the DOM panel and stores the CanvasManager reference.
 *
 * @param {HTMLElement} panel — the #state-inspector-panel element
 * @param {object} canvasManager — CanvasManager instance for component info
 */
export function init(panel, canvasManager) {
    panelElement = panel;
    contentElement = panel ? panel.querySelector('#inspector-content') : null;
    canvasManagerRef = canvasManager;
}

// ---------- Visibility ----------

/**
 * Show the inspector panel.
 */
export function show() {
    if (!panelElement) return;
    panelElement.classList.remove('hidden');
    isVisible = true;
    scheduleUpdate();
}

/**
 * Hide the inspector panel.
 */
export function hide() {
    if (!panelElement) return;
    panelElement.classList.add('hidden');
    isVisible = false;
}

/**
 * Toggle inspector panel visibility.
 */
export function toggle() {
    if (isVisible) {
        hide();
    } else {
        show();
    }
}

/**
 * Check if the inspector is currently visible.
 * @returns {boolean}
 */
export function isInspectorVisible() {
    return isVisible;
}

// ---------- State Collection ----------

/**
 * Collect a full state snapshot from all sim modules.
 * Only includes initialized GPIO pins to avoid clutter.
 *
 * @returns {object} — state snapshot
 */
function collectState() {
    // GPIO states — only initialized pins
    const gpioPins = [];
    for (let i = 0; i < 30; i++) {
        const pin = getPinState(i);
        if (pin && pin.initialized) {
            gpioPins.push({
                pin: i,
                direction: pin.direction === GPIO_OUT ? 'OUT' : 'IN',
                value: readPin(i) === 1 ? 'HIGH' : 'LOW',
                pull: pin.pull === PULL_UP ? 'PULL_UP' : (pin.pull === PULL_DOWN ? 'PULL_DOWN' : 'NONE'),
                outputValue: pin.outputValue,
                externalDrive: pin.externalDrive
            });
        }
    }

    // PWM — only active slices
    const pwmSlices = [];
    for (let i = 0; i < 8; i++) {
        const slice = getSliceState(i);
        if (slice && slice.enabled) {
            pwmSlices.push({
                slice: i,
                wrap: slice.wrap,
                levelA: slice.levels[0],
                levelB: slice.levels[1],
                dutyA: (slice.levels[0] / (slice.wrap + 1) * 100).toFixed(1),
                dutyB: (slice.levels[1] / (slice.wrap + 1) * 100).toFixed(1)
            });
        }
    }

    // WiFi
    const wifi = getWifiStatus();

    // Execution
    const execution = {
        paused: isExecutionPaused(),
    };

    // Active components
    const components = [];
    if (canvasManagerRef && canvasManagerRef.components) {
        canvasManagerRef.components.forEach(c => {
            if (c.id.startsWith('led_')) {
                components.push({ type: 'LED', id: c.id, color: c.color || 'red' });
            } else if (c.id.startsWith('res_')) {
                components.push({ type: 'Resistor', id: c.id, value: (c.value || 0) * (c.unit || 1) });
            } else if (c.id.startsWith('btn_')) {
                components.push({ type: 'Button', id: c.id, pressed: !!c.isPressed });
            }
        });
    }

    return { gpioPins, pwmSlices, wifi, execution, components };
}

// ---------- Display Helpers ----------

/**
 * Convert a hex color code to a human-readable color name.
 * @param {string} hex — e.g. '#ef4444'
 * @returns {string} — e.g. 'Red'
 */
function hexToColorName(hex) {
    const colorMap = {
        '#ef4444': 'Red',
        '#22c55e': 'Green',
        '#3b82f6': 'Blue',
        '#facc15': 'Yellow',
        '#f97316': 'Orange',
        '#a855f7': 'Purple',
        '#ec4899': 'Pink',
        '#22d3ee': 'Cyan',
        '#ffffff': 'White',
        '#a3e635': 'Lime'
    };
    const lower = (hex || '').toLowerCase();
    return colorMap[lower] || hex || 'Unknown';
}

/**
 * Format a resistance value with the appropriate unit.
 * @param {number} ohms — resistance in ohms
 * @returns {string} — e.g. '1kΩ', '2.2MΩ', '470Ω'
 */
function formatResistance(ohms) {
    if (ohms >= 1000000) {
        const val = ohms / 1000000;
        return `${val % 1 === 0 ? val : val.toFixed(1)}MΩ`;
    } else if (ohms >= 1000) {
        const val = ohms / 1000;
        return `${val % 1 === 0 ? val : val.toFixed(1)}kΩ`;
    }
    return `${ohms}Ω`;
}

// ---------- Rendering ----------

/**
 * Render the collected state into the inspector panel.
 */
function renderState() {
    if (!contentElement) return;

    const state = collectState();
    let html = '';

    // ── GPIO Section ──
    html += renderSectionHeader('GPIO STATE', 'memory');
    if (state.gpioPins.length === 0) {
        html += `<div class="text-dracula-comment text-[11px] italic px-3 py-1">No initialized pins</div>`;
    } else {
        state.gpioPins.forEach(p => {
            const valueClass = p.value === 'HIGH' ? 'text-success' : 'text-dracula-comment';
            const dirBadge = p.direction === 'OUT'
                ? '<span class="text-[9px] px-1 py-0.5 rounded bg-primary/20 text-primary font-bold">OUT</span>'
                : '<span class="text-[9px] px-1 py-0.5 rounded bg-dracula-cyan/20 text-dracula-cyan font-bold">IN</span>';
            html += `
                <div class="flex items-center justify-between px-3 py-1 hover:bg-white/5 transition-colors">
                    <div class="flex items-center gap-2">
                        <span class="text-dracula-fg text-[11px] font-mono font-bold w-8">GP${p.pin}</span>
                        ${dirBadge}
                    </div>
                    <span class="${valueClass} text-[11px] font-mono font-bold">${p.value}</span>
                </div>`;
        });
    }

    // ── PWM Section ──
    if (state.pwmSlices.length > 0) {
        html += renderSectionHeader('PWM', 'tune');
        state.pwmSlices.forEach(s => {
            html += `
                <div class="px-3 py-1 text-[11px] font-mono hover:bg-white/5 transition-colors">
                    <div class="flex justify-between">
                        <span class="text-dracula-fg font-bold">Slice ${s.slice}</span>
                        <span class="text-dracula-comment">wrap: ${s.wrap}</span>
                    </div>
                    <div class="flex gap-3 text-dracula-orange">
                        <span>A: ${s.dutyA}%</span>
                        <span>B: ${s.dutyB}%</span>
                    </div>
                </div>`;
        });
    }

    // ── Execution Section ──
    html += renderSectionHeader('EXECUTION', 'play_pause');
    const pausedClass = state.execution.paused ? 'text-dracula-orange' : 'text-success';
    const pausedText = state.execution.paused ? 'PAUSED' : 'RUNNING';
    html += `
        <div class="px-3 py-1 text-[11px] font-mono">
            <div class="flex justify-between">
                <span class="text-dracula-comment">status:</span>
                <span class="${pausedClass} font-bold">${pausedText}</span>
            </div>
        </div>`;

    // ── WiFi Section ──
    if (state.wifi.initialized) {
        html += renderSectionHeader('WIFI', 'wifi');
        const connClass = state.wifi.connected ? 'text-success' : 'text-danger';
        const connText = state.wifi.connected ? 'CONNECTED' : 'DISCONNECTED';
        html += `
            <div class="px-3 py-1 text-[11px] font-mono space-y-0.5">
                <div class="flex justify-between">
                    <span class="text-dracula-comment">status:</span>
                    <span class="${connClass} font-bold">${connText}</span>
                </div>`;
        if (state.wifi.connected) {
            html += `
                <div class="flex justify-between">
                    <span class="text-dracula-comment">ssid:</span>
                    <span class="text-dracula-fg">${state.wifi.ssid}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-dracula-comment">ip:</span>
                    <span class="text-dracula-cyan">${state.wifi.ipAddress}</span>
                </div>`;
        }
        html += `</div>`;
    }

    // ── Components Section ──
    if (state.components.length > 0) {
        html += renderSectionHeader('COMPONENTS', 'developer_board');
        state.components.forEach(c => {
            let detail = '';
            if (c.type === 'Button') {
                detail = c.pressed
                    ? '<span class="text-danger font-bold">PRESSED</span>'
                    : '<span class="text-dracula-comment">released</span>';
            } else if (c.type === 'Resistor') {
                detail = `<span class="text-dracula-comment">${formatResistance(c.value)}</span>`;
            } else if (c.type === 'LED') {
                detail = `<span class="text-dracula-comment">${hexToColorName(c.color)}</span>`;
            }
            html += `
                <div class="flex items-center justify-between px-3 py-1 text-[11px] font-mono hover:bg-white/5 transition-colors">
                    <span class="text-dracula-fg">${c.type}</span>
                    ${detail}
                </div>`;
        });
    }

    contentElement.innerHTML = html;
}

/**
 * Render a section header with icon.
 * @param {string} title
 * @param {string} icon — Material Symbols icon name
 * @returns {string} HTML
 */
function renderSectionHeader(title, icon) {
    return `
        <div class="flex items-center gap-1.5 px-3 py-1.5 mt-1 border-b border-dracula-current/50">
            <span class="material-symbols-outlined text-[14px] text-primary">${icon}</span>
            <span class="text-[10px] font-bold text-dracula-comment uppercase tracking-[0.12em]">${title}</span>
        </div>`;
}

// ---------- Async Update Scheduling ----------

/**
 * Schedule an asynchronous state update.
 * Uses requestAnimationFrame to avoid blocking simulation.
 * Throttled: only one update per animation frame.
 */
export function scheduleUpdate() {
    if (!isVisible || updateScheduled) return;
    updateScheduled = true;

    requestAnimationFrame(() => {
        updateScheduled = false;
        if (isVisible) {
            renderState();
        }
    });
}

/**
 * Force an immediate state update (used on pause/step events).
 * Still async via rAF but clears any pending schedule.
 */
export function forceUpdate() {
    if (!isVisible) return;
    updateScheduled = false;
    scheduleUpdate();
}
