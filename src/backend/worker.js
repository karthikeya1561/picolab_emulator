// worker.js
// This worker runs MicroPython code and communicates GPIO changes.
// It sends messages like "ON:15" to turn LEDs on/off.
// It receives PIN_UPDATE messages to update input states (for buttons).

import { loadMicroPython } from "../../mp/micropython.mjs";

let mp = null;

// Store input states for each GPIO pin (fallback for non-SharedArrayBuffer)
// This is updated when buttons are pressed/released
const inputStates = {};

// SharedArrayBuffer view for instant button state reads (THE FIX!)
// This variable will be set when we receive INIT_SHARED from main thread.
// Using Atomics.load() on this array allows reading button states even
// while the Python code is blocked in a while loop.
let sharedPins = null;

// Debugger state (Step 15)
let sharedDebug = null;  // Int32Array(4) [ STATE, LINE, ... ]
let breakpoints = [];    // Array of line numbers

// Store FakePin instances so we can look them up
const pinInstances = {};

onmessage = async (e) => {
  const data = e.data;

  // Handle INIT_SHARED message - receive SharedArrayBuffer from main thread
  // This must happen BEFORE code execution so we can read button states
  if (typeof data === 'object' && data.type === 'INIT_SHARED') {
    // Create Int32Array view of the shared buffer
    sharedPins = new Int32Array(data.buffer);
    console.log('[Worker] SharedArrayBuffer received and ready');
    return;
  }

  // Handle INIT_DEBUG_SHARED message - receive Debugger buffer (Step 15)
  if (typeof data === 'object' && data.type === 'INIT_DEBUG_SHARED') {
    sharedDebug = new Int32Array(data.buffer);
    console.log('[Worker] Debugger SharedArrayBuffer received');
    return;
  }

  // Handle breakpoint updates
  if (typeof data === 'object' && data.type === 'UPDATE_BREAKPOINTS') {
    breakpoints = data.breakpoints || [];
    return;
  }

  // Handle PIN_UPDATE messages from the main thread (fallback for buttons)
  // This is only used if SharedArrayBuffer is not available
  if (typeof data === 'object' && data.type === 'PIN_UPDATE') {
    // Update the input state for this pin (fallback method)
    inputStates[data.pin] = data.value;
    return;
  }

  // Handle PING messages for performance monitoring (Step 18)
  if (typeof data === 'string' && data.startsWith('PING:')) {
    postMessage(data.replace('PING:', 'PONG:'));
    return;
  }

  // Otherwise, it's code to execute
  let code = data;

  try {
    if (!mp) {
      mp = await loadMicroPython({
        stdout: txt => postMessage(txt),
        stderr: txt => postMessage(txt) // Capture Python runtime errors
      });

      /**
       * FakePin simulates a GPIO pin for the Pico.
       * It handles both output (to LEDs) and input (from buttons).
       * 
       * @param {number} pin - GPIO pin number (0-29)
       * @param {number} mode - Pin.OUT (1) or Pin.IN (0)
       * @param {number} pull - Optional pull-up/pull-down (Pin.PULL_UP = 1)
       */
      function FakePin(pin, mode, pull) {
        if (pin < 0 || pin > 29) throw new Error(`ValueError: Pin ${pin} is invalid (0-29)`);

        postMessage(`CREATE:${pin}:${mode}`);

        // If configured with PULL_UP, default state is HIGH (1)
        if (pull === FakePin.PULL_UP && inputStates[pin] === undefined) {
          inputStates[pin] = 1;
        }

        const pinObj = {
          // Turn pin output HIGH
          on: () => postMessage(`ON:${pin}`),

          // Turn pin output LOW
          off: () => postMessage(`OFF:${pin}`),

          // Toggle pin output
          toggle: () => postMessage(`TOGGLE:${pin}`),

          /**
           * Read or write pin value.
           * - Called with no argument: returns current input state
           * - Called with argument: sets output state
           * 
           * THE FIX: When reading (v === undefined), we use Atomics.load()
           * to get the value directly from shared memory. This works even
           * while we're blocked in a while loop because Atomics operations
           * access memory directly, bypassing the message queue.
           * 
           * @param {number|undefined} v - Value to set (1 or 0), or undefined to read
           * @returns {number|undefined} - Current value if reading, undefined if writing
           */
          value: (v) => {
            if (v === undefined) {
              // READ mode - return current input state
              // 
              // Priority 1: Use SharedArrayBuffer + Atomics (instant, works in loops!)
              // Priority 2: Fall back to inputStates object (may be stale in loops)
              // Default to 1 if not set (for PULL_UP behavior)
              if (sharedPins) {
                return Atomics.load(sharedPins, pin);
              }
              return inputStates[pin] !== undefined ? inputStates[pin] : 1;
            }
            // WRITE mode - send to main thread
            postMessage(v ? `ON:${pin}` : `OFF:${pin}`);
          }
        };

        // Store reference for potential later access
        pinInstances[pin] = pinObj;

        return pinObj;
      }

      // Pin mode constants (matching MicroPython)
      FakePin.OUT = 1;
      FakePin.IN = 0;
      FakePin.PULL_UP = 1;
      FakePin.PULL_DOWN = 2;

      mp.registerJsModule("machine", { Pin: FakePin });

      /**
       * Debugger Checkpoint Function (Step 15)
       * Exposed to MicroPython as `sim_debug.checkpoint(line)`
       */
      function js_debug_checkpoint(line) {
        if (!sharedDebug) return;

        const STATE_RUNNING = 0;
        const STATE_PAUSED = 1;
        const STATE_STEP = 2;

        let state = Atomics.load(sharedDebug, 0);
        const isBreakpoint = breakpoints.includes(line);

        // If stepping or hit a breakpoint, we must transition to PAUSED
        if (state === STATE_STEP || isBreakpoint) {
          Atomics.store(sharedDebug, 0, STATE_PAUSED);
          state = STATE_PAUSED;
        }

        if (state === STATE_PAUSED) {
          // Notify UI that we have paused execution
          postMessage({ type: 'DEBUG_PAUSED', line });

          // Synchronously block this Web Worker thread until state changes from PAUSED
          // This is allowed in Web Workers and frees the CPU without blocking main UI
          while (Atomics.load(sharedDebug, 0) === STATE_PAUSED) {
            Atomics.wait(sharedDebug, 0, STATE_PAUSED);
          }

          // If the UI commanded a step, immediately switch back to PAUSED for the next instruction
          if (Atomics.load(sharedDebug, 0) === STATE_STEP) {
            // UI wants to step. Leave it as STEP so the next checkpoint catches it.
          }
        }
      }

      mp.registerJsModule("sim_debug", { checkpoint: js_debug_checkpoint });
    }

    // Inject checkpoints into the user code line-by-line
    // We ignore empty lines, comments, and un-injectable keywords (else/elif/except)
    let currentInjectedLine = 1;
    const injectedToRealMap = {};

    const injectedCode = code.split('\n').map((line, idx) => {
      const clean = line.trim();
      const realLineNum = idx + 1;

      if (!clean || clean.startsWith('#') || /^(else|elif|except|finally)(\s*:|\s+)/.test(clean) || clean.startsWith('@')) {
        injectedToRealMap[currentInjectedLine] = realLineNum;
        currentInjectedLine++;
        return line;
      }

      const match = line.match(/^(\s*)/);
      const indent = match ? match[1] : '';

      injectedToRealMap[currentInjectedLine] = realLineNum;     // Checkpoint line mapping
      injectedToRealMap[currentInjectedLine + 1] = realLineNum; // Actual code line mapping
      currentInjectedLine += 2;

      // Pass the REAL line number into the checkpoint!
      return `${indent}import sim_debug; sim_debug.checkpoint(${realLineNum})\n${line}`;
    }).join('\n');

    // Run code and catch syntax/logic errors
    mp.runPython(injectedCode);

  } catch (err) {
    // This catches MicroPython loading errors AND Python runtime errors.
    const name = err.name || 'Error';
    let message = err.message || String(err);
    const stack = err.stack || '';

    // Remap error line numbers from the injected code back to the user's original lines
    // Tracebacks usually look like: File "<stdin>", line 10, in <module>
    message = message.replace(/line\s+(\d+)/g, (match, lineStr) => {
      const injLine = parseInt(lineStr, 10);
      // Fallback to original if we don't have it in the map (should always be there)
      return `line ${injectedToRealMap[injLine] || injLine}`;
    });

    postMessage(`\n>>> ${name}: ${message}`);
    console.error('[Worker] Execution error:', { name, message, stack });
  }
};