/* sim/time_sim.js */
export const TimeSim = {
    start: Date.now(),

    sleep_ms(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    sleep_us(us) {
        // Microsecond precision isn't really possible with setTimeout, 
        // but we can approximate it.
        return new Promise(resolve => setTimeout(resolve, us / 1000));
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
