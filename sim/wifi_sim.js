/* sim/wifi_sim.js */
export const WiFiSim = {
    connected: false,
    ssid: null,
    ip: "192.168.1.50",

    init() {
        console.log("WiFi initialized");
        return 0;
    },

    connect(ssid) {
        console.log("Connecting to", ssid);

        // Simulate a slight delay for connection
        this.connected = true;
        this.ssid = ssid;

        if (typeof window !== 'undefined' && window.updateWiFiUI) {
            window.updateWiFiUI(true, this.ip);
        }
        return 0; // success
    }
};

// Expose to Module
if (typeof Module !== 'undefined') {
    Module.imports = Object.assign(Module.imports || {}, {
        sim_wifi_init: () => WiFiSim.init(),
        sim_wifi_connect: (ptr) => {
            const ssid = UTF8ToString(ptr);
            return WiFiSim.connect(ssid);
        }
    });
}

// Global Export
if (typeof window !== 'undefined') {
    window.WiFiSim = WiFiSim;
}
