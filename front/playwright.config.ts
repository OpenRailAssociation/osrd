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
  timeout: 60 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Opt out of parallel tests on CI based on cpu capacity */
  workers: '50%',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 3 : 0,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    headless: true, // Run tests in headless mode
    viewport: { width: 1280, height: 720 }, // Set the viewport size
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:4000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    locale: 'fr',
    video: 'retain-on-failure',
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
        headless: false, // Enable GPU acceleration by running in headful mode
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-popup-blocking',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-infobars',
            '--start-maximized',
            '--no-default-browser-check',
            '--disable-gpu', // Ensure GPU is not disabled
          ],
          firefoxUserPrefs: {
            'pdfjs.disabled': false, // Enable PDF viewer
            'dom.popup_allowed_events': 'click dblclick mousedown pointerdown', // Allow pop-ups
            'dom.webnotifications.enabled': true, // Enable web notifications
            'permissions.default.geo': 1, // Enable geolocation
          },
        },
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: {
        browserName: 'webkit',
      },
      dependencies: ['setup'],
    },
  ],
});
