import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: [
    '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-storysource',
  ],
  framework: '@storybook/react-vite',
  typescript: {
    check: true,
  },
  docs: {
    autodocs: 'tag',
  },
  staticDirs: ['../public'],
  logLevel: 'debug',
};
export default config;
