import { test as setup } from '@playwright/test';

import type { Infra, Project, RollingStock } from 'common/api/osrdEditoastApi';

import { deleteApiRequest, getApiRequest } from './utils/index';

setup('teardown', async () => {
  const infras = await getApiRequest(`/api/infra/`);
  const infra = infras.results.find((i: Infra) => i.name === 'small_infra_test_e2e');

  const projects = await getApiRequest(`/api/projects/`);
  const project = projects.results.find((p: Project) => p.name === 'project_test_e2e');

  const rollingStocks = await getApiRequest(`/api/light_rolling_stock/`, { page_size: 500 });
  const rollingStock: RollingStock = await rollingStocks.results.find(
    (r: RollingStock) => r.name === 'rollingstock_1500_25000_test_e2e'
  );

  await deleteApiRequest(`/api/infra/${infra.id}/`);
  await deleteApiRequest(`/api/projects/${project.id}/`);
  await deleteApiRequest(`/api/rolling_stock/${rollingStock.id}/`);
});
