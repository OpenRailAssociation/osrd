import { test as teardown } from '@playwright/test';

import { deleteInfra, deleteProject, deleteRollingStocks } from './utils/teardown-utils';

teardown('teardown', async () => {
  try {
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
    console.info('Test data teardown completed successfully.');
  } catch (error) {
    console.error('Error during test data teardown:', error);
  }
});
