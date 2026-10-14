import { defineConfig } from 'vitest/config';
import type { PluginOption } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react() as any],
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'threads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
});
