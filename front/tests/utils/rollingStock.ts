import type { RollingStock } from 'common/api/osrdEditoastApi';

import { deleteApiRequest, getApiRequest, postApiRequest } from './api-setup';

// Add a rolling Stock
export async function addRollingStock(rollingStockName: string, rollingStockJson: JSON) {
  await postApiRequest('/api/rolling_stock/', {
    ...rollingStockJson,
    name: rollingStockName,
  });
}
// Find and delete rolling stock with the given name
export async function findAndDeleteRollingStocksByName(rollingStockNames: string[]) {
  const rollingStocks = await getApiRequest(`/api/light_rolling_stock/`, { page_size: 500 });

  const deleteRequests = rollingStockNames.map(async (name) => {
    const rollingStockToDelete = rollingStocks.results.find((r: RollingStock) => r.name === name);
    if (rollingStockToDelete) {
      await deleteApiRequest(`/api/rolling_stock/${rollingStockToDelete.id}/`);
    }
  });

  await Promise.all(deleteRequests);
}
