/**
 * performance_monitor.js — Runtime Performance Monitor (Step 18)
 *
 * Tracks internal performance metrics to ensure stable simulation.
 * Calculates and manages display of:
 *   - FPS (Frames Per Second)
 *   - Signal Propagation Duration (time taken to evaluate circuit logic)
 *   - Worker Latency (round-trip time for worker messages)
 *
 * Designed for minimal overhead using requestAnimationFrame.
 */

// ---------- State ----------

let isTracking = false;
let isPanelVisible = false;

// DOM Elements
let panelEl = null;
let fpsEl = null;
let propEl = null;
let latEl = null;

// FPS Tracking
let frameCount = 0;
let lastFpsTime = 0;
let currentFps = 0;

// Metrics
let lastPropagationTime = 0;
let lastWorkerLatency = 0;

// Intervals
let updateIntervalId = null;

// ---------- Initialization ----------

export function init(panelElement) {
    if (!panelElement) return;
    
    panelEl = panelElement;
    fpsEl = panelElement.querySelector('#perf-fps');
    propEl = panelElement.querySelector('#perf-prop');
    latEl = panelElement.querySelector('#perf-lat');
}

// ---------- Visibility Control ----------

export function togglePanel() {
    if (isPanelVisible) {
        hidePanel();
    } else {
        showPanel();
    }
}

export function showPanel() {
    if (!panelEl) return;
    panelEl.classList.remove('hidden');
    isPanelVisible = true;
}

export function hidePanel() {
    if (!panelEl) return;
    panelEl.classList.add('hidden');
    isPanelVisible = false;
}

// ---------- Lifecycle ----------

export function startTracking() {
    if (isTracking) return;
    isTracking = true;
    
    // Reset counters
    frameCount = 0;
    lastFpsTime = performance.now();
    lastPropagationTime = 0;
    lastWorkerLatency = 0;
    currentFps = 0;

    // Start FPS loop
    requestAnimationFrame(trackFps);

    // Render metrics to UI every 1 second
    updateIntervalId = setInterval(() => {
        renderMetrics();
    }, 1000);
}

export function stopTracking() {
    if (!isTracking) return;
    isTracking = false;
    
    if (updateIntervalId) {
        clearInterval(updateIntervalId);
        updateIntervalId = null;
    }
    
    // Reset UI to dashed lines when stopped
    if (fpsEl) fpsEl.textContent = '--';
    if (propEl) propEl.textContent = '-- ms';
    if (latEl) latEl.textContent = '-- ms';
}

// ---------- Metric Collection ----------

/**
 * FPS counter running on requestAnimationFrame.
 * Has near-zero overhead.
 */
function trackFps(timestamp) {
    if (!isTracking) return;
    
    frameCount++;
    const elapsed = timestamp - lastFpsTime;
    
    if (elapsed >= 1000) {
        currentFps = Math.round((frameCount * 1000) / elapsed);
        frameCount = 0;
        lastFpsTime = timestamp;
    }
    
    requestAnimationFrame(trackFps);
}

/**
 * Report how long it took to trace the circuit and update outputs.
 * Called by SimulatorBridge after updateCircuit().
 * 
 * @param {number} durationMs - execution time in milliseconds
 */
export function reportPropagationTime(durationMs) {
    if (!isTracking) return;
    lastPropagationTime = durationMs;
}

/**
 * Report worker latency (time between ping and pong).
 * Called by SimulatorBridge when PONG is received.
 * 
 * @param {number} latencyMs - round trip time in milliseconds
 */
export function reportWorkerLatency(latencyMs) {
    if (!isTracking) return;
    lastWorkerLatency = latencyMs;
}

// ---------- Rendering ----------

/**
 * Update the DOM with the latest collected metrics.
 * Called once per second by the interval timer.
 */
function renderMetrics() {
    if (!isPanelVisible || !panelEl) return;

    if (fpsEl) {
        fpsEl.textContent = currentFps.toString();
        // Color code FPS
        fpsEl.className = currentFps >= 50 ? 'text-success font-bold' : 
                         (currentFps >= 30 ? 'text-dracula-orange font-bold' : 'text-danger font-bold');
    }
    
    if (propEl) {
        const propStr = lastPropagationTime < 0.1 ? '< 0.1' : lastPropagationTime.toFixed(1);
        propEl.textContent = `${propStr} ms`;
        // Color code propagation (target < 5ms)
        propEl.className = lastPropagationTime < 5 ? 'text-success font-bold' : 
                          (lastPropagationTime < 16 ? 'text-dracula-orange font-bold' : 'text-danger font-bold');
    }
    
    if (latEl) {
        const latStr = lastWorkerLatency < 0.1 ? '< 0.1' : lastWorkerLatency.toFixed(1);
        latEl.textContent = `${latStr} ms`;
        // Color code latency (target < 10ms for local worker)
        latEl.className = lastWorkerLatency < 10 ? 'text-success font-bold' : 
                         (lastWorkerLatency < 50 ? 'text-dracula-orange font-bold' : 'text-danger font-bold');
    }
}
