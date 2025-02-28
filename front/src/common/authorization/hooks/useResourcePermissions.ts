import { useEffect, useState } from 'react';

import { mockedEditoastApi, type Grant, type ResourceType } from 'common/api/mock/mockEditoastApi';

/**
 * provides the user grant and privileges on a resource
 * @param resourceType the type of the resource
 * @param resourceId the id of the resource
 * @returns the user grant and the resource grants
 */
const useResourcePermissions = (resourceType: ResourceType, resourceId?: number) => {
  const { data: resourceGrants } =
    mockedEditoastApi.endpoints.getGrantsByResourceType.useQuery(resourceType);

  const [userGrant, setUserGrant] = useState<Grant>('NONE');
  const [fetchUserGrantByResourceId] =
    mockedEditoastApi.endpoints.postUserResourcesGrants.useMutation();

  useEffect(() => {
    if (!resourceGrants && !resourceId) return;

    fetchUserGrantByResourceId({ [resourceType]: [resourceId!] })
      .unwrap()
      .then((data) => {
        const { grant } = data[resourceType][0];
        setUserGrant(grant);
      })
      .catch(() => setUserGrant('NONE'));
  }, [resourceType, resourceId, resourceGrants]);

  return {
    userGrant,
    resourceGrants,
  };
};

export default useResourcePermissions;
