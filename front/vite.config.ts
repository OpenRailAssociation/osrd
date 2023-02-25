/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import svgrPlugin from 'vite-plugin-svgr';
import ImportMetaEnvPlugin from '@import-meta-env/unplugin';
import checker from 'vite-plugin-checker';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteTsconfigPaths(),
    svgrPlugin(),
    ImportMetaEnvPlugin.vite({
      example: '.env.example',
    }),
    checker({
      typescript: {
        buildMode: true,
      },
      eslint: {
        lintCommand: 'eslint --ext .ts,.tsx,.js,.jsx src --max-warnings 345',
      },
      overlay: false,
    }),
  ],
  build: {
    outDir: 'build',
  },
  server: {
    open: true,
  },
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    environment: 'happy-dom',
    coverage: {
      reportsDirectory: './tests/unit/coverage',
    },
  },
});
