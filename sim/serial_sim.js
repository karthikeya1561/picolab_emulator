/* sim/serial_sim.js */
export const SerialSim = {
    init() {
        console.log("[Serial] Initialized");
    },

    write(msg) {
        if (typeof appendLog === 'function') {
            appendLog(msg);
        } else {
            console.log(msg);
        }
    }
};

if (typeof Module !== 'undefined') {
    // Redirect printf/stdout
    Module.print = (text) => SerialSim.write(text);

    Module.imports = Object.assign(Module.imports || {}, {
        sim_serial_init: () => SerialSim.init()
    });
}

window.SerialSim = SerialSim;
