/**
 * This file handles connecting wires.
 * It lets you click pins to start and finish a wire.
 * It also checks if the connection is allowed (valid).
 */

import { getOrthogonalPath, createWireElement } from '../wires/Wire.js';
import { LEFT_PINS, RIGHT_PINS } from '../components/Pico.js';
import { addWire, removeWire, validateWire, syncWires } from '../sim/connection_graph.js';
import { printError } from '../sim/serial_bridge.js';

import { validateNewWire } from '../sim/circuit_validator.js';

export class WireInteractionManager {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.wireStartNode = null;
        this.tempWireInfo = null;
        this.selectedWireId = null;
    }

    handlePortClick(portInfo, element) {
        if (this.wireStartNode) {
            // Finishing Wire

            // Check for Self-Connection / Same Node
            if (this.isSameNode(this.wireStartNode, portInfo)) {
                this.cancelWire();
                return;
            }

            // Validation Check
            if (this.isValidConnection(this.wireStartNode, portInfo)) {
                this.finishWire(portInfo);
            } else {
                printError('Invalid connection: Electrical theory violation (check polarity).');
                this.cancelWire();
                return;
            }
        } else {
            // Starting Wire
            this.startWire(portInfo);
        }
    }

    isSameNode(n1, n2) {
        if (n1.nodeType !== n2.nodeType) return false;
        if (n1.nodeType === 'component_pin') return n1.componentId === n2.componentId && n1.pin === n2.pin;
        if (n1.nodeType === 'gpio') return n1.pin === n2.pin;
        return false;
    }

    isValidConnection(start, end) {
        const getPinType = (node) => {
            if (node.nodeType === 'gpio') {
                const allPins = [...LEFT_PINS, ...RIGHT_PINS];
                const pinDef = allPins.find(p => p.pin === node.pin);
                if (pinDef) return pinDef.type;
                return 'GPIO';
            }
            if (node.nodeType === 'component_pin') {
                const comp = this.canvasManager.components.find(c => c.id === node.componentId);
                // comp might be undefined if deleted mid-wire?
                if (!comp) return 'Unknown';

                if (comp.id.startsWith('led_')) {
                    if (node.pin === 'A') return 'Anode';
                    if (node.pin === 'C') return 'Cathode';
                }
                if (comp.id.startsWith('res_')) return 'Passive';
                // Push button pins are passive - can connect to anything
                if (comp.id.startsWith('btn_')) return 'Passive';
            }
            return 'Unknown';
        };

        const type1 = getPinType(start);
        const type2 = getPinType(end);

        // Explicitly allow Passive connections (Resistors to Anything)
        if (type1 === 'Passive' || type2 === 'Passive') return true;

        if ((type1 === 'Anode' && type2 === 'Ground') || (type2 === 'Anode' && type1 === 'Ground')) return false;
        if ((type1 === 'Cathode' && type2 === 'Power') || (type2 === 'Cathode' && type1 === 'Power')) return false;
        return true;
    }

    startWire(portInfo) {
        this.wireStartNode = portInfo;

        // Create Temp Path
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("stroke", "#22c55e"); // Green Wire
        path.setAttribute("stroke-width", "4");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        path.setAttribute("d", `M ${portInfo.x} ${portInfo.y}`);

        this.canvasManager.wireLayer.appendChild(path);
        this.tempWireInfo = { pathElement: path };
    }

    updateTempWire(e) {
        if (!this.wireStartNode || !this.tempWireInfo) return;

        // Step 20: Performance Optimization - Prevent DOM thrashing during mouse move
        if (this._updatePending) return;
        this._updatePending = true;

        requestAnimationFrame(() => {
            const coords = this.canvasManager.getLocalCoords(e.clientX, e.clientY);
            const pathD = getOrthogonalPath(this.wireStartNode.x, this.wireStartNode.y, coords.x, coords.y);
            this.tempWireInfo.pathElement.setAttribute("d", pathD);
            this._updatePending = false;
        });
    }

    cancelWire() {
        if (this.tempWireInfo && this.tempWireInfo.pathElement) {
            this.tempWireInfo.pathElement.remove();
        }
        this.wireStartNode = null;
        this.tempWireInfo = null;
    }

    finishWire(endPort) {
        if (!this.wireStartNode) return;

        // Step 19 logic — completely prevent duplicate wires
        const newWire = { start: this.wireStartNode, end: endPort };
        if (!validateNewWire(newWire, this.canvasManager.wires)) {
            this.cancelWire();
            return;
        }

        // Validate connection (Step 14 — connection graph rules)
        const validation = validateWire(this.wireStartNode, endPort);
        if (!validation.valid) {
            printError(validation.reason);
            this.cancelWire();
            return;
        }

        // Create the permanent wire
        this.createWire(this.wireStartNode, endPort);

        // Cleanup Temp
        if (this.tempWireInfo && this.tempWireInfo.pathElement) this.tempWireInfo.pathElement.remove();

        this.wireStartNode = null;
        this.tempWireInfo = null;

        // Notify changes? 
        // Logic from main.js called updateCircuit() and updateDiagramEditor()
        if (this.canvasManager.onCircuitChange) this.canvasManager.onCircuitChange();
    }

    createWire(start, end) {
        const id = 'wire_' + Date.now();

        // Data Object
        const wire = {
            id: id,
            start: start,
            end: end,
            color: '#15803d',
            flipped: false,
            pathElement: null // Will be set by helper
        };

        // Visual Element (using helper from Wire.js)
        const path = createWireElement(wire, this.canvasManager.wireLayer);

        // Add Listeners
        const getPortCoords = this.canvasManager.getPortCoords.bind(this.canvasManager);
        const startCoords = getPortCoords(start) || start;
        const endCoords = getPortCoords(end) || end;
        path.setAttribute("d", getOrthogonalPath(startCoords.x, startCoords.y, endCoords.x, endCoords.y, wire.flipped));

        path.onclick = (e) => {
            e.stopPropagation();
            this.selectWire(wire);
        };

        path.onmouseenter = () => {
            if (this.selectedWireId !== id) path.setAttribute("stroke-width", "14");
        };
        path.onmouseleave = () => {
            if (this.selectedWireId !== id) path.setAttribute("stroke-width", "10");
        };

        this.canvasManager.wires.push(wire);

        // Register with connection graph (Step 14)
        addWire(wire);

        // Keep connection graph in sync
        syncWires(this.canvasManager.wires);

        return wire;
    }

    selectWire(wire) {
        this.selectedWireId = wire.id;

        // Delegate UI updates to CanvasManager? 
        // Or handle wire-specific selection logic here.
        // main.js logic for selection was mixed.
        // We'll update the visuals here.
        this.canvasManager.wires.forEach(w => {
            if (w.id === wire.id) {
                w.pathElement.setAttribute("stroke-width", "14");
                w.pathElement.setAttribute("filter", "drop-shadow(0 0 5px rgba(255,255,255,0.5))");
            } else {
                w.pathElement.setAttribute("stroke-width", "10");
                w.pathElement.setAttribute("filter", "");
            }
        });

        // Deselect components
        this.canvasManager.selectComponent(null);

        // Show Popup (delegated to CanvasManager because it owns the popup UI)
        this.canvasManager.showWirePopup(wire);
    }

    deleteWire(id) {
        const wire = this.canvasManager.wires.find(w => w.id === id);
        if (!wire) return;

        wire.pathElement.remove();
        this.canvasManager.wires = this.canvasManager.wires.filter(w => w.id !== id);

        // Remove from connection graph and trigger cleanup callback (Step 14)
        removeWire(id);
        syncWires(this.canvasManager.wires);

        if (this.selectedWireId === id) {
            this.selectedWireId = null;
            this.canvasManager.hidePopup();
        }

        if (this.canvasManager.onCircuitChange) this.canvasManager.onCircuitChange();
    }

    updateWires() {
        // Redraw all wires based on current component positions
        this.canvasManager.wires.forEach(w => {
            const start = this.canvasManager.getPortCoords(w.start);
            const end = this.canvasManager.getPortCoords(w.end);
            if (start && end) {
                w.pathElement.setAttribute("d", getOrthogonalPath(start.x, start.y, end.x, end.y, w.flipped));
            }
        });
    }
}
