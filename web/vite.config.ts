import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: { '/api': api, '/files': api, '/d/': api },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
