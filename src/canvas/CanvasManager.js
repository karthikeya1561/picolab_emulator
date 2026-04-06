/**
 * This file controls the main drawing area (canvas).
 * It manages the components, wires, and zooming.
 *
 * It does NOT handle the simulation logic.
 */

import { WireInteractionManager } from './WireInteractionManager.js';
import { LEFT_PINS, RIGHT_PINS } from '../components/Pico.js';
import { createLED, updateVisualLED } from '../components/LED.js';
import { createResistor, updateVisualResistor } from '../components/Resistor.js';
import { createPushButton, setPushButtonPressed } from '../components/PushButton.js';
import { ledColorMap, digitColors, multiplierColors } from '../utils/Helpers.js';

export class CanvasManager {
    constructor(containerElement, simulationAreaElement) {
        this.container = containerElement;
        this.simulationArea = simulationAreaElement;

        // State
        this.components = [];
        this.wires = [];
        this.wireManager = new WireInteractionManager(this);

        // Transform State
        this.scale = 0.3;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;

        // UI References (set later)
        this.wireLayer = null;
        this.componentPopup = null;
        this.tooltip = null;

        // Callbacks
        this.onCircuitChange = null;
        // Callback for button press events (connected by SimulatorBridge)
        this.onButtonPress = null;

        this.gpToElementMap = {};
    }

    init() {
        this.setupWireLayer();
        this.setupTooltip();
        this.setupEventListeners();
    }

    setupWireLayer() {
        if (!this.container) return;
        this.wireLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.wireLayer.id = "wire-layer";
        Object.assign(this.wireLayer.style, {
            position: "absolute", top: "0", left: "0", width: "100%", height: "100%",
            overflow: "visible", zIndex: "10", pointerEvents: "none"
        });
        this.container.appendChild(this.wireLayer);
    }

    setupTooltip() {
        // Shared component tooltip
        this.tooltip = document.getElementById("component-tooltip");
        if (!this.tooltip) {
            this.tooltip = document.createElement("div");
            this.tooltip.id = "component-tooltip";
            this.tooltip.className = "fixed pointer-events-none hidden z-50 shadow-lg rounded";
            Object.assign(this.tooltip.style, {
                backgroundColor: "white",
                border: "2px solid #166534",
                color: "#000000",
                fontSize: "24px",
                padding: "8px 12px",
                fontFamily: "monospace"
            });
            document.body.appendChild(this.tooltip);
        }
    }

    async loadBoardSVG() {
        try {
            const response = await fetch('./Raspberrypi.html');
            let text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "text/html");
            const svg = doc.querySelector("svg");

            if (svg) {
                svg.setAttribute("width", "100%");
                svg.setAttribute("height", "100%");
                svg.style.overflow = "visible";

                if (this.container) {
                    this.container.style.width = "400px";
                    this.container.innerHTML = "";
                    if (this.wireLayer) this.container.appendChild(this.wireLayer);
                    this.container.appendChild(svg);
                    this.setupPins(svg);
                }
            }
        } catch (err) {
            console.error("Failed to load SVG", err);
        }
    }

    // --------------------------------------------------
    // Pin Setup
    // We fix issues where some pins were hard to click.
    // --------------------------------------------------
    setupPins(svg) {
        // Fix overlay blocking events
        svg.querySelectorAll("circle, path").forEach(el => {
            const fill = el.getAttribute("fill");
            if (["#333333", "#363732", "#3B3D37", "#2A2D2E", "#DBDDDA", "#363A44"].includes(fill) || fill === "#006837") {
                el.style.pointerEvents = "none";
            }
        });

        const paths = Array.from(svg.querySelectorAll("path, rect"));
        const getFill = (el) => el.getAttribute("fill") || el.style.fill;
        const candidates = [];

        paths.forEach(el => {
            const fill = getFill(el);
            if (fill !== "#958863") return;

            const bbox = el.getBBox();
            const ctm = el.getCTM();
            let cx, cy;
            if (ctm) {
                const localCx = bbox.x + bbox.width / 2;
                const localCy = bbox.y + bbox.height / 2;
                cx = ctm.a * localCx + ctm.c * localCy + ctm.e;
                cy = ctm.b * localCx + ctm.d * localCy + ctm.f;
            } else {
                cx = bbox.x + bbox.width / 2;
                cy = bbox.y + bbox.height / 2;
            }

            candidates.push({ el, cx, cy });
        });

        const leftCandidates = candidates.filter(c => c.cx < 70);
        const rightCandidates = candidates.filter(c => c.cx >= 70);

        const createClusters = (list) => {
            list.sort((a, b) => a.cy - b.cy);
            const clusters = [];
            if (list.length === 0) return clusters;
            const Y_TOLERANCE = 8;
            let currentCluster = [list[0]];
            for (let i = 1; i < list.length; i++) {
                if (Math.abs(list[i].cy - currentCluster[0].cy) < Y_TOLERANCE) {
                    currentCluster.push(list[i]);
                } else {
                    clusters.push(currentCluster);
                    currentCluster = [list[i]];
                }
            }
            clusters.push(currentCluster);
            return clusters;
        };

        const leftClusters = createClusters(leftCandidates);
        const rightClusters = createClusters(rightCandidates);

        // Tooltip for Pins
        let pinTooltip = document.getElementById("pin-tooltip");
        if (!pinTooltip) {
            pinTooltip = document.createElement("div");
            pinTooltip.id = "pin-tooltip";
            pinTooltip.className = "fixed pointer-events-none z-[100] hidden";
            pinTooltip.style.cssText = `
                font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
                font-size: 12px;
                background: rgba(30, 31, 41, 0.95);
                color: #f8f8f2;
                padding: 6px 10px;
                border-radius: 6px;
                border: 1px solid rgba(98, 114, 164, 0.4);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            `;
            document.body.appendChild(pinTooltip);
        }

        const bindPinToCluster = (cluster, pinInfo) => {
            if (!pinInfo) return;
            if (pinInfo.label.startsWith("GP")) {
                const gpNum = pinInfo.label.replace("GP", "");
                this.gpToElementMap[gpNum] = cluster[0].el;
            }

            cluster.forEach(item => {
                const element = item.el;
                element.style.pointerEvents = "all";
                element.style.cursor = "crosshair";
                element.setAttribute('data-is-port', 'true');
                element.setAttribute('data-pin-label', pinInfo.label);
                element.classList.add("hover:opacity-80", "transition-opacity");

                element.addEventListener("mouseenter", () => {
                    cluster.forEach(c => {
                        if (!c.el.getAttribute("data-orig-fill")) {
                            c.el.setAttribute("data-orig-fill", c.el.getAttribute("fill") || c.el.style.fill);
                        }
                        c.el.style.fill = "#34d399";
                    });
                    pinTooltip.innerHTML = `<span class="font-bold text-green-400">Pin ${pinInfo.pin}</span>: ${pinInfo.label} <span class="text-gray-400">(${pinInfo.type})</span>`;
                    pinTooltip.classList.remove("hidden");
                    const rect = element.getBoundingClientRect();
                    pinTooltip.style.left = `${rect.right + 10}px`;
                    pinTooltip.style.top = `${rect.top}px`;
                });

                element.addEventListener("mouseleave", () => {
                    cluster.forEach(c => {
                        const orig = c.el.getAttribute("data-orig-fill") || "#958863";
                        c.el.style.fill = orig;
                    });
                    pinTooltip.classList.add("hidden");
                });

                element.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const rect = element.getBoundingClientRect();
                    const center = this.getLocalCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);

                    this.wireManager.handlePortClick({
                        nodeType: 'gpio',
                        pin: pinInfo.pin,
                        gpNum: pinInfo.label.startsWith("GP") ? pinInfo.label.replace("GP", "") : null,
                        x: center.x,
                        y: center.y
                    }, element);
                });
            });
        };

        // Bind Left
        leftClusters.forEach((cluster, i) => {
            if (i < LEFT_PINS.length) bindPinToCluster(cluster, LEFT_PINS[i]);
        });

        // Bind Right (with orphan logic)
        if (rightClusters.length > RIGHT_PINS.length) {
            const leftYs = leftClusters.map(c => c[0].cy);
            let pinIndex = 0;
            rightClusters.forEach((cluster, i) => {
                const clusterY = cluster[0].cy;
                const hasLeftMatch = leftYs.some(leftY => Math.abs(leftY - clusterY) < 10);
                if (hasLeftMatch && pinIndex < RIGHT_PINS.length) {
                    bindPinToCluster(cluster, RIGHT_PINS[pinIndex]);
                    pinIndex++;
                }
            });
        } else {
            rightClusters.forEach((cluster, i) => {
                if (i < RIGHT_PINS.length) bindPinToCluster(cluster, RIGHT_PINS[i]);
            });
        }
    }

    // --------------------------------------------------
    // Interaction Helpers
    // --------------------------------------------------

    getLocalCoords(clientX, clientY) {
        if (!this.container) return { x: 0, y: 0 };
        const rect = this.container.getBoundingClientRect();
        return {
            x: (clientX - rect.left) / this.scale,
            y: (clientY - rect.top) / this.scale
        };
    }

    getPortCoords(port) {
        if (port.nodeType === 'gpio') {
            return { x: port.x, y: port.y };
        } else if (port.nodeType === 'component_pin') {
            const comp = this.components.find(c => c.id === port.componentId);
            if (comp) {
                let px = 0, py = 0;
                if (comp.id.startsWith('led_')) {
                    if (port.pin === 'A') { px = 80; py = 155; }
                    else { px = 35; py = 150; }
                } else if (comp.id.startsWith('res_')) {
                    if (port.pin === '1') { px = 0; py = 20; }
                    else if (port.pin === '2') { px = 220; py = 20; }
                } else if (comp.id.startsWith('btn_')) {
                    // Push button pin positions (for 200x130 SVG container)
                    // viewBox="1010 1110 130 80" → scale X=200/130=1.538, Y=130/80=1.625
                    // Anchors at the exact metal pin tips for clean visual connection
                    // Pin 1: tip at viewBox(7, 31) → rendered(11, 50)
                    // Pin 2: tip at viewBox(127, 31) → rendered(195, 50)
                    // Pin 3: tip at viewBox(7, 66) → rendered(11, 107)
                    // Pin 4: tip at viewBox(127, 66) → rendered(195, 107)
                    if (port.pin === '1') { px = 11; py = 50; }
                    else if (port.pin === '2') { px = 195; py = 50; }
                    else if (port.pin === '3') { px = 11; py = 107; }
                    else if (port.pin === '4') { px = 195; py = 107; }
                }
                return { x: comp.x + px, y: comp.y + py };
            }
        }
        return null;
    }

    // --------------------------------------------------
    // Event Listeners (Global/Canvas)
    // --------------------------------------------------
    setupEventListeners() {
        if (!this.simulationArea || !this.container) return;

        this.simulationArea.addEventListener("wheel", (e) => {
            e.preventDefault();
            const zoomSensitivity = 0.001;
            const newScale = Math.min(Math.max(0.1, this.scale - e.deltaY * zoomSensitivity), 5);
            if (newScale !== this.scale) {
                this.scale = newScale;
                this.updateTransform();
            }
        });

        this.simulationArea.addEventListener("mousedown", (e) => {
            if (e.target.closest('.dynamic-led') || e.target.closest('.absolute.cursor-move') || e.target.closest('#component-popup') || e.target.getAttribute('data-is-port')) return;

            if (this.wireManager.wireStartNode) {
                this.wireManager.cancelWire();
                return;
            }

            this.selectComponent(null);
            this.isDragging = true;
            this.startX = e.clientX - this.panX;
            this.startY = e.clientY - this.panY;
            this.simulationArea.classList.add("cursor-grabbing");
        });

        this.simulationArea.addEventListener("mousemove", (e) => {
            if (this.wireManager.wireStartNode) {
                this.wireManager.updateTempWire(e);
            }

            if (!this.isDragging) return;
            e.preventDefault();
            this.panX = e.clientX - this.startX;
            this.panY = e.clientY - this.startY;
            this.updateTransform();
        });

        ['mouseup', 'mouseleave'].forEach(evt => {
            this.simulationArea.addEventListener(evt, () => {
                this.isDragging = false;
                this.simulationArea.classList.remove("cursor-grabbing");
            });
        });

        this.simulationArea.addEventListener("contextmenu", (e) => {
            if (this.wireManager.wireStartNode) {
                e.preventDefault();
                this.wireManager.cancelWire();
            }
        });

        // Key listeners can be added via app.js to window, calling methods here
    }

    updateTransform() {
        if (this.container) this.container.style.transform = `translate(-50%, -50%) translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
        if (document.getElementById("zoom-level-lbl")) document.getElementById("zoom-level-lbl").innerText = Math.round(this.scale * 100) + "%";
        this.updatePopupPosition();
    }

    zoomIn() {
        const newScale = Math.min(5, this.scale + 0.1);
        if (newScale !== this.scale) {
            this.scale = newScale;
            this.updateTransform();
        }
    }

    zoomOut() {
        const newScale = Math.max(0.1, this.scale - 0.1);
        if (newScale !== this.scale) {
            this.scale = newScale;
            this.updateTransform();
        }
    }

    // --------------------------------------------------
    // Component Management
    // --------------------------------------------------

    addLED() {
        // Logic from createLEDComponent
        const ledCount = this.components.filter(c => c.id.startsWith('led_')).length + 1;
        const id = 'led_' + Date.now();
        // createLED returns the DIV
        const div = createLED(id, 100, 300, ledCount, this);

        const component = { id, div, x: 100, y: 300, value: 0, unit: 0, rotation: 0, color: '#ef4444', flipped: false };
        this.addComponent(component);
    }

    addResistor() {
        const id = 'res_' + Date.now();
        const div = createResistor(id, 50, 300, this);
        const component = { id, div, x: 50, y: 300, value: 1, unit: 1000, rotation: 0 };
        this.addComponent(component);
    }

    /**
     * Adds a new push button to the canvas.
     * Button has 4 pins and tracks pressed state.
     */
    addPushButton() {
        const buttonCount = this.components.filter(c => c.id.startsWith('btn_')).length + 1;
        const id = 'btn_' + Date.now();
        const div = createPushButton(id, 100, 300, buttonCount, this);
        const component = {
            id,
            div,
            x: 100,
            y: 300,
            rotation: 0,
            isPressed: false  // Track button state
        };
        this.addComponent(component);
    }

    addComponent(component) {
        if (this.container) {
            this.container.appendChild(component.div);
            this.components.push(component);
            this.selectComponent(component.id);
            if (this.onCircuitChange) this.onCircuitChange();
        }
    }

    startComponentDrag(e, div) {
        if (e.button !== 0) return;
        e.preventDefault();
        let startMouseX = e.clientX;
        let startMouseY = e.clientY;

        const component = this.components.find(c => c.id === div.id);
        if (!component) return;

        let initialX = component.x;
        let initialY = component.y;

        const onMouseMove = (ev) => {
            if (this.wireManager.wireStartNode) return;

            ev.preventDefault();
            const dx = ev.clientX - startMouseX;
            const dy = ev.clientY - startMouseY;
            component.x = initialX + (dx / this.scale);
            component.y = initialY + (dy / this.scale);
            div.style.left = `${component.x}px`;
            div.style.top = `${component.y}px`;

            this.updatePopupPosition();
            this.wireManager.updateWires();
            if (this.onCircuitChange) this.onCircuitChange();
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    selectComponent(id) {
        this.selectedComponentId = id;
        // Logic to highlight component and un-highlight others
        // Also handling wire selection deselection
        if (id) {
            // If component selected, deselect wire
            this.wireManager.selectedWireId = null;
        }

        this.components.forEach(c => {
            const svg = c.div.querySelector('svg');
            if (c.id === id) {
                svg.classList.add("ring-2", "ring-primary", "ring-offset-2", "ring-offset-transparent", "rounded-lg", "transition-shadow");
            } else {
                svg.classList.remove("ring-2", "ring-primary", "ring-offset-2", "ring-offset-transparent", "rounded-lg", "transition-shadow");
            }
        });

        // Reset Wires
        this.wires.forEach(w => {
            w.pathElement.setAttribute("stroke-width", "10");
            w.pathElement.setAttribute("opacity", "1");
            w.pathElement.setAttribute("filter", "");
        });

        if (id) {
            const comp = this.components.find(c => c.id === id);
            this.showComponentPopup(comp);
        } else {
            this.hidePopup();
        }
    }

    // --------------------------------------------------
    // Delegates for Interaction Managers
    // --------------------------------------------------
    handlePortClick(id, pin, type, rect, element) {
        // Proxy to WireManager
        // Need to construct portInfo expected by WireManager
        // { nodeType, componentId, pin, x, y }
        const rectCenter = this.getLocalCoords(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const portInfo = {
            nodeType: type,
            componentId: id,
            pin: pin,
            x: rectCenter.x,
            y: rectCenter.y
        };
        this.wireManager.handlePortClick(portInfo, element);
    }

    showTooltip(text, x, y, borderColor, color) {
        if (!this.tooltip) return;
        this.tooltip.innerHTML = text;
        this.tooltip.classList.remove("hidden");
        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${y}px`;
        if (borderColor) this.tooltip.style.borderColor = borderColor;
        if (color) this.tooltip.style.color = color;
    }

    hideTooltip() {
        if (this.tooltip) this.tooltip.classList.add("hidden");
        // Reset styles default
        if (this.tooltip) {
            this.tooltip.style.borderColor = "#166534";
            this.tooltip.style.color = "#000000";
        }
    }

    // --------------------------------------------------
    // UI Popup Logic (Moved from main.js)
    // --------------------------------------------------
    showComponentPopup(comp) {
        this.componentPopup = document.getElementById("component-popup");
        if (!this.componentPopup) return;

        // Hide/Show correct controls
        const resistorControls = document.getElementById("resistor-controls");
        const ledControls = document.getElementById("led-controls");
        const popupFlip = document.getElementById("popup-flip");
        const popupValue = document.getElementById("popup-value");
        const popupUnit = document.getElementById("popup-unit");

        if (comp.id.startsWith('res_')) {
            if (resistorControls) resistorControls.classList.remove('hidden');
            if (ledControls) ledControls.classList.add('hidden');
            if (popupFlip) popupFlip.classList.add('hidden');
            if (popupValue) popupValue.value = comp.value;
            if (popupUnit) popupUnit.value = comp.unit;
        } else if (comp.id.startsWith('led_')) {
            if (resistorControls) resistorControls.classList.add('hidden');
            if (ledControls) ledControls.classList.remove('hidden');
            if (popupFlip) popupFlip.classList.remove('hidden');
        } else if (comp.id.startsWith('btn_')) {
            // Push button: hide all special controls (just delete/rotate)
            if (resistorControls) resistorControls.classList.add('hidden');
            if (ledControls) ledControls.classList.add('hidden');
            if (popupFlip) popupFlip.classList.add('hidden');
        }

        this.componentPopup.classList.remove("hidden");
        this.componentPopup.classList.add("flex");
        this.updatePopupPosition();
    }

    showWirePopup(wire) {
        this.componentPopup = document.getElementById("component-popup");
        if (!this.componentPopup) return;

        const resistorControls = document.getElementById("resistor-controls");
        const ledControls = document.getElementById("led-controls");
        const popupFlip = document.getElementById("popup-flip");

        if (resistorControls) resistorControls.classList.add('hidden');
        if (ledControls) ledControls.classList.remove('hidden'); // For color
        if (popupFlip) popupFlip.classList.add('hidden');

        this.componentPopup.classList.remove("hidden");
        this.componentPopup.classList.add("flex");
        // Wire popup positioning is tricky without comp reference, handled in updatePopupPosition logic or special case override

        // Position at wire center
        const pathRect = wire.pathElement.getBoundingClientRect();
        const containerRect = this.simulationArea.getBoundingClientRect();
        const left = pathRect.left - containerRect.left + (pathRect.width / 2);
        const top = pathRect.top - containerRect.top + (pathRect.height / 2);

        // We override position here because updatePopupPosition relies on selectedComponentId
        this.componentPopup.style.left = `${left - 96}px`; // 96 = half popup width approx
        this.componentPopup.style.top = `${top - 120}px`;
    }

    hidePopup() {
        if (this.componentPopup) {
            this.componentPopup.classList.add("hidden");
            this.componentPopup.classList.remove("flex");
        }
    }

    updatePopupPosition() {
        if (!this.selectedComponentId || !this.componentPopup) return;
        const comp = this.components.find(c => c.id === this.selectedComponentId);
        if (!comp) return;

        const rect = comp.div.getBoundingClientRect();
        const parentRect = this.simulationArea.getBoundingClientRect();

        const popupWidth = 192;
        const popupHeight = 100;

        const left = rect.left - parentRect.left + (rect.width / 2) - (popupWidth / 2);
        const top = rect.top - parentRect.top - popupHeight - 20;

        this.componentPopup.style.left = `${left}px`;
        this.componentPopup.style.top = `${top}px`;
    }

    // Component Updates from UI
    updateSelectedComponentValue(val, unit) {
        if (!this.selectedComponentId) return;
        const comp = this.components.find(c => c.id === this.selectedComponentId);
        if (comp && comp.id.startsWith('res_')) {
            comp.value = parseFloat(val) || 0;
            comp.unit = parseInt(unit) || 1;
            updateVisualResistor(comp);
            if (this.onCircuitChange) this.onCircuitChange();
        }
    }

    updateSelectedComponentColor(color) {
        if (this.selectedComponentId) {
            const comp = this.components.find(c => c.id === this.selectedComponentId);
            if (comp && comp.id.startsWith('led_')) {
                comp.color = color;
                updateVisualLED(comp);
            }
        } else if (this.wireManager.selectedWireId) {
            const wire = this.wires.find(w => w.id === this.wireManager.selectedWireId);
            if (wire) {
                wire.color = color;
                wire.pathElement.setAttribute("stroke", color);
            }
        }
        if (this.onCircuitChange) this.onCircuitChange();
    }

    rotateSelectedComponent() {
        if (!this.selectedComponentId) return;
        const comp = this.components.find(c => c.id === this.selectedComponentId);
        if (comp) {
            comp.rotation = (comp.rotation + 90) % 360;
            this.applyTransform(comp);
            this.wireManager.updateWires();
            if (this.onCircuitChange) this.onCircuitChange();
        }
    }

    flipSelectedComponent() {
        // Logic for flip
        if (this.selectedComponentId) {
            const comp = this.components.find(c => c.id === this.selectedComponentId);
            if (comp && comp.id.startsWith('led_')) {
                comp.flipped = !comp.flipped;
                this.applyTransform(comp);
                this.wireManager.updateWires();
                if (this.onCircuitChange) this.onCircuitChange();
            }
        }
    }

    deleteSelected() {
        if (this.selectedComponentId) {
            const compIdx = this.components.findIndex(c => c.id === this.selectedComponentId);
            if (compIdx > -1) {
                const comp = this.components[compIdx];
                comp.div.remove();
                this.components.splice(compIdx, 1);

                // Remove connected wires
                this.wires = this.wires.filter(w => {
                    if (w.start.componentId === comp.id || w.end.componentId === comp.id) {
                        w.pathElement.remove();
                        return false;
                    }
                    return true;
                });

                this.selectComponent(null);
                if (this.onCircuitChange) this.onCircuitChange();
            }
        } else if (this.wireManager.selectedWireId) {
            this.wireManager.deleteWire(this.wireManager.selectedWireId);
        }
    }

    applyTransform(comp) {
        const scaleX = comp.flipped ? -1 : 1;
        comp.div.style.transform = `rotate(${comp.rotation}deg) scaleX(${scaleX})`;
    }

    // --------------------------------------------------
    // Project Restore (Step 13: Save & Share)
    // --------------------------------------------------

    /**
     * Removes all components and wires from the canvas.
     * Used before restoring a saved project.
     */
    clearAll() {
        // Remove all wires
        this.wires.forEach(w => {
            if (w.pathElement) w.pathElement.remove();
        });
        this.wires = [];

        // Remove all components
        this.components.forEach(c => {
            if (c.div) c.div.remove();
        });
        this.components = [];

        this.wireManager.selectedWireId = null;
        this.selectedComponentId = null;
        this.hidePopup();
    }

    /**
     * Recreates a component from serialized project data.
     * 
     * @param {object} data — serialized component { id, type, x, y, rotation, color, value, unit, flipped }
     */
    restoreComponent(data) {
        let div;
        const component = {
            id: data.id,
            x: data.x,
            y: data.y,
            rotation: data.rotation || 0
        };

        if (data.type === 'led') {
            const ledCount = this.components.filter(c => c.id.startsWith('led_')).length + 1;
            div = createLED(data.id, data.x, data.y, ledCount, this);
            component.div = div;
            component.color = data.color || '#ef4444';
            component.flipped = data.flipped || false;
            component.value = 0;
            component.unit = 0;
        } else if (data.type === 'resistor') {
            div = createResistor(data.id, data.x, data.y, this);
            component.div = div;
            component.value = data.value || 1;
            component.unit = data.unit || 1000;
        } else if (data.type === 'button') {
            const btnCount = this.components.filter(c => c.id.startsWith('btn_')).length + 1;
            div = createPushButton(data.id, data.x, data.y, btnCount, this);
            component.div = div;
            component.isPressed = false;
        } else {
            console.warn('[CanvasManager] Unknown component type:', data.type);
            return;
        }

        if (this.container) {
            this.container.appendChild(div);
            this.components.push(component);

            // Apply saved transforms
            if (data.rotation || data.flipped) {
                this.applyTransform(component);
            }

            // Update visuals for resistor values
            if (data.type === 'resistor') {
                updateVisualResistor(component);
            }
            if (data.type === 'led' && data.color) {
                updateVisualLED(component);
            }
        }
    }

    /**
     * Recreates a wire from serialized project data.
     * 
     * @param {object} wireData — { start: {nodeType, pin, ...}, end: {nodeType, pin, ...}, color }
     */
    restoreWire(wireData) {
        const wire = this.wireManager.createWire(wireData.start, wireData.end);
        if (wire && wireData.color) {
            wire.color = wireData.color;
            wire.pathElement.setAttribute('stroke', wireData.color);
        }
    }
}
