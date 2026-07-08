/// <reference types="vitest" />
import { createRequire } from 'node:module';
import * as path from 'node:path';

import react from '@vitejs/plugin-react';
//import { deprecations } from 'sass';
import { defineConfig, loadEnv } from 'vite';
import checker from 'vite-plugin-checker';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const require = createRequire(import.meta.url);
const ngeBase = path.dirname(require.resolve('@osrd-project/netzgrafik-frontend/index.html'));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    css: {
      preprocessorOptions: {
        scss: {
          // Make all deprecations fatal. Any sass upgrade must resolve these
          // deprecation issues before being merged.
          //fatalDeprecations: Object.values(deprecations),
          // TODO: enable again once we no longer use bootstrap-sncf
          fatalDeprecations: [],
          silenceDeprecations: [
            'import',
            'global-builtin',
            'color-functions',
            'if-function',
            'slash-div',
          ],
        },
      },
    },
    plugins: [
      react(),
      {
        ...checker({
          oxlint: {
            lintCommand: 'oxlint',
            // TODO: Remove this explicit list as soon as vite-plugin-checker handles concurrent
            //       watch files properly (i.e. with a debounce) or at least remove `test-results`
            //       and `playwright-report` from the default watch paths.
            watchPath: [
              'src',
              'tests',
              'ui/storybook/stories',
              'ui/ui-charts/src',
              'ui/ui-core/src',
              'ui/ui-icons/scripts',
              'ui/ui-warped-data/src',
            ],
          },
          overlay: env.OSRD_VITE_OVERLAY !== 'false' && {
            initialIsOpen: env.OSRD_VITE_OVERLAY_OPEN_BY_DEFAULT === 'true',
          },
        }),
        apply: 'serve',
      },
      viteStaticCopy({
        targets: [
          {
            src: [path.join(ngeBase, '*')],
            dest: 'netzgrafik-frontend/',
            rename: { stripBase: true },
          },
          {
            src: [path.join(ngeBase, 'assets/i18n/*')],
            dest: 'netzgrafik-frontend/assets/i18n/',
            rename: { stripBase: true },
          },
        ],
      }),
    ],
    build: {
      outDir: 'build',
      sourcemap: true,
      license: {
        fileName: 'licenses.json',
      },
    },
    resolve: {
      tsconfigPaths: true,
    },
    server: {
      open: false,
      port: +env.OSRD_VITE_PORT || 3000,
    },
    test: {
      globalSetup: './vitest.global-setup.ts',
      setupFiles: './vitest.setup.ts',
      dir: 'src',
      include: ['**/*.spec.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      environment: 'happy-dom',
      coverage: {
        all: true,
        reportsDirectory: 'coverage',
      },
      silent: 'passed-only',
    },
  };
});
