/// <reference types="vitest" />
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import ImportMetaEnvPlugin from '@import-meta-env/unplugin';
import checker from 'vite-plugin-checker';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const require = createRequire(import.meta.url);
const ngeBase = path.dirname(
  require.resolve('@osrd-project/netzgrafik-frontend/dist/netzgrafik-frontend/index.html')
);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      viteTsconfigPaths(),
      ImportMetaEnvPlugin.vite({
        example: '.env.example',
      }),
      checker({
        // typescript: {
        //   buildMode: true,
        // },
        // eslint: {
        //   lintCommand: 'eslint --ext .ts,.tsx,.js,.jsx src --max-warnings 0',
        // },
        overlay: env.OSRD_VITE_OVERLAY !== 'false' && {
          initialIsOpen: env.OSRD_VITE_OVERLAY_OPEN_BY_DEFAULT === 'true',
        },
      }),
      viteStaticCopy({
        targets: [
          {
            src: [
              path.join(ngeBase, 'node_modules_angular_common_locales_*_mjs.js'),
              path.join(ngeBase, 'src_assets_i18n_*_json.js'),
            ],
            dest: 'netzgrafik-frontend/',
          },
        ],
      }),
    ],
    build: {
      outDir: 'build',
    },
    server: {
      open: false,
      port: +env.OSRD_VITE_PORT || 3000,
    },
    test: {
      globals: true,
      globalSetup: './vitest.global-setup.ts',
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      environment: 'happy-dom',
      coverage: {
        all: true,
        reportsDirectory: './tests/unit/coverage',
      },
    },
  };
});
