import type { APIRequestContext } from '@playwright/test';

import type {
  GetAuthzGroupsApiResponse,
  PostAuthzUserInfoApiResponse,
  ResourceType,
  RollingStock,
  StandardGrant,
} from 'common/api/osrdEditoastApi';

import { E2E_IDENTITIES, type E2E_USERS } from '../assets/constants/permission-const';
import { getApiContext, handleErrorResponse } from './api-utils';
import { readJsonFile } from './file-utils';

export type E2EUser = keyof typeof E2E_USERS;

/**
 * Run the callback with an API context sending the requests on behalf of the given e2e user,
 * or of the admin when no user is given.
 */
async function withApiContext<T>(
  user: E2EUser | undefined,
  callback: (apiContext: APIRequestContext) => Promise<T>
): Promise<T> {
  const apiContext = await getApiContext(user && E2E_IDENTITIES[user]);
  try {
    return await callback(apiContext);
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Get the ids of the given e2e users.
 *
 * @param users - The e2e users to look up.
 * @returns {Promise<Record<E2EUser, number>>} - The id of each user.
 */
export async function getE2EUserIds<U extends E2EUser>(users: U[]): Promise<Record<U, number>> {
  return withApiContext(undefined, async (apiContext) => {
    const response = await apiContext.post('/api/authz/user/info', {
      data: { identities: users.map((user) => E2E_IDENTITIES[user]) },
    });
    handleErrorResponse(response, 'Failed to fetch the e2e users');
    const usersInfo = (await response.json()) as PostAuthzUserInfoApiResponse;
    return Object.fromEntries(
      users.map((user) => [
        user,
        usersInfo.find(({ identities }) => identities.includes(E2E_IDENTITIES[user]))!.id,
      ])
    ) as Record<U, number>;
  });
}

/**
 * Get the id of a group by its name.
 *
 * @param groupName - The name of the group.
 * @returns {Promise<number>} - The id of the group.
 */
export async function getGroupId(groupName: string): Promise<number> {
  return withApiContext(undefined, async (apiContext) => {
    const response = await apiContext.get('/api/authz/groups');
    handleErrorResponse(response, 'Failed to fetch the groups');
    const groups = (await response.json()) as GetAuthzGroupsApiResponse;
    const group = groups.find(({ name }) => name === groupName);
    if (!group) throw new Error(`Group "${groupName}" not found`);
    return group.id;
  });
}

/**
 * Give a grant on a resource to a user or a group.
 *
 * @param grant - The resource, the subject (user or group id) and the grant to give.
 * @param grantedBy - Optional. The e2e user giving the grant, the admin by default.
 */
export async function grantAccess(
  {
    resourceType,
    resourceId,
    subjectId,
    grant,
  }: { resourceType: ResourceType; resourceId: number; subjectId: number; grant: StandardGrant },
  grantedBy?: E2EUser
): Promise<void> {
  await withApiContext(grantedBy, async (apiContext) => {
    const response = await apiContext.post('/api/authz/grants', {
      data: {
        grant: [
          {
            resource_type: resourceType,
            resource_id: resourceId,
            subject_id: subjectId,
            grant,
          },
        ],
      },
    });
    handleErrorResponse(response, `Failed to grant ${grant} on ${resourceType} ${resourceId}`);
  });
}

/**
 * Create a rolling stock on behalf of an e2e user, who becomes its owner.
 *
 * @param name - The name of the rolling stock.
 * @param owner - The e2e user creating the rolling stock.
 * @returns {Promise<RollingStock>} - The created rolling stock.
 */
export async function createRollingStockAs(name: string, owner: E2EUser): Promise<RollingStock> {
  const rollingStockJson = readJsonFile<object>(
    './tests/assets/rolling-stock/fast_rolling_stock.json'
  );
  return withApiContext(owner, async (apiContext) => {
    const response = await apiContext.post('/api/rolling_stock', {
      data: { ...rollingStockJson, name },
    });
    handleErrorResponse(response, `Failed to create rolling stock "${name}"`);
    return (await response.json()) as RollingStock;
  });
}

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
  await withApiContext(user, async (apiContext) => {
    const response = await apiContext.patch(`/api/rolling_stock/${rollingStockId}/locked`, {
      data: { locked },
    });
    handleErrorResponse(response, `Failed to set locked=${locked} on rolling stock`);
  });
}

/**
 * Unlock and delete a rolling stock as admin, even if it is used.
 * Does nothing if the rolling stock has already been deleted.
 *
 * @param rollingStockId - The id of the rolling stock.
 */
export async function forceDeleteRollingStock(rollingStockId: number): Promise<void> {
  await withApiContext(undefined, async (apiContext) => {
    const unlockResponse = await apiContext.patch(`/api/rolling_stock/${rollingStockId}/locked`, {
      data: { locked: false },
    });
    if (unlockResponse.status() === 404) return;
    handleErrorResponse(unlockResponse, 'Failed to unlock the rolling stock');

    const deleteResponse = await apiContext.delete(`/api/rolling_stock/${rollingStockId}`, {
      params: { force: true },
    });
    handleErrorResponse(deleteResponse, 'Failed to delete the rolling stock');
  });
}
