import { useEffect, useState } from 'react';

import type { Privilege, ResourceType } from '../types';
import useAuthz from './useAuthz';

type UseCheckUserPrivilegesParams = {
  resourceType: ResourceType;
  resourceId?: number;
  privileges: Privilege[];
};

/**
 *
 * Hook to check if the connected user has the specified privileges.
 */
export default function useCheckUserPrivileges({
  resourceType,
  resourceId,
  privileges,
}: UseCheckUserPrivilegesParams) {
  const { checkUserPrivileges } = useAuthz();
  const [hasPrivileges, setHasPrivileges] = useState(false);

  useEffect(() => {
    if (!resourceId) setHasPrivileges(false);
    else {
      checkUserPrivileges(resourceType, resourceId, privileges)
        .then((result) => setHasPrivileges(result))
        .catch((error) => {
          console.error('Error checking user privileges:', error);
          setHasPrivileges(false);
        });
    }
  }, [checkUserPrivileges, resourceType, resourceId, JSON.stringify(privileges)]);

  return hasPrivileges;
}
