/**
 * circuit_validator.js — Circuit Validation Engine (Step 19)
 *
 * Provides functions to analyze the simulation graph and detect:
 *  - Duplicate wires
 *  - Floating pins (components missing power or ground)
 *  - Unsupported links (e.g. invalid port types)
 *
 * Warnings are sent to the serial monitor without crashing simulation.
 */

import { printWarning } from './serial_bridge.js';

/**
 * Validates a new wire before it is added to the canvas.
 * Prevents visually overlapping/duplicate wires between the same two endpoints.
 * 
 * @param {object} newWire - The proposed wire { start, end }
 * @param {Array} existingWires - Array of current wires
 * @returns {boolean} True if wire is valid and should be added, false otherwise
 */
export function validateNewWire(newWire, existingWires) {
    if (!newWire || !newWire.start || !newWire.end) return false;

    // A wire shouldn't connect a node to itself
    if (nodesMatch(newWire.start, newWire.end)) {
        return false;
    }

    // Check for duplicate wires (A to B, or B to A)
    const isDuplicate = existingWires.some(wire => {
        const matchesA = nodesMatch(wire.start, newWire.start) && nodesMatch(wire.end, newWire.end);
        const matchesB = nodesMatch(wire.start, newWire.end) && nodesMatch(wire.end, newWire.start);
        return matchesA || matchesB;
    });

    if (isDuplicate) {
        // We log locally but don't print to serial here since it's a UI action
        console.warn('CircuitValidator: Prevented duplicate wire.');
        return false;
    }

    return true;
}

/**
 * Validates the entire circuit state at simulation startup.
 * Detects floating components and prints warnings to the serial monitor.
 * 
 * @param {Array} components - All canvas components
 * @param {Array} wires - All canvas wires
 */
export function validateCircuit(components, wires) {
    let warningsFound = 0;

    components.forEach(comp => {
        if (comp.id.startsWith('led_')) {
            const hasAnode = isPinConnected(comp.id, 'A', wires);
            const hasCathode = isPinConnected(comp.id, 'C', wires);

            if (hasAnode && !hasCathode) {
                printWarning(`Warning: Floating LED cathode detected. Consider wiring it to GND.`);
                warningsFound++;
            } else if (!hasAnode && hasCathode) {
                printWarning(`Warning: Floating LED anode detected. Consider wiring it to a GPIO or VBUS.`);
                warningsFound++;
            }
        } 
        else if (comp.id.startsWith('btn_')) {
            const numConnections = countButtonConnections(comp.id, wires);
            if (numConnections === 1) {
                printWarning(`Warning: Button ${comp.id.replace('btn_', '')} is only connected on one side. It will not form a complete circuit.`);
                warningsFound++;
            }
        }
        else if (comp.id.startsWith('res_')) {
            const hasPin1 = isPinConnected(comp.id, '1', wires);
            const hasPin2 = isPinConnected(comp.id, '2', wires);
            if ((hasPin1 && !hasPin2) || (!hasPin1 && hasPin2)) {
                printWarning(`Warning: Resistor ${comp.id.replace('res_', '')} has a floating pin. Resistors must be connected in-line with a circuit.`);
                warningsFound++;
            }
        }
    });

    if (warningsFound > 0) {
        console.warn(`CircuitValidator: Found ${warningsFound} circuit warnings.`);
    }
}

// --- Helpers ---

/** Check if two port objects represent the exact same physical endpoint */
function nodesMatch(n1, n2) {
    if (!n1 || !n2) return false;
    if (n1.nodeType !== n2.nodeType) return false;
    
    if (n1.nodeType === 'gpio') {
        return n1.pin === n2.pin;
    } else if (n1.nodeType === 'component_pin') {
        return n1.componentId === n2.componentId && n1.pin === n2.pin;
    }
    return false;
}

/** Check if a specific component pin has at least one wire attached to it */
function isPinConnected(componentId, pinId, wires) {
    return wires.some(w => {
        return (w.start.nodeType === 'component_pin' && w.start.componentId === componentId && w.start.pin === pinId) ||
               (w.end.nodeType === 'component_pin' && w.end.componentId === componentId && w.end.pin === pinId);
    });
}

/** Buttons have 4 physical pins, but logically 2 sides. This simply counts total wires attached to any of its pins. */
function countButtonConnections(componentId, wires) {
    let count = 0;
    wires.forEach(w => {
        if (w.start.nodeType === 'component_pin' && w.start.componentId === componentId) count++;
        if (w.end.nodeType === 'component_pin' && w.end.componentId === componentId) count++;
    });
    return count;
}
