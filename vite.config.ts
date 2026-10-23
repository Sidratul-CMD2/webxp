import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the production build can be served from any static path.
  base: './',
  build: {
    target: 'es2022',
    // Keep icon SVGs as separate cacheable files rather than inlined data URIs,
    // so CSS masks and <img> share one request per icon.
    assetsInlineLimit: 0,
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    css: false,
  },
});
