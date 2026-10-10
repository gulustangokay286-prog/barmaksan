import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const api = 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    // Host başlığı korunur (changeOrigin: false): sunucunun köken (CSRF) denetimi tarayıcının
    // Origin'iyle aynı adresi görür; üretimde nginx de Host'u olduğu gibi iletir.
    proxy: Object.fromEntries(['/api', '/files', '/d/'].map((path) => [path, { target: api, changeOrigin: false }])),
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
