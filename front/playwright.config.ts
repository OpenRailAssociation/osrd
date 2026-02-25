import { defineConfig } from '@playwright/test';
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',

  timeout: isCI ? 60_000 : 120_000,
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001 },
    timeout: isCI ? 10_000 : 20_000,
  },

  fullyParallel: true,
  workers: isCI ? undefined : '30%',
  forbidOnly: isCI,
  retries: 1,
  use: {
    navigationTimeout: isCI ? 30_000 : 60_000,
    actionTimeout: 10_000,
    baseURL: process.env.BASE_URL || 'http://localhost:4000',
    locale: 'fr',
    timezoneId: 'Europe/Paris',
    viewport: { width: 1920, height: 1080 },

    screenshot: 'on-first-failure',
    trace: 'retain-on-first-failure',
    video: 'on-first-retry',
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
    ['html', { open: isCI ? 'never' : 'on-failure' }],
  ],

  projects: [
    { name: 'setup', testMatch: 'global-setup.ts', teardown: 'teardown' },
    { name: 'teardown', testMatch: 'global-teardown.ts' },
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
      },
      dependencies: ['setup'],
    },
  ],
});
