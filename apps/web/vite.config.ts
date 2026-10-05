import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    rolldownOptions: {
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
