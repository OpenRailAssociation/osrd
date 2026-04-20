import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';
import vitePluginChecker from 'vite-plugin-checker';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],

  addons: ['@storybook/addon-links', '@storybook/addon-docs'],
  framework: '@storybook/react-vite',

  staticDirs: ['../public'],
  logLevel: 'debug',

  async viteFinal(viteConfig) {
    return mergeConfig(viteConfig, {
      plugins: [
        {
          ...vitePluginChecker({
            typescript: true,
            oxlint: {
              lintCommand: 'oxlint -c ../../.oxlintrc.json',
            },
          }),
          apply: 'serve',
        },
      ],
    });
  },
};
export default config;
