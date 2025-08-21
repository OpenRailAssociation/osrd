import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  timeout: 60_000,
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001 },
    timeout: 10_000,
  },

  fullyParallel: true,
  workers: '50%',
  forbidOnly: !!process.env.CI,
  retries: 1,
  use: {
    navigationTimeout: 30_000,
    actionTimeout: 10_000,
    baseURL: process.env.BASE_URL || 'http://localhost:4000',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    locale: 'fr',
    timezoneId: 'Europe/Paris',
  },
  reporter: [
    [
      './tests/reporter/generate-personalized-report.ts',
      {
        minimal: false,
        testType: 'e2e',
      },
    ],
    ['line'],
    ['html'],
  ],

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
