import { test as setup } from '@playwright/test';

import ROLLING_STOCK_NAMES, {
  globalProjectName,
  trainScheduleProjectName,
} from './assets/constants/project-const';
import { logger } from './logging-fixture';
import { createE2eUsers, deleteE2eUsers } from './utils/api-utils';
import { createDataForTests } from './utils/setup-utils';
import { deleteProject, deleteRollingStocks } from './utils/teardown-utils';

setup('setup', async () => {
  logger.info('Starting test data setup ...');

  await Promise.all([
    deleteProject(trainScheduleProjectName),
    deleteProject(globalProjectName),
    deleteE2eUsers(),
  ]);
  await deleteRollingStocks(ROLLING_STOCK_NAMES);

  await createE2eUsers();
  await createDataForTests();

  logger.info('Test data setup completed successfully');
});
