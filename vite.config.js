import { defineConfig } from 'vite';

export default defineConfig({
  worker: {
    format: 'es', // Ensures imports inside worker.js work correctly
  },
  optimizeDeps: {
    exclude: ['@micropython/micropython-web'], // Prevents Vite from trying to pre-bundle the WASM logic
    include: ['mqtt'] // Force pre-bundle mqtt for browser compatibility in dev mode
  },
  server: {
    fs: {
      // Allows Vite to serve files from the /mp and /pico folders
      allow: ['..']
    },
    // REQUIRED FOR SHAREDARRAYBUFFER:
    // These headers enable cross-origin isolation, which is needed for
    // SharedArrayBuffer and Atomics to work in modern browsers.
    // Without these, sharedPins will be null and button inputs won't work!
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless'
    },
    proxy: {
      '/compile': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
