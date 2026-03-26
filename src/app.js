/**
 * This is the main file for the application.
 * It sets up the editor, buttons, and the circuit board.
 * It connects the visual parts to the simulation logic.
 */

import { CanvasManager } from './canvas/CanvasManager.js';
import { SimulatorBridge, isCCode } from './simulation/SimulatorBridge.js';
import { LEFT_PINS, RIGHT_PINS } from './components/Pico.js';
import { createProject, save, load, shareProject, loadFromURL, setupAutoSave } from './sim/project_store.js';
import { pauseExecution, resumeExecution, stepExecution, setDebuggerUICallback, toggleBreakpoint, getBreakpoints, setOnStateChange } from './sim/debugger.js';
import { init as initInspector, show as showInspector, hide as hideInspector, toggle as toggleInspector, scheduleUpdate as updateInspector, forceUpdate as forceInspectorUpdate } from './sim/state_inspector.js';
import { init as initPerfMonitor, startTracking as startPerfTracking, stopTracking as stopPerfTracking, togglePanel as togglePerfPanel } from './sim/performance_monitor.js';
import { handleSaveCode, handleShareProject } from './ui/project_actions.js';

// Global Instances
let canvasManager;
let simulatorBridge;
let editor;
let autoSaveTrigger = null;

// Settings
let currentTab = 'main';
let pythonCode = `from machine import Pin
import time

# Button on GP0 (Pin 1), connected to GND (Pin 3)
btn = Pin(0, Pin.IN, Pin.PULL_UP)

while True:
    val = btn.value()
    print(val)
    time.sleep(0.1)`;

function initApp() {
    console.log("Initializing CircuitFlow Refactored...");

    // UI Elements
    const boardContainer = document.getElementById("board-container");
    const simulationArea = document.getElementById("simulation-area");
    const outputElement = document.getElementById("output");

    // Initialize Managers
    canvasManager = new CanvasManager(boardContainer, simulationArea);
    canvasManager.init();

    simulatorBridge = new SimulatorBridge(canvasManager, outputElement);

    // Initialize state inspector (Step 17)
    const inspectorPanel = document.getElementById('state-inspector-panel');
    initInspector(inspectorPanel, canvasManager);

    // Wire state inspector to debugger state changes
    setOnStateChange((event) => {
        if (event === 'paused' || event === 'step') {
            forceInspectorUpdate();
        } else if (event === 'reset') {
            hideInspector();
        }
    });

    // Initialize performance monitor (Step 18)
    const perfPanel = document.getElementById('perf-panel');
    initPerfMonitor(perfPanel);

    // Connect button press callback to SimulatorBridge
    // This allows button presses to update GPIO inputs
    simulatorBridge.setupButtonCallback();

    // Link Circuit Change to Simulator Update
    canvasManager.onCircuitChange = () => {
        simulatorBridge.updateCircuit();
        updateDiagramEditor();
        // Auto-save on circuit change (components/wires changed)
        if (autoSaveTrigger) autoSaveTrigger();
    };

    setupEditor();
    setupUI();

    // Load Board, then restore project from URL or session
    canvasManager.loadBoardSVG().then(() => {
        canvasManager.updateTransform();
        // URL share link takes priority, then sessionStorage (survives refresh only)
        const urlProject = loadFromURL();
        const savedProject = urlProject || load();
        if (savedProject) {
            restoreProject(savedProject);
        }
    });

    // Setup auto-save (debounced)
    autoSaveTrigger = setupAutoSave(() => getProject());

    // Expose share function on window for testing
    window.__shareProject = () => {
        const project = getProject();
        const url = shareProject(project);
        console.log('[Share] URL:', url);
        return url;
    };
}

function setupEditor() {
    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
    require(['vs/editor/editor.main'], function () {
        if (document.getElementById('editor-container')) {
            editor = monaco.editor.create(document.getElementById('editor-container'), {
                value: pythonCode,
                language: 'python',
                theme: 'vs-dark',
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 14,
                padding: { top: 16 },
                glyphMargin: true // Essential for breakpoints
            });

            // Store decorations for breakpoints
            const breakpointDecorations = editor.createDecorationsCollection([]);

            // Handle clicking in the margin to set breakpoints
            editor.onMouseDown((e) => {
                if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
                    const line = e.target.position.lineNumber;
                    
                    // toggle in debugger logic
                    const isAdded = toggleBreakpoint(line);
                    
                    // update visual dots
                    const currentDecorations = breakpointDecorations.getRanges().map(r => r.startLineNumber);
                    if (isAdded) {
                        currentDecorations.push(line);
                    } else {
                        const idx = currentDecorations.indexOf(line);
                        if (idx > -1) currentDecorations.splice(idx, 1);
                    }
                    
                    // refresh decorations array
                    const newDecs = currentDecorations.map(ln => ({
                        range: new monaco.Range(ln, 1, ln, 1),
                        options: {
                            isWholeLine: false,
                            glyphMarginClassName: 'breakpoint-glyph'
                        }
                    }));
                    breakpointDecorations.set(newDecs);
                }
            });

            // Auto-save on code change
            editor.onDidChangeModelContent(() => {
                if (autoSaveTrigger) autoSaveTrigger();
            });
        }
    });
}

function setupUI() {
    // Buttons
    const runBtn = document.getElementById("run-btn");
    const stopBtn = document.getElementById("stop-btn");

    if (runBtn) {
        runBtn.onclick = () => {
            // UI State
            runBtn.disabled = true;
            runBtn.classList.add("opacity-50", "cursor-not-allowed");
            if (stopBtn) {
                stopBtn.disabled = false;
                stopBtn.classList.remove("opacity-50", "cursor-not-allowed");
            }
            document.getElementById("console-panel").classList.remove("hidden");

            // Run — auto-detect language (C vs Python)
            const code = editor ? editor.getValue() : "";
            if (isCCode(code)) {
                simulatorBridge.runC(code);
            } else {
                simulatorBridge.run(code);
            }

            // Show inspector toggle button when simulation starts
            const inspectorToggle = document.getElementById('inspector-toggle-btn');
            if (inspectorToggle) {
                inspectorToggle.classList.remove('hidden');
                inspectorToggle.disabled = false;
            }

            // Start tracking performance (Step 18)
            startPerfTracking();
        };
    }

    if (stopBtn) {
        stopBtn.onclick = () => {
            runBtn.disabled = false;
            runBtn.classList.remove("opacity-50", "cursor-not-allowed");
            stopBtn.disabled = true;
            stopBtn.classList.add("opacity-50", "cursor-not-allowed");

            // Reset debugger buttons
            document.getElementById("pause-btn").disabled = true;
            document.getElementById("pause-btn").classList.remove("hidden");
            document.getElementById("resume-btn").disabled = true;
            document.getElementById("resume-btn").classList.add("hidden");
            document.getElementById("step-btn").disabled = true;
            document.getElementById("step-btn").classList.add("hidden");

            simulatorBridge.stop();

            // Hide inspector panel and toggle when simulation stops
            hideInspector();
            const inspectorToggle = document.getElementById('inspector-toggle-btn');
            if (inspectorToggle) {
                inspectorToggle.classList.add('hidden');
                inspectorToggle.disabled = true;
            }

            // Stop tracking performance (Step 18)
            stopPerfTracking();
        };
    }

    // Debugger controls (Step 15 Bonus)
    const pauseBtn = document.getElementById("pause-btn");
    const resumeBtn = document.getElementById("resume-btn");
    const stepBtn = document.getElementById("step-btn");

    if (pauseBtn) {
        pauseBtn.onclick = () => pauseExecution();
    }
    if (resumeBtn) {
        resumeBtn.onclick = () => resumeExecution();
    }
    if (stepBtn) {
        stepBtn.onclick = () => stepExecution();
    }

    // Automatically respond to backend pauses (e.g. Breakpoints)
    setDebuggerUICallback((state) => {
        if (state.paused) {
            pauseBtn.classList.add("hidden");
            resumeBtn.classList.remove("hidden");
            stepBtn.classList.remove("hidden");
            resumeBtn.disabled = false;
            stepBtn.disabled = false;

            // Optionally, highlight the line in Monaco
            if (state.line && editor) {
                editor.revealLineInCenter(state.line);
                editor.setPosition({ lineNumber: state.line, column: 1 });
            }
        } else {
            pauseBtn.classList.remove("hidden");
            resumeBtn.classList.add("hidden");
            stepBtn.classList.add("hidden");
            pauseBtn.disabled = false;
        }
    });

    // State Inspector toggle button (Step 17)
    const inspectorToggleBtn = document.getElementById('inspector-toggle-btn');
    const inspectorCloseBtn = document.getElementById('inspector-close-btn');

    if (inspectorToggleBtn) {
        inspectorToggleBtn.onclick = () => toggleInspector();
    }
    if (inspectorCloseBtn) {
        inspectorCloseBtn.onclick = () => hideInspector();
    }

    // Performance Monitor toggle button (Step 18)
    const perfToggleBtn = document.getElementById('perf-toggle-btn');
    if (perfToggleBtn) {
        perfToggleBtn.onclick = () => togglePerfPanel();
    }

    // Save and Share Buttons
    const saveCodeBtn = document.getElementById('save-code-btn');
    const shareProjectBtn = document.getElementById('share-project-btn');

    if (saveCodeBtn) {
        saveCodeBtn.onclick = () => {
            if (editor) {
                handleSaveCode(editor.getValue());
            }
        };
    }

    if (shareProjectBtn) {
        shareProjectBtn.onclick = () => {
            const project = getProject();
            const shareUrl = shareProject(project);
            handleShareProject(shareUrl);
        };
    }

    // Run action extended logic
    const originalRunBtnClick = runBtn.onclick;
    runBtn.onclick = () => {
        if (pauseBtn) pauseBtn.disabled = false;
        originalRunBtnClick();
    };

    // Components
    const addComponentBtn = document.getElementById("add-component-btn");
    const componentDropdown = document.getElementById("component-dropdown");
    const addResistorBtn = document.getElementById("add-resistor-btn");
    const addLedBtn = document.getElementById("add-led-btn");

    if (addComponentBtn && componentDropdown) {
        addComponentBtn.onclick = (e) => {
            e.stopPropagation();
            componentDropdown.classList.toggle("hidden");
            componentDropdown.classList.toggle("flex");
        };

        window.addEventListener('click', (e) => {
            if (!addComponentBtn.contains(e.target) && !componentDropdown.contains(e.target)) {
                componentDropdown.classList.add("hidden");
                componentDropdown.classList.remove("flex");
            }
        });
    }

    if (addResistorBtn) {
        addResistorBtn.onclick = () => {
            canvasManager.addResistor();
            if (componentDropdown) {
                componentDropdown.classList.add("hidden");
                componentDropdown.classList.remove("flex");
            }
        };
    }

    if (addLedBtn) {
        addLedBtn.onclick = () => {
            canvasManager.addLED();
            if (componentDropdown) {
                componentDropdown.classList.add("hidden");
                componentDropdown.classList.remove("flex");
            }
        };
    }

    // Push Button
    const addPushButtonBtn = document.getElementById("add-pushbutton-btn");

    if (addPushButtonBtn) {
        addPushButtonBtn.onclick = () => {
            canvasManager.addPushButton();
            if (componentDropdown) {
                componentDropdown.classList.add("hidden");
                componentDropdown.classList.remove("flex");
            }
        };
    }

    // Zoom Controls
    const zoomInBtn = document.getElementById("zoom-in-btn");
    const zoomOutBtn = document.getElementById("zoom-out-btn");

    if (zoomInBtn) zoomInBtn.onclick = () => canvasManager.zoomIn();
    if (zoomOutBtn) zoomOutBtn.onclick = () => canvasManager.zoomOut();

    // Popup Controls
    const popupValue = document.getElementById("popup-value");
    const popupUnit = document.getElementById("popup-unit");
    const popupRotate = document.getElementById("popup-rotate");
    const popupFlip = document.getElementById("popup-flip");
    const popupDelete = document.getElementById("popup-delete");
    const ledControls = document.getElementById("led-controls");

    if (popupValue) popupValue.oninput = () => canvasManager.updateSelectedComponentValue(popupValue.value, popupUnit.value);
    if (popupUnit) popupUnit.onchange = () => canvasManager.updateSelectedComponentValue(popupValue.value, popupUnit.value);
    if (popupRotate) popupRotate.onclick = () => canvasManager.rotateSelectedComponent();
    if (popupFlip) popupFlip.onclick = () => canvasManager.flipSelectedComponent();
    if (popupDelete) popupDelete.onclick = () => canvasManager.deleteSelected();

    if (ledControls) {
        const swatches = ledControls.querySelectorAll('div[data-color]');
        swatches.forEach(swatch => {
            swatch.onclick = () => {
                const color = swatch.getAttribute('data-color');
                canvasManager.updateSelectedComponentColor(color);
            };
        });
    }

    // Console Toggle
    const consoleToggleBtn = document.getElementById("console-toggle-btn");
    const consolePanel = document.getElementById("console-panel");
    const clearConsoleBtn = document.getElementById("clear-console");

    if (consoleToggleBtn && consolePanel) {
        consoleToggleBtn.onclick = () => {
            consolePanel.classList.toggle("h-60");
            consolePanel.classList.toggle("h-10");
        };
    }
    if (clearConsoleBtn) {
        clearConsoleBtn.onclick = () => {
            const output = document.getElementById("output");
            if (output) output.innerHTML = "";
        };
    }

    // Keys
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (canvasManager.wireManager.wireStartNode) {
                canvasManager.wireManager.cancelWire();
            } else {
                canvasManager.selectComponent(null);
            }
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (document.activeElement !== editor?.getDomNode()?.querySelector('textarea')) {
                canvasManager.deleteSelected();
            }
        }
    });

    setupTabs();
}

function setupTabs() {
    const tabsContainer = document.querySelector('aside .flex.items-center.bg-\\[\\#1E1F29\\]');
    if (!tabsContainer) return;
    const tabMainEl = tabsContainer.children[0];
    const tabDiagramEl = document.getElementById('tab-diagram');

    if (tabMainEl && tabDiagramEl) {
        tabMainEl.onclick = () => switchTab('main', tabMainEl, tabDiagramEl);
        tabDiagramEl.onclick = () => switchTab('diagram', tabMainEl, tabDiagramEl);
    }
}

function switchTab(tabName, tabMainEl, tabDiagramEl) {
    if (currentTab === tabName) return;

    if (currentTab === 'main') {
        pythonCode = editor.getValue();
    }

    currentTab = tabName;
    const activeClass = "bg-[#282A36] border-r border-dracula-current text-dracula-fg text-sm font-medium gap-2 border-t-2 border-primary cursor-pointer";
    const inactiveClass = "text-dracula-comment hover:text-dracula-fg hover:bg-[#282A36] border-r border-dracula-current text-sm font-medium gap-2 cursor-pointer transition-colors";

    if (tabName === 'main') {
        tabMainEl.setAttribute('class', `flex items-center px-4 py-2 ${activeClass}`);
        tabDiagramEl.setAttribute('class', `flex items-center px-4 py-2 ${inactiveClass}`);
        monaco.editor.setModelLanguage(editor.getModel(), 'python');
        editor.updateOptions({ readOnly: false });
        editor.setValue(pythonCode);
    } else {
        tabMainEl.setAttribute('class', `flex items-center px-4 py-2 ${inactiveClass}`);
        tabDiagramEl.setAttribute('class', `flex items-center px-4 py-2 ${activeClass}`);
        monaco.editor.setModelLanguage(editor.getModel(), 'json');
        editor.updateOptions({ readOnly: true });
        const json = generateDiagramJson();
        editor.setValue(json);
    }
}

// Logic for Diagram JSON (copied from main.js)
function generateDiagramJson() {
    const parts = [
        { "type": "raspberry-pi-pico", "id": "pico", "top": 0, "left": 0, "attrs": { "env": "micropython-20231227-v1.22.0" }, "connections": [] }
    ];

    canvasManager.components.forEach(c => {
        let part = null;
        if (c.id.startsWith('led_')) {
            const ledIndex = canvasManager.components.filter(Comp => Comp.id.startsWith('led_')).indexOf(c) + 1;
            part = { "type": "led", "id": `led${ledIndex}`, "top": c.y, "left": c.x, "attrs": { "color": "red" }, "connections": [] };
        } else if (c.id.startsWith('res_')) {
            const resIndex = canvasManager.components.filter(Comp => Comp.id.startsWith('res_')).indexOf(c) + 1;
            part = { "type": "resistor", "id": `res${resIndex}`, "top": c.y, "left": c.x, "attrs": { "value": c.value.toString() }, "connections": [] };
        } else if (c.id.startsWith('btn_')) {
            // Push button component
            const btnIndex = canvasManager.components.filter(Comp => Comp.id.startsWith('btn_')).indexOf(c) + 1;
            part = { "type": "push-button", "id": `btn${btnIndex}`, "top": c.y, "left": c.x, "attrs": {}, "connections": [] };
        }
        if (part) parts.push(part);
    });

    const getFriendlyId = (node) => {
        if (node.nodeType === 'gpio') {
            const allPins = [...LEFT_PINS, ...RIGHT_PINS];
            const pinDef = allPins.find(p => p.pin == node.pin);
            if (!pinDef) return null;
            return `pico:${pinDef.label}`;
        } else if (node.nodeType === 'component_pin') {
            const c = canvasManager.components.find(comp => comp.id === node.componentId);
            if (c) {
                if (c.id.startsWith('led_')) {
                    const ledIndex = canvasManager.components.filter(Comp => Comp.id.startsWith('led_')).indexOf(c) + 1;
                    return `led${ledIndex}:${node.pin}`;
                } else if (c.id.startsWith('res_')) {
                    const resIndex = canvasManager.components.filter(Comp => Comp.id.startsWith('res_')).indexOf(c) + 1;
                    return `res${resIndex}:${node.pin}`;
                } else if (c.id.startsWith('btn_')) {
                    // Push button pins in diagram
                    const btnIndex = canvasManager.components.filter(Comp => Comp.id.startsWith('btn_')).indexOf(c) + 1;
                    return `btn${btnIndex}:${node.pin}`;
                }
            }
        }
        return null;
    };

    canvasManager.wires.forEach(w => {
        const srcId = getFriendlyId(w.start);
        const dstId = getFriendlyId(w.end);
        if (srcId && dstId) {
            const [srcPartId, srcPin] = srcId.split(':');
            const [dstPartId, dstPin] = dstId.split(':');
            const srcPart = parts.find(p => p.id === srcPartId);
            const dstPart = parts.find(p => p.id === dstPartId);
            if (srcPart) srcPart.connections.push(`${srcPin}:${dstId}`);
            if (dstPart) dstPart.connections.push(`${dstPin}:${srcId}`);
        }
    });

    const diagram = { "version": 1, "author": "Anonymous", "editor": "CircuitFlow Simulator", "parts": parts, "dependencies": {} };
    return JSON.stringify(diagram, null, 2);
}

function updateDiagramEditor() {
    if (currentTab === 'diagram' && editor) {
        const json = generateDiagramJson();
        if (editor.getValue() !== json) editor.setValue(json);
    }
}

// ─── Project Save & Share Helpers (Step 13) ─────────────────────

/**
 * Gathers current project state into a serializable object.
 */
function getProject() {
    const code = editor ? editor.getValue() : pythonCode;
    const language = isCCode(code) ? 'c' : 'python';
    return createProject(code, language, canvasManager.components, canvasManager.wires);
}

/**
 * Restores a project from a serialized object.
 * Rebuilds components, wires, and editor code.
 */
function restoreProject(project) {
    if (!project) return;

    // Restore code
    const code = project.code || '';
    const language = project.language || 'python';
    pythonCode = code;

    if (editor) {
        // Set language mode
        const monacoLang = language === 'c' ? 'c' : 'python';
        monaco.editor.setModelLanguage(editor.getModel(), monacoLang);
        editor.setValue(code);
    }

    // Restore components
    canvasManager.clearAll();
    if (project.components && Array.isArray(project.components)) {
        project.components.forEach(compData => {
            canvasManager.restoreComponent(compData);
        });
    }

    // Restore wires (after components, since wires reference component IDs)
    if (project.connections && Array.isArray(project.connections)) {
        project.connections.forEach(wireData => {
            canvasManager.restoreWire(wireData);
        });
    }

    console.log('[ProjectStore] Project restored:', {
        language,
        components: project.components?.length || 0,
        wires: project.connections?.length || 0
    });
}

// Boot
document.addEventListener('DOMContentLoaded', initApp);
