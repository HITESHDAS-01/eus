import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  esbuild: {
    // Strip console.log / debugger from production bundles so we don't leak
    // upload URLs, RLS errors, or other operational details to end users.
    // console.error is kept so genuine surfaced failures still reach the
    // user's browser console for support diagnostics.
    drop: ['debugger'],
    pure: ['console.log', 'console.warn', 'console.info', 'console.debug'],
  },
});
