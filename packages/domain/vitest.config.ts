import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/index.ts'],
      thresholds: { lines: 95, branches: 90, functions: 100 },
      reporter: ['text', 'json-summary'],
    },
  },
});
