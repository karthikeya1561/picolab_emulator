/**
 * This file runs the simulation.
 * It sends your code to a background worker to run.
 * It listens for updates (like "Turn LED ON") and updates the screen.
 *
 * GPIO state management is delegated to the sim/gpio_bridge layer.
 * Circuit analysis is delegated to the sim/connection_graph module (Step 14).
 */

import { initSerial, print, printError, printSystem } from '../sim/serial_bridge.js';
import { setLedState, setLedBrightness } from '../components/LED.js';
import { setPushButtonPressed } from '../components/PushButton.js';
import {
    handlePinAction,
    updateInputState,
    isOutputHigh,
    resetGpio,
    initSharedMemory,
    initializePin
} from '../sim/gpio_bridge.js';
import { startTimer, stopTimer } from '../sim/time_bridge.js';
import { isPinPwm, getPwmDutyCycle, resetPwm } from '../sim/pwm_bridge.js';
import { resetWifi } from '../sim/wifi_bridge.js';
import { resetHttp } from '../sim/http_bridge.js';
import { resetMqtt } from '../sim/mqtt_bridge.js';
import { resetFs } from '../sim/fs_bridge.js';
import { performReset, RESET_SOFT, RESET_WATCHDOG, RESET_POWER_CYCLE } from '../sim/reset_bridge.js';
import { compileCode, loadWasm, unloadWasm, isWasmRunning, isCCode } from '../sim/wasm_loader.js';
import {
    analyzeNet,
    checkConnection,
    isGpioConnectedTo,
    findDrivingGpio,
    syncWires,
    setOnWireRemoved
} from '../sim/connection_graph.js';
import {
    initDebugState,
    handleWorkerPaused
} from '../sim/debug_bridge.js';
import {
    resetDebugger,
    getBreakpoints,
    onDebuggerHit
} from '../sim/debugger.js';
import { reportPropagationTime, reportWorkerLatency } from '../sim/performance_monitor.js';
import { validateCircuit } from '../sim/circuit_validator.js';

export { isCCode };

export class SimulatorBridge {
    constructor(canvasManager, outputElement) {
        this.canvasManager = canvasManager;
        initSerial(outputElement); // Initialize serial output layer

        this.worker = null;
        // GPIO state is now managed by sim/gpio_bridge → sim/gpio_sim
        // this.pinStates and this.inputStates are replaced by the bridge layer

        // SharedArrayBuffer allows instant communication with the worker.
        // Unlike postMessage which is async, Atomics work even when the
        // worker is blocked in a while loop (which is the core issue).
        this.sharedBuffer = null;
        this.sharedPins = null; // Int32Array view of shared memory

        // Track pins that have already shown connection errors (avoid spam)
        this.erroredOutputPins = new Set();
        this.erroredInputPins = new Set();

        // Performance Monitoring (Step 18)
        this.pingInterval = null;

        // Register disconnect cleanup callback (Step 14)
        // When a wire is removed, reset GPIO input states for affected pins
        setOnWireRemoved((removedWire) => {
            this.updateCircuit();
        });
    }

    /**
     * Connects the button press callback to the canvas manager.
     * Called after both CanvasManager and SimulatorBridge are created.
     */
    setupButtonCallback() {
        // When a button is pressed/released, this function is called
        this.canvasManager.onButtonPress = (componentId, isPressed) => {
            this.handleButtonPress(componentId, isPressed);
        };
    }

    run(code) {
        printSystem("Initializing Worker...");

        // Clear temp visuals
        document.querySelectorAll(".dynamic-led").forEach(el => el.remove());

        // Reset GPIO state via bridge
        resetGpio();

        // Clear pin error tracking for new run
        this.erroredOutputPins.clear();
        this.erroredInputPins.clear();

        // Sync connection graph with current wires (Step 14)
        syncWires(this.canvasManager.wires);

        // Start simulation clock
        startTimer();

        // Turn off all LEDs
        this.canvasManager.components.filter(c => c.id.startsWith('led_')).forEach(led => {
            setLedState(led, 'OFF');
        });

        // Reset debug state and initialize the shared buffer for debugger
        resetDebugger();
        const debugBuffer = initDebugState();

        if (this.worker) this.worker.terminate();

        // Worker path might need adjustment if using module? 
        // Vite should handle this URL import if relative to this file?
        // Original was: new URL("../backend/worker.js", import.meta.url)
        this.worker = new Worker(new URL("../backend/worker.js", import.meta.url), { type: "module" });

        this.worker.onmessage = (e) => {
            const data = e.data;

            // Handle debugger pause notifications
            if (typeof data === 'object' && data.type === 'DEBUG_PAUSED') {
                handleWorkerPaused(data.line);
                onDebuggerHit(data.line);
                return;
            }

            // Handle PONG messages for latency tracking (Step 18)
            if (typeof data === 'string' && data.startsWith('PONG:')) {
                const sentTime = parseFloat(data.split(':')[1]);
                reportWorkerLatency(performance.now() - sentTime);
                return;
            }

            // Guard: worker may send objects (not just strings)
            if (typeof data !== 'string') return;
            if (data.startsWith("ON:") || data.startsWith("OFF:") || data.startsWith("TOGGLE:")) {
                const [action, pin] = data.split(":");
                this.handlePinStateChange(pin, action);
                return;
            }
            if (data.startsWith("CREATE:")) {
                const parts = data.split(":");
                const gpNum = parseInt(parts[1]);
                const mode = parseInt(parts[2]); // 0=IN, 1=OUT
                initializePin(gpNum, mode);
                if (mode === 1) {
                    this.validateOutputPin(gpNum);
                } else {
                    this.validateInputPin(gpNum);
                }
                return;
            }
            print(data.replace(/\n$/, ""));
        };

        this.worker.onerror = (err) => {
            const msg = err.message || err.type || 'unknown';
            const file = err.filename || '';
            const line = err.lineno || '';
            const col = err.colno || '';
            printError(`CRITICAL SYSTEM ERROR: ${msg}`);
            if (file) printError(`  File: ${file}:${line}:${col}`);
            console.error('[Worker Error]', { message: msg, filename: file, lineno: line, colno: col, event: err });
        };

        this.worker.addEventListener('messageerror', (err) => {
            console.error('[Worker MessageError]', err);
            printError(`WORKER MESSAGE ERROR: ${err}`);
        });

        // Validate circuit (Step 19 - Floating pins / unsupported connection warnings)
        validateCircuit(this.canvasManager.components, this.canvasManager.wires);

        // Initialize SharedArrayBuffer for instant button input updates.
        // This is the FIX for button.value() not updating in while loops.
        // SharedArrayBuffer creates memory that both threads can access simultaneously.
        if (typeof SharedArrayBuffer !== 'undefined') {
            try {
                // Create shared memory: 256 integers = enough for all 30 GPIO pins
                this.sharedBuffer = new SharedArrayBuffer(1024);
                this.sharedPins = new Int32Array(this.sharedBuffer);

                // Initialize shared memory via bridge (default HIGH for PULL_UP)
                initSharedMemory(this.sharedPins);

                // 2) Send INIT_SHARED message to give worker the SharedArrayBuffer
                this.worker.postMessage({
                    type: 'INIT_SHARED',
                    buffer: this.sharedBuffer
                });

                // 3) Send INIT_DEBUG_SHARED and UPDATE_BREAKPOINTS
                this.worker.postMessage({
                    type: 'INIT_DEBUG_SHARED',
                    buffer: debugBuffer
                });

                this.worker.postMessage({
                    type: 'UPDATE_BREAKPOINTS',
                    breakpoints: Array.from(getBreakpoints())
                });

                // 4) Delay slightly, then send code
                setTimeout(() => {
                    this.worker.postMessage(code);
                }, 50);
            } catch (e) {
                console.warn('[SimulatorBridge] SharedArrayBuffer failed:', e);
            }
        } else {
            console.warn('[SimulatorBridge] SharedArrayBuffer not supported - button inputs may not work in loops');
            this.worker.postMessage(code);
        }

        // Start performance ping interval (Step 18)
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
            if (this.worker) this.worker.postMessage(`PING:${performance.now()}`);
        }, 500);
    }

    stop() {
        // Step 20: Prevent memory leaks / phantom workers by strictly clearing intervals
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        if (this.worker) {
            try {
                this.worker.terminate();
            } catch (e) {
                console.warn('[SimulatorBridge] Worker termination caught:', e);
            }
            this.worker = null;
        }

        // Unload WASM firmware if running
        if (isWasmRunning()) {
            unloadWasm();
        }

        // Reset debugger UI state
        resetDebugger();

        // Reset GPIO state via bridge
        resetGpio();

        // Clear pin error tracking
        this.erroredOutputPins.clear();
        this.erroredInputPins.clear();

        // Reset PWM state
        resetPwm();

        // Reset WiFi state
        resetWifi();

        // Reset HTTP state (abort in-flight requests)
        resetHttp();

        // Reset MQTT state (disconnect client, clear subscriptions)
        resetMqtt();

        // Reset filesystem runtime state (preserves stored files)
        resetFs();

        // Stop simulation clock
        stopTimer();

        // Turn off LEDs
        this.canvasManager.components.filter(c => c.id.startsWith('led_')).forEach(led => {
            setLedState(led, 'OFF');
        });

        printSystem("Simulation Stopped.");
    }

    /**
     * Perform a soft reset: clear all volatile state and restart firmware.
     *
     * This simulates real Pico behavior:
     *   - GPIO pins reset to default
     *   - PWM slices cleared
     *   - WiFi disconnected
     *   - Timers reset
     *   - Serial init flag cleared
     *   - Filesystem (flash) is PRESERVED
     *   - Worker is terminated and re-spawned
     *   - Firmware restarts from main()
     *
     * Safe to call repeatedly — only one worker exists at a time.
     *
     * @param {string} code — firmware code to re-execute after reset
     * @param {number} resetType — RESET_SOFT (default), RESET_WATCHDOG, or RESET_POWER_CYCLE
     */
    softReset(code, resetType = RESET_SOFT) {
        if (this.pingInterval) clearInterval(this.pingInterval);

        // 1. Terminate existing worker to prevent duplicate execution
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }

        // Clear pin error tracking for new session
        this.erroredOutputPins.clear();
        this.erroredInputPins.clear();

        // 2. Clear all volatile hardware state (preserves filesystem)
        const result = performReset(resetType);

        // 3. Reset HTTP/MQTT (these have their own cleanup beyond reset_sim)
        resetHttp();
        resetMqtt();

        // 4. Turn off all LEDs
        this.canvasManager.components.filter(c => c.id.startsWith('led_')).forEach(led => {
            setLedState(led, 'OFF');
        });

        // 5. Notify serial monitor
        printSystem(`${result.label} — restarting firmware...`);

        // 6. Restart simulation clock
        startTimer();

        // 7. Spawn fresh worker
        this.worker = new Worker(new URL("../backend/worker.js", import.meta.url), { type: "module" });

        this.worker.onmessage = (e) => {
            const data = e.data;
            if (typeof data !== 'string') return;
            
            if (data.startsWith('PONG:')) {
                const sentTime = parseFloat(data.split(':')[1]);
                reportWorkerLatency(performance.now() - sentTime);
                return;
            }

            if (data.startsWith("ON:") || data.startsWith("OFF:") || data.startsWith("TOGGLE:")) {
                const [action, pin] = data.split(":");
                this.handlePinStateChange(pin, action);
                return;
            }
            if (data.startsWith("CREATE:")) {
                const parts = data.split(":");
                const gpNum = parseInt(parts[1]);
                const mode = parseInt(parts[2]); // 0=IN, 1=OUT
                initializePin(gpNum, mode);
                if (mode === 1) {
                    this.validateOutputPin(gpNum);
                } else {
                    this.validateInputPin(gpNum);
                }
                return;
            }
            print(data.replace(/\n$/, ""));
        };

        this.worker.onerror = (err) => {
            const msg = err.message || err.type || 'unknown';
            printError(`CRITICAL SYSTEM ERROR: ${msg}`);
            console.error('[Worker Error after reset]', err);
        };

        // Validate circuit (Step 19 - Floating pins / unsupported connection warnings)
        validateCircuit(this.canvasManager.components, this.canvasManager.wires);

        // 8. Re-initialize SharedArrayBuffer
        if (typeof SharedArrayBuffer !== 'undefined') {
            try {
                this.sharedBuffer = new SharedArrayBuffer(1024);
                this.sharedPins = new Int32Array(this.sharedBuffer);
                initSharedMemory(this.sharedPins);
                this.worker.postMessage({ type: 'INIT_SHARED', buffer: this.sharedBuffer });
            } catch (e) {
                console.warn('[SimulatorBridge] SharedArrayBuffer failed on reset:', e);
            }
        }

        // 9. Send code to fresh worker — firmware restarts from main()
        this.worker.postMessage(code);

        // 10. Restart ping interval
        this.pingInterval = setInterval(() => {
            if (this.worker) this.worker.postMessage(`PING:${performance.now()}`);
        }, 500);

        console.log(`[SimulatorBridge] ${result.label} complete — firmware restarted`);
    }

    /**
     * Compile and run C code via the Emscripten compiler server.
     *
     * Pipeline:
     *   1. Send code to POST /compile
     *   2. Receive compiled WASM + JS glue
     *   3. Load WASM via wasm_loader
     *   4. WASM extern calls → js_library → sim bridges
     *
     * On error: compilation errors are shown in the Serial Monitor.
     *
     * @param {string} code — user C source code
     */
    async runC(code) {
        printSystem('Compiling C code...');

        try {
            // 1. Send to compiler server
            const result = await compileCode(code);

            // 2. Check for compilation errors
            if (result.error) {
                printError('Compilation failed:');
                result.error.split('\n').forEach(line => {
                    if (line.trim()) printError(line);
                });
                return false;
            }

            // 3. Start timer for simulation clock
            startTimer();

            // 4. Load and run WASM (WASM is embedded in JS via SINGLE_FILE)
            printSystem('Loading WASM firmware...');
            await loadWasm(result.js);

            printSystem(`Firmware running (JS: ${result.size.js} bytes)`);
            return true;

        } catch (err) {
            printError(`Compiler error: ${err.message}`);
            console.error('[SimulatorBridge] runC error:', err);
            return false;
        }
    }

    /**
     * Handles when a push button is pressed or released.
     * Updates visual state, component state, and notifies worker.
     * 
     * @param {string} componentId - The button's component ID
     * @param {boolean} isPressed - True if pressed, false if released
     */
    handleButtonPress(componentId, isPressed) {
        const btn = this.canvasManager.components.find(c => c.id === componentId);
        if (!btn) return;

        // Update component state
        btn.isPressed = isPressed;

        // Update visual state
        setPushButtonPressed(btn, isPressed);

        // Notify connected GPIOs about the input change
        this.updateGpioInputStates(btn);

        // Re-evaluate circuit (button might complete a circuit)
        this.updateCircuit();
    }

    /**
     * Updates the input state of GPIOs connected to the button.
     * Traces the circuit to see if the GPIO is pulled to Ground.
     * Delegates BFS to connection_graph.analyzeNet() (Step 14).
     * 
     * @param {object} btn - The button component
     */
    updateGpioInputStates(btn) {
        if (!this.worker) return;

        // Check all 4 pins of the button to capture all affected nets
        for (let pinNum = 1; pinNum <= 4; pinNum++) {
            const netStatus = analyzeNet(btn.id, pinNum.toString(), this.canvasManager.components);

            netStatus.gpios.forEach(gpioNum => {
                const value = netStatus.isGrounded ? 0 : 1;
                updateInputState(gpioNum, value, this.sharedPins, this.worker);
            });
        }
    }

    handlePinStateChange(pinStr, action) {
        const gpNum = parseInt(pinStr);

        // Delegate GPIO state change to bridge layer
        handlePinAction(gpNum, action);

        // Check if output pin is connected to any component
        this.validateOutputPin(gpNum);

        this.updateCircuit();
    }

    /**
     * Validates that an output GPIO pin has a connected LED/component.
     * If not connected, STOPS the simulation and shows a red error.
     * Delegates BFS to connection_graph.isGpioConnectedTo() (Step 14).
     */
    validateOutputPin(gpNum) {
        if (this.erroredOutputPins.has(gpNum)) return;
        if (!isGpioConnectedTo(gpNum, 'led_', this.canvasManager.components)) {
            this.erroredOutputPins.add(gpNum);
            printError(`GP${gpNum}: No LED connected — add an LED component and wire it to GP${gpNum}.`);
            printError('Simulation stopped — circuit incomplete.');
            this.stop();
        }
    }

    /**
     * Validates that an input GPIO pin has a connected button/component.
     * If not connected, STOPS the simulation and shows a red error.
     * Delegates BFS to connection_graph.isGpioConnectedTo() (Step 14).
     */
    validateInputPin(gpNum) {
        if (isNaN(gpNum) || gpNum < 0 || gpNum > 29) return;
        if (this.erroredInputPins.has(gpNum)) return;
        if (!isGpioConnectedTo(gpNum, 'btn_', this.canvasManager.components)) {
            this.erroredInputPins.add(gpNum);
            printError(`GP${gpNum}: No button connected — add a button component and wire it to GP${gpNum}.`);
            printError('Simulation stopped — circuit incomplete.');
            this.stop();
        }
    }

    /**
     * Re-evaluates all circuit connections and updates LED / button states.
     * Delegates BFS to connection_graph module (Step 14).
     */
    updateCircuit() {
        const startTime = performance.now();
        const components = this.canvasManager.components;

        // Traverse LEDs
        components.filter(c => c.id.startsWith('led_')).forEach(led => {
            const anodeConnected = checkConnection(led.id, 'A', 'Power', components, isOutputHigh, !!this.worker);
            const cathodeConnected = checkConnection(led.id, 'C', 'Ground', components, isOutputHigh, !!this.worker);

            if (cathodeConnected && anodeConnected) {
                // Check if the driving GPIO has active PWM
                const gpioPin = findDrivingGpio(led.id, components);
                if (gpioPin !== null && isPinPwm(gpioPin)) {
                    const duty = getPwmDutyCycle(gpioPin);
                    setLedBrightness(led, duty);
                } else {
                    setLedState(led, 'ON');
                }
            } else {
                setLedState(led, 'OFF');
            }
        });

        // Update Push Buttons (Inputs)
        components.filter(c => c.id.startsWith('btn_')).forEach(btn => {
            this.updateGpioInputStates(btn);
        });

        reportPropagationTime(performance.now() - startTime);
    }
}
