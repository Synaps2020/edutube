import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (path) =>
          path.includes('/hls.js/')
            ? 'hls'
            : path.includes('/@videojs/')
              ? 'video-controls'
              : undefined,
      },
    },
  },
  server: { proxy: { '/api': `http://127.0.0.1:${process.env.API_PORT ?? '3083'}` } },
});
