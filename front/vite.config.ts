/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import svgrPlugin from 'vite-plugin-svgr';
import ImportMetaEnvPlugin from '@import-meta-env/unplugin';
import checker from 'vite-plugin-checker';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
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
          lintCommand: 'eslint --ext .ts,.tsx,.js,.jsx src --max-warnings 203',
        },
        overlay: env.OSRD_VITE_OVERLAY !== 'false' && {
          initialIsOpen: env.OSRD_VITE_OVERLAY_OPEN_BY_DEFAULT === 'true',
        },
      }),
    ],
    build: {
      outDir: 'build',
    },
    server: {
      open: true,
      port: +env.OSRD_VITE_PORT || 3000,
    },
    test: {
      globals: true,
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      environment: 'happy-dom',
      coverage: {
        reportsDirectory: './tests/unit/coverage',
      },
    },
  };
});
