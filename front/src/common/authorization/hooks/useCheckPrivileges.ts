import { useMemo } from 'react';

import { mockedEditoastApi, type ResourceType } from 'common/api/mock/mockEditoastApi';

import useResourcesGrants from './useResourcesGrants';
import checkPrivileges, {
  type authorizationRequirement,
  type checkPrivilegesParams,
} from '../utils/checkPrivileges';

type useCheckPrivilegesParams = {
  resourceId?: number;
  resourceType: ResourceType;
} & authorizationRequirement;

/**
 * Custom hook to check user privileges for a specific resource.
 *
 * @param {useCheckPrivilegesParams} params - The parameters for checking privileges.
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
  requiredPrivileges,
}: useCheckPrivilegesParams) => {
  const { data: availableGrantsOnResource } =
    mockedEditoastApi.endpoints.getGrantsByResourceType.useQuery(resourceType);

  const resourcePayload = useMemo(
    () => (resourceId ? { [resourceType]: [resourceId] } : {}),
    [resourceType, resourceId]
  );
  const grantByResourceType = useResourcesGrants(resourcePayload);

  const userGrant = grantByResourceType?.[resourceType]?.[0].grant || 'NONE';

  return checkPrivileges({
    resourceGrants: availableGrantsOnResource as checkPrivilegesParams['resourceGrants'],
    userGrant,
    ...(requiredGrant ? { requiredGrant } : { requiredPrivileges }),
  });
};

export default useCheckPrivileges;
