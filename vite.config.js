import { defineConfig } from 'vite';

export default defineConfig({
  worker: {
    format: 'es', // Ensures imports inside worker.js work correctly
  },
  optimizeDeps: {
    exclude: ['@micropython/micropython-web'] // Prevents Vite from trying to pre-bundle the WASM logic
  },
  server: {
    fs: {
      // Allows Vite to serve files from the /mp and /pico folders
      allow: ['..']
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  }
});