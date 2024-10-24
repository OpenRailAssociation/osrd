import { defineConfig, devices } from '@playwright/test';
/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',

  /* Maximum time one test can run for. */
  timeout: process.env.CI ? 90 * 1000 : 180 * 1000, // 90 seconds in CI, otherwise 180 seconds
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     */
    timeout: process.env.CI ? 10 * 1000 : 30 * 1000, // 10 seconds in CI, otherwise 30 seconds
  },

  /* Run tests in files in parallel */
  fullyParallel: true,
  /*
   * Limit parallelism in CI based on CPU capacity,
   * running 50% of the available workers when in CI.
   * Otherwise, run tests with a single worker.
   */
  workers: process.env.CI ? '50%' : 1,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry up to 2 times on CI, and 1 time otherwise */
  retries: process.env.CI ? 2 : 1,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:4000',

    /* Collect trace and video when retrying the first failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    video: 'on-first-retry',

    locale: 'fr',
  },
  reporter: process.env.CI ? 'github' : [['line'], ['html']],

  /* Configure projects for major browsers */
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
    {
      name: 'webkit',
      use: {
        browserName: 'webkit',
        launchOptions: {
          slowMo: 150, // Slows down WebKit interactions by 150 milliseconds
        },
      },
      dependencies: ['setup'],
    },
  ],
});
