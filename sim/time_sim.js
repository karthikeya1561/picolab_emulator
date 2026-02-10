/* sim/time_sim.js */
export const TimeSim = {
    start: Date.now(),

    sleep_ms(ms) {
        // Simple busy wait for simulation accuracy in synchronous contexts
        // Note: This BLOCKS the browser entirely. A better simulation uses Asyncify or Workers.
        // For roadmap Step 2 compat, we keep it simple or assume worker context.
        const start = Date.now();
        while (Date.now() - start < ms) {
            // spin
        }
    },

    sleep_us(us) {
        const start = performance.now();
        while ((performance.now() - start) * 1000 < us) {
            // spin
        }
    },

    get_time_us() {
        return (Date.now() - this.start) * 1000;
    }
};

if (typeof Module !== 'undefined') {
    Module.imports = Module.imports || {};
    // Note: Sleep is tricky in single-threaded JS. 
    // True sleep requires Asyncify or Worker.
    Module.imports.sim_sleep_ms = ms => TimeSim.sleep_ms(ms);
    Module.imports.sim_get_time_us = () => TimeSim.get_time_us();
}

window.TimeSim = TimeSim;
