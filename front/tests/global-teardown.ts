import { test as setup } from '@playwright/test';

import type { Infra, Project, RollingStock } from 'common/api/osrdEditoastApi';

import { deleteApiRequest, getApiRequest } from './utils/api-setup';

setup('teardown', async () => {
  // Fetch infra and projects in parallel
  const [infras, projects] = await Promise.all([
    getApiRequest('/api/infra/'),
    getApiRequest('/api/projects/'),
  ]);

  const infra = infras.results.find((i: Infra) => i.name === 'small_infra_test_e2e');
  const project = projects.results.find((p: Project) => p.name === 'project_test_e2e');

  // Fetch rolling stocks
  const rollingStocks = await getApiRequest('/api/light_rolling_stock/', { page_size: 500 });

  // Find specific rolling stocks
  const rollingStockNames = [
    'rollingstock_1500_25000_test_e2e',
    'dual-mode_rollingstock_test_e2e',
    'slow_rolling_stock_test_e2e',
    'fast_rolling_stock_test_e2e',
  ];

  const rollingStockIds: number[] = rollingStocks.results
    .filter((r: RollingStock) => rollingStockNames.includes(r.name))
    .map((r: RollingStock) => r.id);

  // Collect all delete requests
  const deleteRequests = [
    deleteApiRequest(`/api/infra/${infra.id}/`),
    deleteApiRequest(`/api/projects/${project.id}/`),
    ...rollingStockIds.map((id: number) => deleteApiRequest(`/api/rolling_stock/${id}/`)),
  ];

  // Execute all delete requests in parallel
  await Promise.all(deleteRequests);
});
