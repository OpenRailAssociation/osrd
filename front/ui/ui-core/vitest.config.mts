import { defineConfig } from 'vitest/config';

export default defineConfig({
  mode: 'benchmark',
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'happy-dom',
    silent: false, // Disable console.log output from tests
  },
});
