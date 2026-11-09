import type {
  GetAuthzGroupsApiResponse,
  GrantBody,
  PostAuthzUserInfoApiResponse,
  ResourceType,
  StandardGrant,
} from 'common/api/osrdEditoastApi';

import type { E2EUser } from '../assets/constants/permission-const';
import { getApiContext, getApiRequest, handleErrorResponse, postApiRequest } from './api-utils';

export type E2EGrant = {
  /** An e2e user, or the name of a group */
  subject: E2EUser | string;
  grant: StandardGrant;
};

/**
 * Retrieve the subject id of an e2e user.
 *
 * @param user - The e2e user.
 * @returns The subject id, or `undefined` if the user doesn't exist.
 */
export async function findUserSubjectId(user: E2EUser): Promise<number | undefined> {
  const apiContext = await getApiContext();
  try {
    const response = await apiContext.post('/api/authz/user/info', {
      data: { ids: [], identities: [user.identity] },
    });
    if (response.status() === 404) return undefined;
    handleErrorResponse(response, `Failed to retrieve the user "${user.name}"`);
    const [userInfo] = (await response.json()) as PostAuthzUserInfoApiResponse;
    return userInfo?.id;
  } finally {
    await apiContext.dispose();
  }
}

/**
 * Retrieve the subject id of an e2e user, failing if the user doesn't exist.
 *
 * @param user - The e2e user.
 */
async function getUserSubjectId(user: E2EUser): Promise<number> {
  const id = await findUserSubjectId(user);
  if (id === undefined) {
    throw new Error(`User "${user.identity}" not found, run scripts/load-e2e-users.sh`);
  }
  return id;
}

/**
 * Retrieve the subject id of a group by its name.
 *
 * @param groupName - The name of the group.
 */
async function getGroupSubjectId(groupName: string): Promise<number> {
  const groups = await getApiRequest<GetAuthzGroupsApiResponse>('/api/authz/groups');
  const group = groups.find(({ name }) => name === groupName);
  if (!group) throw new Error(`Group "${groupName}" not found`);
  return group.id;
}

/**
 * Give grants on one or several resources of the same type as admin, in a single request.
 *
 * @param resourceType - The type of the resources.
 * @param resourceIds - The id of the resource, or the ids of the resources.
 * @param grants - The subjects and the grants they receive on each resource.
 */
export async function addGrants(
  resourceType: ResourceType,
  resourceIds: number | number[],
  grants: E2EGrant[]
): Promise<void> {
  const ids = Array.isArray(resourceIds) ? resourceIds : [resourceIds];
  const subjectGrants = await Promise.all(
    grants.map(async ({ subject, grant }) => ({
      grant,
      subject_id:
        typeof subject === 'string'
          ? await getGroupSubjectId(subject)
          : await getUserSubjectId(subject),
    }))
  );
  const grantBodies: GrantBody[] = ids.flatMap((resourceId) =>
    subjectGrants.map(({ grant, subject_id }) => ({
      grant,
      subject_id,
      resource_id: resourceId,
      resource_type: resourceType,
    }))
  );
  await postApiRequest(
    '/api/authz/grants',
    { grant: grantBodies },
    undefined,
    `Failed to give grants on ${resourceType} ${ids.join(', ')}`,
    false
  );
}
