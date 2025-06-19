import process from 'process';
import path from 'path';

import eslint from '@rollup/plugin-eslint';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import livereload from 'rollup-plugin-livereload';
import postcss from 'rollup-plugin-postcss';

const formats = ['esm'];
const rootDir = path.join(process.cwd(), '..', '..');
const name = path.basename(process.cwd());

/** @type {import("rollup").RollupOptions} */
const generateRollupBaseConfig = () => ({
  input: 'src/index.ts',
  output: formats.map((format) => ({
    file: `dist/index.${format}.js`,
    format,
    name,
    sourcemap: true,
  })),
  plugins: [
    nodeResolve({ rootDir }),
    eslint({
      throwOnError: !process.env.ROLLUP_WATCH,
      throwOnWarning: !process.env.ROLLUP_WATCH,
    }),
    typescript(),
    postcss({
      extract: 'theme.css',
      sourceMap: true,
      plugins: [],
    }),
    process.env.ROLLUP_WATCH &&
      livereload({
        watch: 'dist',
      }),
  ],
  external: (id, parent, isResolved) => {
    if (!isResolved) return false;
    if (id.endsWith('.css')) return false;
    const rel = path.relative(rootDir, id);
    const filenames = rel.split(path.sep);
    return filenames[0] === 'node_modules' || filenames[2] === 'dist';
  },
});

export default generateRollupBaseConfig;
