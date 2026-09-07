import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'src/index.ts',
  name: 'ui-core',
  sourcemap: true,
  platform: 'browser',
  dts: {
    enabled: true,
    sourcemap: true,
  },
  css: {
    fileName: 'theme.css',
    transformer: 'postcss',
  },
});
