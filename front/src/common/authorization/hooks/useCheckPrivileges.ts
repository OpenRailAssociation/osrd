import { type ResourceType } from 'common/api/mock/mockEditoastApi';

import type { AuthorizationRequirement } from '../utils/checkPrivileges';

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

// TODO: Uncomment this function when permissions are fully implemented
// const useCheckPrivileges = ({
//   resourceType,
//   resourceId,
//   requiredGrant,
//   requiredPrivileges = [],
// }: UseCheckPrivilegesParams) => {
//   const { data: availableGrantsOnResource } =
//     mockedEditoastApi.endpoints.getGrantsByResourceType.useQuery(resourceType);

//   const resourcePayload = useMemo(
//     () => (resourceId ? { [resourceType]: [resourceId] } : {}),
//     [resourceType, resourceId]
//   );
//   const { userResourcesGrants } = useResourcesGrants(resourcePayload);

//   const userGrant = userResourcesGrants?.[resourceType]?.[0].grant || 'NONE';

//   return checkPrivileges({
//     resourceGrants: availableGrantsOnResource as CheckPrivilegesParams['resourceGrants'],
//     userGrant,
//     ...(requiredGrant ? { requiredGrant } : { requiredPrivileges }),
//   });
// };

// eslint-disable-next-line no-empty-pattern
const useCheckPrivileges = ({}: UseCheckPrivilegesParams): boolean => true;

export default useCheckPrivileges;
