import path from 'node:path';
import process from 'node:process';

import { defineConfig } from 'tsdown';

const rootDir = path.join(process.cwd(), '..', '..');

export default defineConfig({
  entry: 'src/index.ts',
  name: 'ui-warped-map',
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
  deps: {
    neverBundle: (id, parent, isResolved) => {
      if (!isResolved) return false;
      if (id.endsWith('.css')) return false;
      const rel = path.relative(rootDir, id);
      const filenames = rel.split(path.sep);
      return filenames[0] === 'node_modules' || filenames[2] === 'dist';
    },
  },
});
