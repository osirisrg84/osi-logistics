import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // driver.html is index.html's driver-branded twin (correct favicon /
      // title / Open Graph tags for driver.osilogistics.com link previews --
      // see root vercel.json's host-conditioned rewrite). Both load the same
      // /src/main.tsx bundle; React Router decides what renders from the URL
      // either way, so this only changes what's in <head> before JS runs.
      input: {
        main: resolve(__dirname, 'index.html'),
        driver: resolve(__dirname, 'driver.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
