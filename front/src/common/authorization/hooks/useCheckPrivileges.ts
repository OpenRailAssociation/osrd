import { useMemo } from 'react';

import { mockedEditoastApi, type ResourceType } from 'common/api/mock/mockEditoastApi';

import useConnectedUserGrants from './useConnectedUserGrants';
import checkPrivileges, {
  type AuthorizationRequirement,
  type CheckPrivilegesParams,
} from '../utils/checkPrivileges';

type UseCheckPrivilegesParams = {
  resourceId?: number;
  resourceType: ResourceType;
} & AuthorizationRequirement;

/**
 * Custom hook to check user privileges for a specific resource.
 *
 * @param {UseCheckPrivilegesParams} params - The parameters for checking privileges.
 * @param {string} params.resourceType - The type of the resource.
 * @param {string} params.resourceId - The ID of the resource.
 * @param {string} [params.requiredGrant] - The required grant for the resource.
 * @param {string[]} [params.requiredPrivileges] - The required privileges for the resource.
 *
 * @returns {boolean} - Returns true if the user has the required privileges, otherwise false.
 */
const useCheckPrivileges = ({
  resourceType,
  resourceId,
  requiredGrant,
  requiredPrivileges = [],
}: UseCheckPrivilegesParams) => {
  const { data: availableGrantsOnResource } =
    mockedEditoastApi.endpoints.getGrantsByResourceType.useQuery(resourceType);

  const resourcePayload = useMemo(
    () => (resourceId ? { [resourceType]: [resourceId] } : {}),
    [resourceType, resourceId]
  );
  const { userResourcesGrants } = useConnectedUserGrants(resourcePayload);

  const userGrant = userResourcesGrants?.[resourceType]?.[0].grant || 'NONE';

  return checkPrivileges({
    resourceGrants: availableGrantsOnResource as CheckPrivilegesParams['resourceGrants'],
    userGrant,
    ...(requiredGrant ? { requiredGrant } : { requiredPrivileges }),
  });
};

export default useCheckPrivileges;
