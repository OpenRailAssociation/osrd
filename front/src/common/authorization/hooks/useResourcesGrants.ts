import { useEffect } from 'react';

import { mockedEditoastApi, type ResourceType } from 'common/api/mock/mockEditoastApi';

/**
 * provides the user grants on a list of resources
 * @param payload the resource type and the resource ids
 * @returns the user grants on the resources
 */
const useResourcesGrants = (payload: Partial<Record<ResourceType, number[]>>) => {
  const [fetchUserGrantByResourceId, { data: userResourcesGrants }] =
    mockedEditoastApi.endpoints.postUserResourcesGrants.useMutation();

  useEffect(() => {
    const getUserGrantByResourceId = async () => {
      try {
        await fetchUserGrantByResourceId(payload);
      } catch (error) {
        console.error(error);
      }
    };
    getUserGrantByResourceId();
  }, [payload, fetchUserGrantByResourceId]);

  return userResourcesGrants;
};

export default useResourcesGrants;
