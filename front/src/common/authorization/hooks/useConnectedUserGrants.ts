import { useEffect } from 'react';

import { mockedEditoastApi, type ResourceType } from 'common/api/mock/mockEditoastApi';

/**
 * provides the user grants on a list of resources
 * @param payload the resource type and the resource ids
 * @returns the user grants on the resources
 */
const useConnectedUserGrants = (payload: Partial<Record<ResourceType, number[]>>) => {
  const [fetchUserGrantByResourceId, { data: userResourcesGrants }] =
    mockedEditoastApi.endpoints.postUserResourcesGrants.useMutation();

  // TODO: Adapt this query to fetch the grants for multiple resource types
  const { data: resourceGrants } =
    mockedEditoastApi.endpoints.getGrantsByResourceType.useQuery('infra');

  useEffect(() => {
    const getUserGrantByResourceId = async () => {
      try {
        const validPayload = Object.entries(payload).reduce<
          Partial<Record<ResourceType, number[]>>
        >((acc, [resourceType, ids]) => {
          if (ids.length > 0) {
            acc[resourceType as ResourceType] = ids;
          } else {
            console.error(`No ids found for this resource_type: ${resourceType}`);
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

    getUserGrantByResourceId();
  }, [payload]);

  return {
    resourceGrants,
    userResourcesGrants,
  };
};

export default useConnectedUserGrants;
