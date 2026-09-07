import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'src/index.ts',
  name: 'osrdicons',
  sourcemap: true,
  platform: 'browser',
  dts: {
    enabled: true,
    sourcemap: true,
  },
  deps: {
    neverBundle: ['react'],
  },
});
