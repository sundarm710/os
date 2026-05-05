import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PWA plugin config intentionally deferred to Day 2.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
