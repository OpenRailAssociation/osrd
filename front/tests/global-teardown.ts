import fs from 'fs';

import { test as teardown } from '@playwright/test';

import ROLLING_STOCK_NAMES, {
  globalProjectName,
  timetableItemProjectName,
} from './assets/constants/project-const';
import { logger } from './logging-fixture';
import { deleteApiRequest, deleteStdcmEnvironment, listStdcmEnvironment } from './utils/api-utils';
import { deleteProject, deleteRollingStocks } from './utils/teardown-utils';

teardown('teardown', async ({ browser }) => {
  try {
    logger.info('Starting test data teardown...');

    // Delete projects and rolling stocks
    await deleteProject(timetableItemProjectName);
    await deleteProject(globalProjectName);
    await deleteRollingStocks(ROLLING_STOCK_NAMES);

    // Delete saved files in the results directory
    fs.rmSync('./tests/stdcm-results', { recursive: true, force: true });
    logger.info('All downloaded files have been removed from the results directory.');

    // Close all browser contexts
    await Promise.all(browser.contexts().map((context) => context.close()));
    logger.info('All browser contexts closed successfully.');

    // Delete all stdcm search environments which are using the current test infra
    const testStdcmEnvs = (await listStdcmEnvironment()).filter(
      (env) => env.infra_id === Number(process.env.TEST_INFRA_ID)
    );
    for (const env of testStdcmEnvs) {
      await deleteStdcmEnvironment(env.id);
    }

    // Delete infra
    await deleteApiRequest(`/api/infra/${process.env.TEST_INFRA_ID}`);

    logger.info('Test data teardown completed successfully.');
  } catch (error) {
    throw new Error('Error during test data teardown', { cause: error });
  }
});
