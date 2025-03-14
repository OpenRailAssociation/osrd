import { defineConfig } from 'vitest/config';

export default defineConfig({
  mode: 'benchmark',
  test: {
    include: ['**/*.spec.ts'],
  },
});
