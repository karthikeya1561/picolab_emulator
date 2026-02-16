/* sim/fs_sim.js */
export const FSSim = {
    prefix: "pico_fs_",

    init() {
        console.log("FS initialized");
        return 0;
    },

    write(name, data) {
        localStorage.setItem(this.prefix + name, data);
        return data.length;
    },

    read(name) {
        const data = localStorage.getItem(this.prefix + name);
        if (data === null) return null;
        return data;
    },

    exists(name) {
        return localStorage.getItem(this.prefix + name) !== null;
    }
};

// Expose to Module
if (typeof Module !== 'undefined') {
    Module.imports = Object.assign(Module.imports || {}, {
        sim_fs_init: () => FSSim.init(),
        sim_fs_write: (n, d, l) => {
            const name = UTF8ToString(n);
            const data = UTF8ToString(d);
            return FSSim.write(name, data);
        },
        sim_fs_read: (n, b, max) => {
            const name = UTF8ToString(n);
            const data = FSSim.read(name);
            if (!data) return -1;

            const bytes = new TextEncoder().encode(data);
            const len = Math.min(bytes.length, max - 1);

            for (let i = 0; i < len; i++) {
                HEAPU8[b + i] = bytes[i];
            }
            HEAPU8[b + len] = 0;
            return len;
        },
        sim_fs_exists: (n) => FSSim.exists(UTF8ToString(n))
    });
}

// Global Export
if (typeof window !== 'undefined') {
    window.FSSim = FSSim;
}
