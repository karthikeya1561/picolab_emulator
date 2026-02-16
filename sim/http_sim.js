/* sim/http_sim.js */
async function sim_http_get(ptrUrl, ptrResp, maxLen) {
    const url = UTF8ToString(ptrUrl);

    try {
        const res = await fetch(url);
        const text = await res.text();

        const bytes = new TextEncoder().encode(text);
        const len = Math.min(bytes.length, maxLen - 1);

        for (let i = 0; i < len; i++) {
            HEAPU8[ptrResp + i] = bytes[i];
        }
        HEAPU8[ptrResp + len] = 0;

        return len;
    } catch (e) {
        console.error("HTTP GET failed:", e);
        return -1;
    }
}

// Expose to Module
if (typeof Module !== 'undefined') {
    Module.imports = Object.assign(Module.imports || {}, {
        sim_http_get: sim_http_get
    });
}
