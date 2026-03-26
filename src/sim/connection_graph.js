/**
 * connection_graph.js — Connection Graph Module (Step 14)
 *
 * Single source of truth for circuit connections and analysis.
 * Extracted from SimulatorBridge.js to eliminate 5 duplicated BFS traversals.
 *
 * RESPONSIBILITIES:
 *   - Wire registry (add, remove, query, duplicate prevention)
 *   - Unified BFS circuit traversal
 *   - Component internal connection logic (resistor, button)
 *   - Pin definition helpers (GPIO lookup, Ground/Power checks)
 *   - Validation layer for new connections
 *   - Disconnect cleanup callbacks
 *
 * DOES NOT:
 *   - Touch the DOM or render wires (WireInteractionManager does that)
 *   - Manage GPIO pin state (gpio_sim.js does that)
 *   - Communicate with the Web Worker
 *
 * DATA FLOW:
 *   WireInteractionManager.createWire() → addWire()
 *   WireInteractionManager.deleteWire() → removeWire() → onWireRemoved callback
 *   SimulatorBridge.updateCircuit()      → checkConnection() / findDrivingGpio()
 *   SimulatorBridge.updateGpioInputStates() → analyzeNet()
 *   SimulatorBridge.validateOutputPin()  → isGpioConnectedTo()
 */

import { LEFT_PINS, RIGHT_PINS } from '../components/Pico.js';

// ─── Wire Registry ───────────────────────────────────────────────────

/**
 * Internal wire store — the single source of truth for all connections.
 * Each wire: { id, start: node, end: node, color, ... }
 * Node format: { nodeType: 'gpio'|'component_pin', pin, componentId? }
 */
let wires = [];

/**
 * Callback fired when a wire is removed.
 * Signature: onWireRemovedCallback(removedWire)
 * SimulatorBridge registers this to reset GPIO input states.
 */
let onWireRemovedCallback = null;

/**
 * Register a callback for wire removal events.
 * @param {Function} callback — function(removedWire)
 */
export function setOnWireRemoved(callback) {
    onWireRemovedCallback = callback;
}

/**
 * Add a wire to the connection graph.
 * Rejects duplicates (same start+end in either order).
 *
 * @param {object} wire — wire object { id, start, end, color, ... }
 * @returns {boolean} true if added, false if duplicate
 */
export function addWire(wire) {
    if (isDuplicate(wire.start, wire.end)) {
        console.warn('[ConnectionGraph] Duplicate wire rejected:', wire.id);
        return false;
    }
    wires.push(wire);
    return true;
}

/**
 * Remove a wire from the connection graph by ID.
 * Triggers the onWireRemoved callback for cleanup.
 *
 * @param {string} wireId — wire ID to remove
 * @returns {object|null} the removed wire, or null if not found
 */
export function removeWire(wireId) {
    const idx = wires.findIndex(w => w.id === wireId);
    if (idx === -1) return null;

    const removed = wires[idx];
    wires.splice(idx, 1);

    // Notify listeners for cleanup (e.g., reset GPIO states)
    if (onWireRemovedCallback) {
        onWireRemovedCallback(removed);
    }

    return removed;
}

/**
 * Get all registered wires.
 * @returns {Array} — array of wire objects
 */
export function getWires() {
    return wires;
}

/**
 * Clear all wires from the graph.
 * Called on simulation stop or full reset.
 */
export function clearAllWires() {
    wires = [];
}

/**
 * Sync wire registry with an external wire array.
 * Used during initialization/restore when wires already exist in CanvasManager.
 *
 * @param {Array} externalWires — array of wire objects to sync from
 */
export function syncWires(externalWires) {
    wires = externalWires;
}

/**
 * Check if a wire between two nodes already exists.
 * Checks both directions (start↔end).
 *
 * @param {object} start — start node
 * @param {object} end — end node
 * @returns {boolean}
 */
export function isDuplicate(start, end) {
    return wires.some(w =>
        (nodesEqual(w.start, start) && nodesEqual(w.end, end)) ||
        (nodesEqual(w.start, end) && nodesEqual(w.end, start))
    );
}

// ─── Node Utilities ──────────────────────────────────────────────────

/**
 * Check equality between two wire endpoint nodes.
 * Replaces 5 inline isSame() closures in SimulatorBridge.
 *
 * @param {object} n1 — first node
 * @param {object} n2 — second node
 * @returns {boolean}
 */
export function nodesEqual(n1, n2) {
    if (n1.nodeType !== n2.nodeType) return false;
    if (n1.nodeType === 'component_pin') {
        return n1.componentId === n2.componentId && n1.pin === n2.pin;
    }
    if (n1.nodeType === 'gpio') {
        return n1.pin === n2.pin;
    }
    return false;
}

/**
 * Generate a canonical key for a node (for visited-set operations).
 *
 * @param {object} node — wire endpoint node
 * @returns {string}
 */
export function nodeKey(node) {
    if (node.nodeType === 'gpio') return `gpio_${node.pin}`;
    return `comp_${node.componentId}_${node.pin}`;
}

// ─── Pin Definition Helpers ──────────────────────────────────────────

const ALL_PINS = [...LEFT_PINS, ...RIGHT_PINS];

/**
 * Resolve a GPIO number (0–29) to its Pico pin definition.
 *
 * @param {number} gpNum — GPIO number
 * @returns {object|undefined} — pin definition { pin, label, type }
 */
export function resolveGpioPin(gpNum) {
    return ALL_PINS.find(p => p.label === `GP${gpNum}`);
}

/**
 * Resolve a physical pin number to its definition.
 *
 * @param {number|string} pinNumber — physical pin number (1–40)
 * @returns {object|undefined}
 */
export function resolvePinDef(pinNumber) {
    return ALL_PINS.find(p => p.pin == pinNumber);
}

/**
 * Extract GPIO number from a pin definition label (e.g., 'GP15' → 15).
 *
 * @param {object} pinDef — pin definition with label
 * @returns {number|NaN}
 */
export function extractGpioNumber(pinDef) {
    return parseInt(pinDef.label.replace('GP', ''));
}

// ─── Component Internal Connections ──────────────────────────────────

/**
 * Returns which pins are internally connected to a given pin on a push button.
 *
 * Button internal wiring:
 *   - Pins 1 and 2 are always connected (top row)
 *   - Pins 3 and 4 are always connected (bottom row)
 *   - When pressed: all 4 pins are connected
 *
 * @param {string} pin — the pin being queried ('1', '2', '3', or '4')
 * @param {boolean} isPressed — whether the button is currently pressed
 * @returns {string[]} — array of connected pin names
 */
export function getButtonConnectedPins(pin, isPressed) {
    const topPins = ['1', '2'];
    const bottomPins = ['3', '4'];
    const connectedPins = [];

    // Same-row pins are always connected
    if (topPins.includes(pin)) {
        connectedPins.push(...topPins.filter(p => p !== pin));
    } else if (bottomPins.includes(pin)) {
        connectedPins.push(...bottomPins.filter(p => p !== pin));
    }

    // When pressed, top connects to bottom (all pins connected)
    if (isPressed) {
        if (topPins.includes(pin)) {
            connectedPins.push(...bottomPins);
        } else if (bottomPins.includes(pin)) {
            connectedPins.push(...topPins);
        }
    }

    return connectedPins;
}

/**
 * Adds internal connections for components to the BFS queue.
 * Handles the "transparency" of components where pins are internally connected.
 *
 * @param {object} neighbor — the current node being processed
 * @param {array} queue — BFS queue
 * @param {Set} visited — visited set
 * @param {Array} components — component array (for button press state)
 */
function addInternalConnections(neighbor, queue, visited, components) {
    if (neighbor.nodeType !== 'component_pin') return;

    // Resistor: pins 1 and 2 are always connected
    if (neighbor.componentId.startsWith('res_')) {
        const otherPin = neighbor.pin === '1' ? '2' : '1';
        addNodeIfNotVisited({ ...neighbor, pin: otherPin }, queue, visited);
    }

    // Push button: internal connections depend on pressed state
    if (neighbor.componentId.startsWith('btn_')) {
        const btn = components.find(c => c.id === neighbor.componentId);
        if (btn) {
            const connectedPins = getButtonConnectedPins(neighbor.pin, btn.isPressed);
            connectedPins.forEach(otherPin => {
                addNodeIfNotVisited({ ...neighbor, pin: otherPin }, queue, visited);
            });
        }
    }
}

/**
 * Helper to add a node to the BFS queue if not already visited.
 */
function addNodeIfNotVisited(node, queue, visited) {
    const key = nodeKey(node);
    if (!visited.has(key)) {
        visited.add(key);
        queue.push(node);
    }
}

// ─── Unified BFS Traversal ──────────────────────────────────────────

/**
 * Core BFS traversal of the connection graph from a starting node.
 * Walks through wires and component internal connections.
 *
 * @param {object} startNode — starting node
 * @param {Array} components — component array (for internal connections)
 * @param {object} [options] — optional early-termination conditions
 * @param {Function} [options.onGpio] — called with (gpNum, pinDef) for each GPIO found; return true to stop
 * @param {Function} [options.onComponent] — called with (node) for each component_pin; return true to stop
 * @param {Function} [options.onPinDef] — called with (pinDef) for each Pico pin found; return true to stop
 * @returns {object} — { gpios: number[], isGrounded: boolean, hasPower: boolean, terminated: boolean }
 */
function bfsTraverse(startNode, components, options = {}) {
    const queue = [startNode];
    const visited = new Set();
    visited.add(nodeKey(startNode));

    const result = {
        gpios: [],
        isGrounded: false,
        hasPower: false,
        terminated: false
    };

    // Add internal connections for the start node itself
    addInternalConnections(startNode, queue, visited, components);

    while (queue.length > 0) {
        const current = queue.shift();

        // Process GPIO / Pico pins
        if (current.nodeType === 'gpio') {
            const pinDef = resolvePinDef(current.pin);
            if (pinDef) {
                if (pinDef.type === 'Ground') {
                    result.isGrounded = true;
                }
                if (pinDef.type === 'Power') {
                    result.hasPower = true;
                }
                if (pinDef.type === 'GPIO' || pinDef.type === 'ADC0' || pinDef.type === 'ADC1' || pinDef.type === 'ADC2') {
                    const gpNum = extractGpioNumber(pinDef);
                    if (!isNaN(gpNum) && !result.gpios.includes(gpNum)) {
                        result.gpios.push(gpNum);
                    }
                }

                // Early termination callbacks
                if (options.onPinDef && options.onPinDef(pinDef)) {
                    result.terminated = true;
                    return result;
                }
                if (options.onGpio && pinDef.type === 'GPIO') {
                    const gpNum = extractGpioNumber(pinDef);
                    if (!isNaN(gpNum) && options.onGpio(gpNum, pinDef)) {
                        result.terminated = true;
                        return result;
                    }
                }
            }
        }

        // Early termination for component_pin
        if (current.nodeType === 'component_pin' && options.onComponent) {
            if (options.onComponent(current)) {
                result.terminated = true;
                return result;
            }
        }

        // Traverse wires to find neighbors
        wires.forEach(w => {
            let neighbor = null;

            if (nodesEqual(w.start, current)) neighbor = w.end;
            else if (nodesEqual(w.end, current)) neighbor = w.start;

            if (neighbor) {
                const key = nodeKey(neighbor);
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.push(neighbor);

                    // Handle component internal connections
                    addInternalConnections(neighbor, queue, visited, components);
                }
            }
        });
    }

    return result;
}

// ─── Public Circuit Analysis API ─────────────────────────────────────

/**
 * Analyzes the electrical net connected to a component pin.
 * Finds connected GPIOs and checks if the net is grounded.
 *
 * Replaces SimulatorBridge.analyzeNet()
 *
 * @param {string} componentId — the component's ID
 * @param {string} pin — the pin name/number
 * @param {Array} components — component array
 * @returns {object} — { gpios: number[], isGrounded: boolean }
 */
export function analyzeNet(componentId, pin, components) {
    const startNode = { nodeType: 'component_pin', componentId, pin };
    const result = bfsTraverse(startNode, components);
    return {
        gpios: result.gpios,
        isGrounded: result.isGrounded
    };
}

/**
 * Checks if a component pin is connected to a target type (Power or Ground).
 * Also handles GPIO-as-Power (output HIGH).
 *
 * Replaces SimulatorBridge.checkConnection()
 *
 * @param {string} componentId — the component's ID
 * @param {string} pin — the pin name/number
 * @param {string} targetType — 'Power' or 'Ground'
 * @param {Array} components — component array
 * @param {Function} isOutputHighFn — function(gpNum) => boolean, checks if GPIO is outputting HIGH
 * @param {boolean} workerActive — whether a worker is running (needed for Power check)
 * @returns {boolean}
 */
export function checkConnection(componentId, pin, targetType, components, isOutputHighFn, workerActive) {
    const startNode = { nodeType: 'component_pin', componentId, pin };

    let found = false;
    bfsTraverse(startNode, components, {
        onPinDef: (pinDef) => {
            if (targetType === 'Ground' && pinDef.type === 'Ground') {
                found = true;
                return true; // stop
            }
            if (targetType === 'Power') {
                if (!workerActive) return false;
                if (pinDef.type === 'Power') {
                    found = true;
                    return true; // stop
                }
                if (pinDef.type === 'GPIO') {
                    const gpNum = extractGpioNumber(pinDef);
                    if (!isNaN(gpNum) && isOutputHighFn(gpNum)) {
                        found = true;
                        return true; // stop
                    }
                }
            }
            return false;
        }
    });

    return found;
}

/**
 * BFS from a GPIO pin to check if it reaches a component of the given type.
 * Traverses wires and passes through resistors/buttons.
 *
 * Replaces SimulatorBridge._isGpioConnectedTo()
 *
 * @param {number} gpNum — GPIO number (0–29)
 * @param {string} prefix — component ID prefix ('led_' or 'btn_')
 * @param {Array} components — component array
 * @returns {boolean}
 */
export function isGpioConnectedTo(gpNum, prefix, components) {
    const pinDef = resolveGpioPin(gpNum);
    if (!pinDef) return false;

    const startNode = { nodeType: 'gpio', pin: pinDef.pin };

    let found = false;
    bfsTraverse(startNode, components, {
        onComponent: (node) => {
            if (node.componentId && node.componentId.startsWith(prefix)) {
                found = true;
                return true; // stop
            }
            return false;
        }
    });

    return found;
}

/**
 * Find the GPIO pin number driving an LED's anode.
 * Traces from the LED's anode (pin 'A') through wires to find the GPIO.
 *
 * Replaces SimulatorBridge.findDrivingGpio()
 *
 * @param {string} ledId — LED component ID
 * @param {Array} components — component array
 * @returns {number|null} — GPIO number (0–29), or null if not connected
 */
export function findDrivingGpio(ledId, components) {
    const startNode = { nodeType: 'component_pin', componentId: ledId, pin: 'A' };

    let gpioNum = null;
    bfsTraverse(startNode, components, {
        onGpio: (gpNum) => {
            gpioNum = gpNum;
            return true; // stop at first GPIO
        }
    });

    return gpioNum;
}

// ─── Validation Layer ────────────────────────────────────────────────

/**
 * Validates whether a new wire connection is acceptable.
 * Checks for duplicates; electrical validity is handled by WireInteractionManager.isValidConnection().
 *
 * @param {object} start — start node
 * @param {object} end — end node
 * @returns {object} — { valid: boolean, reason: string }
 */
export function validateWire(start, end) {
    // Self-connection
    if (nodesEqual(start, end)) {
        return { valid: false, reason: 'Cannot connect a pin to itself.' };
    }

    // Duplicate check
    if (isDuplicate(start, end)) {
        return { valid: false, reason: 'A wire already exists between these pins.' };
    }

    return { valid: true, reason: '' };
}
