import { useEffect, useState } from 'react';

import {
  mockedEditoastApi,
  type PrivilegesByGrant,
  type ResourceType,
} from 'common/api/mock/mockEditoastApi';

/**
 * provides the user grants on a list of resources
 * @param payload the resource type and the resource ids
 * @returns the user grants on the resources
 */
const useUserResourcesGrants = (payload: Map<ResourceType, number[]>) => {
  const [grantTreeByResourceType, setGrantTreeByResourceType] = useState<
    Map<ResourceType, PrivilegesByGrant>
  >(new Map());
  const [fetchUserGrantByResourceId, { data: currentUserGrants }] =
    mockedEditoastApi.endpoints.postUserResourcesGrants.useMutation();
  const [getGrantsByResourceType] =
    mockedEditoastApi.endpoints.getGrantsByResourceType.useLazyQuery();

  useEffect(() => {
    const getUserGrantByResourceId = async () => {
      try {
        const validPayload = Array.from(payload.entries()).reduce<
          Partial<Record<ResourceType, number[]>>
        >((acc, [resourceType, ids]) => {
          if (ids.length > 0) {
            acc[resourceType] = ids;
          }
          return acc;
        }, {});

        if (Object.keys(validPayload).length > 0) {
          await fetchUserGrantByResourceId(validPayload);
        }
      } catch (error) {
        console.error(error);
      }
    };

    const fetchGrantTreeByResourceType = async () => {
      const newGrantTreeByResourceType = new Map<ResourceType, PrivilegesByGrant>();
      await Promise.all(
        Array.from(payload.keys()).map(async (resourceType) => {
          const { data } = await getGrantsByResourceType(resourceType);
          newGrantTreeByResourceType.set(resourceType, data!);
        })
      );
      setGrantTreeByResourceType(newGrantTreeByResourceType);
    };

    getUserGrantByResourceId();
    fetchGrantTreeByResourceType();
  }, [payload]);

  return {
    grantTreeByResourceType,
    currentUserGrants,
  };
};

export default useUserResourcesGrants;
