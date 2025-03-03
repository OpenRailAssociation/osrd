import fs from 'fs';

import { test as teardown } from '@playwright/test';

import ROLLING_STOCK_NAMES, {
  globalProjectName,
  infrastructureName,
  trainScheduleProjectName,
} from './assets/constants/project-const';
import { logger } from './logging-fixture';
import { setStdcmEnvironment } from './utils/api-utils';
import { deleteInfra, deleteProject, deleteRollingStocks } from './utils/teardown-utils';

teardown('teardown', async ({ browser }) => {
  try {
    logger.info('Starting test data teardown...');

    // Delete projects and rolling stocks
    await deleteProject(trainScheduleProjectName);
    await deleteProject(globalProjectName);
    await deleteRollingStocks(ROLLING_STOCK_NAMES);

    // Delete saved files in the results directory
    fs.rmSync('./tests/stdcm-results', { recursive: true, force: true });
    logger.info('All downloaded files have been removed from the results directory.');

    // Close all browser contexts
    await Promise.all(browser.contexts().map((context) => context.close()));
    logger.info('All browser contexts closed successfully.');

    // Restore STDCM environment
    const savedEnvironment = process.env.STDCM_ENVIRONMENT
      ? JSON.parse(process.env.STDCM_ENVIRONMENT)
      : null;

    if (savedEnvironment) {
      await setStdcmEnvironment(savedEnvironment);
      logger.info('STDCM environment restored successfully.');
    } else {
      logger.warn('No STDCM environment to restore.');
    }

    fs.rmSync('./tests/test-saved-environment/savedStdcmEnvironment.json', {
      recursive: true,
      force: true,
    });

    // Delete infra, unless it is currently used as a foreign key by the stdcm env in the database
    if (savedEnvironment && savedEnvironment.infra_id !== Number(process.env.TEST_INFRA_ID))
      await deleteInfra(infrastructureName);

    logger.info('Test data teardown completed successfully.');
  } catch (error) {
    throw new Error('Error during test data teardown', { cause: error });
  }
});
