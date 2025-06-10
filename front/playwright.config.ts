import { defineConfig, devices } from '@playwright/test';

import { BASE_URL } from './tests/assets/constants/project-const';

export default defineConfig({
  testDir: './tests',

  timeout: 60_000,
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
    timeout: 10_000,
  },

  fullyParallel: true,
  workers: '50%',
  forbidOnly: !!process.env.CI,
  retries: 1,
  use: {
    navigationTimeout: 30_000,
    actionTimeout: 10_000,
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    locale: 'fr',
    timezoneId: 'Europe/Paris',
  },
  reporter: process.env.CI ? 'github' : [['line'], ['html']],

  projects: [
    { name: 'setup', testMatch: 'global-setup.ts', teardown: 'teardown' },
    {
      name: 'teardown',
      testMatch: 'global-teardown.ts',
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
      dependencies: ['setup'],
    },
  ],
});
