import typescript from '@rollup/plugin-typescript';
import eslint from '@rollup/plugin-eslint';

const formats = ['esm'];

/** @type {import('rollup').RollupOptions} */
export default {
  input: 'src/index.ts',
  output: formats.map((format) => ({
    file: `dist/index.${format}.js`,
    format,
    name: 'osrdicons',
    sourcemap: true,
  })),
  plugins: [eslint(), typescript()],
  external: ['react'],
};
