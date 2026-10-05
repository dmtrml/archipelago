import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    rolldownOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        en: resolve(__dirname, 'en/index.html'),
      },
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/](?:three|@react-three[\\/])/ },
          ],
        },
      },
    },
  },
});
