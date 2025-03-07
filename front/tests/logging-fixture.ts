import { test as baseTest, type Page } from '@playwright/test';

// Simple logger
export const logger = {
  // eslint-disable-next-line no-console
  info: (message: string) => console.log(`[INFO] ${message}`),
  error: (message: string, error?: unknown) => console.error(`[ERROR] ${message}`, error),
  warn: (message: string) => console.warn(`[WARN] ${message}`),
};

// Extend baseTest with logging inside the test hooks
const testWithLogging = baseTest.extend<{ page: Page }>({
  page: async ({ page, browserName }, use, testInfo) => {
    const startTime = Date.now(); // Record the start time

    // Log before the test starts
    logger.info(`START: '${testInfo.title}' | Browser: ${browserName}`);

    // Handle uncaught exceptions
    page.on('pageerror', (exception) => {
      throw new Error(`Test failed due to uncaught exception: "${exception}"`);
    });

    // Run the actual test
    await use(page);

    // Calculate the duration
    const duration = Math.round((Date.now() - startTime) / 1000); // Convert to seconds and round

    // Log after the test ends
    const status = testInfo.status === 'passed' ? 'SUCCESS' : 'FAILED';
    logger.info(
      `END: '${testInfo.title}' | Status: ${status} | Browser: ${browserName} | Duration: ${duration} s`
    );

    // If the test failed, log the error
    if (testInfo.status === 'failed') {
      logger.error(`ERROR: '${testInfo.title}' | ${testInfo.error?.message}`);
    }
  },
});

export default testWithLogging;
