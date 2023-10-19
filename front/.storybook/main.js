import { mergeConfig } from 'vite';

module.exports = {
  "stories": ["../src/stories/*.mdx", "../src/stories/*.stories.@(js|jsx|ts|tsx)"],
  "addons": ["@storybook/addon-links", "@storybook/addon-essentials", "@storybook/addon-interactions", "storybook-addon-performance"],
  "framework": {
    name: "@storybook/react-vite",
    options: {}
  },
  "features": {
    "storyStoreV7": true
  },
  typescript: { reactDocgen: 'none' },
  docs: {
    autodocs: true
  },
  async viteFinal(config) {
    // Merge custom configuration into the default config
    return mergeConfig(config, {
      // Add storybook-specific dependencies to pre-optimization
      build: {
        sourcemap: false,
      },
      optimizeDeps: {
        include: ['storybook-addon-designs'],
      },
    });
  },
};