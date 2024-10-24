import { test as setup } from '@playwright/test';

import { createDataForTests } from './utils/setup-utils';
import { deleteInfra, deleteProject, deleteRollingStocks } from './utils/teardown-utils';

setup('setup', async () => {
  console.info('Starting test data setup ...');
  await Promise.all([
    deleteInfra('small_infra_test_e2e'),
    deleteProject('project_test_e2e'),
    deleteRollingStocks([
      'electric_rolling_stock_test_e2e',
      'dual-mode_rolling_stock_test_e2e',
      'slow_rolling_stock_test_e2e',
      'fast_rolling_stock_test_e2e',
      'improbable_rolling_stock_test_e2e',
    ]),
  ]);
  await createDataForTests();
});
