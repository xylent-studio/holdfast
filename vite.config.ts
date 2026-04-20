import path from 'node:path';

import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          if (id.includes('@supabase')) {
            return 'supabase';
          }

          if (id.includes('react-router-dom')) {
            return 'router';
          }

          if (id.includes('dexie')) {
            return 'dexie';
          }

          if (id.includes('react')) {
            return 'react';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 4173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
