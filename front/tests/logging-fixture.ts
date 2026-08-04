import { test as baseTest, type Page, type Request, type Response } from '@playwright/test';

// Simple logger
export const logger = {
  // eslint-disable-next-line no-console
  info: (message: string) => console.log(`[INFO] ${message}`),
  error: (message: string, error?: unknown) => console.error(`[ERROR] ${message}`, error),
  warn: (message: string) => console.warn(`[WARN] ${message}`),
};

function isCriticalApiRequest(url: string, resourceType: string): boolean {
  return (resourceType === 'xhr' || resourceType === 'fetch') && /\/api\//.test(url);
}

function isAbortError(errorText: string): boolean {
  return errorText === 'net::ERR_ABORTED' || errorText === 'NS_BINDING_ABORTED';
}

const testWithLogging = baseTest.extend<{ page: Page }>({
  page: async ({ page, browserName }, use, testInfo) => {
    const startTime = Date.now();
    const runtimeErrors: string[] = [];

    logger.info(`START: '${testInfo.title}' | Browser: ${browserName}`);

    const browserVersion = page.context().browser()?.version() ?? 'unknown';

    await testInfo.attach('metadata.json', {
      body: Buffer.from(
        JSON.stringify({ name: browserName, version: browserVersion }, null, 2),
        'utf-8'
      ),
      contentType: 'application/json',
    });

    const onPageError = (exception: Error) => {
      const message = `Uncaught page error:\n${exception.message}\n${exception.stack ?? ''}`;
      logger.error('🚨 Uncaught page error:', exception);
      runtimeErrors.push(message);
    };

    const onRequestFailed = (request: Request) => {
      const url = request.url();
      const type = request.resourceType();
      const errorText = request.failure()?.errorText ?? 'Unknown network error';

      const isAbort = isAbortError(errorText);
      const isCriticalApi = isCriticalApiRequest(url, type);

      if (isAbort || !isCriticalApi) return;

      runtimeErrors.push(`API request failed with "${errorText}"\n${url}`);
    };

    const onResponse = (response: Response) => {
      const url = response.url();
      const req = response.request();
      const type = req.resourceType();
      const status = response.status();
      const responseText = response.statusText();

      const isCriticalApi = isCriticalApiRequest(url, type);
      if (!isCriticalApi) return;

      if (status > 400) {
        runtimeErrors.push(`HTTP error ${status} on ${url}: ${responseText}`);
      }
    };

    page.on('pageerror', onPageError);
    page.on('requestfailed', onRequestFailed);
    page.on('response', onResponse);

    try {
      await use(page);
    } finally {
      page.removeListener('pageerror', onPageError);
      page.removeListener('requestfailed', onRequestFailed);
      page.removeListener('response', onResponse);

      const duration = Math.round((Date.now() - startTime) / 1000);
      const status = testInfo.status === 'passed' ? 'SUCCESS' : 'FAILED';

      logger.info(
        `END: '${testInfo.title}' | Status: ${status} | Browser: ${browserName} | Duration: ${duration} s`
      );

      if (testInfo.status === 'failed') {
        logger.error(`ERROR: '${testInfo.title}' | ${testInfo.error?.message}`);
      }
    }

    if (runtimeErrors.length > 0) {
      await testInfo.attach('runtime-errors.txt', {
        body: Buffer.from(runtimeErrors.join('\n\n---\n\n'), 'utf-8'),
        contentType: 'text/plain',
      });

      throw new Error(
        `Test failed because runtime errors were detected:\n\n${runtimeErrors.join('\n\n')}`
      );
    }
  },
});

export default testWithLogging;
