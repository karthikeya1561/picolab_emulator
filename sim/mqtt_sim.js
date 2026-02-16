/* sim/mqtt_sim.js */
let mqttClient = null;

export const MQTTsim = {
    init(clientId) {
        console.log("MQTT init:", clientId);
        return 0;
    },

    connect(url, port) {
        console.log(`MQTT connecting to ${url}:${port}`);
        // In a real browser environment, you'd load Paho MQTT library.
        // For this simulator, we might need to inject the script in index.html.
        
        if (typeof Paho === 'undefined') {
            console.error("Paho MQTT library not loaded. Please include it in index.html");
            return -1;
        }

        mqttClient = new Paho.MQTT.Client(
            url,
            port,
            "sim-" + Math.random().toString(16).substr(2, 8)
        );

        mqttClient.onMessageArrived = (msg) => {
            const topicPtr = allocateUTF8(msg.destinationName);
            const msgPtr = allocateUTF8(msg.payloadString);

            if (typeof Module !== 'undefined' && Module.ccall) {
                Module.ccall(
                    "sim_mqtt_message",
                    null,
                    ["number", "number"],
                    [topicPtr, msgPtr]
                );
            }
            // Optional: free pointers if using Emscripten's manual memory management
        };

        mqttClient.connect({
            onSuccess: () => console.log("MQTT connected"),
            onFailure: (err) => console.error("MQTT connection failed:", err),
            useSSL: port === 443 || port === 8083, // Common WebSocket SSL ports
        });

        return 0;
    },

    publish(topic, msg) {
        if (!mqttClient || !mqttClient.isConnected()) {
            console.error("MQTT not connected");
            return -1;
        }
        const message = new Paho.MQTT.Message(msg);
        message.destinationName = topic;
        mqttClient.send(message);
        return 0;
    },

    subscribe(topic) {
        if (!mqttClient || !mqttClient.isConnected()) {
            console.error("MQTT not connected");
            return -1;
        }
        mqttClient.subscribe(topic);
        return 0;
    }
};

// Expose to Module
if (typeof Module !== 'undefined') {
    Module.imports = Object.assign(Module.imports || {}, {
        sim_mqtt_init: (ptr) => MQTTsim.init(UTF8ToString(ptr)),
        sim_mqtt_connect: (ptr, port) => MQTTsim.connect(UTF8ToString(ptr), port),
        sim_mqtt_publish: (t, m) => MQTTsim.publish(UTF8ToString(t), UTF8ToString(m)),
        sim_mqtt_subscribe: (ptr) => MQTTsim.subscribe(UTF8ToString(ptr))
    });
}

// Global Export
if (typeof window !== 'undefined') {
    window.MQTTsim = MQTTsim;
}
