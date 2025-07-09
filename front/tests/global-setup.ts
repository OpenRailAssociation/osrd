import { test as setup } from '@playwright/test';

import ROLLING_STOCK_NAMES, {
  globalProjectName,
  timetableItemProjectName,
} from './assets/constants/project-const';
import { logger } from './logging-fixture';
import { createDataForTests } from './utils/setup-utils';
import { deleteProject, deleteRollingStocks } from './utils/teardown-utils';

setup('setup', async () => {
  logger.info('Starting test data setup ...');

  await Promise.all([deleteProject(timetableItemProjectName), deleteProject(globalProjectName)]);
  await deleteRollingStocks(ROLLING_STOCK_NAMES);

  await createDataForTests();
});
