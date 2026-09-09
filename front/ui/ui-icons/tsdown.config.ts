import { join } from 'node:path';

import { defineConfig } from 'tsdown';

/* eslint-disable-next-line import/extensions */
import svgToReact from './scripts/svgToReact.ts';

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
  hooks: {
    'build:prepare': async () => {
      svgToReact(join(import.meta.dirname, 'icons'), join(import.meta.dirname, 'src'));
    },
  },
});
