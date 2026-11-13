import type { APIRequestContext } from '@playwright/test';

import type { E2EUser } from '../assets/constants/permission-const';
import { deleteApiRequest, getApiContext, handleErrorResponse } from './api-utils';

const patchRollingStockLocked = (
  apiContext: APIRequestContext,
  rollingStockId: number,
  locked: boolean
) => apiContext.patch(`/api/rolling_stock/${rollingStockId}/locked`, { data: { locked } });

/**
 * Lock or unlock a rolling stock on behalf of an e2e user.
 *
 * @param rollingStockId - The id of the rolling stock.
 * @param locked - The new locked value.
 * @param user - The e2e user locking the rolling stock.
 */
export async function setRollingStockLocked(
  rollingStockId: number,
  locked: boolean,
  user: E2EUser
): Promise<void> {
  const apiContext = await getApiContext(user.identity);
  try {
    const response = await patchRollingStockLocked(apiContext, rollingStockId, locked);
    handleErrorResponse(response, `Failed to set locked=${locked} on rolling stock`);
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Unlock a rolling stock as admin.
 * Does nothing if the rolling stock has already been deleted.
 *
 * @param rollingStockId - The id of the rolling stock.
 */
export async function unlockRollingStock(rollingStockId: number): Promise<void> {
  const apiContext = await getApiContext();
  try {
    const response = await patchRollingStockLocked(apiContext, rollingStockId, false);
    if (response.status() === 404) return;
    handleErrorResponse(response, 'Failed to unlock the rolling stock');
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Delete a rolling stock as admin, even if it is used. The rolling stock must be unlocked.
 * Does nothing if the rolling stock has already been deleted.
 *
 * @param rollingStockId - The id of the rolling stock.
 */
export async function forceDeleteRollingStock(rollingStockId: number): Promise<void> {
  await deleteApiRequest(
    `/api/rolling_stock/${rollingStockId}`,
    'Failed to delete the rolling stock',
    { params: { force: true }, ignoreNotFound: true }
  );
}
