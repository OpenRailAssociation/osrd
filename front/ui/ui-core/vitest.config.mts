import { defineConfig } from 'vitest/config';

export default defineConfig({
  mode: 'benchmark',
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'jsdom',
    silent: false, // Disable console.log output from tests
  },
});
